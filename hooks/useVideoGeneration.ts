import { useState, useCallback } from 'react';
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
    const [isVideoGenerating, setIsVideoGenerating] = useState(false);

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
             Role: Expert Video Prompt Designer for Google Veo 3.1.
             
             **THE OFFICIAL VEO 3.1 FRAMEWORK:**
             Follow this exact five-part formula for high-quality generation:
             [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance] + [Soundstage (SFX/Ambient)] + [Emotion Tag]
             
             **EXPERIMENTAL FEATURE: TIMESTAMP PROMPTING**
             For multi-shot sequences, use timestamps to direct precise cinematic pacing:
             [00:00-00:02] [Action 1 with Shot Type]
             [00:02-00:04] [Action 2 with Reverse Shot/Tracking]
             [00:04-00:06] [Action 3 with Close-up]
             ...and so on.
             
             **INPUT DATA:**
             - Vision: Keyframe Image Provided (Use as foundation).
             - Scene Description: "${context}"
             - Intent: "${promptName}"
             - Dialogue: "${scriptText}"
             - Featured Products: "${productContext}"
             - Technical Directives: "${scene.cameraAngleOverride === 'custom' ? scene.customCameraAngle : (CAMERA_ANGLES.find(a => a.value === scene.cameraAngleOverride)?.label || 'Auto')} | ${scene.lensOverride === 'custom' ? scene.customLensOverride : (LENS_OPTIONS.find(l => l.value === scene.lensOverride)?.label || 'Auto')}"
             - Preset Mode: "${selectedPreset.label}"
             - PRESET INSTRUCTION: "${selectedPreset.prompt}"
             
             **GENERATION INSTRUCTIONS:**
             1. **Mode Check:** 
                - If Preset Mode indicates "Single Shot", generate one cohesive formula string starting with [00:00-00:06].
                - If Preset Mode indicates "Multi-Shot", you MUST generate exactly 3-4 segments using timestamps (e.g., [00:00-00:02], [00:02-00:04], etc.).
             2. **Formula Adherence:** Every segment (or single shot) MUST follow: [Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance].
             3. **Quality Examples:**
                - *Single Shot Example:* [00:00-00:06] Wide shot, Kaya stands purposefully, in a rugged fur-lined tent with firelight flickering, photorealistic cinematic style. SFX: crackling fire. Emotion: Determination.
                - *Multi-Shot Example:* 
                  [00:00-00:02] Medium shot of Kaya looking at the camera, in a dim tent.
                  [00:02-00:04] Close-up of Kaya's hands tightening a leather belt.
                  [00:04-00:06] Reverse shot showing Kaya's resolute expression.
                  Emotion: Readiness. SFX: leather creaking.
             4. **Audio & Emotion:** Integrate SFX, Ambient, and Emotion tags as requested.
             5. **Technical:** Incorporate Lens ("${scene.lensOverride}") and Angle ("${scene.cameraAngleOverride}") directives naturally.
             
             **OUTPUT:**
             Return ONLY the prompt string.
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
                await generateVeoPrompt(scene.id);
                await new Promise(r => setTimeout(r, 200));
            }
        } finally {
            setIsVeoGenerating(false);
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
        isVideoGenerating,
        generateVeoPrompt,
        handleGenerateAllVeoPrompts,
        handleGenerateAllVideos,
        suggestVeoPresets,
        applyPresetToAll
    };
}
