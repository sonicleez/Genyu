// Helper for analyzing character images using Gemini Vision
// and generating Face/Body prompts

import { GoogleGenAI } from "@google/genai";

export interface CharacterAnalysis {
    faceDescription: string;
    bodyDescription: string;
    style: string;
    hairColor: string;
    skinTone: string;
    clothing: string;
    accessories: string;
}

const ANALYSIS_PROMPT = `
Analyze this character image in detail. Extract the following information and return as JSON:

{
    "faceDescription": "Detailed description of face: shape, eyes (color, shape), nose, lips, eyebrows, skin texture, any distinctive features, expression",
    "bodyDescription": "Full body description: body type, posture, pose, proportions",
    "style": "Art style (e.g., 'anime', 'realistic', '3D Pixar', 'comic', 'watercolor')",
    "hairColor": "Hair color and style description",
    "skinTone": "Skin tone description",
    "clothing": "Detailed clothing/outfit description with colors and materials",
    "accessories": "Any accessories, jewelry, props"
}

Be very detailed and specific. This will be used to generate consistent face and body images.
Return ONLY valid JSON, no markdown.
`;

/**
 * Analyze character master image using Gemini Vision
 */
export async function analyzeCharacterImage(
    imageBase64: string,
    apiKey: string
): Promise<CharacterAnalysis> {
    const trimmedKey = apiKey?.trim();
    const ai = new GoogleGenAI({ apiKey: trimmedKey });

    // Clean base64 if needed
    const cleanData = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

    console.log('[Character Analysis] 🔍 Analyzing master image with Gemini...');

    const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{
            parts: [
                { inlineData: { data: cleanData, mimeType: 'image/jpeg' } },
                { text: ANALYSIS_PROMPT }
            ]
        }]
    });

    const text = response.text || '{}';
    console.log('[Character Analysis] 📋 Raw response:', text.substring(0, 200));

    try {
        // Clean JSON from markdown if present
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(cleanJson);
        console.log('[Character Analysis] ✅ Parsed successfully:', analysis);
        return analysis;
    } catch (e) {
        console.error('[Character Analysis] ❌ JSON parse error:', e);
        // Return default analysis
        return {
            faceDescription: "character face",
            bodyDescription: "character body",
            style: "detailed illustration",
            hairColor: "dark hair",
            skinTone: "natural skin tone",
            clothing: "casual clothing",
            accessories: ""
        };
    }
}

/**
 * Build prompt for Face ID generation
 */
export function buildFacePrompt(analysis: CharacterAnalysis, characterName?: string): string {
    return `
FACE ID PORTRAIT - CLOSE-UP HEADSHOT

Character: ${characterName || 'Character'}
Style: ${analysis.style}

FACE DETAILS:
${analysis.faceDescription}
Hair: ${analysis.hairColor}
Skin: ${analysis.skinTone}

REQUIREMENTS:
- Extreme close-up portrait, head and shoulders only
- Front facing, looking directly at camera
- Neutral expression, slight smile
- Professional studio lighting with key light and fill
- Solid neutral background (light gray or white)
- Sharp focus on eyes and face
- 4K quality, highly detailed
- Consistent with the original character style: ${analysis.style}

CRITICAL: Must look EXACTLY like the reference character. Same face, same hair, same style.
`.trim();
}

/**
 * Build prompt for Body/Outfit generation
 */
export function buildBodyPrompt(analysis: CharacterAnalysis, characterName?: string): string {
    return `
FULL BODY CHARACTER TURNAROUND

Character: ${characterName || 'Character'}
Style: ${analysis.style}

FACE (MUST MATCH):
${analysis.faceDescription}
Hair: ${analysis.hairColor}
Skin: ${analysis.skinTone}

BODY & OUTFIT:
${analysis.bodyDescription}
Clothing: ${analysis.clothing}
Accessories: ${analysis.accessories}

REQUIREMENTS:
- Full body shot, head to toe visible
- T-Pose or A-Pose for clear silhouette
- Front view, neutral standing pose
- Professional studio lighting
- Solid neutral background (light gray or white)
- Clear visibility of all clothing details
- 4K quality, highly detailed
- Style: ${analysis.style}

CRITICAL: Face and body must be EXACTLY the same character as reference. Maintain perfect consistency.
`.trim();
}
