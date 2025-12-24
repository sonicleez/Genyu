import { useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ProjectState, Character } from '../types';
import { generateId } from '../utils/helpers';
import { GLOBAL_STYLES, CHARACTER_STYLES } from '../constants/presets';
import { callGeminiAPI } from '../utils/geminiUtils';
import { uploadImageToSupabase } from '../utils/storageUtils';

export function useCharacterLogic(
    state: ProjectState,
    updateStateAndRecord: (updater: (prevState: ProjectState) => ProjectState) => void,
    userApiKey: string | null,
    setApiKeyModalOpen: (open: boolean) => void,
    userId?: string
) {
    const updateCharacter = useCallback((id: string, updates: Partial<Character>) => {
        updateStateAndRecord(s => ({
            ...s,
            characters: s.characters.map(c => c.id === id ? { ...c, ...updates } : c)
        }));
    }, [updateStateAndRecord]);

    const addCharacter = useCallback(() => {
        const newChar: Character = {
            id: generateId(),
            name: '',
            description: '',
            masterImage: null,
            faceImage: null,
            bodyImage: null,
            sideImage: null,
            backImage: null,
            props: [
                { id: generateId(), name: '', image: null },
                { id: generateId(), name: '', image: null },
                { id: generateId(), name: '', image: null },
            ],
            isDefault: false,
            isAnalyzing: false,
        };
        updateStateAndRecord(s => ({
            ...s,
            characters: [...s.characters, newChar]
        }));
    }, [updateStateAndRecord]);

    const deleteCharacter = useCallback((id: string) => {
        if (state.characters.length <= 1) {
            alert("Bạn cần ít nhất 1 nhân vật.");
            return;
        }
        setTimeout(() => {
            if (confirm("Bạn có chắc muốn xóa nhân vật này?")) {
                updateStateAndRecord(s => ({
                    ...s,
                    characters: s.characters.filter(c => c.id !== id)
                }));
            }
        }, 100);
    }, [state.characters.length, updateStateAndRecord]);

    const setDefaultCharacter = useCallback((id: string) => {
        updateStateAndRecord(s => ({
            ...s,
            characters: s.characters.map(c => ({
                ...c,
                isDefault: c.id === id
            }))
        }));
    }, [updateStateAndRecord]);

    const analyzeCharacterImage = useCallback(async (id: string, image: string) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
        updateCharacter(id, { isAnalyzing: true });

        if (!apiKey) {
            updateCharacter(id, { isAnalyzing: false });
            setApiKeyModalOpen(true);
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            let data: string;
            let mimeType: string = 'image/jpeg';
            let finalMasterUrl = image;

            if (image.startsWith('data:')) {
                const [header, base64Data] = image.split(',');
                data = base64Data;
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

                if (userId) {
                    try {
                        finalMasterUrl = await uploadImageToSupabase(image, 'project-assets', `${userId}/characters/${id}_master_${Date.now()}.jpg`);
                    } catch (e) {
                        console.error("Cloud upload failed for master image", e);
                    }
                }
            } else if (image.startsWith('http')) {
                // Handle URL images
                const imgRes = await fetch(image);
                if (!imgRes.ok) throw new Error(`Fetch failed`);
                const blob = await imgRes.blob();
                mimeType = blob.type || 'image/jpeg';
                data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                finalMasterUrl = image;
            } else {
                throw new Error("Invalid image format");
            }

            const analyzePrompt = `Analyze this character's main features. Return JSON: {"name": "Suggest a concise name", "description": "Short Vietnamese description (2-3 sentences) of key physical traits, clothing, and overall vibe. Focus on what makes them unique."}`;
            const analysisRes = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ inlineData: { data, mimeType } }, { text: analyzePrompt }] },
                config: {
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingLevel: 'low' as any }
                }
            });

            let json = { name: "", description: "" };
            try {
                const text = (analysisRes as any).text();
                json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
                try {
                    const text = (analysisRes as any).text || "";
                    json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
                } catch (e2) {
                    console.error("JSON parse error", e2);
                }
            }

            updateCharacter(id, {
                masterImage: finalMasterUrl,
                name: json.name || "Unnamed Character",
                description: json.description || "",
                isAnalyzing: false
            });

        } catch (error: any) {
            console.error("Analysis Failed", error);
            updateCharacter(id, { isAnalyzing: false });
        }
    }, [userApiKey, updateCharacter, setApiKeyModalOpen, userId]);

    // Combined function: Analyze + Generate Face ID & Body in one step
    const analyzeAndGenerateSheets = useCallback(async (id: string, image: string, options?: { skipMetadata?: boolean }) => {
        const rawApiKey = userApiKey || (process.env as any).API_KEY;
        const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;

        if (!apiKey) {
            setApiKeyModalOpen(true);
            return;
        }

        updateCharacter(id, { isAnalyzing: true });

        try {
            const ai = new GoogleGenAI({ apiKey });
            let data: string;
            let mimeType: string = 'image/jpeg';
            let finalMasterUrl = image;

            // Convert image to base64 if needed
            if (image.startsWith('data:')) {
                const [header, base64Data] = image.split(',');
                data = base64Data;
                mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

                if (userId) {
                    try {
                        finalMasterUrl = await uploadImageToSupabase(image, 'project-assets', `${userId}/characters/${id}_master_${Date.now()}.jpg`);
                    } catch (e) {
                        console.error("Cloud upload failed for master image", e);
                    }
                }
            } else if (image.startsWith('http')) {
                const imgRes = await fetch(image);
                if (!imgRes.ok) throw new Error(`Fetch failed`);
                const blob = await imgRes.blob();
                mimeType = blob.type || 'image/jpeg';
                data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                finalMasterUrl = image;
            } else {
                throw new Error("Invalid image format");
            }

            // Step 1: Analyze the character AND detect art style with HIGH PRECISION
            const analyzePrompt = `Analyze this character image carefully and provide accurate details.

**NAME RULES:**
- Suggest a SHORT, MEMORABLE English name (1-2 words max)
- Examples: "Leo", "Storm", "Captain Kai", "Luna", "The Hunter"
- If the character looks Asian, you can use short Asian-Western fusion names like "Rei", "Jin", "Yuki"

**DESCRIPTION RULES:**
- Write in Vietnamese
- Be SPECIFIC about physical traits: face shape, skin tone, hair color/style, eye shape
- Describe clothing/costume in detail: materials, colors, patterns
- Maximum 2-3 sentences, focus on VISUAL DISTINGUISHING features only

**ART STYLE DETECTION:**
- PHOTOREALISTIC: Real photo or ultra-realistic 3D render
- DIGITAL PAINTING: Painted look, brushstrokes, stylized
- ANIME: Japanese style, large eyes, cel-shaded
- CARTOON: Western animation, simplified features
- The image is NOT photorealistic if it has painted textures, stylized lighting, or non-realistic skin

Return JSON:
{
    "name": "Short English name (1-2 words)",
    "description": "Vietnamese description của đặc điểm nhận dạng: khuôn mặt, màu da, kiểu tóc màu tóc, trang phục chi tiết.",
    "art_style": "Accurate style description in English. Examples: 'Digital painting with warm tones', 'Anime cel-shaded', 'Semi-realistic illustration'",
    "is_illustration": true/false
}`;


            const analysisRes = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ inlineData: { data, mimeType } }, { text: analyzePrompt }] },
                config: {
                    responseMimeType: "application/json",
                    thinkingConfig: { thinkingLevel: 'medium' as any }
                }
            });

            let json = { name: "", description: "", art_style: "", is_illustration: false };
            try {
                const text = (analysisRes as any).text();
                json = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
                console.error("JSON parse error", e);
            }

            const charName = json.name || "Unnamed Character";
            const charDescription = json.description || "Character";
            let detectedStyle = json.art_style || "Digital illustration style";

            // If detected as illustration, reinforce it
            if (json.is_illustration) {
                detectedStyle = `ILLUSTRATION/PAINTED STYLE: ${detectedStyle}. This is NOT photorealistic.`;
            }

            console.log('[Character Analysis] Detected style:', detectedStyle);


            // Update character with analysis results
            // If skipMetadata is true, we ONLY update the masterImage (if changed)
            // and we rely on existing name/description for the subsequent prompt generation
            const currentChar = state.characters.find(c => c.id === id);
            const finalName = options?.skipMetadata ? (currentChar?.name || charName) : charName;
            const finalDescription = options?.skipMetadata ? (currentChar?.description || charDescription) : charDescription;

            updateCharacter(id, {
                masterImage: finalMasterUrl,
                name: finalName,
                description: finalDescription
            });

            // Step 2: Generate Face ID and Body using ONLY the detected style from the reference image
            // Note: We use finalDescription here which might be the user's custom one
            const styleInstruction = `
**CRITICAL STYLE ENFORCEMENT - DO NOT DEVIATE:**
You are generating images that MUST match the EXACT artistic style of the reference image provided.

DETECTED STYLE FROM REFERENCE: "${detectedStyle}"

ABSOLUTE RULES:
1. COPY the exact art style from the reference image. If it's anime, generate anime. If photorealistic, generate photorealistic.
2. MATCH the same color palette, shading technique, and line work as the reference.
3. IGNORE any other style instructions. The reference image is the ONLY style guide.
4. DO NOT apply any "cinematic", "8k", or "photorealistic" styles unless the reference is actually photorealistic.
5. KEEP the character's exact appearance: face, hair color/style, clothing, accessories.

TECHNICAL REQUIREMENTS:
- BACKGROUND: Pure solid white (#FFFFFF) studio background only.
- LIGHTING: Clean studio lighting that matches the reference's lighting style.
- QUALITY: Sharp, clean, no artifacts.
            `.trim();

            const facePrompt = `${styleInstruction}\n\n[TASK: FACE ID]\nGenerate an EXTREME CLOSE-UP portrait of this character's face on a pure white background.\nCharacter: ${finalDescription}\nSTYLE: Match the reference exactly - "${detectedStyle}"`;

            const bodyPrompt = `${styleInstruction}\n\n[TASK: FULL BODY]\nGenerate a FULL BODY view (head to toe, feet visible) of this character on a pure white background.\nPose: T-Pose or A-Pose, front view.\nCharacter: ${finalDescription}\nSTYLE: Match the reference exactly - "${detectedStyle}"`;

            const model = 'gemini-3-pro-image-preview'; // Use best model for style matching

            let [faceUrl, bodyUrl] = await Promise.all([
                callGeminiAPI(apiKey, facePrompt, "1:1", model, image),
                callGeminiAPI(apiKey, bodyPrompt, "9:16", model, image),
            ]);


            if (userId) {
                if (faceUrl?.startsWith('data:')) {
                    faceUrl = await uploadImageToSupabase(faceUrl, 'project-assets', `${userId}/characters/${id}_face_${Date.now()}.jpg`);
                }
                if (bodyUrl?.startsWith('data:')) {
                    bodyUrl = await uploadImageToSupabase(bodyUrl, 'project-assets', `${userId}/characters/${id}_body_${Date.now()}.jpg`);
                }
            }

            updateCharacter(id, {
                faceImage: faceUrl || undefined,
                bodyImage: bodyUrl || undefined,
                isAnalyzing: false
            });

        } catch (error: any) {
            console.error("Analyze and Generate Failed", error);
            updateCharacter(id, { isAnalyzing: false });
        }
    }, [userApiKey, updateCharacter, setApiKeyModalOpen, userId, state.imageModel]);

    const generateCharacterSheets = useCallback(async (id: string) => {
        const char = state.characters.find(c => c.id === id);
        if (!char || !char.masterImage) return;

        updateCharacter(id, { isAnalyzing: true });

        try {
            const rawApiKey = userApiKey || (process.env as any).API_KEY;
            const apiKey = typeof rawApiKey === 'string' ? rawApiKey.trim() : rawApiKey;
            const currentStyle = GLOBAL_STYLES.find(s => s.value === state.stylePrompt)?.prompt || "Cinematic photorealistic, 8k, high quality";

            const consistencyInstruction = `
            **MANDATORY CONSISTENCY:** 
            - BACKGROUND: MUST be a Pure Solid White Studio Background. 
            - CHARACTER: The character's face, hair, and clothing MUST be exactly as seen in the reference.
            - MASTER REFERENCE STYLE: You must strictly adhere to the following artistic style for all character details: "${currentStyle}".
            - LIGHTING: Professional studio lighting with rim lights for clear character silhouette.
            - QUALITY: 8K resolution, hyper-detailed, clean sharp focus.
            `.trim();

            const description = char.description || "Character";
            const facePrompt = `${consistencyInstruction}\n\n(STRICT CAMERA: EXTREME CLOSE-UP - FACE ID ON WHITE BACKGROUND) Generate a highly detailed Face ID close-up of this character: ${description}. Focus on capturing the exact facial features and expression from the reference. The background must be pure solid white.`;
            const bodyPrompt = `${consistencyInstruction}\n\n(STRICT CAMERA: FULL BODY HEAD-TO-TOE WIDE SHOT ON WHITE BACKGROUND) Generate a Full Body character design sheet (Front View, T-Pose or A-Pose). MUST CAPTURE HEAD-TO-TOE INCLUDING VISIBLE FEET. Description: ${description}. The clothing must match the reference image's color and texture exactly. The background must be pure solid white.`;

            if (!apiKey) {
                updateCharacter(id, { isAnalyzing: false });
                setApiKeyModalOpen(true);
                return;
            }

            const model = state.imageModel || 'gemini-3-pro-image-preview';

            let [faceUrl, bodyUrl] = await Promise.all([
                callGeminiAPI(apiKey, facePrompt, "1:1", model, char.masterImage),
                callGeminiAPI(apiKey, bodyPrompt, "9:16", model, char.masterImage),
            ]);

            if (userId) {
                if (faceUrl?.startsWith('data:')) {
                    faceUrl = await uploadImageToSupabase(faceUrl, 'project-assets', `${userId}/characters/${id}_face_${Date.now()}.jpg`);
                }
                if (bodyUrl?.startsWith('data:')) {
                    bodyUrl = await uploadImageToSupabase(bodyUrl, 'project-assets', `${userId}/characters/${id}_body_${Date.now()}.jpg`);
                }
            }

            updateCharacter(id, {
                faceImage: faceUrl || undefined,
                bodyImage: bodyUrl || undefined,
                isAnalyzing: false
            });

        } catch (e) {
            console.error("Generation Sheets Failed", e);
            updateCharacter(id, { isAnalyzing: false });
        }
    }, [userApiKey, state.imageModel, state.stylePrompt, updateCharacter, state.characters, userId]);

    const generateCharacterImage = useCallback(async (
        charId: string,
        params: {
            prompt: string,
            style: string,
            customStyle?: string,
            aspectRatio: string,
            resolution: string,
            model: string
        }
    ) => {
        const { prompt, style, customStyle, aspectRatio, model } = params;
        updateCharacter(charId, { isGenerating: true });

        try {
            const styleConfig = CHARACTER_STYLES.find(s => s.value === style);
            const stylePrompt = style === 'custom' ? customStyle : (styleConfig?.prompt || styleConfig?.label || style);

            const fullPrompt = `
CHARACTER DESIGN TASK:
Create a professional character sheet with the following specifications:

STYLE PRESET:
${stylePrompt}

CHARACTER DESCRIPTION:
${prompt}

MANDATORY REQUIREMENTS:
- Background: Pure Solid White Studio Background (RGB 255, 255, 255). No shadows on background, no textures.
- Framing: FULL BODY HEAD-TO-TOE, clear silhouette, MUST INCLUDE FEET.
- Pose: Standard A-Pose or T-Pose.
- Lighting: Professional studio softbox lighting, high contrast, rim light for separation.
- Quality: 8K, Ultra-Sharp focus, Hyper-detailed texture, Ray-tracing style.
- Consistency: Unified style, no artifacts, clean lines.

CRITICAL: The style MUST strictly follow the "STYLE PRESET" and Capturing the specific vibe described. Solid white background is non-negotiable.
            `.trim();

            const apiKey = (userApiKey || (process.env as any).API_KEY)?.trim();
            if (!apiKey) {
                setApiKeyModalOpen(true);
                throw new Error("API Key is missing");
            }

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: model,
                contents: [{ parts: [{ text: fullPrompt }] }],
                config: {
                    imageConfig: {
                        aspectRatio: aspectRatio
                    }
                }
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                let imageUrl = `data:${imagePart.inlineData.mimeType};base64,${base64ImageBytes}`;

                if (userId) {
                    try {
                        imageUrl = await uploadImageToSupabase(imageUrl, 'project-assets', `${userId}/characters/${charId}_gen_${Date.now()}.jpg`);
                    } catch (e) {
                        console.error("Cloud storage upload failed", e);
                    }
                }

                updateCharacter(charId, { generatedImage: imageUrl, isGenerating: false });
            } else {
                throw new Error("AI không trả về ảnh.");
            }

        } catch (err: any) {
            console.error("Background Gen Error:", err);
            updateCharacter(charId, { isGenerating: false });
            alert(`❌ Lỗi tạo ảnh: ${err.message}`);
        }
    }, [userApiKey, updateCharacter, userId]);

    return {
        updateCharacter,
        addCharacter,
        deleteCharacter,
        setDefaultCharacter,
        analyzeCharacterImage,
        analyzeAndGenerateSheets,
        generateCharacterSheets,
        generateCharacterImage
    };
}
