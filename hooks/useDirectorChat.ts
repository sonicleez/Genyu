import { useCallback, useRef } from 'react';
import { ProjectState, AgentStatus, Scene, ProductionLogEntry } from '../types';
import { callGeminiText } from '../utils/geminiUtils';

// Memory for pending actions
interface PendingAction {
    type: string;
    sceneId?: string;
    sceneNumber?: number;
    directive?: string;
    timestamp: number;
}

interface UseDirectorChatProps {
    state: ProjectState;
    userApiKey: string | null;
    setAgentState: (agent: 'director' | 'dop', status: AgentStatus, message?: string, stage?: string) => void;
    addProductionLog: (sender: 'director' | 'dop' | 'user' | 'system', message: string, type?: string, stage?: string) => void;
    stopBatchGeneration: () => void;
    updateStateAndRecord: (updater: (s: ProjectState) => ProjectState) => void;
    handleGenerateAllImages: (specificSceneIds?: string[], referenceMap?: { [key: string]: string }, baseImageMap?: { [key: string]: string }) => Promise<void>;
    // Scene Management
    addScene: () => void;
    removeScene: (id: string) => void;
    insertScene: (index: number, initialData?: any) => string;
    // Clear functions
    onClearAllImages?: () => void;
}

export const useDirectorChat = ({
    state,
    userApiKey,
    setAgentState,
    addProductionLog,
    stopBatchGeneration,
    updateStateAndRecord,
    handleGenerateAllImages,
    addScene,
    removeScene,
    insertScene,
    onClearAllImages
}: UseDirectorChatProps) => {

    // Memory: Store pending action for continuation
    const pendingActionRef = useRef<PendingAction | null>(null);

    // Build conversation history from production logs
    const getConversationHistory = useCallback(() => {
        const logs = state.productionLogs || [];
        const recentLogs = logs.slice(-10); // Last 10 messages
        return recentLogs.map(log =>
            `[${log.sender.toUpperCase()}]: ${log.message}`
        ).join('\n');
    }, [state.productionLogs]);

    const recognizeIntent = useCallback(async (command: string) => {
        const conversationHistory = getConversationHistory();
        const pendingAction = pendingActionRef.current;

        const systemPrompt = `You are the AI Director of a film production system. 
Your task is to recognize the user's intent from their natural language command.

CURRENT PROJECT STATE:
- Scenes: ${state.scenes.length}
- Generated: ${state.scenes.filter(s => s.generatedImage).length}
- Characters: ${state.characters.map(c => c.name).join(', ')}
- Research Notes: ${state.researchNotes?.story || 'None'}
- Project Context: ${state.detailedScript?.substring(0, 500) || 'None'}...

RECENT CONVERSATION (IMPORTANT - Use this for context):
${conversationHistory || '(No prior conversation)'}

${pendingAction ? `PENDING ACTION (Waiting for confirmation):
- Type: ${pendingAction.type}
- Scene: ${pendingAction.sceneNumber || 'N/A'}
- Directive: ${pendingAction.directive || 'N/A'}
` : ''}



INTENTS:

1. PAUSE_BATCH: Stop current image generation.
2. REGENERATE_RANGE: Redo specific scenes (e.g. "Cảnh 54-60", "Cảnh 15").
3. UPDATE_STYLE: Change style for future (ungenerated) scenes.
4. PROD_Q_AND_A: Answer questions about the script, characters, or production status.
5. SYNERGY_DIRECTIVE: Give a technical instruction to the DOP (e.g. "cảnh 3 cho medium shot").
6. MATERIAL_INHERITANCE: Sample visual details or materials from one scene and apply to another.
7. SYNC_AND_REGENERATE: Fix a scene to match another scene's DNA AND regenerate it, optionally with extra instructions (e.g. "Sửa cảnh 2 giống cảnh 1 nhưng góc toàn", "Cảnh 3 tham chiếu cảnh 1, góc medium").
8. ADD_SCENE: Add new scene(s) (e.g. "Thêm 3 cảnh mới", "Thêm cảnh").

9. DELETE_SCENE: Delete specific scene(s) (e.g. "Xóa cảnh 5", "Xóa cảnh 10-15").
10. INSERT_SCENE: Insert scene at specific position (e.g. "Chèn cảnh sau cảnh 5").
11. CLEAR_ALL_IMAGES: Clear all generated images (e.g. "Xóa hết ảnh", "Clear ảnh").
12. UPDATE_SCENE_PROMPT: Edit a specific scene's prompt (e.g. "Sửa prompt cảnh 3 thành...").
13. EXECUTE_PENDING: User confirms to execute the SINGLE previously discussed action (e.g. "thực thi", "OK" after discussing a specific scene change). ONLY use if there is a PENDING ACTION.
14. COMPOSITE_OBJECT_TRANSFER: Take an object from one scene and add it to another scene (e.g. "tham chiếu cảnh 2, thêm chiếc cặp vào cảnh 1", "lấy cái túi từ cảnh 3 đặt lên bàn ở cảnh 1"). The TARGET scene (where object is added) should be EDITED, not regenerated. The SOURCE scene provides the object reference only.
15. GENERATE_ALL: Start batch generation for ALL ungenerated scenes (e.g. "bắt đầu tạo ảnh", "tạo ảnh hàng loạt", "generate all", "chạy production", "bắt đầu sản xuất", "tạo tất cả ảnh"). Use this when user wants to generate images for multiple/all scenes without specifying which ones.
16. GENERATE_SCENE: Generate image for a SPECIFIC scene (e.g. "tạo ảnh cảnh 5", "generate scene 10", "tạo ảnh cho cảnh này"). Use when user specifies exactly which scene to generate.

IMPORTANT RULES:
- If user says "bắt đầu tạo ảnh", "tạo ảnh", "chạy" WITHOUT specifying a scene number → use GENERATE_ALL
- If user says "tạo ảnh cảnh 5", "generate scene 10" → use GENERATE_SCENE with sceneNumber
- If user says "thực thi", "OK" AND there is a PENDING ACTION → use EXECUTE_PENDING
- For SYNERGY_DIRECTIVE about camera angles/shots: store the scene number and directive for later execution.

OUTPUT FORMAT: JSON only
{
  "intent": "INTENT_NAME",
  "entities": {
    "range": [start, end], // for REGENERATE_RANGE, DELETE_SCENE
    "sceneIds": ["id1", "id2"], // preferred if identifiable
    "styleInstruction": "string", // for UPDATE_STYLE
    "directive": "string", // for SYNERGY_DIRECTIVE
    "sourceSceneId": "string", // for MATERIAL_INHERITANCE
    "targetSceneId": "string", // for MATERIAL_INHERITANCE
    "count": number, // for ADD_SCENE
    "insertAfter": number, // for INSERT_SCENE (scene number)
    "sceneNumber": number, // for UPDATE_SCENE_PROMPT, SYNERGY_DIRECTIVE, EXECUTE_PENDING
    "newPrompt": "string", // for UPDATE_SCENE_PROMPT
    "visualDirective": "string", // Optional: If user provides visual description for new/inserted scene (e.g. "extreme closeup of hand").
    "referencePrevious": boolean, // Optional: true if user implies continuity with previous scene (e.g. "zoom in", "next shot").
    "sourceSceneNumber": number, // for COMPOSITE_OBJECT_TRANSFER: scene containing the object to extract
    "targetSceneNumber": number, // for COMPOSITE_OBJECT_TRANSFER: scene to EDIT (add object to)
    "objectDescription": "string" // for COMPOSITE_OBJECT_TRANSFER: description of the object to transfer (e.g. "chiếc cặp", "cái túi")
  },
  "response": "Brief professional acknowledgment in Vietnamese"
}`;



        try {
            const response = await callGeminiText(userApiKey || '', command, systemPrompt, 'gemini-2.5-flash', true);


            return JSON.parse(response);
        } catch (error) {

            console.error('Failed to recognize intent:', error);
            return { intent: 'PROD_Q_AND_A', response: 'Tôi nghe rõ, nhưng có chút trục trặc khi phân tích lệnh. Bạn có thể nói rõ hơn không?' };
        }
    }, [state]);

    const handleCommand = useCallback(async (command: string) => {
        // 1. Acknowledge immediately
        setAgentState('director', 'thinking', 'Đang phân tích yêu cầu...', 'NLU Processing');

        // 2. Recognize Intent
        const result = await recognizeIntent(command);
        const { intent, entities, response } = result;

        // 3. Execute Actions
        switch (intent) {
            case 'PAUSE_BATCH':
                addProductionLog('director', response || 'Đang dừng tiến trình tạo ảnh theo yêu cầu.', 'info');
                stopBatchGeneration();
                setAgentState('director', 'success', 'Tiến trình đã được tạm dừng.');
                break;

            case 'REGENERATE_RANGE':
                addProductionLog('director', response || `Đang chuẩn bị tạo lại các phân cảnh được yêu cầu.`, 'info');
                // Logic to find scene IDs based on range (e.g. sceneNumber)
                const startNum = entities.range?.[0];
                const endNum = entities.range?.[1] || startNum;

                const targetScenes = state.scenes.filter(s => {
                    const num = parseInt(s.sceneNumber);
                    return num >= startNum && num <= endNum;
                });

                if (targetScenes.length > 0) {
                    setAgentState('director', 'success', `Đã xác định được ${targetScenes.length} phân cảnh. Bắt đầu tạo lại...`);
                    handleGenerateAllImages(targetScenes.map(s => s.id));
                } else {
                    setAgentState('director', 'error', 'Tôi không tìm thấy phân cảnh nào trong khoảng bạn yêu cầu.');
                }
                break;

            case 'UPDATE_STYLE':
                addProductionLog('director', response || 'Đang nghiên cứu cách áp dụng style mới vào mạch truyện...', 'info');
                setAgentState('director', 'thinking', 'Đang thiết kế lại các phân cảnh tiếp theo...', 'Creative Rewriting');

                const scenesToUpdate = state.scenes.filter(s => !s.generatedImage);
                const generatedHistory = state.scenes.filter(s => s.generatedImage).slice(-3); // Last 3 generated scenes for Look-Back

                if (scenesToUpdate.length > 0) {
                    try {
                        const rewritePrompt = `As the Director, rewrite the 'visual_context' and 'technical_instructions' for these scenes to incorporate the following style command: "${entities.styleInstruction}".
                        
                        LOOK-BACK (Last 3 generated scenes visual DNA):
                        ${generatedHistory.map(s => `Scene ${s.sceneNumber}: ${s.contextDescription}`).join('\n')}

                        SCENES TO REWRITE (Look-Ahead context):
                        ${scenesToUpdate.map(s => `Scene ${s.sceneNumber}: ${s.contextDescription}`).join('\n')}

                        GUIDELINES:
                        1. Keep the story and character actions identical.
                        2. Only change visual descriptions, lighting, and camera feelings.
                        3. Preserve continuity with the LOOK-BACK DNA so transitions aren't jarring.
                        4. Ensure the new style doesn't conflict with future script beats.
                        5. Maintain consistency with the base Material Kit: ${state.researchNotes?.materialKit || 'None'}.
                        6. Maintain consistency with the research notes: ${state.researchNotes?.story || 'N/A'}.

                        
                        OUTPUT: JSON array of string (just the new contextDescriptions), same length and order as input scenes.
                        ["New prompt 1", "New prompt 2", ...]`;


                        const rawUpdates = await callGeminiText(userApiKey || '', rewritePrompt, 'You are an Expert Director.', 'gemini-2.5-flash', true);


                        const newPrompts = JSON.parse(rawUpdates);

                        if (Array.isArray(newPrompts) && newPrompts.length === scenesToUpdate.length) {
                            updateStateAndRecord(s => ({
                                ...s,
                                scenes: s.scenes.map(scene => {
                                    if (!scene.generatedImage) {
                                        const index = scenesToUpdate.findIndex(su => su.id === scene.id);
                                        if (index !== -1) {
                                            return {
                                                ...scene,
                                                contextDescription: newPrompts[index]
                                            };
                                        }
                                    }
                                    return scene;
                                })
                            }));
                            setAgentState('director', 'success', 'Đã cập nhật chỉ dẫn thẩm mỹ và ánh sáng cho các cảnh tới.');
                        }
                    } catch (e) {
                        console.error('Bulk rewrite failed:', e);
                        setAgentState('director', 'error', 'Tôi gặp chút khó khăn khi thiết kế lại các cảnh. Đã áp dụng chỉ dẫn cơ bản.');
                    }
                }
                break;


            case 'SYNERGY_DIRECTIVE':
                const directiveSceneNum = entities.sceneNumber;
                const directiveScene = directiveSceneNum
                    ? state.scenes.find(s => parseInt(s.sceneNumber) === directiveSceneNum)
                    : null;

                addProductionLog('director', response || 'Đã gửi chỉ thị cho DOP.', 'directive');
                setAgentState('dop', 'thinking', `Đang điều chỉnh theo yêu cầu: ${entities.directive}`, 'DOP Optimization');

                try {
                    const dopResponsePrompt = `You are the DOP (Director of Photography). The Director gave you this directive: "${entities.directive}"${directiveScene ? ` for Scene ${directiveScene.sceneNumber}` : ''}.
                    How do you technically implement this? 
                    OUTPUT: Brief technical response in Vietnamese (max 30 words).`;

                    const dopResponse = await callGeminiText(userApiKey || '', dopResponsePrompt, 'You are an Expert DOP.', 'gemini-2.5-flash', false);

                    addProductionLog('dop', dopResponse, 'info');
                    setAgentState('dop', 'success', dopResponse);

                    // Store the pending action for later execution
                    if (directiveScene) {
                        pendingActionRef.current = {
                            type: 'SYNERGY_DIRECTIVE',
                            sceneId: directiveScene.id,
                            sceneNumber: directiveSceneNum,
                            directive: entities.directive,
                            timestamp: Date.now()
                        };

                        // Update the scene's camera angle in the prompt
                        const updatedPrompt = `${directiveScene.contextDescription}\n[Camera: ${entities.directive}]`;
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene =>
                                scene.id === directiveScene.id
                                    ? { ...scene, contextDescription: updatedPrompt, cameraAngleOverride: entities.directive }
                                    : scene
                            )
                        }));

                        setAgentState('director', 'success', `DOP đã xác nhận. Cảnh ${directiveSceneNum} đã được cập nhật. Nói "thực thi" để tạo lại ảnh.`);
                    } else {
                        setAgentState('director', 'success', 'DOP đã xác nhận và lên phương án kỹ thuật.');
                    }
                } catch (e) {
                    setAgentState('dop', 'success', 'DOP: Đã rõ, tôi sẽ điều chỉnh kỹ thuật ngay.');
                }
                break;

            case 'MATERIAL_INHERITANCE':
                const sourceScene = state.scenes.find(s => s.sceneNumber === String(entities.sourceSceneId) || s.id === entities.sourceSceneId);
                const targetScene = state.scenes.find(s => s.sceneNumber === String(entities.targetSceneId) || s.id === entities.targetSceneId);

                if (sourceScene && targetScene) {
                    addProductionLog('director', response || `Đang trích xuất visual DNA từ cảnh ${sourceScene.sceneNumber} để áp dụng cho cảnh ${targetScene.sceneNumber}.`, 'info');
                    setAgentState('director', 'thinking', 'Đang phân tách chất liệu và ánh sáng...', 'Material Extraction');

                    try {
                        const extractPrompt = `As the Director, extract only the visual material, texture, and technical DNA (e.g. "brushed metal", "volumetric lighting", "8k octane render") from this prompt:
                        "${sourceScene.contextDescription}"
                        
                        Now, inject these visual details into this target prompt WITHOUT changing the actions or story:
                        "${targetScene.contextDescription}"
                        
                        OUTPUT: The new complete prompt for the target scene.`;

                        const newPrompt = await callGeminiText(userApiKey || '', extractPrompt, 'You are an Expert Director.', 'gemini-2.5-flash', false);



                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene => scene.id === targetScene.id ? {
                                ...scene,
                                contextDescription: newPrompt,
                                generatedImage: null // Clear old image to allow regeneration
                            } : scene)
                        }));

                        // Auto-regenerate the target scene with reference to source
                        addProductionLog('director', 'Đang tự động tạo lại cảnh với DNA mới...', 'info');
                        setAgentState('director', 'speaking', 'Đang tạo lại ảnh với Visual DNA mới...', 'Regenerating');

                        // Trigger regeneration for the target scene with VISUAL DNA REFERENCE
                        const refMap = sourceScene.generatedImage ? { [targetScene.id]: sourceScene.generatedImage } : undefined;
                        await handleGenerateAllImages([targetScene.id], refMap);

                        setAgentState('director', 'success', `Đã đồng bộ và tạo lại cảnh ${targetScene.sceneNumber} với DNA từ cảnh ${sourceScene.sceneNumber}.`);
                    } catch (e) {
                        setAgentState('director', 'error', 'Không thể trích xuất DNA chất liệu.');
                    }
                } else {
                    setAgentState('director', 'error', 'Tôi không tìm thấy cảnh nguồn hoặc cảnh đích để đồng bộ.');
                }
                break;

            case 'SYNC_AND_REGENERATE':
                // This is similar to MATERIAL_INHERITANCE but explicitly triggers regeneration
                const srcScene = state.scenes.find(s => s.sceneNumber === String(entities.sourceSceneId) || s.id === entities.sourceSceneId);
                const tgtScene = state.scenes.find(s => s.sceneNumber === String(entities.targetSceneId) || s.id === entities.targetSceneId);

                if (srcScene && tgtScene) {
                    addProductionLog('director', response || `Đang sửa và tạo lại cảnh ${tgtScene.sceneNumber} theo DNA của cảnh ${srcScene.sceneNumber}.`, 'info');
                    setAgentState('director', 'thinking', 'Đang phân tích và đồng bộ DNA...', 'Sync & Regen');

                    try {
                        const directiveText = entities.directive
                            ? `4. ADDITIONAL DIRECTIVE (PRIORITY #1): "${entities.directive}".
                               - IF ADDING AN OBJECT: Describe it vividly (color, material) based on SOURCE, and place it in TARGET.
                               - IMPORTANT: DO NOT CHANGE THE TARGET ROOM/ENVIRONMENT unless explicitly asked. Merge the object into the EXISTING room.`
                            : '';

                        const syncPrompt = `As the Director, you need to fix Scene ${tgtScene.sceneNumber} to match Scene ${srcScene.sceneNumber}'s visual DNA.
                        
                        SOURCE SCENE (Ref Object/Style):
                        "${srcScene.contextDescription}"
                        
                        TARGET SCENE (Environment to KEEP):
                        "${tgtScene.contextDescription}"
                        
                        RULES:
                        1. PRESERVE TARGET ENVIRONMENT: Keep the original room details (e.g. "round window", "attic", "mirror"). DO NOT replace them with Source environment details.
                        2. EXECUTE DIRECTIVE: Insert the requested object/action modification seamlessly into the Target environment.
                        3. SYNC STYLE ONLY: Use Source's lighting/mood/texture, but apply it to Target's geometry.
                        ${directiveText}
                        
                        OUTPUT: The corrected complete prompt for TARGET scene.`;

                        const fixedPrompt = await callGeminiText(userApiKey || '', syncPrompt, 'You are an Expert Director.', 'gemini-2.5-flash', false);


                        // Update prompt and clear image
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene => scene.id === tgtScene.id ? {
                                ...scene,
                                contextDescription: fixedPrompt
                                // PRESERVE generatedImage so it can be used as Base Image for editing
                            } : scene)
                        }));

                        // Auto-regenerate
                        setAgentState('director', 'speaking', `Đang tạo lại cảnh ${tgtScene.sceneNumber}...`, 'Regenerating');

                        // Pass reference image map
                        const refMap = srcScene.generatedImage ? { [tgtScene.id]: srcScene.generatedImage } : undefined;
                        await handleGenerateAllImages([tgtScene.id], refMap);

                        setAgentState('director', 'success', `Đã sửa và tạo lại cảnh ${tgtScene.sceneNumber} thành công!`);
                    } catch (e) {
                        setAgentState('director', 'error', 'Lỗi khi đồng bộ và tạo lại cảnh.');
                    }
                } else {
                    setAgentState('director', 'error', 'Tôi không tìm thấy cảnh nguồn hoặc cảnh đích.');
                }
                break;

            case 'COMPOSITE_OBJECT_TRANSFER':
                // CRITICAL: Target scene is EDITED (preserved), Source scene is only for REFERENCE
                // Fix: Handle different sceneNumber formats (1, '1', '001', etc.)
                const srcNum = entities.sourceSceneNumber;
                const tgtNum = entities.targetSceneNumber;
                console.log('[Director] COMPOSITE_OBJECT_TRANSFER - Looking for source:', srcNum, 'target:', tgtNum);

                const compositeSource = state.scenes.find(s => {
                    const sNum = parseInt(s.sceneNumber, 10);
                    return sNum === srcNum || s.id === entities.sourceSceneId;
                });
                const compositeTarget = state.scenes.find(s => {
                    const sNum = parseInt(s.sceneNumber, 10);
                    return sNum === tgtNum || s.id === entities.targetSceneId;
                });

                console.log('[Director] Found source:', compositeSource?.sceneNumber, 'target:', compositeTarget?.sceneNumber);

                if (compositeSource && compositeTarget) {
                    const objectDesc = entities.objectDescription || 'the object';
                    addProductionLog('director', response || `Đang thêm ${objectDesc} từ cảnh ${compositeSource.sceneNumber} vào cảnh ${compositeTarget.sceneNumber}.`, 'info');
                    setAgentState('director', 'thinking', `Đang chuẩn bị composite: ${objectDesc}...`, 'Composite');

                    try {
                        // Generate edit prompt that describes what to ADD
                        const compositePrompt = `EDIT the target scene by ADDING an object from the reference.

TARGET SCENE (KEEP THIS SCENE'S LAYOUT, CAMERA, SUBJECT):
"${compositeTarget.contextDescription}"

OBJECT TO ADD (from reference image):
"${objectDesc}"

INSTRUCTION: Using the provided target image as the base, add ${objectDesc} (visible in the reference image) to the scene. 
- KEEP the target scene's composition, camera angle, and main subject EXACTLY.
- Only ADD the new object in a natural position.
- Match the object's appearance from the reference image.`;

                        console.log('[Director] Calling Gemini for composite prompt...');
                        const editPrompt = await callGeminiText(userApiKey || '', compositePrompt, 'You are an Expert VFX Compositor. Output only the final edit instruction prompt.', 'gemini-2.5-flash', false);
                        console.log('[Director] Got edit prompt:', editPrompt?.substring(0, 100) + '...');

                        // Update the target scene's prompt
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene => scene.id === compositeTarget.id ? {
                                ...scene,
                                contextDescription: editPrompt || `Add ${objectDesc} from reference to ${compositeTarget.contextDescription}`,
                                referenceImage: compositeSource.generatedImage, // Source as REFERENCE for object
                                referenceImageDescription: objectDesc
                            } : scene)
                        }));

                        // Wait for React state to sync (critical for referenceImageDescription to be available)
                        await new Promise(resolve => setTimeout(resolve, 400));
                        console.log('[Director] COMPOSITE: State synced, referenceImageDescription should be:', objectDesc);

                        // Generate with:
                        // - baseImageMap: Target's existing image (CANVAS to edit)
                        // - referenceMap: Source's image (for object appearance)
                        setAgentState('director', 'speaking', `Đang chỉnh sửa cảnh ${compositeTarget.sceneNumber}...`, 'Editing');

                        const baseMap = compositeTarget.generatedImage ? { [compositeTarget.id]: compositeTarget.generatedImage } : undefined;
                        const refMap = compositeSource.generatedImage ? { [compositeTarget.id]: compositeSource.generatedImage } : undefined;

                        console.log('[Director] Calling image generation with baseMap:', !!baseMap, 'refMap:', !!refMap);
                        await handleGenerateAllImages([compositeTarget.id], refMap, baseMap);

                        setAgentState('director', 'success', `Đã thêm ${objectDesc} vào cảnh ${compositeTarget.sceneNumber} thành công!`);
                    } catch (e) {
                        console.error('[Director] COMPOSITE_OBJECT_TRANSFER error:', e);
                        setAgentState('director', 'error', `Lỗi khi thêm vật thể vào cảnh.`);
                    }
                } else {
                    setAgentState('director', 'error', 'Tôi không tìm thấy cảnh nguồn hoặc cảnh đích. Vui lòng chỉ rõ số cảnh.');
                }
                break;

            case 'ADD_SCENE':
                const sceneCount = entities.count || 1;
                addProductionLog('director', response || `Đang thêm ${sceneCount} cảnh mới...`, 'info');
                setAgentState('director', 'speaking', `Thêm ${sceneCount} cảnh mới...`, 'Adding Scenes');

                for (let i = 0; i < sceneCount; i++) {
                    addScene();
                }

                setAgentState('director', 'success', `Đã thêm ${sceneCount} cảnh mới vào cuối danh sách.`);
                break;

            case 'DELETE_SCENE':
                const deleteStart = entities.range?.[0] || entities.sceneNumber;
                const deleteEnd = entities.range?.[1] || deleteStart;

                if (deleteStart) {
                    const scenesToDelete = state.scenes.filter(s => {
                        const num = parseInt(s.sceneNumber);
                        return num >= deleteStart && num <= deleteEnd;
                    });

                    if (scenesToDelete.length > 0) {
                        addProductionLog('director', response || `Đang xóa ${scenesToDelete.length} cảnh...`, 'warning');
                        setAgentState('director', 'speaking', `Xóa cảnh ${deleteStart}${deleteEnd !== deleteStart ? `-${deleteEnd}` : ''}...`, 'Deleting');

                        scenesToDelete.forEach(scene => removeScene(scene.id));

                        setAgentState('director', 'success', `Đã xóa ${scenesToDelete.length} cảnh thành công.`);
                    } else {
                        setAgentState('director', 'error', 'Không tìm thấy cảnh để xóa.');
                    }
                } else {
                    setAgentState('director', 'error', 'Vui lòng chỉ định số cảnh cần xóa.');
                }
                break;

            case 'INSERT_SCENE':
                const insertAfterNum = entities.insertAfter || 0;
                const insertIndex = state.scenes.findIndex(s => parseInt(s.sceneNumber) === insertAfterNum);

                if (insertIndex !== -1) {
                    addProductionLog('director', response || `Chèn cảnh mới sau cảnh ${insertAfterNum}...`, 'info');

                    const prevScene = state.scenes[insertIndex];
                    let initialData: any = {};

                    // NEW: Smart Context Injection
                    if (entities.visualDirective) {
                        const directive = entities.visualDirective;
                        // Construct prompt borrowing context from previous scene
                        initialData.contextDescription = `[DIRECTOR INSTRUCTION]: ${directive}\n\nCONTEXT FROM PREVIOUS SCENE:\n${prevScene.contextDescription}`;
                        initialData.promptName = directive.length > 30 ? `${directive.substring(0, 30)}...` : directive;
                    }

                    // NEW: Image Reference Transfer (Consistency)
                    // If user implies continuity OR explicitly asks for similar shot
                    // Store prevScene image for baseMap (used in angle change mode)
                    let prevSceneImage: string | undefined;

                    if (entities.referencePrevious && prevScene.generatedImage) {
                        prevSceneImage = prevScene.generatedImage;

                        // Check if this is an ANGLE CHANGE request (zoom, close-up, etc.)
                        const isAngleChange = entities.visualDirective &&
                            /zoom|close.?up|wide|medium|long|pan|angle|shot/i.test(entities.visualDirective);

                        if (isAngleChange) {
                            // ANGLE CHANGE: Do NOT set referenceImage (avoid DNA style injection)
                            // Only use baseImage (passed via baseMap) to maintain subject identity
                            // Let Reasoning generate the new camera angle
                            addProductionLog('director', 'Tạo góc máy mới từ cảnh trước...', 'info');
                            console.log('[Director] INSERT_SCENE - ANGLE CHANGE mode, skipping referenceImage');
                        } else {
                            // STYLE CONTINUITY: Set referenceImage for visual consistency
                            initialData.referenceImage = prevScene.generatedImage;
                            initialData.referenceImageDescription = "Previous moment in sequence. Maintain visual continuity.";
                            addProductionLog('director', 'Đang dùng ảnh cảnh trước làm tham chiếu (Reference)...', 'info');
                        }
                        console.log('[Director] INSERT_SCENE - isAngleChange:', isAngleChange, 'directive:', entities.visualDirective);
                    }

                    // Execute Insertion
                    const newId = insertScene(insertIndex + 1, initialData);

                    if (entities.visualDirective) {
                        setAgentState('director', 'speaking', `Đang tạo cảnh mới: ${entities.visualDirective}...`, 'Generating');

                        // NOTE: insertScene returns newId synchronously. The scene exists in state immediately
                        // after insertScene() returns (it calls updateStateAndRecord internally).
                        // We use a short delay to allow React to flush the state update to DOM/hooks.
                        // Previous polling approach had a stale closure bug (state.scenes was captured at render time).
                        await new Promise(resolve => setTimeout(resolve, 300));
                        console.log(`[Director] Waited 300ms for React state flush, proceeding with generation for scene ${newId}`);

                        // Pass as Base Image to maintain subject identity
                        // Works for both angle change (Reasoning controls angle) and style continuity
                        let baseMap: { [key: string]: string } | undefined;
                        if (entities.referencePrevious && prevSceneImage) {
                            baseMap = { [newId]: prevSceneImage };
                            console.log('[Director] Passing Previous Image as Base Image for Continuity Insert');
                        }

                        await handleGenerateAllImages([newId], undefined, baseMap);
                        setAgentState('director', 'success', `Đã tạo xong cảnh mới!`);
                    } else {
                        setAgentState('director', 'success', `Đã chèn cảnh mới sau cảnh ${insertAfterNum}.`);
                    }

                } else {
                    // If no specific position, add at end
                    addScene();
                    setAgentState('director', 'success', 'Đã thêm cảnh mới vào cuối danh sách.');
                }
                break;

            case 'CLEAR_ALL_IMAGES':
                addProductionLog('director', response || 'Đang xóa tất cả ảnh đã tạo...', 'warning');
                setAgentState('director', 'speaking', 'Xóa tất cả ảnh...', 'Clearing');

                if (onClearAllImages) {
                    onClearAllImages();
                } else {
                    updateStateAndRecord(s => ({
                        ...s,
                        scenes: s.scenes.map(scene => ({ ...scene, generatedImage: null }))
                    }));
                }

                setAgentState('director', 'success', 'Đã xóa tất cả ảnh. Sẵn sàng tạo lại.');
                break;

            case 'UPDATE_SCENE_PROMPT':
                const targetSceneNum = entities.sceneNumber;
                const newPromptText = entities.newPrompt;

                if (targetSceneNum && newPromptText) {
                    const sceneToUpdate = state.scenes.find(s => parseInt(s.sceneNumber) === targetSceneNum);

                    if (sceneToUpdate) {
                        addProductionLog('director', response || `Cập nhật prompt cảnh ${targetSceneNum}...`, 'info');
                        setAgentState('director', 'speaking', `Sửa prompt cảnh ${targetSceneNum}...`, 'Updating');

                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene =>
                                scene.id === sceneToUpdate.id
                                    ? { ...scene, contextDescription: newPromptText, generatedImage: null }
                                    : scene
                            )
                        }));

                        setAgentState('director', 'success', `Đã cập nhật prompt cảnh ${targetSceneNum}. Ảnh cũ đã xóa, sẵn sàng tạo lại.`);
                    } else {
                        setAgentState('director', 'error', `Không tìm thấy cảnh ${targetSceneNum}.`);
                    }
                } else {
                    setAgentState('director', 'error', 'Vui lòng chỉ định số cảnh và nội dung prompt mới.');
                }
                break;

            case 'EXECUTE_PENDING':
                const pending = pendingActionRef.current;
                const execSceneNum = entities.sceneNumber || pending?.sceneNumber;

                if (pending && pending.sceneId) {
                    // Execute the pending action
                    addProductionLog('director', response || `Đang thực thi yêu cầu đã xác nhận cho cảnh ${pending.sceneNumber}...`, 'info');
                    setAgentState('director', 'speaking', `Đang tạo lại cảnh ${pending.sceneNumber}...`, 'Executing');

                    // Capture old image for reference (Self-Repair/Edit Mode)
                    const sceneToExec = state.scenes.find(s => s.id === pending.sceneId);
                    const oldImage = sceneToExec?.generatedImage;

                    // Clear the image first
                    updateStateAndRecord(s => ({
                        ...s,
                        scenes: s.scenes.map(scene =>
                            scene.id === pending.sceneId
                                ? { ...scene, generatedImage: null }
                                : scene
                        )
                    }));

                    // Regenerate the specific scene using Old Image as Base Image (Edit Mode)
                    const baseMap = oldImage ? { [pending.sceneId]: oldImage } : undefined;
                    if (oldImage) addProductionLog('director', 'Đang dùng ảnh gốc làm nền để chỉnh sửa...', 'info');

                    // Arg 1: IDs, Arg 2: RefMap (undefined -> uses scene.referenceImage), Arg 3: BaseMap (oldImage)
                    await handleGenerateAllImages([pending.sceneId], undefined, baseMap);

                    // Clear the pending action after execution
                    pendingActionRef.current = null;

                    setAgentState('director', 'success', `Đã hoàn thành tạo lại cảnh ${pending.sceneNumber}!`);
                } else if (execSceneNum) {
                    // User specified a scene directly
                    const sceneToExec = state.scenes.find(s => parseInt(s.sceneNumber) === execSceneNum);

                    if (sceneToExec) {
                        addProductionLog('director', response || `Đang tạo lại cảnh ${execSceneNum}...`, 'info');
                        setAgentState('director', 'speaking', `Tạo lại cảnh ${execSceneNum}...`, 'Regenerating');

                        const oldImage = sceneToExec.generatedImage;

                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene =>
                                scene.id === sceneToExec.id
                                    ? { ...scene, generatedImage: null }
                                    : scene
                            )
                        }));

                        // Regenerate using Old Image as Base Image
                        const baseMap = oldImage ? { [sceneToExec.id]: oldImage } : undefined;
                        if (oldImage) addProductionLog('director', 'Đang giữ lại ảnh gốc để chỉnh sửa...', 'info');

                        await handleGenerateAllImages([sceneToExec.id], undefined, baseMap);
                        setAgentState('director', 'success', `Đã hoàn thành cảnh ${execSceneNum}!`);
                    } else {
                        setAgentState('director', 'error', `Không tìm thấy cảnh ${execSceneNum}.`);
                    }
                } else {
                    setAgentState('director', 'error', 'Không có yêu cầu đang chờ xử lý. Vui lòng chỉ định cảnh cần thực thi.');
                }
                break;


            case 'GENERATE_ALL':
                // Batch generation for all ungenerated scenes
                const ungeneratedScenes = state.scenes.filter(s => !s.generatedImage && s.contextDescription);

                if (ungeneratedScenes.length === 0) {
                    addProductionLog('director', 'Tất cả các cảnh đã có ảnh hoặc chưa có mô tả. Không có gì để tạo.', 'info');
                    setAgentState('director', 'success', 'Không có cảnh nào cần tạo ảnh.');
                } else {
                    addProductionLog('director', response || `Bắt đầu sản xuất ${ungeneratedScenes.length} phân cảnh...`, 'info');
                    setAgentState('director', 'speaking', `Đang khởi động production cho ${ungeneratedScenes.length} cảnh...`, 'Batch Generation');

                    // Start batch generation for all ungenerated scenes
                    await handleGenerateAllImages();
                }
                break;

            case 'GENERATE_SCENE':
                // Single scene generation
                const targetSceneNumber = entities.sceneNumber;

                if (targetSceneNumber) {
                    const sceneToGen = state.scenes.find(s => parseInt(s.sceneNumber) === targetSceneNumber);

                    if (sceneToGen) {
                        addProductionLog('director', response || `Đang tạo ảnh cho cảnh ${targetSceneNumber}...`, 'info');
                        setAgentState('director', 'speaking', `Đang tạo ảnh cảnh ${targetSceneNumber}...`, 'Single Generation');

                        await handleGenerateAllImages([sceneToGen.id]);
                        setAgentState('director', 'success', `Đã tạo xong ảnh cảnh ${targetSceneNumber}!`);
                    } else {
                        setAgentState('director', 'error', `Không tìm thấy cảnh ${targetSceneNumber}.`);
                    }
                } else {
                    setAgentState('director', 'error', 'Vui lòng chỉ định số cảnh cần tạo ảnh.');
                }
                break;

            default:
                // Only log via addProductionLog (setAgentState will NOT log if we pass the same message that's already in lastLogRef)
                addProductionLog('director', response || 'Tôi đã ghi nhận ý kiến của bạn.', 'info');
                // Use empty message to prevent duplicate log from setAgentState
                setAgentState('director', 'success', '');
                break;
        }
    }, [recognizeIntent, addProductionLog, stopBatchGeneration, setAgentState, state.scenes, handleGenerateAllImages, updateStateAndRecord, addScene, removeScene, insertScene, onClearAllImages]);

    return { handleCommand };
};
