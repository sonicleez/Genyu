import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectState, Scene, Character, Product, DirectorPreset } from '../types';
import { getPresetById } from '../utils/scriptPresets';
import { buildScriptPrompt, buildGroupRegenerationPrompt } from '../utils/promptBuilder';
import { generateId } from '../utils/helpers';
import { callGeminiText } from '../utils/geminiUtils';


export function useScriptGeneration(
    state: ProjectState,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void,
    setAgentState: (agent: 'director' | 'dop', status: any, message?: string, stage?: string) => void

) {

    const [isScriptGenerating, setIsScriptGenerating] = useState(false);

    const handleGenerateScript = useCallback(async (idea: string, count: number, selectedCharacterIds: string[], selectedProductIds: string[], director?: DirectorPreset) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) {
            alert("Vui lòng nhập API Key để sử dụng tính năng này.");
            setApiKeyModalOpen(true);
            return null;
        }

        setIsScriptGenerating(true);
        setAgentState('dop', 'thinking', 'Đang phân tích ý tưởng và xây dựng kịch bản chi tiết...');


        try {
            const activePreset = getPresetById(state.activeScriptPreset, state.customScriptPresets);
            if (!activePreset) {
                throw new Error("Preset not found");
            }

            const activeCharacters = state.characters.filter(c => selectedCharacterIds.includes(c.id));
            const activeProducts = (state.products || []).filter(p => selectedProductIds.includes(p.id));

            const effectiveLanguage = state.scriptLanguage === 'custom'
                ? (state.customScriptLanguage || 'English')
                : (state.scriptLanguage === 'vietnamese' ? 'Vietnamese' : 'English');

            const prompt = buildScriptPrompt(idea, activePreset, activeCharacters, activeProducts, count, effectiveLanguage, state.customScriptInstruction, director);

            const [modelId, thinkingLevel] = (state.scriptModel || 'gemini-3.0-flash|high').split('|');

            const ai = new GoogleGenAI({ apiKey });

            const sceneProperties: any = {
                scene_number: { type: Type.STRING },
                group_id: { type: Type.STRING },
                prompt_name: { type: Type.STRING },
                visual_context: { type: Type.STRING },
                character_ids: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                },
                product_ids: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            };

            if (activePreset.outputFormat.hasDialogue) {
                sceneProperties.dialogues = {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            characterName: { type: Type.STRING },
                            line: { type: Type.STRING }
                        }
                    }
                };
            }

            if (activePreset.outputFormat.hasNarration) {
                sceneProperties.voiceover = { type: Type.STRING };
            }

            if (activePreset.outputFormat.hasCameraAngles) {
                sceneProperties.camera_angle = { type: Type.STRING };
            }

            const generationConfig: any = {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        global_story_context: { type: Type.STRING }, // New Field
                        detailed_story: { type: Type.STRING },
                        scene_groups: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    continuity_reference_group_id: { type: Type.STRING }
                                },
                                required: ["id", "name", "description"]
                            }
                        },
                        scenes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: sceneProperties,
                                required: ["scene_number", "visual_context", "prompt_name", "character_ids", "group_id"]
                            }
                        }
                    },
                    required: ["global_story_context", "detailed_story", "scene_groups", "scenes"]
                }
            };

            if (thinkingLevel && thinkingLevel !== 'none') {
                (generationConfig as any).thinkingConfig = { thinkingLevel };
            }

            const response = await ai.models.generateContent({
                model: modelId,
                contents: prompt,
                config: generationConfig
            });

            const rawText = response.text || '{}';
            const jsonResponse = JSON.parse(rawText);

            const finalScript = {
                globalStoryContext: jsonResponse.global_story_context || '',
                detailedStory: jsonResponse.detailed_story || '',
                groups: jsonResponse.scene_groups || [],
                scenes: jsonResponse.scenes || []
            };

            // --- Pre-Production Style Audit (The "Gatekeeper") ---
            setAgentState('director', 'thinking', 'Đang thực hiện Style Audit để đồng bộ visual DNA...', 'Pre-Prod Audit');

            const auditPrompt = `You are the AI Director. Audit the following generated scenes for visual and material consistency.
            
            SCENES:
            ${finalScript.scenes.map((s: any) => `Scene ${s.scene_number}: ${s.visual_context}`).join('\n')}


            GUIDELINES:
            1. Characters MUST have consistent visual DNA (materials, clothing descriptions, facial features) across all scenes.
            2. If you detect a character is described as "human" in one scene but "mannequin" in another, harmonize them.
            3. Synchronize lighting and weather keywords if they are in the same location/time.
            
            OUTPUT: JSON array of string (the corrected visual_context for each scene), same order.`;

            try {
                const auditedTextsRaw = await callGeminiText(apiKey, auditPrompt, 'System: Expert Film Director.', 'gemini-3-flash-preview', true);


                const auditedTexts = JSON.parse(auditedTextsRaw);

                if (Array.isArray(auditedTexts) && auditedTexts.length === finalScript.scenes.length) {
                    finalScript.scenes = finalScript.scenes.map((s: any, idx: number) => ({
                        ...s,
                        visual_context: auditedTexts[idx]
                    }));
                    setAgentState('director', 'success', 'Style Audit hoàn tất! Visual DNA đã được đồng bộ.');

                    // --- Extract Material Kit for future reference ---
                    const kitPrompt = `Based on these audited scenes, extract a "Material Kit" (5-10 technical words like 'brushed aluminum', 'cinematic lighting', '8k octane') that should be used in EVERY future prompt for this project to maintain visual DNA.
                    SCENES:
                    ${auditedTexts.slice(0, 3).join('\n')}
                    OUTPUT: Just the comma-separated words.`;

                    try {
                        const kit = await callGeminiText(apiKey, kitPrompt, 'System: Expert Technical Director.', 'gemini-3-flash-preview', false);


                        updateStateAndRecord(s => ({
                            ...s,
                            researchNotes: {
                                ...s.researchNotes,
                                materialKit: kit
                            }
                        }));
                    } catch (e) { console.error('Kit extraction failed:', e); }
                }
            } catch (auditError) {

                console.error('Style Audit failed:', auditError);
                // Fallback: Continue with original scenes if audit fails
            }

            return finalScript;


        } catch (error) {

            console.error("Script generation failed:", error);
            alert("Tạo kịch bản thất bại. Vui lòng thử lại.");
            return null;
        } finally {
            setIsScriptGenerating(false);
        }
    }, [state, userApiKey, setApiKeyModalOpen]);

    const handleRegenerateGroup = useCallback(async (detailedStory: string, groupToRegen: any, allGroups: any[], sceneCount?: number) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) {
            setApiKeyModalOpen(true);
            return null;
        }

        setIsScriptGenerating(true);
        setAgentState('dop', 'thinking', 'Đang tái cấu trúc nhóm phân cảnh...');


        try {
            const activePreset = getPresetById(state.activeScriptPreset, state.customScriptPresets);
            if (!activePreset) throw new Error("Preset not found");

            const effectiveLanguage = state.scriptLanguage === 'custom'
                ? (state.customScriptLanguage || 'English')
                : (state.scriptLanguage === 'vietnamese' ? 'Vietnamese' : 'English');

            const prompt = buildGroupRegenerationPrompt(
                detailedStory,
                groupToRegen,
                allGroups,
                activePreset,
                state.characters,
                state.products || [],
                effectiveLanguage,
                state.customScriptInstruction,
                groupToRegen.pacing,
                sceneCount
            );

            const [modelId, thinkingLevel] = (state.scriptModel || 'gemini-3-flash-preview|high').split('|');
            const ai = new GoogleGenAI({ apiKey });

            const generationConfig: any = {
                responseMimeType: "application/json",
            };

            if (thinkingLevel && thinkingLevel !== 'none') {
                (generationConfig as any).thinkingConfig = { thinkingLevel };
            }

            const response = await ai.models.generateContent({
                model: modelId,
                contents: prompt,
                config: generationConfig
            });

            const rawText = response.text || '{}';
            const jsonResponse = JSON.parse(rawText);

            setAgentState('dop', 'success', 'Cấu trúc nhóm phân cảnh đã được cập nhật.');
            return jsonResponse.scenes || [];

        } catch (error) {
            console.error("Group regeneration failed:", error);
            alert("Tái tạo nhóm kịch bản thất bại.");
            return null;
        } finally {
            setIsScriptGenerating(false);
        }
    }, [state, userApiKey, setApiKeyModalOpen]);

    const handleSmartMapAssets = useCallback(async (scenes: any[], characters: Character[], products: Product[]) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) return null;

        try {
            const ai = new GoogleGenAI({ apiKey });

            const mappingPrompt = `
            **TASK:** Audit this list of scenes and map the correct Character and Product IDs to each scene based on their visual description and dialogue.
            
            **AVAILABLE ASSETS:**
            Characters:
            ${JSON.stringify(characters.map(c => ({ id: c.id, name: c.name, description: c.description })), null, 2)}
            
            Products:
            ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, description: p.description })), null, 2)}
            
            **SCENES TO MAP:**
            ${JSON.stringify(scenes.map(s => ({
                scene_number: s.scene_number,
                visual_context: s.visual_context,
                dialogues: s.dialogues,
                voiceover: s.voiceover
            })), null, 2)}
            
            **RULES:**
            1. Characters should ONLY be mapped if they are EXPLICITLY mentioned by name or have DIALOGUE in this specific scene.
            2. DO NOT map characters based on ambiguous pronouns (like "he", "she", "they") unless their visual description is the primary focus of the "visual_context".
            3. Products should be mapped if they are the primary focus or interactable item in the scene.
            4. If a scene is environmental or purely landscape, both arrays should be empty.
            3. Return ONLY a JSON object where keys are "scene_number" and values are objects containing "character_ids" and "product_ids" arrays.
            
            **EXAMPLE FORMAT:**
            {
              "1": { "character_ids": ["id1", "id2"], "product_ids": ["prod1"] },
              "2": { "character_ids": ["id1"], "product_ids": [] }
            }
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: mappingPrompt,
                config: {
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingLevel: 'low' }
                } as any
            });

            const rawText = response.text || '{}';
            return JSON.parse(rawText);
        } catch (error) {
            console.error("Smart mapping failed:", error);
            return null;
        }
    }, [userApiKey]);

    return {
        handleGenerateScript,
        handleRegenerateGroup,
        handleSmartMapAssets,
        isScriptGenerating
    };
}
