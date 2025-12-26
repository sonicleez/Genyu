import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectState } from '../types';
import { CAMERA_ANGLES, LENS_OPTIONS, VEO_PRESETS } from '../constants/presets';
import { Scene } from '../types';

export function useVideoGeneration(
    state: ProjectState,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void
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
        if (!scene || !scene.generatedImage) return;

        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) return;

        try {
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
                    console.error("Fetch image failed", e);
                    return;
                }
            }

            const scriptText = state.scriptLanguage === 'vietnamese' ? scene.vietnamese : scene.language1;
            const context = scene.contextDescription || '';
            const promptName = scene.promptName || '';
            const sceneProducts = (state.products || []).filter(p => (scene.productIds || []).includes(p.id));
            const productContext = sceneProducts.map(p => `Product: ${p.name} (${p.description})`).join('; ');

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
- Dialogue/Script: "${scriptText}"
- Products visible: "${productContext}"
- Camera Angle: "${scene.cameraAngleOverride === 'custom' ? scene.customCameraAngle : (CAMERA_ANGLES.find(a => a.value === scene.cameraAngleOverride)?.label || 'Auto')}"
- Lens Style: "${scene.lensOverride === 'custom' ? scene.customLensOverride : (LENS_OPTIONS.find(l => l.value === scene.lensOverride)?.label || 'Auto')}"

**PRESET MODE: ${selectedPreset.label}**
${selectedPreset.prompt}

**GENERATION RULES FOR IMAGE-TO-VIDEO:**
1. START by analyzing the keyframe image - describe its visual elements
2. The [Subject] in your prompt = the subject VISIBLE in the image
3. The [Context] = the environment VISIBLE in the image  
4. The [Style] = match the lighting, colors, and aesthetic of the image
5. Add MOTION that makes sense for what's in the image
6. Include SFX and Emotion tags appropriate to the scene

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
                    console.log('[Veo] Stopped by user');
                    break;
                }
                await generateVeoPrompt(scene.id);
                await new Promise(r => setTimeout(r, 200));
            }
        } finally {
            setIsVeoGenerating(false);
            setIsVeoStopping(false);
            stopVeoRef.current = false;
        }
    }, [state.scenes, userApiKey, generateVeoPrompt, setApiKeyModalOpen, updateStateAndRecord]);

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
