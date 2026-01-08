import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectState, AgentStatus } from '../types';

import { CAMERA_ANGLES, LENS_OPTIONS, VEO_PRESETS } from '../constants/presets';
import { Scene } from '../types';

export function useVideoGeneration(
    state: ProjectState,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void,
    setAgentState?: (agent: 'director' | 'dop', status: AgentStatus, message?: string, stage?: string) => void,
    addProductionLog?: (sender: 'director' | 'dop' | 'user' | 'system', message: string, type?: string, stage?: string) => void
) {

    const [isVeoGenerating, setIsVeoGenerating] = useState(false);
    const [isVeoStopping, setIsVeoStopping] = useState(false);
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);
    const stopVeoRef = useRef(false);




    const stopVeoGeneration = useCallback(() => {
        if (isVeoGenerating) {
            stopVeoRef.current = true;
            setIsVeoStopping(true);
        }
    }, [isVeoGenerating]);

    const generateVeoPrompt = useCallback(async (sceneId: string) => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene) {
            console.warn('[Veo] Scene not found:', sceneId);
            return;
        }
        if (!scene.generatedImage) {
            alert('Vui lòng tạo ảnh cho scene này trước khi tạo Veo prompt.');
            console.warn('[Veo] No generated image for scene:', sceneId);
            return;
        }

        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) {
            setApiKeyModalOpen(true);
            console.warn('[Veo] No API key available');
            return;
        }

        // Mark scene as generating (for UI feedback)
        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, veoPrompt: '⏳ Đang tạo...' } : sc)
        }));

        try {
            console.log('[Veo] Starting prompt generation for scene:', sceneId);
            const ai = new GoogleGenAI({ apiKey });
            let data: string;
            let mimeType: string = 'image/jpeg';

            if (scene.generatedImage.startsWith('data:')) {
                const [header, base64Data] = scene.generatedImage.split(',');
                data = base64Data;
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            } else {
                try {
                    const proxyUrl = `http://localhost:3001/api/proxy/fetch-image?url=${encodeURIComponent(scene.generatedImage)}`;
                    const imgRes = await fetch(proxyUrl);
                    const blob = await imgRes.blob();
                    mimeType = blob.type;
                    data = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                } catch (e) {
                    console.error("[Veo] Fetch image failed:", e);
                    updateStateAndRecord(s => ({
                        ...s,
                        scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, veoPrompt: '❌ Lỗi tải ảnh' } : sc)
                    }));
                    alert('Không thể tải ảnh từ URL. Vui lòng thử lại hoặc convert ảnh sang base64.');
                    return;
                }
            }

            // Determine effective language for script text
            const languageNames: Record<string, string> = {
                'vietnamese': 'Vietnamese',
                'language1': 'English',
                'spanish': 'Spanish',
                'chinese': 'Chinese (Mandarin)',
                'hindi': 'Hindi',
                'arabic': 'Arabic',
                'custom': state.customScriptLanguage || 'English'
            };
            const effectiveLanguage = languageNames[state.scriptLanguage] || 'English';

            // Get script text based on language setting
            // Vietnamese uses 'vietnamese' field, all others use 'language1' field
            const dialogueText = state.scriptLanguage === 'vietnamese'
                ? scene.vietnamese
                : scene.language1;

            // Voice Over (narration/commentary - not spoken by characters in scene)
            const voiceOverText = scene.voiceOverText || scene.voiceover || '';

            // Dialogue (spoken by characters in scene)
            // CRITICAL FIX: Only use dialogueText if this is ACTUALLY a dialogue scene
            // Previously, Voice-Over was being incorrectly treated as dialogue
            const dialoguesFromArray = scene.dialogues?.map(d => `${d.characterName}: "${d.line}"`).join('; ') || '';

            // Only consider dialogueText as real dialogue if:
            // 1. Scene is explicitly marked as dialogue scene, OR
            // 2. dialogueText contains speaker prefix (e.g., "John: Hello")
            const isActualDialogue = scene.isDialogueScene ||
                (dialogueText && dialogueText.includes(':') && !dialogueText.startsWith('Scene'));

            const finalDialogue = dialoguesFromArray || (isActualDialogue ? dialogueText : '');

            const context = scene.contextDescription || '';
            const promptName = scene.promptName || '';
            const sceneProducts = (state.products || []).filter(p => (scene.productIds || []).includes(p.id));
            const productContext = sceneProducts.map(p => `Product: ${p.name} (${p.description})`).join('; ');

            // Build Scene Intelligence context
            const hasDialogue = Boolean(finalDialogue);
            const hasVoiceOver = Boolean(voiceOverText);
            const characterCount = scene.characterIds?.length || 0;

            // Analyze emotional keywords from context and dialogue
            const emotionalKeywords = {
                tense: ['tense', 'nervous', 'fear', 'afraid', 'threat', 'danger', 'sợ', 'căng thẳng', 'nguy hiểm'],
                angry: ['angry', 'rage', 'furious', 'shout', 'scream', 'tức giận', 'hét', 'la'],
                sad: ['sad', 'cry', 'tears', 'mourn', 'loss', 'buồn', 'khóc', 'mất'],
                romantic: ['love', 'kiss', 'embrace', 'tender', 'gentle', 'yêu', 'hôn', 'dịu dàng'],
                action: ['run', 'fight', 'chase', 'attack', 'escape', 'chạy', 'đánh', 'trốn', 'tấn công'],
                mysterious: ['mystery', 'secret', 'hidden', 'shadow', 'dark', 'bí ẩn', 'bóng tối']
            };

            const combinedText = `${context} ${voiceOverText} ${finalDialogue}`.toLowerCase();
            const detectedEmotions: string[] = [];
            for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
                if (keywords.some(kw => combinedText.includes(kw))) {
                    detectedEmotions.push(emotion);
                }
            }
            const primaryEmotion = detectedEmotions[0] || 'neutral';

            // Build acting and camera suggestions based on emotion
            const actingCameraGuide: Record<string, { acting: string; camera: string }> = {
                tense: {
                    acting: 'Subtle tension in body language: clenched jaw, tight shoulders, darting eyes. Breathing slightly faster. Hands may grip objects tightly.',
                    camera: 'Slow push-in to build tension. Handheld slight shake for unease. Close-ups on eyes and hands. Low depth of field to isolate subject.'
                },
                angry: {
                    acting: 'Aggressive posture: leaning forward, pointing finger, raised voice. Veins visible, face flushed. Abrupt movements.',
                    camera: 'Quick cuts between subjects. Dutch angle for instability. Tracking shot following aggressive movement. Wide to show confrontation.'
                },
                sad: {
                    acting: 'Withdrawn body language: slumped shoulders, downcast eyes, slow movements. Hands may touch face or cover eyes. Trembling lip.',
                    camera: 'Slow dolly out to emphasize isolation. High angle to show vulnerability. Long takes to let emotion breathe. Soft focus transitions.'
                },
                romantic: {
                    acting: 'Soft gazes, gentle touches, leaning toward each other. Relaxed shoulders, open body language. Subtle smiles, lingering looks.',
                    camera: 'Slow circular dolly around subjects. Shallow depth of field for dreamy look. Warm color grading. Smooth steadicam movement.'
                },
                action: {
                    acting: 'Dynamic movement: running, dodging, reaching. High energy, quick reflexes. Physical exertion visible (sweat, heavy breathing).',
                    camera: 'Fast tracking shots following movement. Quick cuts for impact. Low angle for heroism. Whip pan for speed. Slow-motion for key moments.'
                },
                mysterious: {
                    acting: 'Guarded body language: face partially hidden, deliberate movements. Eyes scanning surroundings. Careful, measured gestures.',
                    camera: 'Slow reveal from shadow. Rack focus between elements. Dutch angle for unease. Slow zoom into key details. Silhouette compositions.'
                },
                neutral: {
                    acting: 'Natural, everyday movement appropriate to the context. Relaxed but purposeful actions.',
                    camera: 'Standard coverage: establishing wide, medium for interaction, close-up for emphasis. Smooth, unobtrusive movement.'
                }
            };

            const guide = actingCameraGuide[primaryEmotion] || actingCameraGuide.neutral;

            const selectedPreset = VEO_PRESETS.find(p => p.value === scene.veoPreset) || VEO_PRESETS[0];

            const promptText = `
Role: Expert Video Prompt Designer for Google Veo 3.1 IMAGE-TO-VIDEO mode.

**CRITICAL: IMAGE-TO-VIDEO MODE**
You are generating a prompt to ANIMATE the provided keyframe image. The image is your PRIMARY REFERENCE.
- DESCRIBE what you SEE in the image (subject, environment, lighting, colors)
- ANIMATE what's ALREADY visible - don't invent new elements
- MAINTAIN the exact visual style, colors, and composition from the image

**THE OFFICIAL VEO 3.1 FORMULA:**
[Cinematography] + [Subject from image] + [Animation/Action] + [Context from image] + [Style matching image] + [SFX/Ambient] + [Emotion]

**SOURCE IMAGE CONTEXT (from user):**
- Scene Description: "${context}"
- Scene Intent: "${promptName}"
${voiceOverText ? `- Voice Over/Narration (OFF-SCREEN narrator, NOT character speech): "${voiceOverText}"` : ''}
${finalDialogue ? `- Character Dialogue (ON-SCREEN character speaking, ${effectiveLanguage}): "${finalDialogue}"` : ''}
- Products visible: "${productContext}"
- Camera Angle: "${scene.cameraAngleOverride === 'custom' ? scene.customCameraAngle : (CAMERA_ANGLES.find(a => a.value === scene.cameraAngleOverride)?.label || 'Auto')}"
- Lens Style: "${scene.lensOverride === 'custom' ? scene.customLensOverride : (LENS_OPTIONS.find(l => l.value === scene.lensOverride)?.label || 'Auto')}"

**SCENE INTELLIGENCE (Auto-Analyzed):**
- Detected Emotional Tone: ${primaryEmotion.toUpperCase()}${detectedEmotions.length > 1 ? ` (also: ${detectedEmotions.slice(1).join(', ')})` : ''}
- Scene Type: ${hasDialogue ? 'DIALOGUE SCENE' : hasVoiceOver ? 'VOICE-OVER/NARRATION SCENE' : 'VISUAL SCENE'}
- Character Count: ${characterCount > 0 ? characterCount : 'Auto-detect from image'}
- SUGGESTED ACTING: ${guide.acting}
- SUGGESTED CAMERA: ${guide.camera}

**PRESET MODE: ${selectedPreset.label}**
${selectedPreset.prompt}

**GENERATION RULES FOR IMAGE-TO-VIDEO:**
1. START by analyzing the keyframe image - describe its visual elements
2. APPLY the SUGGESTED ACTING directions to animate characters naturally
3. APPLY the SUGGESTED CAMERA movement for cinematic feel
4. The [Subject] in your prompt = the subject VISIBLE in the image
5. The [Context] = the environment VISIBLE in the image  
6. The [Style] = match the lighting, colors, and aesthetic of the image
7. Add MOTION that makes sense for what's in the image AND the detected emotion
8. Include SFX and Emotion tags appropriate to the scene

**AUDIO RULES (CRITICAL):**
- NO background music, NO orchestral score, NO musical soundtrack
- ONLY use SFX: for environmental/action sound effects (footsteps, water, wind, impacts)
- ONLY use Dialogue: "[speech]" or Voiceover: "[narration]" if there's actual speech
- Use Ambient noise: for environmental soundscape (city hum, forest sounds, room tone)

**PRESET-SPECIFIC RULES:**
- If "Single Shot": One continuous 6-second animation of the image, subtle camera movement
- If "Dialogue/Multi-Shot": Describe the character from the image speaking, use shot/reverse if applicable
- If "Action": Animate dynamic movement FROM the pose visible in the image
- If "Mood": Slow, atmospheric animation with emphasis on lighting from the image
- If "Macro": Animate subtle micro-movements of the focused element in the image
- If "Epic": Add camera reveal movement starting from the image's composition

**OUTPUT FORMAT:**
Return ONLY the video prompt string. NO explanations, NO markdown.
`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { data, mimeType } },
                        { text: promptText }
                    ]
                }
            });

            const veoPrompt = (response as any).text?.trim?.() || (response as any).text || '';
            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, veoPrompt } : sc)
            }));
        } catch (e) {
            console.error("Veo prompt gen failed", e);
        }
    }, [state.scenes, state.scriptLanguage, state.products, updateStateAndRecord, userApiKey]);

    const handleGenerateAllVeoPrompts = useCallback(async () => {
        const scenesToProcess = state.scenes.filter(s => s.generatedImage);
        if (scenesToProcess.length === 0) return alert("Không có phân cảnh nào có ảnh để tạo Veo prompt.");

        setIsVeoGenerating(true);
        setAgentState('director', 'thinking', 'Đang phân tích kịch bản để tối ưu Prompt cho Veo 3.1...');
        setAgentState('dop', 'idle', '');

        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) {
            setApiKeyModalOpen(true);
            setIsVeoGenerating(false);
            return;
        }

        try {
            // STEP 1: DOP Auto-Suggest Presets for scenes without preset
            const scenesNeedingPreset = scenesToProcess.filter(s => !s.veoPreset);
            if (scenesNeedingPreset.length > 0) {
                setAgentState('dop', 'thinking', 'Đang tự động đề xuất phong cách (Presets) dựa trên phân tích hình ảnh...');
                console.log('[DOP Veo] Auto-suggesting presets for', scenesNeedingPreset.length, 'scenes...');


                const ai = new GoogleGenAI({ apiKey });
                const scenesInfo = scenesNeedingPreset.map(s =>
                    `ID: ${s.id}, Context: ${s.contextDescription}, Script: ${s.vietnamese || s.language1}, Angle: ${s.cameraAngleOverride || 'auto'}`
                ).join('\n');
                const presetsInfo = VEO_PRESETS.map(p => `${p.value}: ${p.label}`).join('\n');

                const dopPrompt = `
                Role: You are a DOP (Director of Photography) analyzing scenes to suggest the optimal Veo 3.1 preset.
                
                **PRESET SELECTION RULES:**
                - "action-sequence": Scenes with running, fighting, chasing, explosions, quick movements
                - "storytelling-multi": Dialogue heavy scenes, emotional beats, character interactions
                - "cinematic-master": Establishing shots, artistic compositions, slow reveals, single steady shots
                - "macro-detail": Product showcases, texture details, extreme close-ups
                - "emotional-focus": Emotional character moments, crying, laughing, reactions
                - "ambient-mood": Atmosphere building, environmental shots, mood pieces
                
                Available Presets:
                ${presetsInfo}
                
                Scenes to analyze:
                ${scenesInfo}
                
                Return ONLY a JSON object: {"scene_id": "preset_value", ...}
                `;

                const result = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [{ parts: [{ text: dopPrompt }] }],
                    config: { responseMimeType: "application/json" }
                });

                const text = (result as any).text?.trim?.() || (result as any).text || '';
                try {
                    const mapping = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                    console.log('[DOP Veo] Preset suggestions:', mapping);

                    updateStateAndRecord(s => ({
                        ...s,
                        scenes: s.scenes.map(scene => ({
                            ...scene,
                            veoPreset: mapping[scene.id] || scene.veoPreset || 'cinematic-master'
                        }))
                    }));

                    // Wait for state update
                    await new Promise(r => setTimeout(r, 300));
                } catch (parseError) {
                    console.error('[DOP Veo] Failed to parse preset suggestions:', parseError);
                }
            }

            // STEP 2: Generate Veo prompts for all scenes
            console.log('[Veo] Generating prompts for', scenesToProcess.length, 'scenes...');
            for (const scene of scenesToProcess) {
                if (stopVeoRef.current) {
                    setAgentState('director', 'idle', 'Đã dừng theo yêu cầu người dùng.');
                    console.log('[Veo] Stopped by user');
                    break;
                }
                setAgentState('director', 'speaking', `Đang tối ưu Veo Prompt cho Phân cảnh ${scene.sceneNumber}...`);
                await generateVeoPrompt(scene.id);
                const veoDelay = state.generationConfig?.veoDelay || 200;
                await new Promise(r => setTimeout(r, veoDelay));
            }
            setAgentState('director', 'success', 'Hoàn tất tối ưu toàn bộ Veo Prompts!');

        } finally {
            setIsVeoGenerating(false);
            setIsVeoStopping(false);
            stopVeoRef.current = false;
            setAgentState('director', 'idle', '');
            setAgentState('dop', 'idle', '');
        }
    }, [state.scenes, userApiKey, generateVeoPrompt, setApiKeyModalOpen, updateStateAndRecord, setAgentState]);


    const handleGenerateAllVideos = useCallback(async () => {
        alert("Video generation currently requires an external integration and is disabled in this version.");
    }, []);

    const suggestVeoPresets = useCallback(async () => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) {
            setApiKeyModalOpen(true);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });

            const scenesInfo = state.scenes.map(s => `ID: ${s.id}, Context: ${s.contextDescription}, Script: ${s.vietnamese || s.language1}`).join('\n');
            const presetsInfo = VEO_PRESETS.map(p => `${p.value}: ${p.label} - ${p.prompt}`).join('\n');

            const suggestionPrompt = `
            Task: Assign the best Veo 3.1 Video Preset for each scene based on the context and script.
            
            **PRESET SELECTION STRATEGY:**
            - Use "action-sequence" (Multi-Shot) for scenes with physical movement, chases, or high energy.
            - Use "storytelling-multi" (Multi-Shot) for scenes with dialogue or character interactions.
            - Use "cinematic-master" (Single Shot) for artistic, steady, or high-production single-shot scenes.
            - Use "macro-detail" for products or close-up textures.
            
            Available Presets:
            ${presetsInfo}
            
            Scenes:
            ${scenesInfo}
            
            Return ONLY a JSON object mapping scene ID to preset value: {"scene_id": "preset_value", ...}
            `;

            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: [{ text: suggestionPrompt }] }],
                config: {
                    responseMimeType: "application/json"
                }
            });

            const text = (result as any).text?.trim?.() || (result as any).text || '';
            const mapping = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());

            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(scene => ({
                    ...scene,
                    veoPreset: mapping[scene.id] || scene.veoPreset || 'cinematic-master'
                }))
            }));
        } catch (e) {
            console.error("Suggest Veo Presets failed", e);
        }
    }, [state.scenes, userApiKey, setApiKeyModalOpen, updateStateAndRecord]);

    const applyPresetToAll = useCallback((presetValue: string) => {
        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(scene => ({ ...scene, veoPreset: presetValue }))
        }));
    }, [updateStateAndRecord]);

    return {
        isVeoGenerating,
        isVeoStopping,
        isVideoGenerating,
        generateVeoPrompt,
        handleGenerateAllVeoPrompts,
        handleGenerateAllVideos,
        suggestVeoPresets,
        applyPresetToAll,
        stopVeoGeneration
    };
}
