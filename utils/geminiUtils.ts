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
    imageModel: string = 'gemini-3-pro-image-preview',
    imageContext: string | null = null
): Promise<string | null> => {
    const trimmedKey = apiKey?.trim();
    if (!trimmedKey) {
        console.error('[Gemini Gen] ❌ No API key provided');
        return null;
    }

    // Validate and map model names
    let finalModel = imageModel;
    if (imageModel === 'gemini-2.0-flash') {
        finalModel = 'gemini-2.0-flash-preview-image-generation';
    }

    console.log('[Gemini Gen] 🎨 Calling Gemini API...', {
        model: finalModel,
        aspectRatio,
        hasContext: !!imageContext,
        promptLength: prompt.length
    });

    try {
        const ai = new GoogleGenAI({ apiKey: trimmedKey });
        const parts: any[] = [];

        if (imageContext) {
            console.log('[Gemini Gen] 📎 Processing Reference Image...');
            const contextData = await safeGetImageData(imageContext);
            if (contextData) {
                console.log('[Gemini Gen] ✅ Reference image loaded:', contextData.mimeType);
                parts.push({ inlineData: { data: contextData.data, mimeType: contextData.mimeType } });
            } else {
                console.error('[Gemini Gen] ❌ Failed to load reference image!');
            }
        }

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: finalModel,
            contents: { parts: parts },
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio
                }
            }
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart?.inlineData) {
            console.log('[Gemini Gen] ✅ Image generated successfully!');
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }

        console.error('[Gemini Gen] ❌ No image in response:', response);
        return null;
    } catch (err: any) {
        console.error('[Gemini Gen] ❌ Error:', err.message, err);
        return null;
    }
};

export interface TextGenerationResult {
    text: string;
    tokenUsage?: {
        promptTokens: number;
        candidateTokens: number;
        totalTokens: number;
    };
}

export const callGeminiText = async (
    apiKey: string,
    prompt: string,
    systemPrompt: string = '',
    model: string = 'gemini-2.5-flash',
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

        // Log token usage if available
        const usage = response.usageMetadata;
        if (usage) {
            console.log('[Gemini Text] Token Usage:', {
                prompt: usage.promptTokenCount,
                candidates: usage.candidatesTokenCount,
                total: usage.totalTokenCount
            });
            // Store in global for tracking (will be picked up by syncUserStatsToCloud)
            (window as any).__lastTextTokenUsage = {
                promptTokens: usage.promptTokenCount || 0,
                candidateTokens: usage.candidatesTokenCount || 0,
                totalTokens: usage.totalTokenCount || 0
            };
        }

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
    model: string = 'gemini-2.5-flash', // Gemini 3 Standard
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
