import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Part } from "@google/genai";
import { ProjectState, Scene } from '../types';
import {
    GLOBAL_STYLES, CAMERA_MODELS, LENS_OPTIONS, CAMERA_ANGLES,
    DEFAULT_META_TOKENS, TRANSITION_TYPES
} from '../constants/presets';
import { DIRECTOR_PRESETS, DirectorCategory } from '../constants/directors';
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
    isOutfitLockMode?: boolean,
    addToGallery?: (image: string, type: string, prompt?: string, sourceId?: string) => void,
    isDOPEnabled?: boolean,
    validateRaccordWithVision?: (currentImage: string, prevImage: string, currentScene: Scene, prevScene: Scene, apiKey: string) => Promise<{ isValid: boolean; errors: { type: string; description: string }[]; correctionPrompt?: string }>,
    makeRetryDecision?: (failedImage: string, referenceImage: string, originalPrompt: string, errors: { type: string; description: string }[], apiKey: string) => Promise<{ action: 'retry' | 'skip' | 'try_once'; reason: string; enhancedPrompt?: string; confidence: number }>
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
        parts: any[] = [],
        imageSize: string = '1K' // Added resolution parameter: '1K', '2K', or '4K'
    ): Promise<{ imageUrl: string; mediaId?: string }> => {
        const isHighRes = model === 'gemini-3-pro-image-preview';

        if (apiKey && isHighRes) {
            const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

            const fullParts = [...parts];
            if (prompt) fullParts.push({ text: prompt });

            console.log(`[ImageGen] Generating with resolution: ${imageSize}, aspectRatio: ${aspectRatio}`);

            const response = await ai.models.generateContent({
                model: model,
                contents: fullParts,
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio || "16:9",
                        imageSize: imageSize || '1K' // Pass resolution to API
                    }
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
                console.log('[ImageGen] ✨ CUSTOM style check:', {
                    effectiveStylePrompt,
                    effectiveCustomStyle: effectiveCustomStyle?.substring(0, 50) + '...',
                    customStyleImage: currentState.customStyleImage ? '✅ Image attached' : '❌ No image',
                    stateCustomStyleInstruction: currentState.customStyleInstruction?.substring(0, 50) + '...'
                });
            } else {
                const selectedStyle = GLOBAL_STYLES.find(s => s.value === effectiveStylePrompt);
                styleInstruction = selectedStyle ? selectedStyle.prompt : '';
                console.log('[ImageGen] 🎨 PRESET style:', effectiveStylePrompt, '| Prompt:', styleInstruction?.substring(0, 50));
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
                // Find group to check for overrides
                const group = sceneToUpdate.groupId
                    ? currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId)
                    : null;

                const charDesc = selectedChars.map(c => {
                    const override = group?.outfitOverrides?.[c.id];
                    if (override) {
                        return `[${c.name}: ${c.description}. MANDATORY OUTFIT OVERRIDE: ${override}. IGNORE ALL PRIOR CLOTHING DETAILS.]`;
                    }
                    return `[${c.name}: ${c.description}]`;
                }).join(' ');

                const outfitConstraint = ' (MANDATORY COSTUME LOCK: Character MUST be wearing the exact clothing/uniform shown in their FULL BODY reference image OR the specified OUTFIT OVERRIDE. ABSOLUTELY NO NAKEDNESS.)';

                // FACELESS ENFORCEMENT
                const isFacelessMode = currentState.globalCharacterStyleId?.includes('faceless');
                const facelessConstraint = isFacelessMode
                    ? ' !!! STRICT FACELESS MODE: NO FACES, NO EYES, NO MOUTH. Heads must be turned away, in shadow, or obscured. !!! '
                    : '';

                charPrompt = `Appearing Characters: ${charDesc}${outfitConstraint}${facelessConstraint}`;
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

            // NO DRIFT GUARD: Prevent "Chibi" or distortion if style is realistic
            const noDriftGuard = isRealistic ? "!!! MANDATORY CONSISTENCY: Maintain realistic human/object dimensions. NO DISTORTIONS. !!!" : "";

            // SCALE LOCK: If it's a close-up, reference the previous shot's scale
            let scaleLockInstruction = '';
            if (anglePrompt.toUpperCase().includes('CLOSE UP') || anglePrompt.toUpperCase().includes('POV')) {
                scaleLockInstruction = '[SCALE LOCK]: Reference the object/subject dimensions from previous wide shots. Match texture and relative size exactly. ';
            }

            // GLOBAL ENVIRONMENT ANCHOR (To prevent drift within group)
            let groupEnvAnchor = '';
            let timeWeatherLock = '';
            if (sceneToUpdate.groupId) {
                const groupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);
                if (groupObj) {
                    groupEnvAnchor = `GLOBAL SETTING: ${groupObj.description.toUpperCase()}. [SET ANCHOR]: Maintain fixed positions of furniture, windows, and architectural landmarks (e.g. fireplace, counter).`;

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
                        timeWeatherLock = `[GLOBAL ATMOSPHERE LOCK]: ${timeParts.join(', ')}. MANDATORY: ALL scenes in this group MUST have IDENTICAL lighting direction, shadow intensity, sky color, and atmospheric mood. No variations allowed.`;
                    }
                }
            }

            // --- DIRECTOR DNA INJECTION ---
            let directorDNAPrompt = '';
            if (currentState.activeDirectorId) {
                // Search across all categories for the director
                const allDirectors = Object.values(DIRECTOR_PRESETS).flat();
                const customDirectors = currentState.customDirectors || [];
                const activeDirector = [...allDirectors, ...customDirectors].find(d => d.id === currentState.activeDirectorId);

                if (activeDirector) {
                    const cameraStyle = activeDirector.signatureCameraStyle
                        ? `SIGNATURE CAMERA: ${activeDirector.signatureCameraStyle}.`
                        : '';
                    directorDNAPrompt = `[DIRECTORIAL VISION - ${activeDirector.name.toUpperCase()}]: MANDATORY CINEMATIC STYLE. Visual DNA: ${activeDirector.dna}. ${cameraStyle} ${activeDirector.description}. ALL visual elements and camera work must reflect this director's signature style.`;
                    console.log('[ImageGen] 🎬 Director DNA injected:', activeDirector.name, '| DNA:', activeDirector.dna, '| Camera:', activeDirector.signatureCameraStyle);
                }
            }

            // --- DOP RESEARCH NOTES INJECTION (Session Memory) ---
            let dopResearchPrompt = '';
            if (currentState.researchNotes?.dop) {
                dopResearchPrompt = `[USER DOP NOTES - MANDATORY CINEMATOGRAPHY GUIDE]: ${currentState.researchNotes.dop}. Apply these lighting, camera angle, and transition guidelines to this scene.`;
                console.log('[ImageGen] 📹 DOP Research Notes injected:', currentState.researchNotes.dop.substring(0, 50) + '...');
            }

            let finalImagePrompt = `${directorDNAPrompt} ${dopResearchPrompt} ${authoritativeStyle} ${scaleCmd} ${scaleLockInstruction} ${noDriftGuard} ${coreActionPrompt} ${groupEnvAnchor} ${timeWeatherLock} ${charPrompt} FULL SCENE VISUALS: ${cleanedContext}. STYLE DETAILS: ${metaTokens}. TECHNICAL: (STRICT CAMERA: ${cinematographyPrompt ? cinematographyPrompt : 'High Quality'}).`.trim();

            // PROP ANCHOR TEXT INJECTION (High Priority)
            if (sceneToUpdate.referenceImage && sceneToUpdate.referenceImageDescription) {
                finalImagePrompt = `!!! MANDATORY OBJECT LOCK: ${sceneToUpdate.referenceImageDescription.toUpperCase()} !!! Draw the following objects EXACTLY as shown in the [AUTHORITATIVE_VISUAL_REFERENCE] image: ${sceneToUpdate.referenceImageDescription.toUpperCase()}. Match design, material, and color. ${finalImagePrompt}`;
            }

            if (refinementPrompt) {
                finalImagePrompt = `REFINEMENT: ${refinementPrompt}. BASE PROMPT: ${finalImagePrompt}`;
            }

            // --- 5. CONTINUITY & MULTI-IMAGE REFERENCES ---
            const parts: any[] = [];
            let continuityInstruction = '';
            const isPro = currentState.imageModel === 'gemini-3-pro-image-preview';

            // 5a. CHARACTER FACE ID ANCHOR (ABSOLUTE FIRST - Before Style!)
            // Using Google's recommended pattern: "Use supplied image as reference for how [name] should look"
            for (const char of selectedChars) {
                // PRIMARY ANCHOR: Face ID (most important)
                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `IDENTITY_${char.name.toUpperCase()}`;
                        // Google pattern: explicit name + "use as reference for how X should look"
                        parts.push({ text: `[${refLabel}]: MANDATORY IDENTITY LOCK. Use this supplied image as the ONLY AUTHORITATIVE reference for how ${char.name} should look. Match face structure, features, and identity 100%. ABSOLUTELY NO VARIATION in facial structure allowed. ${char.description}` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(STRICT IDENTITY LOCK: ${char.name}) `;
                    }
                }

                // SECONDARY ANCHOR: Master Image (full body reference)
                if (char.masterImage && char.masterImage !== char.faceImage) {
                    const imgData = await safeGetImageData(char.masterImage);
                    if (imgData) {
                        const refLabel = `FULLBODY_${char.name.toUpperCase()}`;
                        // STRONGER COSTUME LOCK
                        parts.push({ text: `[${refLabel}]: MANDATORY COSTUME REFERENCE for ${char.name}. Match clothing, colors, uniform, and textures 100%. If character has clothes in this image, they MUST HAVE CLOTHES in the output.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }
            // 5b. STYLE REFERENCE IMAGE
            // Google pattern: "Apply style of [ref2] to subject in [ref1] while maintaining facial features"
            // FIX: Use effectiveStylePrompt for consistency with earlier logic
            console.log('[ImageGen] 🖼️ Style Image Check:', {
                effectiveStylePrompt,
                hasCustomStyleImage: !!currentState.customStyleImage,
                customStyleImagePreview: currentState.customStyleImage?.substring(0, 50) + '...'
            });
            if (effectiveStylePrompt === 'custom' && currentState.customStyleImage) {
                const imgData = await safeGetImageData(currentState.customStyleImage);
                const charNames = selectedChars.map(c => c.name).join(', ');
                if (imgData) {
                    parts.push({ text: `[STYLE_REFERENCE]: Apply ONLY the artistic rendering style of this image (shading, colors, texture) while RIGIDLY MAINTAINING the facial identity from ${charNames ? `IDENTITY references for ${charNames}` : 'above'}. DO NOT let this image influence the person's face structure or identity.` });
                    parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    continuityInstruction += `(STYLE ISOLATION: APPLY STYLE TO ENVIRONMENT/RENDER ONLY) `;
                    console.log('[ImageGen] ✅ Style Image INJECTED into prompt');
                } else {
                    console.warn('[ImageGen] ⚠️ Style Image could not be loaded');
                }
            }

            // 5c. FACE OVERRIDE (Immediately after style to prevent face contamination)
            // This re-establishes character identity after AI has seen the style image
            for (const char of selectedChars) {
                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `FACE_OVERRIDE: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! IDENTITY GUARD !!! ABSOLUTELY REJECT any facial variations introduced by style. RE-ESTABLISH this exact person. This face is the ONLY valid person for ${char.name}.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }


            // 5d. ABSOLUTE SET LOCK (Master Anchor + Continuity Anchor)
            if (sceneToUpdate.groupId) {
                const groupObj = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);

                // PARENT SCENE ANCHOR: For sub-scenes, use parent scene's image as PRIMARY anchor
                if (sceneToUpdate.parentSceneId) {
                    const parentScene = currentState.scenes.find(s => s.id === sceneToUpdate.parentSceneId);
                    if (parentScene?.generatedImage) {
                        const imgData = await safeGetImageData(parentScene.generatedImage);
                        if (imgData) {
                            const refLabel = `PARENT_SCENE_ANCHOR`;
                            // CRITICAL: Use parent scene as the RIGID template for this sub-scene
                            parts.push({
                                text: `[${refLabel}]: !!! MANDATORY CINEMATIC CONTINUITY !!!
                            1. 3D SPATIAL LOCK: Assume this is the EXACT SAME 3D SET as the anchor.
                            2. LIGHTING COPY: You MUST use the EXACT SAME lighting setup (Color temperature, Shadow direction, Intensity). Do NOT change the mood (e.g. if Anchor is Warm, Sub-scene MUST be Warm).
                            3. BACKGROUND LOCK: The walls, furniture, and floor texture must match the anchor 100%. Do NOT hallucinate new wallpaper or decor.
                            4. MICRO-PROGRESSION: This shot takes place 1-2 seconds AFTER the anchor. The character is ALIVE (can move hands/head), but the WORLD is FROZEN.
                            5. FIXED GEOMETRY: Do NOT change the room layout.
                            6. CHARACTER CONSISTENCY: Same Suit, Same Tie, Same Mannequin Material.
                            7. REJECT BIAS: The Anchor Image is the ONLY source of truth.` });
                            parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                            continuityInstruction += `(PARENT SCENE LOCK - DYNAMIC MATERIAL MATCH) `;
                            console.log('[ImageGen] 🔗 Parent Scene Anchor injected for sub-scene', sceneToUpdate.sceneNumber);
                        }
                    }
                }

                // BACKGROUND LOCK: Use first scene in group for environment only (for main scenes)
                const firstSceneInGroup = currentState.scenes
                    .filter(s => s.groupId === sceneToUpdate.groupId && s.generatedImage && !s.parentSceneId) // Exclude sub-scenes
                    .sort((a, b) => parseInt(a.scene_number) - parseInt(b.scene_number))[0];

                if (firstSceneInGroup?.generatedImage && !sceneToUpdate.parentSceneId) {
                    const imgData = await safeGetImageData(firstSceneInGroup.generatedImage);
                    if (imgData) {
                        const refLabel = `ENVIRONMENT_ONLY_LOCK`;
                        // CLEAN REFERENCE: Only use for background, explicitly ignore characters/props
                        parts.push({ text: `[${refLabel}]: Use this as the RIGID template for architecture and lighting ONLY. Match: layout, wall textures, room geometry, furniture placement, and lighting source. ABSOLUTELY IGNORE characters, clothing, and small props. This is a background-only consistency anchor.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(BACKGROUND LOCK FROM MASTER SCENE) `;
                    }
                }

                // SHOT_CONTINUITY REMOVED - Clean Reference approach
                // Previous scene references caused props/character leaking
                // Now relying solely on character Face ID + Body Sheet for consistency

                if (!firstSceneInGroup && groupObj?.conceptImage) {
                    const imgData = await safeGetImageData(groupObj.conceptImage);
                    if (imgData) {
                        const refLabel = `ENVIRONMENT_ANCHOR (Global Concept)`;
                        // Stronger instruction for concept art as base environment
                        parts.push({ text: `[${refLabel}]: Use this as the AUTHORITATIVE template for the environment. Match: architectural style, layout, color palette, lighting, textures, and general geometry. ABSOLUTELY IGNORE characters. This is the master reference for this entire location.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(CONCEPT ENVIRONMENT LOCK) `;
                    }
                }

                if (continuityInstruction) {
                    continuityInstruction = `ENVIRONMENT REFERENCE: Background elements only. Character appearance from IDENTITY references. ${continuityInstruction}`;
                }
            }


            // 5c. CHARACTER BODY/VIEWS & PRODUCT REFERENCES (Advanced Mapping for Gemini 3 Pro)
            let referencePreamble = '';

            // Track characters from the previous scene for re-entry logic
            const prevScene = currentSceneIndex > 0 ? currentState.scenes[currentSceneIndex - 1] : null;
            const prevSceneCharIds = prevScene?.characterIds || [];

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

                        // IDENTITY RE-ENTRY LOGIC: If character wasn't in previous shot, force a reset
                        const isReentry = !prevSceneCharIds.includes(char.id);
                        const reentryInstruction = isReentry ? `!!! IDENTITY RESET !!! Character ${char.name} is re-entering the sequence. Strictly reset facial features to this Face ID. Do NOT be influenced by surroundings.` : "";

                        parts.push({ text: `[${refLabel}]: AUTHORITATIVE identity anchor for ${char.name}. ${reentryInstruction} Match these exact face features. For clothing and pose, defer to SCENE_LOCK_REFERENCE if present. Description: ${char.description}` });
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
                        // STRONGER RACCORD FOR PROPS
                        parts.push({ text: `[${refLabel}]: AUTHORITATIVE visual anchor for ${prod.name} (PROP RACCORD). Match the design, colors, material, and branding from this image EXACTLY. Maintain consistent scale relative to the character.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        referencePreamble += `(PROP CONTINUITY: Match ${refLabel}) `;
                    }
                }
            }

            // 5e. SCALE ANCHOR FROM PREVIOUS SHOT (New)
            // Only use if isContinuityMode is ON and no explicit user reference image is provided (to avoid conflicting references)
            if (isContinuityMode && currentSceneIndex > 0 && !sceneToUpdate.referenceImage) {
                const prevSceneWithImage = currentState.scenes.slice(0, currentSceneIndex).reverse().find(s => s.generatedImage);
                if (prevSceneWithImage?.generatedImage) {
                    const imgData = await safeGetImageData(prevSceneWithImage.generatedImage);
                    if (imgData) {
                        // RE-ENTRY SAFE INSTRUCTION: If previous shot was empty, warn AI not to suppress characters
                        const wasPrevShotEmpty = (prevSceneWithImage.characterIds?.length || 0) === 0;
                        const charReturnWarning = wasPrevShotEmpty ? "!!! NOTICE !!! The previous shot was a background-only view. The current shot contains characters; do NOT let this reference suppress their appearance or identity." : "";

                        parts.push({ text: `[SCALE_ANCHOR_PREVIOUS]: Use as reference for object proportions and relative scale. ${charReturnWarning} Ensure item in this scene matches the size/color of the same item in this previous shot.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }

            // 5e. EXPLICIT PRODUCT/PROP REFERENCE (User-defined Override)
            if (sceneToUpdate.referenceImage) {
                const imgData = await safeGetImageData(sceneToUpdate.referenceImage);
                if (imgData) {
                    const focus = sceneToUpdate.referenceImageDescription || 'props and environment';
                    parts.push({ text: `[AUTHORITATIVE_VISUAL_REFERENCE]: USE THIS IMAGE as the primary reference for the design, color, and texture of the ${focus}. Match the objects shown here exactly in the new scene. IGNORE any text descriptions of these specific objects that conflict with this image.` });
                    parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    // Add to top of parts if it's really important? No, index-wise handles it.
                }
            }


            // 5f. IDENTITY & OUTFIT REINFORCEMENT (SANDWICH PATTERN - Face & Body again at END)
            // This reinforces character identity and costume after scene references to prevent drift
            for (const char of selectedChars) {
                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `FINAL_IDENTITY_ANCHOR: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! FINAL IDENTITY CHECK !!! Match face structure 100%.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }

                if (char.bodyImage || char.masterImage) {
                    const imgData = await safeGetImageData(char.bodyImage || char.masterImage || '');
                    if (imgData) {
                        const refLabel = `FINAL_OUTFIT_ANCHOR: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! FINAL OUTFIT CHECK !!! Character MUST BE CLOTHED according to this reference. No nakedness.` });
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
                isHighRes ? parts : [],
                currentState.resolution || '1K' // Pass resolution setting
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

            // Add to session gallery
            if (addToGallery) {
                addToGallery(imageUrl, isEndFrame ? 'end-frame' : 'scene', finalImagePrompt, sceneId);
            }

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

            // Enhanced concept art prompt with specific artistic keywords
            const conceptPrompt = `PROFESSIONAL ENVIRONMENT CONCEPT ART: Location "${groupName}". 
            DESCRIPTION: ${groupDescription}. 
            STYLE: ${styleInstruction} ${metaTokens}. 
            COMPOSITION: Master shot, architectural visualization, cinematic wide angle, high-level set design, matte painting, Unreal Engine 5 render style. 
            MANDATORY: Focus on spatial layout, atmospheric lighting, and materials (wood, stone, metal). 
            !!! ABSOLUTELY NO PEOPLE, NO HUMANS, NO CHARACTERS, NO FACES !!! focus purely on the empty world and set design.`.trim();

            const { imageUrl } = await callAIImageAPI(
                conceptPrompt,
                userApiKey,
                currentState.imageModel || 'gemini-3-pro-image-preview',
                currentState.aspectRatio,
                [], // No parts for concept art
                currentState.resolution || '1K' // Pass resolution setting
            );

            if (imageUrl && addToGallery) {
                addToGallery(imageUrl, 'concept', conceptPrompt, groupName);
            }

            return imageUrl;
        } catch (error) {
            console.error("Concept generation failed:", error);
            return null;
        }
    }, [stateRef, userApiKey, setApiKeyModalOpen, userId]);

    const _performImageGenerationInternal = useCallback(async (sceneId: string, refinementPrompt?: string, isEndFrame: boolean = false) => {
        const currentState = stateRef.current;
        const isPro = currentState.imageModel === 'gemini-3-pro-image-preview';
        const isHighRes = isPro;

        const sceneToUpdate = currentState.scenes.find(s => s.id === sceneId);

        if (!sceneToUpdate || !sceneToUpdate.contextDescription) {
            console.warn(`Scene ${sceneId} not found or has no context description.`);
            return;
        }

        const apiKey = userApiKey || (process.env as any).API_KEY;

        if (!apiKey) {
            setApiKeyModalOpen(true);
            return;
        }

        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: true, error: null } : sc)
        }));

        try {
            const parts: (string | Part)[] = [];
            let referencePreamble = '';

            const currentSceneIndex = currentState.scenes.findIndex(s => s.id === sceneId);
            const prevScene = currentSceneIndex > 0 ? currentState.scenes[currentSceneIndex - 1] : null;

            // 1. SCENE_LOCK_REFERENCE (User-defined)
            if (sceneToUpdate.sceneLockImage) {
                const imgData = await safeGetImageData(sceneToUpdate.sceneLockImage);
                if (imgData) {
                    parts.push({ text: `[SCENE_LOCK_REFERENCE]: AUTHORITATIVE visual anchor for the entire scene. Match the composition, lighting, and overall aesthetic of this image EXACTLY. This image takes precedence over all other visual references for scene-level attributes.` });
                    parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    referencePreamble += `(SCENE_LOCK: Match SCENE_LOCK_REFERENCE) `;
                }
            }

            // 2. STYLE REFERENCE (Global or Scene-specific)
            let styleInstruction = '';
            const effectiveStylePrompt = sceneToUpdate.stylePrompt || currentState.stylePrompt;
            const effectiveCustomStyle = sceneToUpdate.stylePrompt ? sceneToUpdate.customStyleInstruction : currentState.customStyleInstruction;

            if (effectiveStylePrompt === 'custom') {
                styleInstruction = effectiveCustomStyle || '';
            } else {
                const selectedStyle = GLOBAL_STYLES.find(s => s.value === effectiveStylePrompt);
                styleInstruction = selectedStyle ? selectedStyle.prompt : '';
            }

            // 3. META TOKENS (Global or Preset-specific)
            const activePreset = getPresetById(currentState.activeScriptPreset, currentState.customScriptPresets);
            const metaTokens = currentState.customMetaTokens || DEFAULT_META_TOKENS[activePreset?.category || 'custom'] || DEFAULT_META_TOKENS['custom'];

            // 4. CONTINUITY INSTRUCTION (DOP Vision)
            let continuityInstruction = '';
            if (isContinuityMode && isDOPEnabled && prevScene?.generatedImage && sceneToUpdate.generatedImage) {
                // This is for the *initial* generation, not retries.
                // The actual validation and retry logic is handled by validateAndFixScene.
                // Here we just generate the initial prompt.
                // The prompt for continuity is generated by the DOP Vision agent.
                // For now, we'll just use a placeholder or rely on the validation step.
            }

            // 5. Build the main prompt
            let finalImagePrompt = `
                GENERATE A HIGH-QUALITY CINEMATIC IMAGE.
                SCENE DESCRIPTION: ${sceneToUpdate.contextDescription}
                STYLE: ${styleInstruction} ${metaTokens}
                ADDITIONAL INSTRUCTIONS: ${refinementPrompt || ''}
            `.trim();

            // 5a. LOCATION REFERENCE
            if (sceneToUpdate.groupId) {
                const group = currentState.sceneGroups?.find(g => g.id === sceneToUpdate.groupId);
                if (group?.conceptImage) {
                    const imgData = await safeGetImageData(group.conceptImage);
                    if (imgData) {
                        parts.push({ text: `[LOCATION_CONCEPT_ART]: AUTHORITATIVE visual anchor for the location "${group.name}". Match the architectural style, environment, and overall mood. This is a high-level concept, defer to SCENE_LOCK_REFERENCE for specific composition.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        referencePreamble += `(LOCATION: Match LOCATION_CONCEPT_ART) `;
                    }
                }
            }

            // 5b. CHARACTER REFERENCES
            const selectedChars = currentState.characters.filter(c => sceneToUpdate.characterIds.includes(c.id));
            const prevSceneCharIds = new Set(prevScene?.characterIds || []);

            for (const char of selectedChars) {
                const charRefs: { type: string, img: string }[] = [];
                if (char.faceImage) charRefs.push({ type: 'FACE', img: char.faceImage });
                if (char.bodyImage) charRefs.push({ type: 'BODY', img: char.bodyImage });

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

                        // IDENTITY RE-ENTRY LOGIC: If character wasn't in previous shot, force a reset
                        const isReentry = !prevSceneCharIds.has(char.id);
                        const reentryInstruction = isReentry ? `!!! IDENTITY RESET !!! Character ${char.name} is re-entering the sequence. Strictly reset facial features to this Face ID. Do NOT be influenced by surroundings.` : "";

                        parts.push({ text: `[${refLabel}]: AUTHORITATIVE identity anchor for ${char.name}. ${reentryInstruction} Match these exact face features. For clothing and pose, defer to SCENE_LOCK_REFERENCE if present. Description: ${char.description}` });
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
                        // STRONGER RACCORD FOR PROPS
                        parts.push({ text: `[${refLabel}]: AUTHORITATIVE visual anchor for ${prod.name} (PROP RACCORD). Match the design, colors, material, and branding from this image EXACTLY. Maintain consistent scale relative to the character.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        referencePreamble += `(PROP CONTINUITY: Match ${refLabel}) `;
                    }
                }
            }

            // 5e. SCALE ANCHOR FROM PREVIOUS SHOT (New)
            // Only use if isContinuityMode is ON and no explicit user reference image is provided (to avoid conflicting references)
            if (isContinuityMode && currentSceneIndex > 0 && !sceneToUpdate.referenceImage) {
                const prevSceneWithImage = currentState.scenes.slice(0, currentSceneIndex).reverse().find(s => s.generatedImage);
                if (prevSceneWithImage?.generatedImage) {
                    const imgData = await safeGetImageData(prevSceneWithImage.generatedImage);
                    if (imgData) {
                        // RE-ENTRY SAFE INSTRUCTION: If previous shot was empty, warn AI not to suppress characters
                        const wasPrevShotEmpty = (prevSceneWithImage.characterIds?.length || 0) === 0;
                        const charReturnWarning = wasPrevShotEmpty ? "!!! NOTICE !!! The previous shot was a background-only view. The current shot contains characters; do NOT let this reference suppress their appearance or identity." : "";

                        parts.push({ text: `[SCALE_ANCHOR_PREVIOUS]: Use as reference for object proportions and relative scale. ${charReturnWarning} Ensure item in this scene matches the size/color of the same item in this previous shot.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }

            // 5e. EXPLICIT PRODUCT/PROP REFERENCE (User-defined Override)
            if (sceneToUpdate.referenceImage) {
                const imgData = await safeGetImageData(sceneToUpdate.referenceImage);
                if (imgData) {
                    const focus = sceneToUpdate.referenceImageDescription || 'props and environment';
                    parts.push({ text: `[AUTHORITATIVE_VISUAL_REFERENCE]: USE THIS IMAGE as the primary reference for the design, color, and texture of the ${focus}. Match the objects shown here exactly in the new scene. IGNORE any text descriptions of these specific objects that conflict with this image.` });
                    parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    // Add to top of parts if it's really important? No, index-wise handles it.
                }
            }


            // 5f. IDENTITY & OUTFIT REINFORCEMENT (SANDWICH PATTERN - Face & Body again at END)
            // This reinforces character identity and costume after scene references to prevent drift
            for (const char of selectedChars) {
                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `FINAL_IDENTITY_ANCHOR: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! FINAL IDENTITY CHECK !!! Match face structure 100%.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }

                if (char.bodyImage || char.masterImage) {
                    const imgData = await safeGetImageData(char.bodyImage || char.masterImage || '');
                    if (imgData) {
                        const refLabel = `FINAL_OUTFIT_ANCHOR: ${char.name.toUpperCase()}`;
                        parts.push({ text: `[${refLabel}]: !!! FINAL OUTFIT CHECK !!! Character MUST BE CLOTHED according to this reference. No nakedness.` });
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
                isHighRes ? parts : [],
                currentState.resolution || '1K' // Pass resolution setting
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

            // Add to session gallery
            if (addToGallery) {
                addToGallery(imageUrl, isEndFrame ? 'end-frame' : 'scene', finalImagePrompt, sceneId);
            }

        } catch (error) {
            console.error("Image generation failed:", error);
            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: false, error: (error as Error).message } : sc)
            }));
        }
    }, [stateRef, userApiKey, updateStateAndRecord, setApiKeyModalOpen, userId]);

    const validateAndFixScene = useCallback(async (sceneId: string) => {
        if (!isDOPEnabled || !validateRaccordWithVision || !userApiKey) return;

        const updatedState = stateRef.current;
        const updatedScene = updatedState.scenes.find(s => s.id === sceneId);
        const currentImage = updatedScene?.generatedImage;

        if (!currentImage) return;

        const currentSceneIndex = updatedState.scenes.findIndex(s => s.id === sceneId);

        // CRITICAL: Determine Validation Reference (Parent or Previous)
        let referenceScene = null;
        if (updatedScene?.parentSceneId) {
            referenceScene = updatedState.scenes.find(s => s.id === updatedScene.parentSceneId) || null;
            console.log('[DOP] Sub-scene detected. Validating against PARENT SCENE:', referenceScene?.scene_number);
        } else if (currentSceneIndex > 0) {
            referenceScene = updatedState.scenes[currentSceneIndex - 1];
        }

        if (referenceScene?.generatedImage) {
            console.log('[DOP] Validating raccord against:', referenceScene.scene_number);

            let MAX_DOP_RETRIES = 2;
            let retryCount = 0;
            let lastValidation = await validateRaccordWithVision(
                currentImage,
                referenceScene.generatedImage,
                updatedScene!,
                referenceScene,
                userApiKey
            );

            // Filter for critical errors (Character/Prop)
            const criticalErrors = lastValidation.errors.filter(e =>
                e.type === 'character' || e.type === 'prop'
            );

            // Decision Agent Logic
            if (!lastValidation.isValid && criticalErrors.length > 0) {
                console.log(`[DOP] RACCORD ERROR DETECTED:`, criticalErrors);

                let shouldRetry = true;
                let enhancedCorrection = lastValidation.correctionPrompt;
                const originalPrompt = updatedScene?.contextDescription || '';

                if (makeRetryDecision) {
                    console.log('[DOP Agent] Analyzing if retry will succeed...');
                    const decision = await makeRetryDecision(
                        currentImage,
                        referenceScene.generatedImage,
                        originalPrompt,
                        criticalErrors,
                        userApiKey
                    );

                    console.log('[DOP Agent] Decision:', decision);

                    if (decision.action === 'skip') {
                        console.log('[DOP Agent] SKIP - errors are unfixable.');
                        shouldRetry = false;
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(sc => sc.id === sceneId ? {
                                ...sc,
                                error: `⚠️ DOP: ${decision.reason} (manual review needed)`
                            } : sc)
                        }));
                    } else if (decision.action === 'try_once') {
                        MAX_DOP_RETRIES = 1;
                        if (decision.enhancedPrompt) enhancedCorrection = decision.enhancedPrompt;
                    } else if (decision.enhancedPrompt) {
                        enhancedCorrection = decision.enhancedPrompt;
                    }
                }

                // Retry Loop
                while (shouldRetry && !lastValidation.isValid && criticalErrors.length > 0 && retryCount < MAX_DOP_RETRIES) {
                    console.log(`[DOP] Retrying with enhanced correction (attempt ${retryCount + 1}/${MAX_DOP_RETRIES})`);

                    updateStateAndRecord(s => ({
                        ...s,
                        scenes: s.scenes.map(sc => sc.id === sceneId ? {
                            ...sc,
                            generatedImage: null,
                            error: `DOP Retry ${retryCount + 1}: ${criticalErrors.map(e => e.description).join('; ')}`
                        } : sc)
                    }));

                    await new Promise(r => setTimeout(r, 500));
                    console.log('[DOP] Auto-regenerating with correction:', enhancedCorrection);

                    // Call INTERNAL generate function directly to avoid double-wrapping
                    await _performImageGenerationInternal(sceneId, enhancedCorrection);

                    // Re-validate
                    const reUpdatedState = stateRef.current;
                    const reUpdatedScene = reUpdatedState.scenes.find(s => s.id === sceneId);
                    const newImage = reUpdatedScene?.generatedImage;

                    if (newImage) {
                        lastValidation = await validateRaccordWithVision(
                            newImage,
                            referenceScene.generatedImage,
                            reUpdatedScene!,
                            referenceScene,
                            userApiKey
                        );
                    }
                    retryCount++;
                }
            }

            if (retryCount >= MAX_DOP_RETRIES && !lastValidation.isValid) {
                console.warn('[DOP] Max retries reached.');
                updateStateAndRecord(s => ({
                    ...s,
                    scenes: s.scenes.map(sc => sc.id === sceneId ? {
                        ...sc,
                        error: `⚠️ DOP: Requires manual review (${lastValidation.errors.map(e => e.description).join('; ')})`
                    } : sc)
                }));
            } else if (lastValidation.isValid) {
                console.log('[DOP] Raccord validation PASSED');
            }
        }
    }, [stateRef, isDOPEnabled, validateRaccordWithVision, userApiKey, makeRetryDecision, updateStateAndRecord, _performImageGenerationInternal]); // Dependency list for helper

    const performImageGenerationWithAutoFix = useCallback(async (sceneId: string, refinementPrompt?: string, isEndFrame: boolean = false) => {
        await _performImageGenerationInternal(sceneId, refinementPrompt, isEndFrame);
        // Safety Delay for State Prop
        await new Promise(resolve => setTimeout(resolve, 1000));
        await validateAndFixScene(sceneId);
    }, [_performImageGenerationInternal, validateAndFixScene]);

    const handleGenerateAllImages = useCallback(async () => {
        const scenesToGenerate = state.scenes.filter(s => !s.generatedImage && s.contextDescription);
        if (scenesToGenerate.length === 0) return alert("Tất cả các phân cảnh có mô tả đã có ảnh.");

        setIsBatchGenerating(true);
        setIsStopping(false);
        stopRef.current = false;

        try {
            for (let i = 0; i < scenesToGenerate.length; i++) {
                const scene = scenesToGenerate[i];
                if (stopRef.current) break;

                // Use the Auto-Fix wrapper
                await performImageGenerationWithAutoFix(scene.id);

                // Additional Batch Safety Delay (just in case)
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsBatchGenerating(false);
            setIsStopping(false);
        }
    }, [state.scenes, performImageGenerationWithAutoFix]);

    return {
        isBatchGenerating,
        isStopping,
        performImageGeneration: performImageGenerationWithAutoFix, // EXPOSE THE WRAPPER
        generateGroupConcept,
        handleGenerateAllImages,
        stopBatchGeneration
    };
}
