import { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { ProjectState, Scene, Character, Product } from '../types';
import { getPresetById } from '../utils/scriptPresets';
import { buildScriptPrompt, buildGroupRegenerationPrompt } from '../utils/promptBuilder';
import { generateId } from '../utils/helpers';

export function useScriptGeneration(
    state: ProjectState,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void
) {
    const [isScriptGenerating, setIsScriptGenerating] = useState(false);

    const handleGenerateScript = useCallback(async (idea: string, count: number, selectedCharacterIds: string[], selectedProductIds: string[]) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        if (!apiKey) {
            alert("Vui lòng nhập API Key để sử dụng tính năng này.");
            setApiKeyModalOpen(true);
            return null;
        }

        setIsScriptGenerating(true);

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

            const prompt = buildScriptPrompt(idea, activePreset, activeCharacters, activeProducts, count, effectiveLanguage, state.customScriptInstruction);

            const [modelId, thinkingLevel] = (state.scriptModel || 'gemini-3-flash-preview|high').split('|');

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
                    required: ["detailed_story", "scene_groups", "scenes"]
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

            return {
                detailedStory: jsonResponse.detailed_story || '',
                groups: jsonResponse.scene_groups || [],
                scenes: jsonResponse.scenes || []
            };

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
