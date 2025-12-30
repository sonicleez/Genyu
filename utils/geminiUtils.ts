import { GoogleGenAI } from "@google/genai";

// Helper function to safely extract base64 data from both URL and base64 images
export const safeGetImageData = async (imageStr: string): Promise<{ data: string; mimeType: string } | null> => {
    if (!imageStr) return null;

    try {
        if (imageStr.startsWith('data:')) {
            const mimeType = imageStr.substring(5, imageStr.indexOf(';'));
            const data = imageStr.split('base64,')[1];
            return { data, mimeType };
        } else if (imageStr.startsWith('http')) {
            const response = await fetch(imageStr);
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const mimeType = blob.type || 'image/jpeg';
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({
                    data: (reader.result as string).split(',')[1],
                    mimeType
                });
                reader.readAsDataURL(blob);
            });
        }
        return null;
    } catch (error) {
        console.error('Error in safeGetImageData:', error);
        return null;
    }
};

export const callGeminiAPI = async (
    apiKey: string,
    prompt: string,
    aspectRatio: string,
    imageModel: string = 'gemini-2.5-flash-image',
    imageContext: string | null = null
): Promise<string | null> => {
    const trimmedKey = apiKey?.trim();
    if (!trimmedKey) return null;

    console.log('[Gemini Gen] 🎨 Calling Gemini API...');
    try {
        const ai = new GoogleGenAI({ apiKey: trimmedKey });
        const parts: any[] = [];

        if (imageContext) {
            console.log('[Gemini Gen] 📎 Using Reference Image...');
            const contextData = await safeGetImageData(imageContext);
            if (contextData) {
                parts.push({ inlineData: { data: contextData.data, mimeType: contextData.mimeType } });
            }
        }

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: imageModel === 'gemini-2.0-flash' ? 'gemini-2.5-flash-image' : imageModel,
            contents: { parts: parts },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio
                }
            }
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
        return null;
    } catch (err: any) {
        console.error('[Gemini Gen] ❌ Error:', err.message);
        return null;
    }
};

export const callGeminiText = async (
    apiKey: string,
    prompt: string,
    systemPrompt: string = '',
    model: string = 'gemini-1.5-flash',
    jsonMode: boolean = false
): Promise<string> => {
    const trimmedKey = apiKey?.trim();
    if (!trimmedKey) throw new Error('Missing API Key');

    try {
        const ai = new GoogleGenAI({ apiKey: trimmedKey });

        const response = await ai.models.generateContent({
            model: model,
            contents: [{
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUSER COMMAND: ${prompt}` }]
            }],
            config: jsonMode ? { responseMimeType: "application/json" } : {}
        });

        return response.text;
    } catch (err: any) {
        console.error('[Gemini Text] ❌ Error:', err.message);
        throw err;
    }
};

export const callGeminiVisionReasoning = async (
    apiKey: string,
    prompt: string,
    images: { data: string; mimeType: string }[],
    model: string = 'gemini-2.0-flash-exp' // Default to "Banana Pro" (Latest Flash/Pro)
): Promise<string> => {
    const trimmedKey = apiKey?.trim();
    if (!trimmedKey) throw new Error('Missing API Key');

    try {
        const ai = new GoogleGenAI({ apiKey: trimmedKey });

        const parts: any[] = [{ text: prompt }];

        // Add all images
        images.forEach(img => {
            parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
        });

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ parts: parts }],
        });

        return response.text || '';
    } catch (err: any) {
        console.error('[Gemini Vision] ❌ Reasoning Error:', err.message);
        throw err;
    }
};
