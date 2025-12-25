import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectState, Scene } from '../types';
import {
    GLOBAL_STYLES, CAMERA_MODELS, LENS_OPTIONS, CAMERA_ANGLES,
    DEFAULT_META_TOKENS, TRANSITION_TYPES
} from '../constants/presets';
import { getPresetById } from '../utils/scriptPresets';
import { uploadImageToSupabase } from '../utils/storageUtils';

// Helper function to safely extract base64 data from both URL and base64 images
const safeGetImageData = async (imageStr: string): Promise<{ data: string; mimeType: string } | null> => {
    if (!imageStr) return null;

    try {
        if (imageStr.startsWith('data:')) {
            // It's a base64 data URI
            const [header, data] = imageStr.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
            return { data, mimeType };
        } else if (imageStr.startsWith('http')) {
            // It's a URL, fetch and convert
            console.log('[ImageGen] 🌐 Converting URL to Base64...');
            const response = await fetch(imageStr);
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const mimeType = blob.type || 'image/jpeg';
            const data = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            return { data, mimeType };
        }
    } catch (e) {
        console.error('[ImageGen] ❌ Failed to process image:', e);
    }
    return null;
};

// Helper function to clean VEO-specific tokens from prompt for image generation
const cleanPromptForImageGen = (prompt: string): string => {
    return prompt
        .replace(/\[\d{2}:\d{2}-\d{2}:\d{2}\]/g, '') // Remove timestamps [00:00-00:05]
        .replace(/SFX:.*?(\.|$)/gi, '') // Remove SFX descriptions
        .replace(/Emotion:.*?(\.|$)/gi, '') // Remove Emotion descriptions
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim();
};

export function useImageGeneration(
    state: ProjectState,
    stateRef: React.MutableRefObject<ProjectState>,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void,
    isContinuityMode: boolean,
    userId?: string,
    isOutfitLockMode?: boolean
) {
    const [isBatchGenerating, setIsBatchGenerating] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const stopRef = useRef(false);

    const stopBatchGeneration = useCallback(() => {
        if (isBatchGenerating) {
            stopRef.current = true;
            setIsStopping(true);
        }
    }, [isBatchGenerating]);

    const callAIImageAPI = async (
        prompt: string,
        apiKey: string | null,
        model: string,
        aspectRatio: string,
        parts: any[] = []
    ): Promise<{ imageUrl: string; mediaId?: string }> => {
        const isHighRes = model === 'gemini-3-pro-image-preview';

        if (apiKey && isHighRes) {
            const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

            const fullParts = [...parts];
            if (prompt) fullParts.push({ text: prompt });

            const response = await ai.models.generateContent({
                model: model,
                contents: fullParts,
                config: {
                    imageConfig: { aspectRatio: aspectRatio || "16:9" }
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
            if (imagePart?.inlineData) {
                return { imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` };
            } else {
                throw new Error("Không nhận được ảnh từ API.");
            }
        } else {
            throw new Error("Missing Credentials (API Key)");
        }
    };

    const performImageGeneration = useCallback(async (sceneId: string, refinementPrompt?: string, isEndFrame: boolean = false) => {
        const currentState = stateRef.current;
        const currentSceneIndex = currentState.scenes.findIndex(s => s.id === sceneId);
        const sceneToUpdate = currentState.scenes[currentSceneIndex];
        if (!sceneToUpdate) return;

        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: true, error: null } : sc)
        }));

        try {
            // --- 1. GET STYLE PROMPT ---
            let styleInstruction = '';
            const currentGroupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);
            const effectiveStylePrompt = currentGroupObj?.stylePrompt || currentState.stylePrompt;

            // Use group's custom style if it has one, otherwise fallback to global
            const effectiveCustomStyle = (currentGroupObj?.stylePrompt === 'custom' && currentGroupObj?.customStyleInstruction)
                ? currentGroupObj.customStyleInstruction
                : currentState.customStyleInstruction;

            if (effectiveStylePrompt === 'custom') {
                styleInstruction = effectiveCustomStyle || '';
                console.log('[ImageGen] Using CUSTOM style:', styleInstruction?.substring(0, 100) + '...');
            } else {
                const selectedStyle = GLOBAL_STYLES.find(s => s.value === effectiveStylePrompt);
                styleInstruction = selectedStyle ? selectedStyle.prompt : '';
                console.log('[ImageGen] Using PRESET style:', effectiveStylePrompt);
            }

            // --- 2. CINEMATOGRAPHY ---
            const cameraModelInfo = CAMERA_MODELS.find(c => c.value === currentState.cameraModel);
            const cameraPrompt = currentState.cameraModel === 'custom' ? (currentState.customCameraModel ? `Shot on ${currentState.customCameraModel}` : '') : (cameraModelInfo?.prompt || '');

            const effectiveLens = sceneToUpdate.lensOverride || currentState.defaultLens || '';
            const lensInfo = LENS_OPTIONS.find(l => l.value === effectiveLens);
            const lensPrompt = effectiveLens === 'custom' ? (sceneToUpdate.customLensOverride || currentState.customDefaultLens || '') : (lensInfo?.prompt || '');

            const angleInfo = CAMERA_ANGLES.find(a => a.value === (sceneToUpdate.cameraAngleOverride || ''));
            const anglePrompt = (sceneToUpdate.cameraAngleOverride === 'custom' ? sceneToUpdate.customCameraAngle : angleInfo?.label) || '';

            const activePreset = getPresetById(currentState.activeScriptPreset, currentState.customScriptPresets);
            const metaTokens = currentState.customMetaTokens || DEFAULT_META_TOKENS[activePreset?.category || 'custom'] || DEFAULT_META_TOKENS['custom'];

            const cinematographyPrompt = [cameraPrompt, lensPrompt, anglePrompt].filter(Boolean).join(', ');

            // Clean context from AI meta-instructions - broader regex
            let cleanedContext = (sceneToUpdate.contextDescription || '')
                .replace(/Referencing environment from.*?(consistency|logic|group|refgroup|nhất quán)\.?/gi, '')
                .replace(/Tham chiếu bối cảnh từ.*?(nhất quán|consistency)\.?/gi, '')
                .trim();

            // STRIP VEO-specific tokens (timestamps, SFX, Emotion) for image generation
            cleanedContext = cleanPromptForImageGen(cleanedContext);

            // STRIP character names from context if they are NOT selected for this scene
            const unselectedChars = currentState.characters.filter(c => !sceneToUpdate.characterIds.includes(c.id));
            unselectedChars.forEach(c => {
                if (!c.name) return;
                const escapedName = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
                cleanedContext = cleanedContext.replace(regex, '');
            });
            cleanedContext = cleanedContext.replace(/\s+/g, ' ').trim();


            const isHighRes = (currentState.imageModel || 'gemini-3-pro-image-preview') === 'gemini-3-pro-image-preview';

            // --- 3. CHARACTERS & PRODUCTS ---
            const selectedChars = currentState.characters.filter(c => sceneToUpdate.characterIds.includes(c.id));
            let charPrompt = '';
            const isDocumentary = activePreset?.category === 'documentary';

            if (selectedChars.length > 0) {
                const charDesc = selectedChars.map(c => `[${c.name}: ${c.description}]`).join(' ');
                const outfitConstraint = isOutfitLockMode ? ' (STRICT OUTFIT LOCK: Use EXACT clothes/colors from reference images.)' : '';
                charPrompt = `Appearing Characters: ${charDesc}${outfitConstraint}`;
            } else if (isDocumentary) {
                // DOCUMENTARY MODE: Allow anonymous people (crowds, subjects, etc.)
                charPrompt = `DOCUMENTARY STYLE: Use realistic anonymous people fitting the scene context. No specific character identity required - focus on authentic human moments and environmental storytelling. Generate contextually appropriate people (workers, crowds, passersby, subjects) without fixed character references.`;
            } else {
                // EXPLICIT NO CHARACTER for macro/landscape shots (non-documentary)
                charPrompt = `STRICT NEGATIVE: NO PEOPLE, NO CHARACTERS, NO HUMANS, NO FACES, NO BODY PARTS. EXPLICITLY REMOVE ALL HUMAN ELEMENTS. FOCUS ONLY ON ${cleanedContext.toUpperCase() || 'ENVIRONMENT'}.`;
            }


            // --- 3.5 EXTRACT CORE ACTION ---
            // Try to find the action part after "->" or at least pick key verbs
            let coreAction = '';
            if (cleanedContext.includes('->')) {
                const parts = cleanedContext.split('->');
                coreAction = parts[parts.length - 1].trim();
            } else {
                coreAction = cleanedContext; // Fallback
            }
            const coreActionPrompt = `CORE ACTION: ${coreAction.toUpperCase()}. (Ensure high dynamic energy, motion blur if applicable, realistic physics).`;

            // --- 4. FINAL PROMPT CONSTRUCTION (Priority Order) ---
            // STYLE & NEGATIVE CONSTRAINTS (Authoritative)
            const isRealistic = effectiveStylePrompt === 'cinematic-realistic' || effectiveStylePrompt === 'vintage-film';
            const negativeStyle = isRealistic ? '!!! STRICT NEGATIVE: NO ANIME, NO CARTOON, NO 2D, NO DRAWING, NO ILLUSTRATION, NO PAINTING, NO CGI-LOOK !!!' : '';
            const authoritativeStyle = `AUTHORITATIVE STYLE: ${styleInstruction.toUpperCase()}. ${negativeStyle}`;

            // Shot Scale (Angle) is the ABSOLUTE PRIORITY for composition
            const scaleCmd = anglePrompt ? `SHOT SCALE: ${anglePrompt.toUpperCase()}.` : 'CINEMATIC WIDE SHOT.';

            // GLOBAL ENVIRONMENT ANCHOR (To prevent drift within group)
            let groupEnvAnchor = '';
            let timeWeatherLock = '';
            if (sceneToUpdate.groupId) {
                const groupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);
                if (groupObj) {
                    groupEnvAnchor = `GLOBAL SETTING: ${groupObj.description.toUpperCase()}.`;

                    // TIME & WEATHER CONSISTENCY LOCK
                    const timeParts: string[] = [];

                    // Time of Day
                    if (groupObj.timeOfDay) {
                        const timeStr = groupObj.timeOfDay === 'custom'
                            ? (groupObj.customTimeOfDay || '')
                            : groupObj.timeOfDay.toUpperCase();
                        if (timeStr) timeParts.push(`TIME: ${timeStr}`);
                    }

                    // Weather
                    if (groupObj.weather) {
                        const weatherStr = groupObj.weather === 'custom'
                            ? (groupObj.customWeather || '')
                            : groupObj.weather.toUpperCase();
                        if (weatherStr) timeParts.push(`WEATHER: ${weatherStr}`);
                    }

                    // Lighting Mood
                    if (groupObj.lightingMood) {
                        timeParts.push(`LIGHTING: ${groupObj.lightingMood.toUpperCase()}`);
                    }

                    if (timeParts.length > 0) {
                        timeWeatherLock = `[TIME/WEATHER LOCK - STRICT CONSISTENCY]: ${timeParts.join(', ')}. ALL scenes in this group MUST have IDENTICAL lighting direction, shadow angles, sky color, and atmospheric conditions.`;
                    }
                }
            }


            let finalImagePrompt = `${authoritativeStyle} ${scaleCmd} ${coreActionPrompt} ${groupEnvAnchor} ${timeWeatherLock} ${charPrompt} FULL SCENE VISUALS: ${cleanedContext}. STYLE DETAILS: ${metaTokens}. TECHNICAL: (STRICT CAMERA: ${cinematographyPrompt ? cinematographyPrompt : 'High Quality'}).`.trim();

            if (refinementPrompt) {
                finalImagePrompt = `REFINEMENT: ${refinementPrompt}. BASE PROMPT: ${finalImagePrompt}`;
            }

            // --- 5. CONTINUITY & MULTI-IMAGE REFERENCES ---
            const parts: any[] = [];
            let continuityInstruction = '';
            const isPro = currentState.imageModel === 'gemini-3-pro-image-preview';

            // 5a. CHARACTER FACE ID ANCHOR (ABSOLUTE FIRST - Before Style!)
            // Character identity MUST be established before AI sees any style reference
            for (const char of selectedChars) {
                // PRIMARY ANCHOR: Face ID (most important)
                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `PRIMARY_IDENTITY: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! ABSOLUTE CHARACTER LOCK !!! This is the ONLY person allowed in the image. Use THIS EXACT face - no substitutions. Facial features, bone structure, skin tone, face shape are NON-NEGOTIABLE. If you see a different person in any other reference, REPLACE them with THIS person. Character: ${char.description}` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(CHARACTER: ${char.name}) `;
                    }
                }

                // SECONDARY ANCHOR: Master Image (full body reference)
                if (char.masterImage && char.masterImage !== char.faceImage) {
                    const imgData = await safeGetImageData(char.masterImage);
                    if (imgData) {
                        const refLabel = `FULL_REFERENCE: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: Body and posture reference for ${char.name}. FACE from PRIMARY_IDENTITY takes precedence.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }
            // 5b. STYLE REFERENCE IMAGE
            // CRITICAL: Only use style IMAGE when NO characters selected
            // If characters are present, style should come from TEXT only to prevent face copying
            const hasCharacters = selectedChars.length > 0 && selectedChars.some(c => c.faceImage || c.masterImage);

            if (currentState.stylePrompt === 'custom' && currentState.customStyleImage && !hasCharacters) {
                // No characters = safe to use style image
                const imgData = await safeGetImageData(currentState.customStyleImage);
                if (imgData) {
                    parts.push({ text: `[STYLE_REFERENCE]: Copy line work, colors, shading, texture from this reference.` });
                    parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    continuityInstruction += `(STYLE from image) `;
                }
            } else if (currentState.stylePrompt === 'custom' && currentState.customStyleImage && hasCharacters) {
                // HAS characters = DO NOT use style image (it causes face copying)
                // Style will come from customStyleInstruction text only
                console.log('[ImageGen] SAFETY: Style image SKIPPED because characters are selected. Using text instruction only.');
            }


            // 5b. ABSOLUTE SET LOCK (Master Anchor + Continuity Anchor)
            if (sceneToUpdate.groupId) {
                const groupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);

                // BACKGROUND LOCK: Use first scene in group for environment only
                const firstSceneInGroup = currentState.scenes
                    .filter(s => s.groupId === sceneToUpdate.groupId && s.generatedImage)
                    .sort((a, b) => parseInt(a.scene_number) - parseInt(b.scene_number))[0];

                if (firstSceneInGroup?.generatedImage) {
                    const imgData = await safeGetImageData(firstSceneInGroup.generatedImage);
                    if (imgData) {
                        const refLabel = `BACKGROUND_LOCK (Environment Only)`;
                        // CLEAN REFERENCE: Only use for background, explicitly ignore characters/props
                        parts.push({ text: `[${refLabel}]: Extract ONLY the BACKGROUND ENVIRONMENT from this image. Match: architecture, scenery, weather, lighting, time of day, sky. ABSOLUTELY IGNORE: any people, characters, props, objects, or items shown. DO NOT copy character poses, clothing, or accessories. This is for ENVIRONMENTAL CONSISTENCY ONLY.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(BACKGROUND ONLY from first scene) `;
                    }
                }

                // SHOT_CONTINUITY REMOVED - Clean Reference approach
                // Previous scene references caused props/character leaking
                // Now relying solely on character Face ID + Body Sheet for consistency

                if (!firstSceneInGroup && groupObj?.conceptImage) {
                    const imgData = await safeGetImageData(groupObj.conceptImage);
                    if (imgData) {
                        parts.push({ text: `[MOODBOARD REFERENCE]: Match lighting, color palette, and architectural style. IGNORE any characters or props.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(CONCEPT LOCK) `;
                    }
                }

                if (continuityInstruction) {
                    continuityInstruction = `ENVIRONMENT REFERENCE: Background elements only. Character appearance from IDENTITY references. ${continuityInstruction}`;
                }
            }


            // 5c. CHARACTER BODY/VIEWS & PRODUCT REFERENCES (Advanced Mapping for Gemini 3 Pro)
            let referencePreamble = '';

            for (const char of selectedChars) {
                const charRefs: { type: string, img: string }[] = [];
                if (char.faceImage) charRefs.push({ type: 'FACE ID', img: char.faceImage });
                if (char.bodyImage) charRefs.push({ type: 'FULL BODY', img: char.bodyImage });

                // Add more views if using Pro
                if (isPro) {
                    if (char.sideImage) charRefs.push({ type: 'SIDE VIEW', img: char.sideImage });
                    if (char.backImage) charRefs.push({ type: 'BACK VIEW', img: char.backImage });
                }

                // Fallback to master if no specific views exist
                if (charRefs.length === 0 && char.masterImage) {
                    charRefs.push({ type: 'PRIMARY', img: char.masterImage });
                }

                for (const ref of charRefs) {
                    const imgData = await safeGetImageData(ref.img);
                    if (imgData) {
                        const refLabel = `MASTER VISUAL: ${char.name.toUpperCase()} ${ref.type}`;
                        parts.push({ text: `[${refLabel}]: AUTHORITATIVE identity anchor for ${char.name}. Match these exact face features. For clothing and pose, defer to SCENE_LOCK_REFERENCE if present. Description: ${char.description}` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        referencePreamble += `(IDENTITY CONTINUITY: Match ${refLabel}) `;
                    }
                }
            }

            const selectedProducts = currentState.products.filter(p => sceneToUpdate.productIds.includes(p.id));
            for (const prod of selectedProducts) {
                const prodRefs: { type: string, img: string }[] = [];
                if (prod.views?.front) prodRefs.push({ type: 'FRONT VIEW', img: prod.views.front });

                // Add more views if using Pro
                if (isPro) {
                    const sideImg = prod.views?.left || prod.views?.right;
                    if (sideImg) prodRefs.push({ type: 'SIDE VIEW', img: sideImg });
                    if (prod.views?.back) prodRefs.push({ type: 'BACK VIEW', img: prod.views.back });
                    if (prod.views?.top) prodRefs.push({ type: 'TOP VIEW', img: prod.views.top });
                } else {
                    const sideImg = prod.views?.left || prod.views?.right;
                    if (sideImg) prodRefs.push({ type: 'SIDE VIEW', img: sideImg });
                }

                // Fallback to master if no specific views
                if (prodRefs.length === 0 && prod.masterImage) {
                    prodRefs.push({ type: 'PRIMARY', img: prod.masterImage });
                }

                for (const ref of prodRefs) {
                    const imgData = await safeGetImageData(ref.img);
                    if (imgData) {
                        const refLabel = `MASTER VISUAL: ${prod.name.toUpperCase()} ${ref.type}`;
                        parts.push({ text: `[${refLabel}]: AUTHORITATIVE visual anchor for ${prod.name}. Match the design, colors, and branding from this image exactly.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        referencePreamble += `(PRODUCT CONTINUITY: Match ${refLabel}) `;
                    }
                }
            }

            // 5d. IDENTITY REINFORCEMENT (SANDWICH PATTERN - Face ID again at END)
            // This reinforces character identity after scene references to prevent drift
            for (const char of selectedChars) {
                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `FINAL_IDENTITY_CHECK: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! FINAL VERIFICATION !!! Re-confirming that the generated image features THIS EXACT PERSON. Cross-check against PRIMARY_IDENTITY. If there is ANY face mismatch, regenerate.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }


            if (continuityInstruction) {
                finalImagePrompt = `${continuityInstruction.trim()} ${finalImagePrompt}`;
            }

            const { imageUrl, mediaId } = await callAIImageAPI(
                finalImagePrompt,
                userApiKey,
                currentState.imageModel || 'gemini-3-pro-image-preview',
                currentState.aspectRatio,
                isHighRes ? parts : []
            );

            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? {
                    ...sc,
                    ...(isEndFrame ? { endFrameImage: imageUrl } : { generatedImage: imageUrl }),
                    mediaId: isEndFrame ? sc.mediaId : (mediaId || sc.mediaId),
                    isGenerating: false,
                    error: null
                } : sc)
            }));

        } catch (error) {
            console.error("Image generation failed:", error);
            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: false, error: (error as Error).message } : sc)
            }));
        }
    }, [stateRef, userApiKey, updateStateAndRecord, setApiKeyModalOpen, userId]);

    const generateGroupConcept = useCallback(async (groupName: string, groupDescription: string, styleOverride?: string, customStyleOverride?: string) => {
        const currentState = stateRef.current;
        const apiKey = userApiKey || (process.env as any).API_KEY;

        if (!apiKey) {
            setApiKeyModalOpen(true);
            return null;
        }

        try {
            let styleInstruction = '';
            const effectiveStylePrompt = styleOverride || currentState.stylePrompt;
            const effectiveCustomStyle = styleOverride ? customStyleOverride : currentState.customStyleInstruction;

            if (effectiveStylePrompt === 'custom') {
                styleInstruction = effectiveCustomStyle || '';
            } else {
                const selectedStyle = GLOBAL_STYLES.find(s => s.value === effectiveStylePrompt);
                styleInstruction = selectedStyle ? selectedStyle.prompt : '';
            }

            const activePreset = getPresetById(currentState.activeScriptPreset, currentState.customScriptPresets);
            const metaTokens = currentState.customMetaTokens || DEFAULT_META_TOKENS[activePreset?.category || 'custom'] || DEFAULT_META_TOKENS['custom'];

            const conceptPrompt = `STRICT ENVIRONMENT CONCEPT ART: Location "${groupName}". DESCRIPTION: ${groupDescription}. STYLE: ${styleInstruction} ${metaTokens}. MANDATORY: Cinematic landscape/interior, architectural focus, atmospheric lighting. !!! ABSOLUTELY NO PEOPLE, NO HUMANS, NO CHARACTERS, NO FACES !!! focus purely on set design.`.trim();

            const { imageUrl } = await callAIImageAPI(
                conceptPrompt,
                userApiKey,
                currentState.imageModel || 'gemini-3-pro-image-preview',
                currentState.aspectRatio
            );

            return imageUrl;
        } catch (error) {
            console.error("Concept generation failed:", error);
            return null;
        }
    }, [stateRef, userApiKey, setApiKeyModalOpen, userId]);

    const handleGenerateAllImages = useCallback(async () => {
        const scenesToGenerate = state.scenes.filter(s => !s.generatedImage && s.contextDescription);
        if (scenesToGenerate.length === 0) return alert("Tất cả các phân cảnh có mô tả đã có ảnh.");

        setIsBatchGenerating(true);
        setIsStopping(false);
        stopRef.current = false;

        try {
            for (const scene of scenesToGenerate) {
                if (stopRef.current) break;
                await performImageGeneration(scene.id);
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsBatchGenerating(false);
            setIsStopping(false);
        }
    }, [state.scenes, performImageGeneration]);

    return {
        isBatchGenerating,
        isStopping,
        performImageGeneration,
        generateGroupConcept,
        handleGenerateAllImages,
        stopBatchGeneration
    };
}
