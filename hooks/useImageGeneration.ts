import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectState, Scene } from '../types';
import {
    GLOBAL_STYLES, CAMERA_MODELS, LENS_OPTIONS, CAMERA_ANGLES,
    DEFAULT_META_TOKENS, TRANSITION_TYPES
} from '../constants/presets';
import { getPresetById } from '../utils/scriptPresets';
import { uploadImageToSupabase } from '../utils/storageUtils';

export function useImageGeneration(
    state: ProjectState,
    stateRef: React.MutableRefObject<ProjectState>,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void,
    isContinuityMode: boolean,
    userId?: string
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
            const effectiveCustomStyle = currentGroupObj?.stylePrompt ? currentGroupObj.customStyleInstruction : currentState.customStyleInstruction;

            if (effectiveStylePrompt === 'custom') {
                styleInstruction = effectiveCustomStyle || '';
            } else {
                const selectedStyle = GLOBAL_STYLES.find(s => s.value === effectiveStylePrompt);
                styleInstruction = selectedStyle ? selectedStyle.prompt : '';
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
            if (selectedChars.length > 0) {
                const charDesc = selectedChars.map(c => `[${c.name}: ${c.description}]`).join(' ');
                charPrompt = `Appearing Characters: ${charDesc}`;
            } else {
                // EXPLICIT NO CHARACTER for macro/landscape shots
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
            if (sceneToUpdate.groupId) {
                const groupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);
                if (groupObj) {
                    groupEnvAnchor = `GLOBAL SETTING: ${groupObj.description.toUpperCase()}.`;
                }
            }

            let finalImagePrompt = `${authoritativeStyle} ${scaleCmd} ${coreActionPrompt} ${groupEnvAnchor} ${charPrompt} FULL SCENE VISUALS: ${cleanedContext}. STYLE DETAILS: ${metaTokens}. TECHNICAL: (STRICT CAMERA: ${cinematographyPrompt ? cinematographyPrompt : 'High Quality'}).`.trim();

            if (refinementPrompt) {
                finalImagePrompt = `REFINEMENT: ${refinementPrompt}. BASE PROMPT: ${finalImagePrompt}`;
            }

            // --- 5. CONTINUITY & MULTI-IMAGE REFERENCES ---
            const parts: any[] = [];
            let continuityInstruction = '';

            // 5a. ABSOLUTE SET LOCK (Master Anchor + Continuity Anchor)
            if (sceneToUpdate.groupId) {
                const groupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);

                // 1. MASTER ANCHOR: The very first image in the group (The "Set")
                const firstSceneInGroup = currentState.scenes
                    .filter(s => s.groupId === sceneToUpdate.groupId && s.generatedImage)
                    .sort((a, b) => parseInt(a.scene_number) - parseInt(b.scene_number))[0];

                // 2. CONTINUITY ANCHOR: The immediately preceding generated image
                const precedingSceneInGroup = currentState.scenes
                    .slice(0, currentSceneIndex)
                    .filter(s => s.groupId === sceneToUpdate.groupId && s.generatedImage)
                    .reverse()[0];

                if (firstSceneInGroup?.generatedImage) {
                    const [header, data] = firstSceneInGroup.generatedImage.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    const refLabel = `SCENE_MASTER_LOCK (Set Anchor)`;
                    parts.push({ text: `[${refLabel}]: AUTHORITATIVE STRICT BACKGROUND for the physical environment. Match the architecture, props, weather, and lighting EXACTLY. This is a TIGHT SET LOCK. IGNORE the action in this reference, only follow its GEOMETRY and LIGHTING.` });
                    parts.push({ inlineData: { data, mimeType } });
                    continuityInstruction += `(STRICT SET LOCK: Follow ${refLabel}) `;
                }

                if (precedingSceneInGroup?.generatedImage && precedingSceneInGroup.id !== firstSceneInGroup?.id) {
                    const [header, data] = precedingSceneInGroup.generatedImage.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    const refLabel = `SHOT_CONTINUITY_ANCHOR (Last Shot)`;
                    parts.push({ text: `[${refLabel}]: Match character clothing, hair state, and immediate action from this previous shot. Note: This shot is a PERSPECTIVE SHIFT from the Master Lock.` });
                    parts.push({ inlineData: { data, mimeType } });
                    continuityInstruction += `(SHOT CONTINUITY: Follow ${refLabel}) `;
                } else if (!firstSceneInGroup && groupObj?.conceptImage) {
                    const [header, data] = groupObj.conceptImage.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    parts.push({ text: `[MOODBOARD REFERENCE]: Match lighting, color palette, and architectural style.` });
                    parts.push({ inlineData: { data, mimeType } });
                    continuityInstruction += `(CONCEPT LOCK) `;
                }

                if (continuityInstruction) {
                    continuityInstruction = `CAMERA PERSPECTIVE SHIFT: Only change the camera angle. Everything else is LOCKED. ${continuityInstruction}`;
                }
            }

            // 5b. CHARACTER & PRODUCT REFERENCES (Advanced Mapping for Gemini 3 Pro - 14 References)
            const isPro = currentState.imageModel === 'gemini-3-pro-image-preview';
            let referencePreamble = '';

            selectedChars.forEach((char) => {
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

                charRefs.forEach(ref => {
                    const [header, data] = ref.img.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    const refLabel = `MASTER VISUAL: ${char.name.toUpperCase()} ${ref.type}`;
                    parts.push({ text: `[${refLabel}]: AUTHORITATIVE identity anchor for ${char.name}. Match these exact face features. For clothing and pose, defer to SCENE_LOCK_REFERENCE if present. Description: ${char.description}` });
                    parts.push({ inlineData: { data, mimeType } });
                    referencePreamble += `(IDENTITY CONTINUITY: Match ${refLabel}) `;
                });
            });

            const selectedProducts = currentState.products.filter(p => sceneToUpdate.productIds.includes(p.id));
            selectedProducts.forEach((prod) => {
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

                prodRefs.forEach(ref => {
                    const [header, data] = ref.img.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
                    const refLabel = `MASTER VISUAL: ${prod.name.toUpperCase()} ${ref.type}`;
                    parts.push({ text: `[${refLabel}]: AUTHORITATIVE visual anchor for ${prod.name}. Match the design, colors, and branding from this image exactly.` });
                    parts.push({ inlineData: { data, mimeType } });
                    referencePreamble += `(PRODUCT CONTINUITY: Match ${refLabel}) `;
                });
            });

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
