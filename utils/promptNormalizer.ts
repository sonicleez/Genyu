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
// Note: Gemini-based models (gemini, banana_pro, imagen via google) support Vietnamese natively
export function detectModelType(modelId: string): ModelType {
    // Convert to lowercase for case-insensitive matching
    const id = modelId.toLowerCase();

    // Gemini direct
    if (id.includes('gemini')) return 'gemini';

    // Google Nano Banana Pro (Gemini-based) - supports Vietnamese!
    if (id.includes('banana') || id.includes('google_nano')) return 'gemini';

    // Google Imagen via Gommo - also Gemini-based, supports Vietnamese
    if (id.includes('google_image_gen')) return 'gemini';

    // Non-Google models - need translation
    if (id.includes('midjourney')) return 'midjourney';
    if (id.includes('seedream')) return 'seedream';
    if (id.includes('kling') || id.includes('colors') || id === 'o1') return 'kling';
    if (id.includes('dreamina')) return 'dreamina';
    if (id.includes('z_image')) return 'z_image';
    if (id.includes('hailuo')) return 'hailuo';
    if (id.includes('flux')) return 'flux';
    if (id.includes('ideogram')) return 'ideogram';
    if (id.includes('recraft')) return 'recraft';
    if (id.includes('sd_') || id.includes('stable')) return 'stable_diffusion';
    if (id.includes('dalle')) return 'dalle';
    if (id.includes('imagen')) return 'imagen'; // Non-Google Imagen

    return 'gemini'; // Default to Gemini (no translation needed)
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
    negativePrompt?: string; // Auto-generated negative prompt
    modelType: ModelType;
    changes: string[];
    truncated: boolean;
    translated: boolean;
    suggestedAspectRatio?: string; // AI-suggested AR
}

// Negative prompts for character mode
const CHARACTER_NEGATIVE_PROMPT = `
cropped image, partial body, cut off body,
headshot only, face close-up, bust shot,
missing legs, missing feet, no feet visible,
colored background, gradient background, busy background,
multiple characters, duplicates, character sheet, multiple views,
blurry face, distorted features, deformed,
text, watermark, signature, logo
`.trim().replace(/\n/g, ' ');

// Negative prompts for scene mode  
const SCENE_NEGATIVE_PROMPT = `
blurry, low quality, distorted,
text, watermark, signature, logo,
deformed, ugly, bad anatomy
`.trim().replace(/\n/g, ' ');

/**
 * Get negative prompt for mode
 */
export function getNegativePrompt(mode: 'character' | 'scene'): string {
    return mode === 'character' ? CHARACTER_NEGATIVE_PROMPT : SCENE_NEGATIVE_PROMPT;
}

/**
 * Suggest aspect ratio based on prompt content and mode
 */
export function suggestAspectRatio(prompt: string, mode: 'character' | 'scene'): string {
    const promptLower = prompt.toLowerCase();

    // Character mode defaults
    if (mode === 'character') {
        // Full body needs vertical
        if (promptLower.includes('full body') || promptLower.includes('standing')) {
            return '9:16';
        }
        // Portrait/headshot can be square
        if (promptLower.includes('portrait') || promptLower.includes('headshot')) {
            return '1:1';
        }
        return '9:16'; // Default for characters
    }

    // Scene mode analysis
    if (promptLower.includes('landscape') || promptLower.includes('wide shot') ||
        promptLower.includes('panorama') || promptLower.includes('environment')) {
        return '16:9';
    }

    if (promptLower.includes('portrait') || promptLower.includes('vertical') ||
        promptLower.includes('tall') || promptLower.includes('phone')) {
        return '9:16';
    }

    if (promptLower.includes('square') || promptLower.includes('instagram') ||
        promptLower.includes('profile')) {
        return '1:1';
    }

    if (promptLower.includes('group') || promptLower.includes('multiple people') ||
        promptLower.includes('crowd')) {
        return '3:2'; // Wider for groups
    }

    // Default for scenes
    return '16:9';
}
/**
 * Translate and optimize prompt using Gemini
 * CRITICAL: Preserves the user's core subject/intent
 * @param mode - 'character' for character sheets (sharp, white bg, posing) or 'scene' for normal scenes
 */
async function translateAndOptimize(
    prompt: string,
    modelType: ModelType,
    apiKey: string,
    aspectRatio: string,
    mode: 'character' | 'scene' = 'scene'
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

    // Character-specific requirements
    const characterRequirements = mode === 'character' ? `
MANDATORY FOR CHARACTER REFERENCE:
- BACKGROUND: Pure solid white studio background (#FFFFFF)
- CLARITY: Ultra-sharp, 8K quality, hyper-detailed
- POSE: Standard A-pose or neutral standing pose, full body visible
- LIGHTING: Professional studio softbox lighting
- FRAMING: Full body from head to toe, clear silhouette
- SINGLE SUBJECT ONLY: No duplicates, no multiple views` : '';

    const systemPrompt = `You are an expert AI image generation prompt engineer.

CRITICAL TASK:
The user wants to generate ${mode === 'character' ? 'a CHARACTER REFERENCE image' : 'an image'}. Their CORE DESCRIPTION is:
"${userDescription}"
${stylePreset ? `Style preset: ${stylePreset}` : ''}
${characterRequirements}

YOUR JOB:
1. If the description is in Vietnamese, translate it to English ACCURATELY
2. Format for ${modelType.toUpperCase()} model (max ${config.maxLength} chars)
3. PRESERVE THE EXACT SUBJECT - if user says "dog", output must be about a dog, NOT a human
4. Keep style and visual details from user's description
5. Add quality keywords appropriate for the model
${mode === 'character' ? '6. Include: pure white background, full body, sharp details, studio lighting' : ''}

OUTPUT RULES:
- Output ONLY the optimized prompt, no explanation
- Keep it concise: ${config.maxLength} chars max
${config.promptTemplate ? `- Follow template: ${config.promptTemplate}` : ''}
${modelType === 'midjourney' ? `- End with: --ar ${aspectRatio} --v 7 --style raw` : ''}
${modelType === 'seedream' ? '- Use comma-separated tags: masterpiece, best quality, [subject], [details]' : ''}
${modelType === 'imagen' ? '- Use natural English, style first, then subject details' : ''}

EXAMPLE${mode === 'character' ? ' (Character)' : ''}:
Input (Vietnamese): "Một chú chó đốm dễ thương, đeo vòng cổ đỏ"
Output: "${mode === 'character'
            ? 'cute spotted dalmatian dog wearing red collar, full body, pure white studio background, sharp details, professional lighting, 8K quality'
            : 'cute spotted dalmatian dog wearing red collar, adorable pet portrait, studio lighting'}"`;

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: [{
                role: 'user',
                parts: [{ text: systemPrompt }]
            }]
        });

        let optimized = response.text?.trim() || userDescription;
        const wasTranslated = containsVietnamese(userDescription);

        // For character mode: Force append critical keywords if not present
        if (mode === 'character') {
            const mustHaveKeywords = [
                { check: /full\s*body/i, add: 'full body from head to toe' },
                { check: /white\s*(studio\s*)?background/i, add: 'pure white studio background' },
                { check: /8k|ultra.?sharp|hyper.?detail/i, add: '8K ultra-sharp' }
            ];

            const missing = mustHaveKeywords.filter(k => !k.check.test(optimized)).map(k => k.add);
            if (missing.length > 0) {
                optimized = `${optimized}, ${missing.join(', ')}`;
                console.log('[PromptNormalizer] Injected missing character keywords:', missing);
            }
        }

        console.log('[PromptNormalizer] AI Optimized:', {
            mode,
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
 * @param mode - 'character' for character sheets or 'scene' for normal scenes
 */
export async function normalizePromptAsync(
    rawPrompt: string,
    modelId: string,
    apiKey: string,
    aspectRatio: string = '16:9',
    mode: 'character' | 'scene' = 'scene'
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
        const result = await translateAndOptimize(rawPrompt, modelType, apiKey, aspectRatio, mode);
        normalized = result.optimized;
        translated = result.wasTranslated;

        if (translated) {
            changes.push('🌐 Auto-translated from Vietnamese to English');
        }
        changes.push(`🤖 AI-optimized for ${modelType.toUpperCase()}${mode === 'character' ? ' (Character Mode)' : ''}`);
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

    // Generate negative prompt for supported models
    const negativePrompt = config.supportsNegative ? getNegativePrompt(mode) : undefined;
    if (negativePrompt) {
        changes.push('🚫 Negative prompt added');
    }

    // Suggest aspect ratio
    const suggestedAspectRatio = suggestAspectRatio(rawPrompt, mode);
    if (suggestedAspectRatio !== aspectRatio) {
        changes.push(`📐 Suggested AR: ${suggestedAspectRatio}`);
    }

    return {
        original: rawPrompt,
        normalized,
        negativePrompt,
        modelType,
        changes,
        truncated,
        translated,
        suggestedAspectRatio
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

