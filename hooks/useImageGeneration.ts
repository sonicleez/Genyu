import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectState, Scene, AgentStatus } from '../types';

import {
    GLOBAL_STYLES, CAMERA_MODELS, LENS_OPTIONS, CAMERA_ANGLES,
    DEFAULT_META_TOKENS, TRANSITION_TYPES
} from '../constants/presets';
import { DIRECTOR_PRESETS, DirectorCategory } from '../constants/directors';
import { getPresetById } from '../utils/scriptPresets';
import { uploadImageToSupabase, syncUserStatsToCloud } from '../utils/storageUtils';
import { safeGetImageData, callGeminiVisionReasoning } from '../utils/geminiUtils';
import { GommoAI, urlToBase64 } from '../utils/gommoAI';
import { IMAGE_MODELS } from '../utils/appConstants';

// Helper function to clean VEO-specific tokens from prompt for image generation
const cleanPromptForImageGen = (prompt: string): string => {
    return prompt
        .replace(/\[\d{2}:\d{2}-\d{2}:\d{2}\]/g, '') // Remove timestamps [00:00-00:05]
        .replace(/SFX:.*?(\.|$)/gi, '') // Remove SFX descriptions
        .replace(/Emotion:.*?(\.|$)/gi, '') // Remove Emotion descriptions
        .replace(/\s+/g, ' ') // Collapse whitespace
        .trim();
};

// Helper: Determine which provider to use based on model ID
const getProviderFromModel = (modelId: string): 'gemini' | 'gommo' => {
    const model = IMAGE_MODELS.find(m => m.value === modelId);
    return (model?.provider as 'gemini' | 'gommo') || 'gemini';
};

export function useImageGeneration(
    state: ProjectState,
    stateRef: React.MutableRefObject<ProjectState>,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void,
    isContinuityMode: boolean,
    setAgentState: (agent: 'director' | 'dop', status: AgentStatus, message?: string, stage?: string) => void,
    addProductionLog?: (sender: 'director' | 'dop' | 'user' | 'system', message: string, type?: string, stage?: string) => void,

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

    // Generation Lock: Track which scenes are currently being generated to prevent duplicates
    const generatingSceneIdsRef = useRef<Set<string>>(new Set());

    /**
     * Storyboard Mode: Find the best cascade reference image for visual consistency
     * Priority: Nearest KEY FRAME > Nearest any scene > Group conceptImage
     * - Looks for the nearest scene with an image in the SAME SceneGroup
     * - KEY FRAMES are prioritized as they are hero shots
     * - Falls back to group's conceptImage if no scene has image
     * - Returns undefined if no reference available (first scene in group)
     */
    const findCascadeReference = useCallback((
        currentScene: Scene,
        currentState: ProjectState
    ): string | undefined => {
        if (!currentScene.groupId) return undefined;

        // 1. Get ALL scenes in same group that have generated images AND are valid (no critical errors)
        const sameGroupScenes = currentState.scenes.filter(
            s => s.groupId === currentScene.groupId &&
                s.generatedImage &&
                s.id !== currentScene.id &&
                // IGNORE scenes with Critical DOP Errors (Unfixable / Wrong Person) to prevent error propagation
                (!s.error || (!s.error.includes('UNFIXABLE') && !s.error.includes('DOP Skip')))
        );

        if (sameGroupScenes.length === 0) {
            // No scenes with images in this group - try conceptImage
            const group = currentState.sceneGroups?.find(g => g.id === currentScene.groupId);
            if (group?.conceptImage) {
                console.log(`[Cascade] Using group conceptImage as reference for scene ${currentScene.sceneNumber}`);
                return group.conceptImage;
            }
            return undefined;
        }

        const currentNum = parseInt(currentScene.sceneNumber);

        // 2. PRIORITY: Find nearest KEY FRAME (hero shot) first
        const keyFramesInGroup = sameGroupScenes.filter(s => s.isKeyFrame);
        if (keyFramesInGroup.length > 0) {
            // Find nearest key frame by scene number distance
            const sortedByDistance = keyFramesInGroup.sort((a, b) => {
                const distA = Math.abs(parseInt(a.sceneNumber) - currentNum);
                const distB = Math.abs(parseInt(b.sceneNumber) - currentNum);
                return distA - distB;
            });
            console.log(`[Cascade] Scene ${currentScene.sceneNumber} referencing KEY FRAME Scene ${sortedByDistance[0].sceneNumber} ⭐`);
            return sortedByDistance[0].generatedImage!;
        }

        // 3. Fallback: Find nearest scene BEFORE current (by sceneNumber)
        const beforeScenes = sameGroupScenes
            .filter(s => parseInt(s.sceneNumber) < currentNum)
            .sort((a, b) => parseInt(b.sceneNumber) - parseInt(a.sceneNumber));

        if (beforeScenes.length > 0) {
            console.log(`[Cascade] Scene ${currentScene.sceneNumber} referencing Scene ${beforeScenes[0].sceneNumber} for consistency`);
            return beforeScenes[0].generatedImage!;
        }

        // 4. If no scene before, check if any scene AFTER has image (edge case: regenerating earlier scene)
        const afterScenes = sameGroupScenes
            .filter(s => parseInt(s.sceneNumber) > currentNum)
            .sort((a, b) => parseInt(a.sceneNumber) - parseInt(b.sceneNumber));

        if (afterScenes.length > 0) {
            console.log(`[Cascade] Scene ${currentScene.sceneNumber} referencing Scene ${afterScenes[0].sceneNumber} (forward ref)`);
            return afterScenes[0].generatedImage!;
        }

        return undefined;
    }, []);

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
        imageSize: string = '1K',
        gommoCredentials?: { domain: string; accessToken: string }
    ): Promise<{ imageUrl: string; mediaId?: string }> => {
        const provider = getProviderFromModel(model);

        console.log(`[ImageGen] Provider: ${provider}, Model: ${model}`);

        // ═══════════════════════════════════════════════════════════════
        // GOMMO PATH: Supports subjects array for Face ID references
        // ═══════════════════════════════════════════════════════════════
        if (provider === 'gommo' && gommoCredentials?.domain && gommoCredentials?.accessToken) {
            console.log('[ImageGen] 🟡 Using GOMMO provider');

            // Convert Gemini parts to Gommo subjects format
            // Look for parts with inlineData (images) that have associated text labels
            const subjects: Array<{ name: string; base64Image: string; description?: string }> = [];

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (part.inlineData?.data && part.inlineData?.mimeType) {
                    // Find the associated text label (usually the previous part)
                    const prevPart = parts[i - 1];
                    let name = 'Character';
                    let description = '';

                    if (prevPart?.text) {
                        // Extract character name from text like "[IDENTITY_JOHN]: MANDATORY..."
                        const nameMatch = prevPart.text.match(/\[IDENTITY_([^\]]+)\]/);
                        if (nameMatch) {
                            name = nameMatch[1].replace(/_/g, ' ');
                        }
                        description = prevPart.text.substring(0, 200);
                    }

                    // Convert to Gommo subject format (full base64 with prefix)
                    const base64WithPrefix = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    subjects.push({ name, base64Image: base64WithPrefix, description });
                }
            }

            if (subjects.length > 0) {
                console.log(`[ImageGen] 🎭 Converted ${subjects.length} Face ID references to Gommo subjects`);
            }

            try {
                const client = new GommoAI(gommoCredentials.domain, gommoCredentials.accessToken);
                const gommoRatio = GommoAI.convertRatio(aspectRatio);

                // Generate image via Gommo (async with polling)
                const cdnUrl = await client.generateImage(prompt, {
                    ratio: gommoRatio,
                    model: model,
                    subjects: subjects.length > 0 ? subjects : undefined,
                    onProgress: (status, attempt) => {
                        console.log(`[Gommo] Polling ${attempt}/60: ${status}`);
                    }
                });

                // Convert CDN URL to base64 for consistency with existing code
                const base64Image = await urlToBase64(cdnUrl);
                console.log('[ImageGen] ✅ Gommo image generated successfully');

                return { imageUrl: base64Image };
            } catch (error: any) {
                console.error('[ImageGen] ❌ Gommo generation failed:', error.message);
                throw new Error(`Gommo Error: ${error.message}`);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // GEMINI PATH: Full multi-modal generation with image references
        // ═══════════════════════════════════════════════════════════════
        const isHighRes = model === 'gemini-3-pro-image-preview';

        if (apiKey && isHighRes) {
            console.log('[ImageGen] 🔵 Using GEMINI provider');
            const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

            // Build parts in Google's recommended order: TEXT FIRST, then IMAGES
            const fullParts: any[] = [];
            if (prompt) fullParts.push({ text: prompt }); // Text FIRST per docs
            fullParts.push(...parts); // Then all image references

            console.log(`[ImageGen] Generating with resolution: ${imageSize}, aspectRatio: ${aspectRatio}, parts: ${fullParts.length}`);

            const response = await ai.models.generateContent({
                model: model,
                contents: [{ parts: fullParts }],
                config: {
                    responseModalities: ["IMAGE"], // Enforce Image output
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
            throw new Error("Missing Credentials (API Key hoặc Gommo Token)");
        }
    };

    // referenceImage: Optional image URL to use as visual DNA reference (from another scene)
    const performImageGeneration = useCallback(async (
        sceneId: string,
        refinementPrompt?: string,
        fromManual: boolean = false,
        referenceImage?: string,
        baseImage?: string, // NEW: Optional base image for Img2Img editing
        negativePrompt?: string // NEW: Negative constraints for DOP retries
    ) => {
        const currentState = stateRef.current;
        const currentSceneIndex = currentState.scenes.findIndex(s => s.id === sceneId);
        const sceneToUpdate = currentState.scenes[currentSceneIndex];
        if (!sceneToUpdate) return;

        updateStateAndRecord(s => ({
            ...s,
            scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: true, error: null, generationStartTime: Date.now(), generationDuration: undefined } : sc)
        }));

        const startTime = Date.now();

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

            // --- REASONING STEP (Refinement/Edit Mode) ---
            // If we have a Base Image (Edit Mode) and a Command, we use "Gemini 3 Reasoning" to plan the edit first.
            let reasonedContext = null;
            if (baseImage && (refinementPrompt || sceneToUpdate.contextDescription) && isHighRes) {
                try {
                    const baseImgData = await safeGetImageData(baseImage);

                    // Detect Reference Image (for Composite / Transfer)
                    // Priority: Explicit arg -> Scene property
                    const refImgUrl = referenceImage || sceneToUpdate.referenceImage;
                    const refImgData = refImgUrl ? await safeGetImageData(refImgUrl) : null;

                    if (baseImgData && userApiKey) {
                        console.log('[Reasoning] 🧠 Analyzing Images + Request with Gemini Vision...');

                        const imagesToSend = [baseImgData];
                        let instructionExtra = "";

                        if (refImgData) {
                            imagesToSend.push(refImgData);
                            instructionExtra = `
IMAGE 2 IS A REFERENCE OBJECT/SOURCE.
- The User Command may ask to "use the object from Scene X" or "transfer the style".
- Look at IMAGE 2 to identify the specific object, texture, or detail requested.
- COMPOSITE instruction: Describe the scene from IMAGE 1, but include the object/element from IMAGE 2 as requested, ensuring it fits the lighting and perspective of IMAGE 1.
`;
                        }

                        const analysisPrompt = `Role: Expert VFX Supervisor & Prompt Engineer.
Task: The user wants to EDIT the attached IMAGE 1.
User Command: "${refinementPrompt || sceneToUpdate.contextDescription}".
Current Scene Context: "${sceneToUpdate.contextDescription}".
${instructionExtra}

INSTRUCTIONS:
1. Analyze IMAGE 1 (Context, Composition, Lighting, Subject).
${refImgData ? "2. Analyze IMAGE 2 (Reference Object/Detail)." : ""}
3. Interpret the User Command.
   - Does it ask to CHANGE the CAMERA ANGLE (e.g. "Zoom in", "Pan left", "High angle")?
   - Does it ask to CHANGE the POSE?
   - Or is it just adding/changing an object/detail?

4. Generate a precise Image Generation Prompt that:
   - IF CAMERA/POSE CHANGE REQUESTED: Describe the NEW angle/pose clearly.
   - IF NO CAMERA/POSE CHANGE: Start with "EDIT REQUEST: Keep the exact camera angle, subject pose, and lighting from the source image."
   - Describes the scene fully, integrating the changes NATURALISTICALLY.

OUTPUT ONLY THE PROMPT. DO NOT OUTPUT MARKDOWN OR EXPLANATION.`;

                        const reasonedPrompt = await callGeminiVisionReasoning(
                            userApiKey,
                            analysisPrompt,
                            imagesToSend,
                            'gemini-2.5-flash' // "Gemini 3 Reasoning"
                        );

                        if (reasonedPrompt) {
                            console.log('[Reasoning] ✨ Enhanced Prompt:', reasonedPrompt);
                            // Detect if angle change was requested
                            const isAngleChange = /zoom|pan|angle|close.?up|wide|medium|long|shot/i.test(reasonedPrompt);
                            console.log(`[Reasoning] 📐 Angle Change Detected: ${isAngleChange}`);
                            cleanedContext = reasonedPrompt.trim(); // Override context with smart prompt
                            reasonedContext = reasonedPrompt.trim();
                        }
                    }
                } catch (err) {
                    console.warn('[Reasoning] Failed:', err);
                }
            }

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

                const hasAnimal = selectedChars.some(c =>
                    /horse|snake|dog|cat|wolf|bird|lion|tiger|dragon|animal|creature|bear|eagle|fish|shark|whale/i.test(c.name) ||
                    /horse|snake|dog|cat|wolf|bird|lion|tiger|dragon|animal|creature|bear|eagle|fish|shark|whale/i.test(c.description)
                );

                const outfitConstraint = hasAnimal
                    ? '' // No outfit lock for animals
                    : ' (MANDATORY COSTUME LOCK: Character MUST be wearing the exact clothing/uniform shown in their FULL BODY reference image OR the specified OUTFIT OVERRIDE. ABSOLUTELY NO NAKEDNESS.)';

                // FACELESS ENFORCEMENT
                const isFacelessMode = currentState.globalCharacterStyleId?.includes('faceless');
                const facelessConstraint = (isFacelessMode && !hasAnimal)
                    ? ' !!! STRICT FACELESS MODE: NO FACES, NO EYES, NO MOUTH. Heads must be turned away, in shadow, or obscured. !!! '
                    : '';

                // MANNEQUIN MATERIAL ENFORCEMENT (Critical for style consistency)
                const isMannequinMode = currentState.globalCharacterStyleId?.includes('mannequin');
                const mannequinMaterialConstraint = (isMannequinMode && !hasAnimal)
                    ? `!!! ABSOLUTE MANNEQUIN MATERIAL LOCK !!!
ALL human figures in this scene (main characters, supporting characters, background crowds, extras, hands, body parts) MUST have:
- HEAD: Smooth cast resin material, pristine white mannequin finish, egg-shaped featureless head, NO facial features (NO eyes, NO nose, NO mouth, NO ears, NO hair)
- HANDS: White/grey mannequin hands, hard plastic surface, smooth finish, NO skin texture, NO veins, NO wrinkles
- BODY: Consistent matte white/grey plastic material throughout. NO skin tones, NO flesh texture, NO human skin whatsoever.
- MATERIAL KEYWORDS: "smooth cast resin", "pristine white mannequin finish", "hard plastic surface", "store display mannequin"
This applies to EVERY human figure in the scene without ANY exception. If a hand appears, it must be a mannequin hand. If a face appears, it must be a featureless mannequin head.`
                    : '';

                charPrompt = `${mannequinMaterialConstraint} Appearing Characters: ${charDesc}${outfitConstraint}${facelessConstraint}`;
            } else if (isDocumentary) {
                // DOCUMENTARY MODE: Check mannequin style first
                const isMannequinMode = currentState.globalCharacterStyleId?.includes('mannequin');
                const mannequinForDocs = isMannequinMode
                    ? `Use FACELESS WHITE MANNEQUIN figures (smooth cast resin material, egg-shaped featureless heads, hard plastic hands, NO skin texture whatsoever)`
                    : `Use realistic anonymous people fitting the scene context`;

                charPrompt = `DOCUMENTARY STYLE: ${mannequinForDocs} for all humans. Focus on storytelling through clothing and body language. NO SKIN TEXTURE - if mannequin style is enabled, ALL body parts must be smooth plastic.`;
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

            // If Reasoning happened, it already built the style into the prompt. Don't override it brutally.
            const authoritativeStyle = reasonedContext
                ? "STYLE ADAPTATION: Follow the style described in the main prompt."
                : (baseImage || refinementPrompt)
                    ? "STYLE LOCK: MATCH SOURCE IMAGE."
                    : `AUTHORITATIVE STYLE: ${styleInstruction.toUpperCase()}. ${negativeStyle}`;

            // Shot Scale (Angle) is the ABSOLUTE PRIORITY for composition
            // If Reasoning happened, trust IT to set the angle (it knows if user asked for a change).
            // If no reasoning but we have baseImage, maintain lock.
            // Otherwise, use UI selection.
            const scaleCmd = reasonedContext
                ? "" // Let Reasoning control the angle
                : (baseImage ? "COMPOSITION LOCK: MATCH SOURCE IMAGE EXACTLY." : (anglePrompt ? `SHOT SCALE: ${anglePrompt.toUpperCase()}.` : 'CINEMATIC WIDE SHOT.'));

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
                    // Auto-detect Camera Only mode:
                    // 1. If explicitly enabled via directorCameraOnlyMode
                    // 2. OR if user has custom Meta Tokens (they want their own color grading)
                    const hasCustomMetaTokens = currentState.customMetaTokens && currentState.customMetaTokens.trim().length > 0;
                    const useCameraOnlyMode = currentState.directorCameraOnlyMode || hasCustomMetaTokens;

                    if (useCameraOnlyMode) {
                        // Camera Only Mode: Only inject camera techniques, skip color DNA
                        if (activeDirector.signatureCameraStyle) {
                            directorDNAPrompt = `[DIRECTOR CAMERA - ${activeDirector.name.toUpperCase()}]: Apply this director's CAMERA TECHNIQUES and FRAMING STYLE: ${activeDirector.signatureCameraStyle}. COLOR GRADING follows user's Meta Tokens/Style settings, NOT this director's color palette.`;
                            console.log('[ImageGen] 🎬 Director CAMERA ONLY injected (auto-detect: customMetaTokens=' + hasCustomMetaTokens + '):', activeDirector.name, '| Camera:', activeDirector.signatureCameraStyle);
                        }
                    } else {
                        // Full DNA Mode (default): Inject both color and camera
                        const cameraStyle = activeDirector.signatureCameraStyle
                            ? `SIGNATURE CAMERA: ${activeDirector.signatureCameraStyle}.`
                            : '';
                        directorDNAPrompt = `[DIRECTORIAL VISION - ${activeDirector.name.toUpperCase()}]: MANDATORY CINEMATIC STYLE. Visual DNA: ${activeDirector.dna}. ${cameraStyle} ${activeDirector.description}. ALL visual elements and camera work must reflect this director's signature style.`;
                        console.log('[ImageGen] 🎬 Director FULL DNA injected:', activeDirector.name, '| DNA:', activeDirector.dna, '| Camera:', activeDirector.signatureCameraStyle);
                    }
                }
            }

            // --- DOP RESEARCH NOTES INJECTION (Session Memory) ---
            let dopResearchPrompt = '';
            if (currentState.researchNotes?.dop) {
                dopResearchPrompt = `[USER DOP NOTES - MANDATORY CINEMATOGRAPHY GUIDE]: ${currentState.researchNotes.dop}. Apply these lighting, camera angle, and transition guidelines to this scene.`;
                console.log('[ImageGen] 📹 DOP Research Notes injected:', currentState.researchNotes.dop.substring(0, 50) + '...');
            }

            // --- GLOBAL STORY CONTEXT INJECTION (World Building) ---
            let globalStoryPrompt = '';
            if (currentState.researchNotes?.story) {
                globalStoryPrompt = `[GLOBAL STORY CONTEXT - MANDATORY WORLD SETTING]: ${currentState.researchNotes.story}. The scene must strictly exist within this specific world/universe. Align all architecture, technology, and atmosphere with this context.`;
                console.log('[ImageGen] 🌍 Global Story Context injected:', currentState.researchNotes.story.substring(0, 50) + '...');
            }

            // --- ANTI-COLLAGE INSTRUCTION (Prevent split-frame/storyboard images) ---
            const antiCollagePrompt = `!!! CRITICAL OUTPUT CONSTRAINT !!! Generate EXACTLY ONE single continuous scene/frame. ABSOLUTELY NO: split frames, collages, storyboards, multiple panels, side-by-side images, grid layouts, before/after comparisons, or any form of image division. The output MUST be ONE unified visual with ONE continuous composition. If the prompt implies multiple moments, choose the MOST IMPORTANT SINGLE MOMENT and render only that.`;

            let finalImagePrompt = `${antiCollagePrompt} ${globalStoryPrompt} ${directorDNAPrompt} ${dopResearchPrompt} ${authoritativeStyle} ${scaleCmd} ${scaleLockInstruction} ${noDriftGuard} ${coreActionPrompt} ${groupEnvAnchor} ${timeWeatherLock} ${charPrompt} FULL SCENE VISUALS: ${cleanedContext}. STYLE DETAILS: ${metaTokens}. TECHNICAL: (STRICT CAMERA: ${cinematographyPrompt ? cinematographyPrompt : 'High Quality'}).`.trim();

            // PROP ANCHOR TEXT INJECTION (High Priority)
            if (sceneToUpdate.referenceImage && sceneToUpdate.referenceImageDescription) {
                finalImagePrompt = `!!! MANDATORY OBJECT LOCK: ${sceneToUpdate.referenceImageDescription.toUpperCase()} !!! Draw the following objects EXACTLY as shown in the [AUTHORITATIVE_VISUAL_REFERENCE] image: ${sceneToUpdate.referenceImageDescription.toUpperCase()}. Match design, material, and color. ${finalImagePrompt}`;
            }

            // AUTO-DETECT OBJECT INSERTION FROM CONTEXT
            const objectInsertionMatch = cleanedContext.match(/(?:sits|placed|lying|resting)\s+(?:a|the)\s+([a-zA-Z\s]+?)\s+(?:on|in|at)\s+(?:the|a)\s+([a-zA-Z\s]+)/i);
            if (objectInsertionMatch) {
                const [_, objName, locName] = objectInsertionMatch;
                finalImagePrompt = `!!! PRIORITY EDIT: COMPOSITE A ${objName.toUpperCase()} ONTOP OF THE EXISTING ${locName.toUpperCase()} !!! 
                1. RENDER the ${objName} clearly.
                2. KEEP the ${locName} VISIBLE underneath the ${objName}.
                3. DO NOT REMOVE or REPLACE the ${locName}. 
                ${finalImagePrompt}`;
            }

            if (refinementPrompt) {
                finalImagePrompt = `REFINEMENT: ${refinementPrompt}. BASE PROMPT: ${finalImagePrompt}`;
            }

            if (negativePrompt) {
                finalImagePrompt = `${finalImagePrompt} NEGATIVE CONSTRAINTS (AVOID THESE): ${negativePrompt}`;
            }

            // --- 5. CONTINUITY & MULTI-IMAGE REFERENCES ---
            const parts: any[] = [];

            // 5.0.0 BASE IMAGE (CANVAS) - MUST BE FIRST FOR EDITING
            // Placing the base image first tells the model this is the "Subject" to modify.
            if (baseImage) {
                const baseImgData = await safeGetImageData(baseImage);
                if (baseImgData) {
                    console.log('[ImageGen] 🖼️ Base Image Editing Mode: Injecting as PRIMARY input.');
                    parts.push({ inlineData: { data: baseImgData.data, mimeType: baseImgData.mimeType } });
                    parts.push({ text: `Using the provided image as the base scene, please EDIT it according to the instructions. Retain the original composition, lighting, and subject pose unless explicitly asked to change them.` });
                }
            }
            let continuityInstruction = '';
            const isPro = currentState.imageModel === 'gemini-3-pro-image-preview';

            // 5.0 DNA REFERENCE IMAGE INJECTION (From Director Chat - SYNC/REGENERATE)
            // This is a VERY HIGH PRIORITY reference - the user explicitly asked to match this scene
            if (referenceImage) {
                const dnaImgData = await safeGetImageData(referenceImage);
                if (dnaImgData) {
                    // Check if this is COMPOSITE mode (has object description) or STYLE mode
                    const objectToExtract = sceneToUpdate.referenceImageDescription;

                    if (objectToExtract) {
                        // COMPOSITE MODE: Extract specific object from reference
                        const refLabel = 'OBJECT_SOURCE_IMAGE';
                        parts.push({
                            text: `[${refLabel}]: !!! EXTRACT OBJECT FROM THIS IMAGE !!!
Look at this reference image and FIND the object: "${objectToExtract}".
COPY the EXACT appearance of "${objectToExtract}" (color, texture, shape, details) from THIS image.
ADD this object to the BASE scene (the first image) in a natural position.
DO NOT copy the background or other elements from this reference - ONLY the specified object.`
                        });
                        parts.push({ inlineData: { data: dnaImgData.data, mimeType: dnaImgData.mimeType } });
                        continuityInstruction += `(COMPOSITE: Add "${objectToExtract}" from reference) `;
                        console.log('[ImageGen] 🎯 COMPOSITE Mode: Extracting object:', objectToExtract);
                    } else {
                        // STYLE MODE: Match visual DNA/style
                        const refLabel = 'DNA_VISUAL_REFERENCE';
                        parts.push({
                            text: `[${refLabel}]: !!! CRITICAL VISUAL DNA ANCHOR !!!
This is the MANDATORY reference image that defines the EXACT visual style for this scene.
MATCH PRECISELY:
- Color grading, palette, and lighting atmosphere
- Material textures (e.g. skin, fabric, surfaces) and render style
- Character identity and appearance details

IMPORTANT EXCEPTIONS - DEFER TO PROMPT FOR:
- ACTION and POSE (If text prompt describes a different action, FOLLOW THE TEXT)
- OBJECT PLACEMENT (If text prompt moves an object, FOLLOW THE TEXT)
- COMPOSITION (If text prompt changes camera angle, FOLLOW THE TEXT)

Use this image strictly as a "Style & Material" reference, NOT a pixel-perfect layout content constraint.` });
                        parts.push({ inlineData: { data: dnaImgData.data, mimeType: dnaImgData.mimeType } });
                        continuityInstruction += '(DNA REFERENCE ENFORCED) ';
                        console.log('[ImageGen] 🧬 DNA Reference Image injected for visual consistency');
                    }
                }
            }

            // 5.0.1 BASE IMAGE INJECTION (For Img2Img / Editing)
            // If baseImage is provided, this is an EDIT operation, not a generation from scratch.



            // 5a. CHARACTER FACE ID ANCHOR (ABSOLUTE FIRST - Before Style!)
            // Using Google's recommended pattern: "Use supplied image as reference for how [name] should look"
            for (const char of selectedChars) {
                // PRIMARY ANCHOR: Face ID (most important)
                const isAnimal = /horse|snake|dog|cat|wolf|bird|lion|tiger|dragon|animal|creature|bear|eagle|fish|shark|whale/i.test(char.name) ||
                    /horse|snake|dog|cat|wolf|bird|lion|tiger|dragon|animal|creature|bear|eagle|fish|shark|whale/i.test(char.description);

                if (char.faceImage) {
                    const imgData = await safeGetImageData(char.faceImage);
                    if (imgData) {
                        const refLabel = `IDENTITY_${char.name.toUpperCase().replace(/\s+/g, '_')}`;

                        if (isAnimal) {
                            // ANIMAL/CREATURE LOGIC: Softer lock, focus on species/texture, NO face structure mapping
                            parts.push({ text: `[${refLabel}]: VISUAL REFERENCE for ${char.name}. Use this image as a guide for the creature's appearance (species, color, pattern, size). Do NOT treat this as a human face. Blend it naturally into the scene.` });
                            console.log(`[ImageGen] 🐾 Injected CREATURE reference for ${char.name}`);
                        } else {
                            // HUMAN LOGIC: Strict Face Lock
                            parts.push({ text: `[${refLabel}]: !!! MANDATORY IDENTITY LOCK !!! Use this supplied image as the ONLY AUTHORITATIVE reference for how ${char.name} should look. Match face structure, features, and identity 100%. ABSOLUTELY NO VARIATION in facial structure allowed. ${char.description}` });
                            console.log(`[ImageGen] 👤 Injected FACE reference for ${char.name}`);
                        }

                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(STRICT IDENTITY LOCK: ${char.name}) `;
                    } else {
                        console.warn(`[ImageGen] ⚠️ Failed to load FACE image for ${char.name}`);
                    }
                } else if (char.masterImage) {
                    // Fallback to Master Image if Face Image is missing
                    const imgData = await safeGetImageData(char.masterImage);
                    if (imgData) {
                        const refLabel = `IDENTITY_${char.name.toUpperCase().replace(/\s+/g, '_')}`;
                        parts.push({ text: `[${refLabel}]: !!! MANDATORY IDENTITY LOCK (MASTER) !!! Use this supplied image as the ONLY AUTHORITATIVE reference for ${char.name}. Focus on the face and identity from this image. ${char.description}` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(STRICT IDENTITY LOCK (MASTER): ${char.name}) `;
                        console.log(`[ImageGen] 👤 Injected MASTER reference (as Face fallback) for ${char.name}`);
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

                // SAME LOCATION LOCK: All scenes in this group share the same physical environment
                if (groupObj) {
                    const sameLocationLock = `!!! SAME LOCATION LOCK !!! This scene is part of location group "${groupObj.name}". 
ALL SCENES IN THIS GROUP SHARE THE SAME PHYSICAL ENVIRONMENT: ${groupObj.description}.
YOU MUST MAINTAIN:
- Same architectural style, room layout, wall colors, and ceiling height
- Same furniture positions (tables, chairs, counters remain fixed)
- Same window/door placements
- Same lighting sources and color temperature
- Same time of day: ${groupObj.timeOfDay || 'consistent with group'}
DO NOT invent new environments or change the location. This is NOT a different place.`;
                    continuityInstruction += sameLocationLock;
                }

                // CONCEPT IMAGE ANCHOR: Use for ALL scenes in group (CRITICAL - not just after first)
                if (groupObj?.conceptImage) {
                    const imgData = await safeGetImageData(groupObj.conceptImage);
                    if (imgData) {
                        const refLabel = `MANDATORY_LOCATION_TEMPLATE`;
                        parts.push({ text: `[${refLabel}]: !!! CRITICAL ENVIRONMENT ANCHOR !!! This concept image defines the EXACT environment for ALL scenes in this location group. EVERY shot must exist within this space. Match: architectural style, layout, color palette, lighting, textures, and geometry. CHARACTER APPEARANCE comes from separate IDENTITY references - only use this for ENVIRONMENT. This location must be IDENTICAL across all scenes in the group.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(CONCEPT ENVIRONMENT ENFORCED) `;
                    }
                } else if (groupObj) {
                    // WARN: No concept image - add stronger text-based instruction
                    console.warn(`[ImageGen] ⚠️ Group "${groupObj.name}" has no concept image. Environment may vary.`);
                    continuityInstruction += `[NO CONCEPT IMAGE]: Strictly infer environment from "${groupObj.description}". Do NOT hallucinate different locations. `;
                }

                // FIRST SCENE BACKUP: If no concept image but first scene exists, use it as environment template
                const firstSceneInGroup = currentState.scenes
                    .filter(s => s.groupId === sceneToUpdate.groupId && s.generatedImage && s.id !== sceneToUpdate.id)
                    .sort((a, b) => parseInt(a.scene_number) - parseInt(b.scene_number))[0];

                if (firstSceneInGroup?.generatedImage && !groupObj?.conceptImage) {
                    const imgData = await safeGetImageData(firstSceneInGroup.generatedImage);
                    if (imgData) {
                        const refLabel = `ENVIRONMENT_ONLY_LOCK`;
                        parts.push({ text: `[${refLabel}]: Use this as the RIGID template for architecture and lighting ONLY. Match: layout, wall textures, room geometry, furniture placement, and lighting source. ABSOLUTELY IGNORE characters, clothing, and small props. This is a background-only consistency anchor.` });
                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                        continuityInstruction += `(BACKGROUND LOCK FROM MASTER SCENE) `;
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

            // 5e. CONTINUITY ANCHOR FROM PREVIOUS SHOT (Stronger Logic)
            // Use if isContinuityMode is ON and we are in the same group (or no group but sequential)
            if (isContinuityMode && currentSceneIndex > 0 && !sceneToUpdate.referenceImage) {
                const prevSceneWithImage = currentState.scenes.slice(0, currentSceneIndex).reverse().find(s => s.generatedImage);

                // Only use as anchor if it belongs to the same Scene Group (strong continuity) or is the immediate predecessor
                const isSameGroup = prevSceneWithImage && prevSceneWithImage.groupId === sceneToUpdate.groupId;
                const isImmediate = prevSceneWithImage && (parseInt(sceneToUpdate.sceneNumber) - parseInt(prevSceneWithImage.sceneNumber) <= 1);

                if (prevSceneWithImage?.generatedImage && (isSameGroup || isImmediate)) {
                    const imgData = await safeGetImageData(prevSceneWithImage.generatedImage);
                    if (imgData) {
                        // RE-ENTRY SAFE INSTRUCTION: If previous shot was empty, warn AI not to suppress characters
                        const wasPrevShotEmpty = (prevSceneWithImage.characterIds?.length || 0) === 0;
                        const charReturnWarning = wasPrevShotEmpty ? "!!! NOTICE !!! The previous shot was a background-only view. The current shot contains characters; do NOT let this reference suppress their appearance or identity." : "";

                        // Detect if we are zooming in (Wide -> Close Up)
                        const isZoomingIn = (anglePrompt.includes('CLOSE') || anglePrompt.includes('CU')) && !prevSceneWithImage.cameraAngleOverride?.includes('CLOSE');

                        const anchorLabel = isZoomingIn ? "ZOOM_IN_ANCHOR" : "CONTINUITY_ANCHOR";

                        parts.push({
                            text: `[${anchorLabel}]: CONTINUITY REFERENCE (SELECTIVE). Use previous frame for consistency. ${charReturnWarning}
INHERIT THESE:
1. PHYSICAL LIGHTING: Match actual light source direction and shadow placement
2. ENVIRONMENT: Fixed positions of furniture, architecture, and landmarks
3. SUBJECTS: Character appearance (clothing, pose, physical features)

!!! DO NOT INHERIT - CAMERA-SPECIFIC EFFECTS !!!:
- Camera filters (CCTV, night vision, security camera, surveillance overlays)
- Vignettes, scan lines, recording artifacts, grain patterns
- Color grading specific to surveillance/special camera POV
- Text overlays, timestamps, HUD elements, date stamps
- Fish-eye distortion or lens artifacts from special cameras

The NEW scene has its OWN camera style as specified in the current prompt. DO NOT apply previous scene's camera treatment.` });

                        parts.push({ inlineData: { data: imgData.data, mimeType: imgData.mimeType } });
                    }
                }
            }

            // 5e. EXPLICIT PRODUCT/PROP REFERENCE (User-defined Override)
            if (sceneToUpdate.referenceImage) {
                const imgData = await safeGetImageData(sceneToUpdate.referenceImage);
                if (imgData) {
                    const focus = sceneToUpdate.referenceImageDescription || 'props and environment';
                    parts.push({
                        text: `[AUTHORITATIVE_VISUAL_REFERENCE]: 
STEP 1: ANALYZE this image deeply. Identify the key visual attributes of the ${focus} (Material, Texture, Color Palette, Lighting Style, Design details).
STEP 2: GENERATE the new scene by strictly applying these identified attributes.
Match the ${focus} EXACTLY as shown in this reference.
IGNORE any prior text descriptions if they conflict with this visual DNA.` });
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

            // (Base Image moved to start)
            if (continuityInstruction) {
                finalImagePrompt = `${continuityInstruction.trim()} ${finalImagePrompt}`;
            }

            // --- REFERENCE LIMIT VALIDATION (Gemini 3 Pro: Max 14 images) ---
            const imagePartsCount = parts.filter((p: any) => p.inlineData).length;
            if (imagePartsCount > 14) {
                console.warn(`[ImageGen] ⚠️ WARNING: ${imagePartsCount} reference images detected. Gemini 3 Pro supports max 14. Performance may degrade.`);
            } else if (imagePartsCount > 0) {
                console.log(`[ImageGen] 📷 Using ${imagePartsCount} reference image(s)`);
            }

            const { imageUrl, mediaId } = await callAIImageAPI(
                finalImagePrompt,
                userApiKey,
                currentState.imageModel || 'gemini-3-pro-image-preview',
                currentState.aspectRatio,
                isHighRes ? parts : [],
                currentState.resolution || '1K',
                { domain: currentState.gommoDomain || '', accessToken: currentState.gommoAccessToken || '' }
            );

            updateStateAndRecord(s => {
                const duration = Date.now() - startTime;
                const resolutionKey = (currentState.resolution || '1K') as '1K' | '2K' | '4K';
                const currentStats = s.usageStats || { '1K': 0, '2K': 0, '4K': 0, total: 0 };
                const newCount = (currentStats[resolutionKey] || 0) + 1;

                const updatedStats = {
                    ...currentStats,
                    [resolutionKey]: newCount,
                    total: (currentStats.total || 0) + 1,
                    scenes: (currentStats.scenes || 0) + 1,
                    lastGeneratedAt: new Date().toISOString()
                };

                // Sync to Supabase if userId is present
                if (userId) {
                    syncUserStatsToCloud(userId, updatedStats);
                }

                return {
                    ...s,
                    totalGenerationTime: (s.totalGenerationTime || 0) + duration,
                    scenes: s.scenes.map(sc => sc.id === sceneId ? {
                        ...sc,
                        generationDuration: duration,
                        generationStartTime: undefined,
                        ...(fromManual ? { endFrameImage: imageUrl } : { generatedImage: imageUrl }),
                        mediaId: fromManual ? sc.mediaId : (mediaId || sc.mediaId),
                        isGenerating: false,
                        error: null
                    } : sc),
                    usageStats: updatedStats
                };
            });

            // Add to session gallery
            if (addToGallery) {
                addToGallery(imageUrl, fromManual ? 'end-frame' : 'scene', finalImagePrompt, sceneId);
            }

        } catch (error) {
            console.error("Image generation failed:", error);
            updateStateAndRecord(s => ({
                ...s,
                scenes: s.scenes.map(sc => sc.id === sceneId ? { ...sc, isGenerating: false, generationStartTime: undefined, error: (error as Error).message } : sc)
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
                currentState.resolution || '1K',
                { domain: currentState.gommoDomain || '', accessToken: currentState.gommoAccessToken || '' }
            );

            if (imageUrl) {
                // Increment Usage Stats
                updateStateAndRecord(s => {
                    const resolutionKey = (currentState.resolution || '1K') as '1K' | '2K' | '4K';
                    const currentStats = s.usageStats || { '1K': 0, '2K': 0, '4K': 0, total: 0 };

                    const updatedStats = {
                        ...currentStats,
                        [resolutionKey]: (currentStats[resolutionKey] || 0) + 1,
                        total: (currentStats.total || 0) + 1,
                        concepts: (currentStats.concepts || 0) + 1,
                        lastGeneratedAt: new Date().toISOString()
                    };

                    if (userId) {
                        syncUserStatsToCloud(userId, updatedStats);
                    }

                    return {
                        ...s,
                        usageStats: updatedStats
                    };
                });

                if (addToGallery) {
                    addToGallery(imageUrl, 'concept', conceptPrompt, groupName);
                }
            }

            return imageUrl;
        } catch (error) {
            console.error("Concept generation failed:", error);
            return null;
        }
    }, [stateRef, userApiKey, setApiKeyModalOpen, userId]);

    // specificSceneIds: Optional list of specific IDs to regenerate
    // referenceMap: Optional mapping of sceneId -> sourceImageURL for DNA syncing
    // baseImageMap: Optional mapping of sceneId -> baseImageURL for Img2Img editing from a specific source
    const handleGenerateAllImages = useCallback(async (specificSceneIds?: string[], referenceMap?: { [key: string]: string }, baseImageMap?: { [key: string]: string }) => {
        console.log('[BatchGen] handleGenerateAllImages called', { specificSceneIds, hasReferenceMap: !!referenceMap, hasBaseImageMap: !!baseImageMap });

        const allScenesToGenerate = specificSceneIds
            ? stateRef.current.scenes.filter(s => specificSceneIds.includes(s.id))
            : stateRef.current.scenes.filter(s => !s.generatedImage && s.contextDescription);

        // Generation Lock: Filter out scenes that are already being generated
        const scenesToGenerate = allScenesToGenerate.filter(scene => {
            if (generatingSceneIdsRef.current.has(scene.id)) {
                console.warn(`[BatchGen] ⏸️ Scene ${scene.sceneNumber} (${scene.id}) already generating, skipping duplicate request`);
                return false;
            }
            return true;
        });

        // Mark all scenes as generating
        scenesToGenerate.forEach(scene => generatingSceneIdsRef.current.add(scene.id));

        console.log('[BatchGen] Scenes to generate:', scenesToGenerate.length, '(filtered from', allScenesToGenerate.length, ')');

        if (scenesToGenerate.length === 0) {
            console.log('[BatchGen] No scenes to generate (all duplicates or empty), returning');
            return; // Don't show alert if we filtered out duplicates
        }

        setIsBatchGenerating(true);
        setIsStopping(false);
        stopRef.current = false;

        console.log('[BatchGen] Starting batch generation...');
        const batchStartTime = Date.now();
        setAgentState('director', 'thinking', 'Đang lập kế hoạch sản xuất cho các phân cảnh...');
        setAgentState('dop', 'idle', '');

        try {
            // KEY FRAME STRATEGY: Generate Key Frames FIRST within each group
            // This ensures hero shots are available as references for other scenes
            const sortedScenes = [...scenesToGenerate].sort((a, b) => {
                // Key frames first
                if (a.isKeyFrame && !b.isKeyFrame) return -1;
                if (!a.isKeyFrame && b.isKeyFrame) return 1;
                // Then by scene number
                return parseInt(a.sceneNumber) - parseInt(b.sceneNumber);
            });

            const keyFrameCount = sortedScenes.filter(s => s.isKeyFrame).length;
            if (keyFrameCount > 0) {
                console.log(`[BatchGen] ⭐ Key Frame Strategy: ${keyFrameCount} key frames will be generated first`);
            }

            for (let i = 0; i < sortedScenes.length; i++) {
                const scene = sortedScenes[i];
                if (stopRef.current) break;

                setAgentState('director', 'speaking', `Đang chỉ đạo Phân cảnh ${scene.sceneNumber}...`);

                // STORYBOARD MODE: Find cascade reference from same group for visual consistency
                const cascadeRef = findCascadeReference(scene, stateRef.current);

                // Check if this scene has a specific DNA reference image (from Reference Map OR Scene Attributes)
                // Priority: explicit referenceMap > scene.referenceImage > cascadeReference
                const dnaReference = (referenceMap && referenceMap[scene.id]) || scene.referenceImage || cascadeRef || undefined;

                // Check if scene ALREADY has an image -> Treat as Base Image for Editing
                // PRIORITIZE explicitly passed baseImageMap
                const existingBaseImage = (baseImageMap && baseImageMap[scene.id]) || scene.generatedImage || undefined;

                const result = await performImageGeneration(scene.id, undefined, false, dnaReference, existingBaseImage);

                if (result === 'critical_error') {
                    console.warn(`[BatchGen] ⚠️ CRITICAL DOP ERROR in Scene ${scene.sceneNumber}. Marking as unfixable but CONTINUING batch.`);
                    // We do NOT break here anymore, per user request.
                    // The scene is already marked as error in state by performImageGeneration.
                }

                setAgentState('director', 'success', `Đã xử lý xong Phân cảnh ${scene.sceneNumber}.`);


                // Get the newly generated image
                const updatedState = stateRef.current;
                const updatedScene = updatedState.scenes.find(s => s.id === scene.id);
                const currentImage = updatedScene?.generatedImage;

                // DOP Vision Validation (if enabled and not first scene)
                if (isDOPEnabled && validateRaccordWithVision && currentImage && userApiKey) {
                    const currentSceneIndex = updatedState.scenes.findIndex(s => s.id === scene.id);
                    const prevScene = currentSceneIndex > 0 ? updatedState.scenes[currentSceneIndex - 1] : null;

                    if (prevScene?.generatedImage) {
                        setAgentState('dop', 'thinking', 'Đang kiểm tra tính nhất quán (Raccord) với cảnh trước...');
                        console.log('[DOP] Validating raccord between scenes...');


                        // [DOP UI FEEDBACK] Show validation in progress
                        updateStateAndRecord(s => ({
                            ...s,
                            scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                ...sc,
                                error: '🎬 DOP đang kiểm tra...'
                            } : sc)
                        }));

                        let MAX_DOP_RETRIES = 2;
                        let retryCount = 0;
                        let lastValidation = await validateRaccordWithVision(
                            currentImage,
                            prevScene.generatedImage,
                            updatedScene!,
                            prevScene,
                            userApiKey
                        );

                        // Filter for critical errors only (character/prop issues warrant regen)
                        const criticalErrors = lastValidation.errors.filter(e =>
                            e.type === 'character' || e.type === 'prop'
                        );

                        // FIX: If validation passed OR no critical errors, clear the checking status immediately
                        if (lastValidation.isValid || criticalErrors.length === 0) {
                            updateStateAndRecord(s => ({
                                ...s,
                                scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                    ...sc,
                                    error: lastValidation.isValid ? null : `ℹ️ Minor issues (non-critical): ${lastValidation.errors.map(e => e.description).join('; ')}`
                                } : sc)
                            }));

                            if (lastValidation.isValid) {
                                console.log('[DOP] Raccord validation PASSED - clearing status');
                                setAgentState('dop', 'success', `Cảnh ${scene.sceneNumber} khớp raccord hoàn hảo!`);
                            } else {
                                console.log('[DOP] Only minor issues found - continuing without retry');
                                setAgentState('dop', 'idle', '');
                            }
                        }

                        // Use Decision Agent if available, otherwise use simple retry logic
                        if (!lastValidation.isValid && criticalErrors.length > 0) {
                            console.log(`[DOP] RACCORD ERROR DETECTED:`, criticalErrors);

                            // Get original prompt for decision agent
                            const originalPrompt = updatedScene?.contextDescription || '';

                            // Ask Decision Agent if we should retry
                            let shouldRetry = true;
                            let enhancedCorrection = lastValidation.correctionPrompt;

                            if (makeRetryDecision && currentImage) {
                                setAgentState('dop', 'speaking', 'Phát hiện lỗi Raccord! Đang phân tích khả năng sửa đổi...');
                                console.log('[DOP Agent] Analyzing if retry will succeed...');


                                // [DOP UI FEEDBACK] Show decision agent thinking
                                updateStateAndRecord(s => ({
                                    ...s,
                                    scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                        ...sc,
                                        error: '🧠 DOP Agent đang phân tích lỗi...'
                                    } : sc)
                                }));

                                const decision = await makeRetryDecision(
                                    currentImage,
                                    prevScene.generatedImage,
                                    originalPrompt,
                                    criticalErrors,
                                    userApiKey
                                );

                                console.log('[DOP Agent] Decision:', decision);

                                if (decision.action === 'skip') {
                                    console.log('[DOP Agent] SKIP - errors are unfixable, saving credits');
                                    shouldRetry = false;

                                    // FIX: Clear checking status and show clear unfixable message
                                    const unfixableMsg = decision.reason.includes('face') || decision.reason.includes('identity')
                                        ? `🚫 UNFIXABLE: Nhân vật khác (AI không thể sửa - cần chọn reference khác hoặc regenerate từ đầu)`
                                        : `⚠️ DOP Skip: ${decision.reason}`;

                                    updateStateAndRecord(s => ({
                                        ...s,
                                        scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                            ...sc,
                                            error: unfixableMsg
                                        } : sc)
                                    }));

                                    setAgentState('dop', 'error', 'Lỗi không thể sửa tự động - cần review thủ công');
                                    if (addProductionLog) {
                                        addProductionLog('dop', unfixableMsg, 'warning');
                                    }
                                } else if (decision.action === 'try_once') {
                                    MAX_DOP_RETRIES = 1; // Reduce retries for uncertain cases
                                    if (decision.enhancedPrompt) {
                                        enhancedCorrection = decision.enhancedPrompt;
                                    }
                                } else if (decision.enhancedPrompt) {
                                    enhancedCorrection = decision.enhancedPrompt;
                                }
                            }

                            // Only retry if Decision Agent approves
                            while (shouldRetry && !lastValidation.isValid && retryCount < MAX_DOP_RETRIES) {
                                // [Fix] Check stop signal inside retry loop
                                if (stopRef.current) {
                                    console.log('[DOP] Batch stopped during retry.');
                                    break;
                                }

                                console.log(`[DOP] Retrying with enhanced correction (attempt ${retryCount + 1}/${MAX_DOP_RETRIES})`);

                                // Clear the bad image and regenerate with correction
                                updateStateAndRecord(s => ({
                                    ...s,
                                    scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                        ...sc,
                                        generatedImage: null,
                                        error: `DOP Retry ${retryCount + 1}: ${lastValidation.errors.filter(e => e.type === 'character' || e.type === 'prop').map(e => e.description).join('; ')}`
                                    } : sc)
                                }));

                                // Wait a bit then regenerate with enhanced correction prompt
                                await new Promise(r => setTimeout(r, 500));

                                console.log('[DOP] Auto-regenerating with correction:', enhancedCorrection);

                                // Construct Negative Prompt based on specific errors
                                const negativeConstraints: string[] = [];
                                lastValidation.errors.forEach(e => {
                                    const desc = e.description.toLowerCase();
                                    if (e.type === 'character' || desc.includes('face') || desc.includes('person')) {
                                        negativeConstraints.push('wrong person', 'different face', 'extra people', 'ugly face', 'distorted face');
                                    }
                                    if (e.type === 'prop' || desc.includes('missing')) {
                                        negativeConstraints.push('missing object', 'floating objects', 'bad hands', 'mutated');
                                    }
                                    if (e.type === 'lighting') {
                                        negativeConstraints.push('bad lighting', 'wrong exposure', 'dark image');
                                    }
                                    if (e.type === 'spatial' || desc.includes('scale') || desc.includes('perspective') || desc.includes('floating')) {
                                        negativeConstraints.push('same background', 'floating furniture', 'double exposure', 'collage', 'surreal', 'bad perspective');
                                    }
                                    if (desc.includes('static background') || desc.includes('identical') || desc.includes('wallpaper')) {
                                        negativeConstraints.push('static background', 'identical composition', 'same pixels', 'exact match', 'repetitive');
                                        // JITTER FIX: Force camera movement
                                        enhancedCorrection += ' (CAMERA MOVEMENT: Shift angle slightly! Dynamic perspective change! Do not reuse exact background pixels!)';
                                    }
                                });
                                const negativePrompt = negativeConstraints.length > 0
                                    ? `(${[...new Set(negativeConstraints)].join(', ')})`
                                    : undefined;

                                await performImageGeneration(scene.id, enhancedCorrection, false, undefined, undefined, negativePrompt);

                                // Re-validate
                                const reUpdatedState = stateRef.current;
                                const reUpdatedScene = reUpdatedState.scenes.find(s => s.id === scene.id);
                                const newImage = reUpdatedScene?.generatedImage;

                                if (newImage) {
                                    lastValidation = await validateRaccordWithVision(
                                        newImage,
                                        prevScene.generatedImage,
                                        reUpdatedScene!,
                                        prevScene,
                                        userApiKey
                                    );

                                    // [Fix] Re-evaluate critical errors to determine if we should continue retrying
                                    const currentCriticalErrors = lastValidation.errors.filter(e =>
                                        e.type === 'character' || e.type === 'prop'
                                    );

                                    // If no critical errors remain (only minor ones), stop retrying
                                    if (currentCriticalErrors.length === 0) {
                                        console.log('[DOP] Critical errors resolved. Stopping retries.');
                                        break;
                                    }
                                } else {
                                    // If generation failed (no image), stick with previous validation result or break
                                    console.warn('[DOP] Retry generation failed to produce image.');
                                    break;
                                }

                                retryCount++;
                            }
                        }

                        if (retryCount >= MAX_DOP_RETRIES && !lastValidation.isValid) {
                            console.warn('[DOP] Max retries reached. Marking scene for manual review.');
                            if (addProductionLog) {
                                addProductionLog('dop', `CẢNH BÁO: Cảnh ${scene.sceneNumber} gặp lỗi raccord nghiêm trọng (${lastValidation.errors[0]?.description}). Đã cố gắng sửa ${MAX_DOP_RETRIES} lần nhưng không thành công.`, 'warning');
                            }
                            // Proactive: Inform Director to update DNA for future scenes
                            if (lastValidation.errors.some(e => e.type === 'character')) {
                                addProductionLog('dop', 'Chỉ thị cho Director: Identity raccord bị trôi. Hãy rà soát lại Visual DNA cho các cảnh sau.', 'directive');
                            }

                            updateStateAndRecord(s => ({

                                ...s,
                                scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                    ...sc,
                                    error: `⚠️ DOP: Requires manual review (${lastValidation.errors.map(e => e.description).join('; ')})`
                                } : sc)
                            }));

                            // FAIL FAST RETURN
                            if (lastValidation.decision === 'skip') {
                                return 'critical_error';
                            }
                        } else if (lastValidation.isValid) {
                            console.log('[DOP] Raccord validation PASSED');
                            if (addProductionLog) {
                                addProductionLog('dop', `Cảnh ${scene.sceneNumber} khớp raccord hoàn hảo. Tiếp tục sản xuất.`, 'success');
                            }
                            // [DOP UI FEEDBACK] Clear status on success
                            updateStateAndRecord(s => ({
                                ...s,
                                scenes: s.scenes.map(sc => sc.id === scene.id ? {
                                    ...sc,
                                    error: null // Clear the status indicator
                                } : sc)
                            }));
                        }

                    }
                }

                const imageDelay = state.generationConfig?.imageDelay || 500;
                await new Promise(r => setTimeout(r, imageDelay));
            }
        } catch (e) {
            console.error('[BatchGen] Generation interrupted:', e);
            setAgentState('director', 'error', 'Có lỗi xảy ra khi tạo ảnh.');
        } finally {
            // Generation Lock Cleanup: Remove all scene IDs that were being generated
            scenesToGenerate.forEach(scene => generatingSceneIdsRef.current.delete(scene.id));
            console.log('[BatchGen] Cleaned up generation lock for', scenesToGenerate.length, 'scenes');

            setIsBatchGenerating(false);
            setAgentState('dop', 'idle', '');

            if (!stopRef.current) {
                const batchDuration = Date.now() - batchStartTime;
                const seconds = Math.floor(batchDuration / 1000);
                const timeStr = seconds > 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;

                setAgentState('director', 'success', `Đã hoàn thành! Tổng thời gian: ${timeStr}`);
                if (addProductionLog) {
                    addProductionLog('director', `Production hoàn tất. Thời gian thực thi: ${timeStr}`, 'success');
                }
            } else {
                setAgentState('director', 'idle', 'Đã dừng production.');
            }
        }
    }, [state.scenes, performImageGeneration, isDOPEnabled, validateRaccordWithVision, makeRetryDecision, userApiKey, stateRef, updateStateAndRecord, setAgentState]);


    return {
        isBatchGenerating,
        isStopping,
        performImageGeneration,
        generateGroupConcept,
        handleGenerateAllImages,
        stopBatchGeneration
    };
}
