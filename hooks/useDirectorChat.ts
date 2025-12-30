import { useCallback } from 'react';
import { ProjectState, AgentStatus, Scene } from '../types';
import { callGeminiText } from '../utils/geminiUtils';


interface UseDirectorChatProps {
    state: ProjectState;
    userApiKey: string | null;
    setAgentState: (agent: 'director' | 'dop', status: AgentStatus, message?: string, stage?: string) => void;
    addProductionLog: (sender: 'director' | 'dop' | 'user' | 'system', message: string, type?: string, stage?: string) => void;
    stopBatchGeneration: () => void;
    updateStateAndRecord: (updater: (s: ProjectState) => ProjectState) => void;
    handleGenerateAllImages: (specificSceneIds?: string[]) => Promise<void>;
}

export const useDirectorChat = ({
    state,
    userApiKey,
    setAgentState,
    addProductionLog,
    stopBatchGeneration,
    updateStateAndRecord,
    handleGenerateAllImages
}: UseDirectorChatProps) => {


    const recognizeIntent = useCallback(async (command: string) => {
        const systemPrompt = `You are the AI Director of a film production system. 
Your task is to recognize the user's intent from their natural language command.

CURRENT PROJECT STATE:
- Scenes: ${state.scenes.length}
- Generated: ${state.scenes.filter(s => s.generatedImage).length}
- Characters: ${state.characters.map(c => c.name).join(', ')}
- Research Notes: ${state.researchNotes?.story || 'None'}
- Project Context: ${state.detailedScript?.substring(0, 500) || 'None'}...


INTENTS:

1. PAUSE_BATCH: Stop current image generation.
2. REGENERATE_RANGE: Redo specific scenes (e.g. "Cảnh 54-60", "Cảnh 15").
3. UPDATE_STYLE: Change style for future (ungenerated) scenes.
4. PROD_Q_AND_A: Answer questions about the script, characters, or production status.
5. SYNERGY_DIRECTIVE: Give a technical instruction to the DOP.
6. MATERIAL_INHERITANCE: Sample visual details or materials from one scene and apply to another (e.g. "Dùng chất liệu của cảnh 10 cho cảnh 15").
7. SYNC_AND_REGENERATE: Fix a scene to match another scene's DNA AND regenerate it (e.g. "Sửa cảnh 2 giống cảnh 1 rồi tạo lại", "Cảnh 5 sai, sync với cảnh 4").



OUTPUT FORMAT: JSON only
{
  "intent": "INTENT_NAME",
  "entities": {
    "range": [start, end], // for REGENERATE_RANGE
    "sceneIds": ["id1", "id2"], // preferred if identifiable
    "styleInstruction": "string", // for UPDATE_STYLE
    "directive": "string", // for SYNERGY_DIRECTIVE
    "sourceSceneId": "string", // for MATERIAL_INHERITANCE
    "targetSceneId": "string" // for MATERIAL_INHERITANCE
  },
  "response": "Brief professional acknowledgment in Vietnamese"
}`;


        try {
            const response = await callGeminiText(userApiKey || '', command, systemPrompt, 'gemini-3-flash-preview', true);


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


                        const rawUpdates = await callGeminiText(userApiKey || '', rewritePrompt, 'You are an Expert Director.', 'gemini-3-flash-preview', true);


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
                addProductionLog('director', response || 'Đã gửi chỉ thị cho DOP.', 'directive');
                setAgentState('dop', 'thinking', `Đang điều chỉnh theo yêu cầu: ${entities.directive}`, 'DOP Optimization');

                try {
                    const dopResponsePrompt = `You are the DOP (Director of Photography). The Director gave you this directive: "${entities.directive}".
                    How do you technically implement this? 
                    OUTPUT: Brief technical response in Vietnamese (max 20 words).`;

                    const dopResponse = await callGeminiText(userApiKey || '', dopResponsePrompt, 'You are an Expert DOP.', 'gemini-3-flash-preview', false);



                    addProductionLog('dop', dopResponse, 'info');
                    setAgentState('dop', 'success', dopResponse);
                    setAgentState('director', 'success', 'DOP đã xác nhận và lên phương án kỹ thuật.');
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

                        const newPrompt = await callGeminiText(userApiKey || '', extractPrompt, 'You are an Expert Director.', 'gemini-3-flash-preview', false);



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

                        // Trigger regeneration for the target scene
                        await handleGenerateAllImages([targetScene.id]);

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
                        const syncPrompt = `As the Director, you need to fix Scene ${tgtScene.sceneNumber} to match Scene ${srcScene.sceneNumber}'s visual DNA.
                        
                        SOURCE SCENE (Reference):
                        "${srcScene.contextDescription}"
                        
                        TARGET SCENE (Needs fixing):
                        "${tgtScene.contextDescription}"
                        
                        RULES:
                        1. Keep the TARGET scene's story and actions.
                        2. Inject the SOURCE scene's visual style, materials, lighting, and atmosphere.
                        3. Ensure character descriptions match between scenes.
                        
                        OUTPUT: The corrected complete prompt for the target scene.`;

                        const fixedPrompt = await callGeminiText(userApiKey || '', syncPrompt, 'You are an Expert Director.', 'gemini-3-flash-preview', false);

                        // Update prompt and clear image
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(scene => scene.id === tgtScene.id ? {
                                ...scene,
                                contextDescription: fixedPrompt,
                                generatedImage: null
                            } : scene)
                        }));

                        // Auto-regenerate
                        setAgentState('director', 'speaking', `Đang tạo lại cảnh ${tgtScene.sceneNumber}...`, 'Regenerating');
                        await handleGenerateAllImages([tgtScene.id]);

                        setAgentState('director', 'success', `Đã sửa và tạo lại cảnh ${tgtScene.sceneNumber} thành công!`);
                    } catch (e) {
                        setAgentState('director', 'error', 'Lỗi khi đồng bộ và tạo lại cảnh.');
                    }
                } else {
                    setAgentState('director', 'error', 'Tôi không tìm thấy cảnh nguồn hoặc cảnh đích.');
                }
                break;



            default:
                addProductionLog('director', response || 'Tôi đã ghi nhận ý kiến của bạn.', 'info');
                setAgentState('director', 'success', response);
                break;
        }
    }, [recognizeIntent, addProductionLog, stopBatchGeneration, setAgentState, state.scenes, handleGenerateAllImages, updateStateAndRecord]);

    return { handleCommand };
};
