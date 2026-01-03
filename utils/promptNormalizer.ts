/**
 * Prompt Normalizer
 * Optimizes prompts for each specific AI model
 * Called by DOP before sending to API
 */

import { GoogleGenAI } from "@google/genai";

export type ModelType =
    | 'gemini'
    | 'imagen'
    | 'banana_pro'
    | 'seedream'
    | 'midjourney'
    | 'kling'
    | 'dreamina'
    | 'z_image'
    | 'hailuo'
    | 'flux'
    | 'ideogram'
    | 'recraft'
    | 'stable_diffusion'
    | 'dalle';

// Detect model type from model ID
export function detectModelType(modelId: string): ModelType {
    if (modelId.includes('gemini')) return 'gemini';
    if (modelId.includes('midjourney')) return 'midjourney';
    if (modelId.includes('seedream')) return 'seedream';
    if (modelId.includes('kling') || modelId.includes('colors') || modelId === 'o1') return 'kling';
    if (modelId.includes('dreamina')) return 'dreamina';
    if (modelId.includes('z_image')) return 'z_image';
    if (modelId.includes('hailuo')) return 'hailuo';
    if (modelId.includes('flux')) return 'flux';
    if (modelId.includes('ideogram')) return 'ideogram';
    if (modelId.includes('recraft')) return 'recraft';
    if (modelId.includes('sd_') || modelId.includes('stable')) return 'stable_diffusion';
    if (modelId.includes('dalle')) return 'dalle';
    if (modelId.includes('imagen') || modelId.includes('google_image_gen')) return 'imagen';
    if (modelId.includes('banana')) return 'banana_pro';
    return 'gemini'; // Default
}

// Check if text contains Vietnamese
export function containsVietnamese(text: string): boolean {
    return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
}

// Model-specific limits and preferences
const MODEL_CONFIG: Record<ModelType, {
    maxLength: number;
    language: 'en' | 'multilingual';
    styleFirst: boolean;
    supportsNegative: boolean;
    format: 'verbose' | 'concise' | 'keyword' | 'danbooru';
    suffix?: string;
    promptTemplate?: string; // Optimal prompt structure for this model
}> = {
    gemini: {
        maxLength: 8000,
        language: 'multilingual',
        styleFirst: false,
        supportsNegative: true,
        format: 'verbose'
    },
    imagen: {
        maxLength: 500,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[STYLE]. [SUBJECT] [ACTION]. [CAMERA].'
    },
    banana_pro: {
        maxLength: 1000,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[STYLE], [SUBJECT], [ACTION], [ENVIRONMENT], [CAMERA], [LIGHTING]'
    },
    seedream: {
        maxLength: 800,
        language: 'multilingual',
        styleFirst: true,
        supportsNegative: false,
        format: 'danbooru',
        promptTemplate: 'masterpiece, best quality, [SUBJECT], [ACTION], [STYLE], [CAMERA]'
    },
    midjourney: {
        maxLength: 350,
        language: 'en',
        styleFirst: false,
        supportsNegative: false,
        format: 'keyword',
        suffix: ' --v 7 --style raw',
        promptTemplate: '[SUBJECT] [ACTION], [STYLE], [CAMERA] --ar [AR] --v 7 --style raw'
    },
    kling: {
        maxLength: 600,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: 'professional photograph, [STYLE], [SUBJECT], [ACTION], [CAMERA]'
    },
    dreamina: {
        maxLength: 500,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[STYLE], [SUBJECT], [ACTION]'
    },
    z_image: {
        maxLength: 500,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise'
    },
    hailuo: {
        maxLength: 500,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise'
    },
    // New models
    flux: {
        maxLength: 1000,
        language: 'en',
        styleFirst: false,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[SUBJECT], [ACTION], [STYLE], [LIGHTING], [CAMERA]'
    },
    ideogram: {
        maxLength: 800,
        language: 'en',
        styleFirst: false,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[SUBJECT], [ACTION], [TEXT if any], [STYLE]'
    },
    recraft: {
        maxLength: 600,
        language: 'en',
        styleFirst: true,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[STYLE], [SUBJECT], vector art, clean lines'
    },
    stable_diffusion: {
        maxLength: 400,
        language: 'en',
        styleFirst: true,
        supportsNegative: true,
        format: 'danbooru',
        promptTemplate: 'masterpiece, best quality, [SUBJECT], [ACTION], [STYLE]'
    },
    dalle: {
        maxLength: 1000,
        language: 'en',
        styleFirst: false,
        supportsNegative: false,
        format: 'concise',
        promptTemplate: '[SUBJECT] [ACTION]. [STYLE]. [CAMERA].'
    }
};

export interface NormalizedPrompt {
    original: string;
    normalized: string;
    modelType: ModelType;
    changes: string[];
    truncated: boolean;
    translated: boolean;
}

/**
 * Translate and optimize prompt using Gemini
 * CRITICAL: Preserves the user's core subject/intent
 */
async function translateAndOptimize(
    prompt: string,
    modelType: ModelType,
    apiKey: string,
    aspectRatio: string
): Promise<{ optimized: string; wasTranslated: boolean }> {
    const config = MODEL_CONFIG[modelType];

    // Extract the core user description from the full prompt
    // Character Generator wraps user input in "CHARACTER DESCRIPTION:" section
    let userDescription = prompt;
    const descMatch = prompt.match(/CHARACTER DESCRIPTION:\s*([\s\S]*?)(?:\n\nMANDATORY|\n\n!!!|$)/i);
    if (descMatch && descMatch[1]) {
        userDescription = descMatch[1].trim();
        console.log('[PromptNormalizer] Extracted user description:', userDescription);
    }

    // Also check for style preset
    let stylePreset = '';
    const styleMatch = prompt.match(/STYLE PRESET:\s*([^\n]+)/i);
    if (styleMatch && styleMatch[1]) {
        stylePreset = styleMatch[1].trim();
    }

    const systemPrompt = `You are an expert AI image generation prompt engineer.

CRITICAL TASK:
The user wants to generate an image. Their CORE DESCRIPTION is:
"${userDescription}"
${stylePreset ? `Style preset: ${stylePreset}` : ''}

YOUR JOB:
1. If the description is in Vietnamese, translate it to English ACCURATELY
2. Format for ${modelType.toUpperCase()} model (max ${config.maxLength} chars)
3. PRESERVE THE EXACT SUBJECT - if user says "dog", output must be about a dog, NOT a human
4. Keep style and visual details from user's description
5. Add quality keywords appropriate for the model

OUTPUT RULES:
- Output ONLY the optimized prompt, no explanation
- Keep it concise: ${config.maxLength} chars max
${config.promptTemplate ? `- Follow template: ${config.promptTemplate}` : ''}
${modelType === 'midjourney' ? `- End with: --ar ${aspectRatio} --v 7 --style raw` : ''}
${modelType === 'seedream' ? '- Use comma-separated tags: masterpiece, best quality, [subject], [details]' : ''}
${modelType === 'imagen' ? '- Use natural English, style first, then subject details' : ''}

EXAMPLE:
Input (Vietnamese): "Một chú chó đốm dễ thương, đeo vòng cổ đỏ"
Output: "cute spotted dalmatian dog wearing red collar, adorable pet portrait, studio lighting"`;

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{
                role: 'user',
                parts: [{ text: systemPrompt }]
            }]
        });

        const optimized = response.text?.trim() || userDescription;
        const wasTranslated = containsVietnamese(userDescription);

        console.log('[PromptNormalizer] AI Optimized:', {
            modelType,
            userDesc: userDescription.substring(0, 100),
            inputLen: prompt.length,
            outputLen: optimized.length,
            output: optimized.substring(0, 200),
            translated: wasTranslated
        });

        return { optimized, wasTranslated };
    } catch (err) {
        console.error('[PromptNormalizer] Translation failed:', err);
        // Fallback: just translate the user description if possible
        return { optimized: userDescription, wasTranslated: false };
    }
}

/**
 * Extract key components from a verbose prompt
 */
function extractComponents(prompt: string): {
    style: string;
    subject: string;
    action: string;
    camera: string;
    negative: string;
    extras: string;
} {
    let style = '';
    let subject = '';
    let action = '';
    let camera = '';
    let negative = '';
    let extras = '';

    // Extract style
    const styleMatch = prompt.match(/(?:AUTHORITATIVE STYLE|STYLE[:\s]+)([^.!]+)/i);
    if (styleMatch) style = styleMatch[1].trim();

    // Extract negative
    const negMatch = prompt.match(/(?:NEGATIVE[:\s]+|AVOID[:\s]+|!!! STRICT NEGATIVE:)([^!!!]+)/i);
    if (negMatch) negative = negMatch[1].trim();

    // Extract camera
    const camMatch = prompt.match(/(?:CAMERA|SHOT SCALE|TECHNICAL)[:\s]+([^.]+)/i);
    if (camMatch) camera = camMatch[1].trim();

    // Extract core action
    const actionMatch = prompt.match(/CORE ACTION[:\s]+([^.]+)/i);
    if (actionMatch) action = actionMatch[1].trim();

    // Extract subject/characters
    const charMatch = prompt.match(/(?:Appearing Characters|CHARACTERS)[:\s]+([^\]]+\])/i);
    if (charMatch) subject = charMatch[1].trim();

    // Everything else
    const sceneMatch = prompt.match(/(?:FULL SCENE VISUALS|SCENE)[:\s]+([^.]+)/i);
    if (sceneMatch) extras = sceneMatch[1].trim();

    return { style, subject, action, camera, negative, extras };
}

/**
 * Normalize prompt for specific model (sync version - basic formatting only)
 */
export function normalizePrompt(
    rawPrompt: string,
    modelId: string,
    aspectRatio: string = '16:9'
): NormalizedPrompt {
    const modelType = detectModelType(modelId);
    const config = MODEL_CONFIG[modelType];
    const changes: string[] = [];
    let normalized = rawPrompt;

    // 1. Extract components for restructuring
    const components = extractComponents(rawPrompt);

    // 2. Format based on model type
    switch (config.format) {
        case 'verbose':
            // Gemini: Keep mostly as-is, just clean up
            normalized = rawPrompt
                .replace(/\s+/g, ' ')
                .trim();
            break;

        case 'concise':
            // Imagen/Banana/Kling: Style first, short phrases
            const conciseParts = [
                components.style,
                components.subject,
                components.action,
                components.extras,
                components.camera
            ].filter(Boolean);

            normalized = conciseParts.join('. ').replace(/\s+/g, ' ').trim();
            changes.push('Restructured: Style → Subject → Action → Camera');
            break;

        case 'keyword':
            // Midjourney: Keywords with commas
            const keywords = [
                components.style,
                components.subject,
                components.action,
                components.extras,
                components.camera
            ].filter(Boolean).join(', ');

            // Add aspect ratio for MJ
            normalized = `${keywords} --ar ${aspectRatio}${config.suffix || ''}`;
            changes.push('Converted to MJ keyword format');
            changes.push(`Added --ar ${aspectRatio} --v 7 --style raw`);
            break;

        case 'danbooru':
            // Seedream: Tag-style, quality prefixes
            const tags = [];
            tags.push('masterpiece', 'best quality', '8k uhd');

            if (components.subject) {
                tags.push(...components.subject.split(/[,.]/).map(s => s.trim().toLowerCase()));
            }
            if (components.action) {
                tags.push(components.action.toLowerCase());
            }
            if (components.extras) {
                tags.push(...components.extras.split(/[,.]/).map(s => s.trim().toLowerCase()));
            }
            if (components.style) {
                tags.push(components.style.toLowerCase());
            }
            if (components.camera) {
                tags.push(components.camera.toLowerCase());
            }

            normalized = tags.filter(Boolean).slice(0, 30).join(', ');
            changes.push('Converted to Danbooru tag format');
            changes.push('Added quality prefixes');
            break;
    }

    // 3. Remove negative prompts if not supported
    if (!config.supportsNegative && components.negative) {
        normalized = normalized.replace(/(?:NEGATIVE|AVOID|!!! STRICT NEGATIVE)[^!]*!!!/gi, '');
        changes.push('Removed negative prompts (not supported)');
    }

    // 4. Truncate if needed
    let truncated = false;
    if (normalized.length > config.maxLength) {
        normalized = normalized.substring(0, config.maxLength - 3) + '...';
        truncated = true;
        changes.push(`Truncated to ${config.maxLength} chars`);
    }

    // 5. Language check
    if (config.language === 'en' && containsVietnamese(normalized)) {
        changes.push('⚠️ Vietnamese detected - use normalizePromptAsync for auto-translation');
    }

    return {
        original: rawPrompt,
        normalized,
        modelType,
        changes,
        truncated,
        translated: false
    };
}

/**
 * Normalize prompt with AI translation and optimization (async)
 */
export async function normalizePromptAsync(
    rawPrompt: string,
    modelId: string,
    apiKey: string,
    aspectRatio: string = '16:9'
): Promise<NormalizedPrompt> {
    const modelType = detectModelType(modelId);
    const config = MODEL_CONFIG[modelType];
    const changes: string[] = [];

    // Check if translation is needed
    const needsTranslation = config.language === 'en' && containsVietnamese(rawPrompt);

    let normalized = rawPrompt;
    let translated = false;

    // Use AI to translate and optimize for non-Gemini models
    if (modelType !== 'gemini' && apiKey) {
        const result = await translateAndOptimize(rawPrompt, modelType, apiKey, aspectRatio);
        normalized = result.optimized;
        translated = result.wasTranslated;

        if (translated) {
            changes.push('🌐 Auto-translated from Vietnamese to English');
        }
        changes.push(`🤖 AI-optimized for ${modelType.toUpperCase()}`);
    } else {
        // Gemini or no API key - use sync version
        const syncResult = normalizePrompt(rawPrompt, modelId, aspectRatio);
        return syncResult;
    }

    // Truncate if still too long
    let truncated = false;
    if (normalized.length > config.maxLength) {
        normalized = normalized.substring(0, config.maxLength - 3) + '...';
        truncated = true;
        changes.push(`Truncated to ${config.maxLength} chars`);
    }

    return {
        original: rawPrompt,
        normalized,
        modelType,
        changes,
        truncated,
        translated
    };
}

/**
 * Generate a human-readable summary of normalization changes
 */
export function formatNormalizationLog(result: NormalizedPrompt): string {
    const lines = [
        `🔧 [DOP] Prompt optimized for ${result.modelType.toUpperCase()}`,
        `📏 Length: ${result.original.length} → ${result.normalized.length} chars`
    ];

    if (result.translated) {
        lines.push(`🌐 Auto-translated: Vietnamese → English`);
    }

    if (result.changes.length > 0) {
        lines.push(`📝 Changes:`);
        result.changes.forEach(c => lines.push(`   • ${c}`));
    }

    if (result.truncated) {
        lines.push(`⚠️ Prompt was truncated to fit model limit`);
    }

    // Show preview of final prompt
    const preview = result.normalized.length > 150
        ? result.normalized.substring(0, 150) + '...'
        : result.normalized;
    lines.push(`\n📄 Final prompt:\n"${preview}"`);

    return lines.join('\n');
}

/**
 * Quick check if prompt needs normalization
 */
export function needsNormalization(modelId: string): boolean {
    const modelType = detectModelType(modelId);
    return modelType !== 'gemini'; // Gemini handles verbose well
}

/**
 * Check if async normalization should be used (has Vietnamese or non-Gemini model)
 */
export function shouldUseAsyncNormalization(modelId: string, prompt: string): boolean {
    const modelType = detectModelType(modelId);
    if (modelType === 'gemini') return false;
    // Non-Gemini models: always use async for better optimization
    // Plus translation if Vietnamese detected
    return true;
}

