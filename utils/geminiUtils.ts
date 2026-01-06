import { GoogleGenAI } from "@google/genai";

// ═══════════════════════════════════════════════════════════════
// IMAGE CACHE - Avoids re-fetching same images during generation
// ═══════════════════════════════════════════════════════════════
const imageCache = new Map<string, { data: string; mimeType: string }>();
const CACHE_MAX_SIZE = 100; // Increased from 50
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes (was 5 min) - longer session support
const FETCH_TIMEOUT = 15000; // 15 second timeout for slow connections
let cacheTimestamp = Date.now();

// Clear cache if too old
const checkCacheExpiry = () => {
    if (Date.now() - cacheTimestamp > CACHE_TTL) {
        imageCache.clear();
        cacheTimestamp = Date.now();
        console.log('[ImageCache] 🗑️ Cache cleared (TTL expired)');
    }
};

// Helper: Fetch with timeout
const fetchWithTimeout = async (url: string, timeout: number): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// Helper function to safely extract base64 data from both URL and base64 images
// WITH CACHING to avoid duplicate fetches
export const safeGetImageData = async (imageStr: string): Promise<{ data: string; mimeType: string } | null> => {
    if (!imageStr) return null;

    // Check cache first
    checkCacheExpiry();
    if (imageCache.has(imageStr)) {
        console.log('[ImageCache] ⚡ Cache hit');
        return imageCache.get(imageStr)!;
    }

    try {
        let result: { data: string; mimeType: string } | null = null;

        if (imageStr.startsWith('data:')) {
            const mimeType = imageStr.substring(5, imageStr.indexOf(';'));
            const data = imageStr.split('base64,')[1];
            result = { data, mimeType };
        } else if (imageStr.startsWith('http')) {
            const startTime = Date.now();
            const response = await fetchWithTimeout(imageStr, FETCH_TIMEOUT);
            if (!response.ok) throw new Error('Failed to fetch image');
            const blob = await response.blob();
            const mimeType = blob.type || 'image/jpeg';
            result = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({
                    data: (reader.result as string).split(',')[1],
                    mimeType
                });
                reader.readAsDataURL(blob);
            });
            console.log(`[ImageCache] 📥 Fetched in ${Date.now() - startTime}ms`);
        }

        // Store in cache
        if (result) {
            if (imageCache.size >= CACHE_MAX_SIZE) {
                // Remove oldest entry
                const firstKey = imageCache.keys().next().value;
                if (firstKey) imageCache.delete(firstKey);
            }
            imageCache.set(imageStr, result);
        }

        return result;
    } catch (error) {
        console.error('Error in safeGetImageData:', error);
        return null;
    }
};

// Pre-warm cache with multiple images in parallel
// Call this when loading a project to speed up first generation
export const preWarmImageCache = async (imageUrls: string[]): Promise<number> => {
    const startTime = Date.now();
    const uniqueUrls = [...new Set(imageUrls.filter(Boolean))];

    if (uniqueUrls.length === 0) return 0;

    console.log(`[ImageCache] 🔥 Pre-warming cache with ${uniqueUrls.length} images...`);

    const results = await Promise.allSettled(
        uniqueUrls.map(url => safeGetImageData(url))
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
    console.log(`[ImageCache] ✅ Pre-warmed ${successCount}/${uniqueUrls.length} images in ${Date.now() - startTime}ms`);

    return successCount;
};

// Export cache clear function for manual clearing
export const clearImageCache = () => {
    imageCache.clear();
    cacheTimestamp = Date.now();
    console.log('[ImageCache] 🗑️ Cache manually cleared');
};

// Get cache stats for debugging
export const getCacheStats = () => ({
    size: imageCache.size,
    maxSize: CACHE_MAX_SIZE,
    ttlMinutes: CACHE_TTL / 60000,
    ageMinutes: Math.round((Date.now() - cacheTimestamp) / 60000)
});

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

// Import GommoAI if needed for callCharacterImageAPI
import { GommoAI, urlToBase64 } from './gommoAI';
import { IMAGE_MODELS } from './appConstants';

/**
 * Character Image API with Gemini/Gommo routing
 * Used for Lora generation (Face ID, Body sheets)
 */
export const callCharacterImageAPI = async (
    apiKey: string | null,
    prompt: string,
    aspectRatio: string,
    imageModel: string = 'gemini-3-pro-image-preview',
    imageContext: string | null = null,
    gommoCredentials?: { domain: string; accessToken: string }
): Promise<string | null> => {
    // Determine provider from model
    const model = IMAGE_MODELS.find(m => m.value === imageModel);
    const provider = model?.provider || 'gemini';

    console.log(`[CharacterGen] Provider: ${provider}, Model: ${imageModel}`);

    // ═══════════════════════════════════════════════════════════════
    // GOMMO PATH
    // ═══════════════════════════════════════════════════════════════
    if (provider === 'gommo') {
        // STRICT CHECK: Only use Gommo if provider is explicitly Gommo AND credentials exist
        if (gommoCredentials?.domain && gommoCredentials?.accessToken) {
            console.log('[CharacterGen] 🟡 Using GOMMO provider');
            try {
                const client = new GommoAI(gommoCredentials.domain, gommoCredentials.accessToken);
                const gommoRatio = GommoAI.convertRatio(aspectRatio);

                // Prepare subjects if imageContext provided
                const subjects: Array<{ data?: string }> = [];
                if (imageContext) {
                    let base64Data = '';
                    if (imageContext.startsWith('data:')) {
                        base64Data = imageContext.split(',')[1] || '';
                    } else if (imageContext.startsWith('http')) {
                        const fetched = await urlToBase64(imageContext);
                        base64Data = fetched.split(',')[1] || '';
                    }
                    if (base64Data) {
                        subjects.push({ data: base64Data });
                    }
                }

                const cdnUrl = await client.generateImage(prompt, {
                    ratio: gommoRatio,
                    model: imageModel,
                    subjects: subjects.length > 0 ? subjects : undefined,
                    onProgress: (status, attempt) => {
                        console.log(`[CharacterGen] Polling ${attempt}/60: ${status}`);
                    }
                });

                // Convert CDN URL to base64
                const base64Image = await urlToBase64(cdnUrl);
                console.log('[CharacterGen] ✅ Gommo image generated successfully');
                return base64Image;
            } catch (error: any) {
                console.error('[CharacterGen] ❌ Gommo error:', error.message);
                throw error;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // ERROR: Gommo model selected but credentials missing
        // ═══════════════════════════════════════════════════════════════
        if (provider === 'gommo') {
            console.error('[CharacterGen] ❌ Gommo model selected but credentials missing!');
            throw new Error('Gommo credentials chưa được cấu hình. Vào Profile → Gommo AI để nhập Domain và Access Token.');
        }

        // ═══════════════════════════════════════════════════════════════
        // GEMINI PATH (only for Gemini provider models)
        // ═══════════════════════════════════════════════════════════════
        if (!apiKey?.trim()) {
            console.error('[CharacterGen] ❌ No API key');
            return null;
        }

        console.log('[CharacterGen] 🔵 Using GEMINI provider');
        return callGeminiAPI(apiKey, prompt, aspectRatio, imageModel, imageContext);
    };
