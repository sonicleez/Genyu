/**
 * DOP Intelligence - Smart Decision Making
 * 
 * Uses learned data to make intelligent decisions:
 * - Auto-enhance prompts with successful patterns
 * - Predict quality before generation
 * - Select optimal settings (AR, model)
 * - Suggest similar successful prompts
 */

import { GoogleGenAI } from "@google/genai";
import {
    getModelLearnings,
    searchSimilarPrompts,
    getSuggestedKeywords,
    SimilarPrompt,
    ModelLearnings
} from './dopLearning';
import { detectModelType } from './promptNormalizer';

// Intelligence result types
export interface PromptEnhancement {
    originalPrompt: string;
    enhancedPrompt: string;
    addedKeywords: string[];
    suggestedAspectRatio: string;
    predictedQuality: number;
    confidence: number; // How confident DOP is (based on data amount)
    similarPrompts: SimilarPrompt[];
    reasoning: string;
}

export interface ModelRecommendation {
    recommendedModel: string;
    reason: string;
    alternativeModels: { model: string; score: number; reason: string }[];
    basedOnLearnings: boolean;
}

export interface IntelligentDecision {
    enhancement: PromptEnhancement;
    modelRecommendation?: ModelRecommendation;
    warnings: string[];
    suggestions: string[];
}

/**
 * Main Intelligence Function - Analyze and enhance prompt
 */
export async function analyzeAndEnhance(
    prompt: string,
    modelId: string,
    mode: 'character' | 'scene',
    aspectRatio: string,
    apiKey: string,
    userId?: string
): Promise<IntelligentDecision> {
    const modelType = detectModelType(modelId);
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 1. Get model learnings
    const learnings = await getModelLearnings(modelId);

    // 2. Get suggested keywords from learnings
    const suggestedKeywords = await getSuggestedKeywords(modelId, mode);

    // 3. Find similar successful prompts (RAG search)
    let similarPrompts: SimilarPrompt[] = [];
    if (userId && apiKey) {
        similarPrompts = await searchSimilarPrompts(prompt, modelId, mode, apiKey, 5);
    }

    // 4. Enhance prompt based on learnings
    const enhancement = await enhancePromptWithLearnings(
        prompt,
        modelType,
        mode,
        aspectRatio,
        learnings,
        suggestedKeywords,
        similarPrompts,
        apiKey
    );

    // 5. Generate warnings
    if (mode === 'character' && aspectRatio === '16:9') {
        warnings.push('⚠️ AR 16:9 thường không phù hợp cho full body character. Đề xuất: 9:16');
    }

    if (enhancement.predictedQuality < 0.6) {
        warnings.push('⚠️ Dự đoán chất lượng thấp. Xem xét thêm keywords: ' + suggestedKeywords.slice(0, 3).join(', '));
    }

    // 6. Generate suggestions
    if (similarPrompts.length > 0) {
        const bestSimilar = similarPrompts[0];
        if (bestSimilar.quality_score > 0.85) {
            suggestions.push(`💡 Prompt tương tự đã thành công (${Math.round(bestSimilar.quality_score * 100)}%): "${bestSimilar.normalized_prompt.substring(0, 100)}..."`);
        }
    }

    if (learnings && learnings.approval_rate < 0.5) {
        suggestions.push(`💡 Model ${modelType} có tỷ lệ thành công thấp (${Math.round(learnings.approval_rate * 100)}%). Xem xét đổi model.`);
    }

    return {
        enhancement,
        warnings,
        suggestions
    };
}

/**
 * NEW: Analyze scene continuity to ensure logical flow from previous shot
 */
export async function analyzeSceneContinuity(
    apiKey: string,
    currentScene: { description: string; action: string; shotType?: string },
    previousScene: { description: string; action: string; shotType?: string; imageUrl?: string } | null
): Promise<string> {
    if (!previousScene || !apiKey) return '';

    try {
        console.log('[DOP Intelligence] 🎬 Analyzing continuity...');

        const prompt = `
        Acting as a Director of Photography (DOP), analyze the transition between two shots to ensure spatial continuity and logical camera movement.

        [PREVIOUS SHOT]
        Description: ${previousScene.description}
        Action: ${previousScene.action}
        Shot Type: ${previousScene.shotType || 'Unknown'}
        
        [CURRENT SHOT]
        Description: ${currentScene.description}
        Action: ${currentScene.action}
        Shot Type: ${currentScene.shotType || 'Unknown'}

        TASK:
        Generate a concise "Visual Bridge" instruction (max 15 words) that explains how the camera and character moved from Shot A to Shot B.
        - Focus on: Camera angle change, spatial rotation, and character pose transition.
        - If the previous shot was a Wide Shot and the current is Close Up, specify "Cut to Close Up matching eye-line".
        - If character was standing and is now kneeling, specify "Follow character movement down".
        
        OUTPUT FORMAT: Just the instruction text. No quotes.
        `;

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }] }]
        });

        const transition = (response.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        console.log(`[DOP Intelligence] 🔄 Transition: "${transition}"`);
        return transition || '';

    } catch (error) {
        console.warn('[DOP Intelligence] Continuity analysis failed:', error);
        return '';
    }
}

/**
 * Enhance prompt using learned patterns
 */
async function enhancePromptWithLearnings(
    prompt: string,
    modelType: string,
    mode: 'character' | 'scene',
    aspectRatio: string,
    learnings: ModelLearnings | null,
    suggestedKeywords: string[],
    similarPrompts: SimilarPrompt[],
    apiKey: string
): Promise<PromptEnhancement> {
    const promptLower = prompt.toLowerCase();

    // Find missing important keywords
    const addedKeywords: string[] = [];

    // Mode-specific must-have keywords
    const mustHaveKeywords = mode === 'character'
        ? ['full body', 'white background', '8k']
        : ['cinematic', 'detailed'];

    for (const kw of mustHaveKeywords) {
        if (!promptLower.includes(kw.toLowerCase())) {
            addedKeywords.push(kw);
        }
    }

    // Add top learned keywords that are missing
    for (const kw of suggestedKeywords.slice(0, 5)) {
        if (!promptLower.includes(kw.toLowerCase()) && !addedKeywords.includes(kw)) {
            addedKeywords.push(kw);
        }
    }

    // Cap at 5 added keywords
    const keywordsToAdd = addedKeywords.slice(0, 5);

    // Build enhanced prompt
    let enhancedPrompt = prompt;
    if (keywordsToAdd.length > 0) {
        enhancedPrompt = `${prompt}, ${keywordsToAdd.join(', ')}`;
    }

    // Suggest best AR from learnings
    let suggestedAspectRatio = aspectRatio;
    if (learnings && learnings.best_aspect_ratios) {
        const bestARs = Object.entries(learnings.best_aspect_ratios)
            .sort((a, b) => (b[1] as number) - (a[1] as number));
        if (bestARs.length > 0) {
            suggestedAspectRatio = bestARs[0][0];
        }
    } else {
        // Default based on mode
        suggestedAspectRatio = mode === 'character' ? '9:16' : '16:9';
    }

    // Predict quality based on learnings and similar prompts
    let predictedQuality = 0.7; // Base prediction
    let confidence = 0.3; // Low confidence if no data

    if (learnings && learnings.total_generations > 10) {
        predictedQuality = learnings.avg_quality_score || 0.7;
        confidence = Math.min(0.9, learnings.total_generations / 100);
    }

    if (similarPrompts.length > 0) {
        // Weight by similarity
        const weightedQuality = similarPrompts.reduce((sum, p) =>
            sum + (p.quality_score * p.similarity), 0
        ) / similarPrompts.reduce((sum, p) => sum + p.similarity, 0);

        predictedQuality = (predictedQuality + weightedQuality) / 2;
        confidence = Math.min(0.95, confidence + 0.2);
    }

    // Boost prediction if using learned keywords
    if (keywordsToAdd.length > 0) {
        predictedQuality = Math.min(0.95, predictedQuality + 0.05);
    }

    // Generate reasoning
    let reasoning = '';
    if (learnings && learnings.total_generations > 5) {
        reasoning = `Dựa trên ${learnings.total_generations} generations với model ${modelType} `;
        reasoning += `(tỷ lệ thành công: ${Math.round(learnings.approval_rate * 100)}%). `;
    }
    if (similarPrompts.length > 0) {
        reasoning += `Tìm thấy ${similarPrompts.length} prompts tương tự (similarity: ${Math.round(similarPrompts[0].similarity * 100)}%). `;
    }
    if (keywordsToAdd.length > 0) {
        reasoning += `Thêm ${keywordsToAdd.length} keywords từ patterns thành công.`;
    }

    return {
        originalPrompt: prompt,
        enhancedPrompt,
        addedKeywords: keywordsToAdd,
        suggestedAspectRatio,
        predictedQuality,
        confidence,
        similarPrompts,
        reasoning: reasoning || 'Chưa đủ dữ liệu để đưa ra dự đoán chính xác.'
    };
}

/**
 * Get model recommendation based on learnings
 */
export async function getModelRecommendation(
    mode: 'character' | 'scene',
    availableModels: string[]
): Promise<ModelRecommendation | null> {
    const modelScores: { model: string; score: number; reason: string }[] = [];

    for (const modelId of availableModels) {
        const learnings = await getModelLearnings(modelId);

        if (learnings && learnings.total_generations >= 5) {
            const score = (learnings.approval_rate * 0.7) + (learnings.avg_quality_score * 0.3);
            const reason = `${learnings.total_generations} gens, ${Math.round(learnings.approval_rate * 100)}% success`;
            modelScores.push({ model: modelId, score, reason });
        }
    }

    if (modelScores.length === 0) {
        return null; // Not enough data
    }

    // Sort by score
    modelScores.sort((a, b) => b.score - a.score);

    const best = modelScores[0];
    return {
        recommendedModel: best.model,
        reason: `Highest success rate: ${best.reason}`,
        alternativeModels: modelScores.slice(1, 4),
        basedOnLearnings: true
    };
}

/**
 * Quick check if prompt is likely to succeed
 */
export async function predictSuccess(
    prompt: string,
    modelId: string,
    mode: 'character' | 'scene',
    apiKey: string
): Promise<{ likelihood: number; suggestions: string[] }> {
    const learnings = await getModelLearnings(modelId);
    const suggestedKeywords = await getSuggestedKeywords(modelId, mode);

    let likelihood = 0.6; // Base
    const suggestions: string[] = [];
    const promptLower = prompt.toLowerCase();

    // Check for important keywords
    const importantKeywords = mode === 'character'
        ? ['full body', 'white background', 'standing']
        : ['cinematic', 'detailed', 'professional'];

    let keywordMatches = 0;
    for (const kw of importantKeywords) {
        if (promptLower.includes(kw)) {
            keywordMatches++;
        } else {
            suggestions.push(`Add "${kw}"`);
        }
    }

    likelihood += keywordMatches * 0.1;

    // Boost from learnings
    if (learnings && learnings.avg_quality_score > 0) {
        likelihood = (likelihood + learnings.avg_quality_score) / 2;
    }

    // Check for learned successful keywords
    for (const kw of suggestedKeywords.slice(0, 3)) {
        if (promptLower.includes(kw.toLowerCase())) {
            likelihood += 0.05;
        }
    }

    likelihood = Math.min(0.95, Math.max(0.3, likelihood));

    return { likelihood, suggestions: suggestions.slice(0, 3) };
}

/**
 * Get key insights for display
 */
export async function getInsights(modelId: string, mode: 'character' | 'scene'): Promise<{
    topKeywords: string[];
    bestAspectRatio: string;
    avgQuality: number;
    successRate: number;
    totalData: number;
}> {
    const learnings = await getModelLearnings(modelId);
    const keywords = await getSuggestedKeywords(modelId, mode);

    if (!learnings) {
        return {
            topKeywords: mode === 'character'
                ? ['full body', 'white background', '8k']
                : ['cinematic', 'detailed'],
            bestAspectRatio: mode === 'character' ? '9:16' : '16:9',
            avgQuality: 0.7,
            successRate: 0,
            totalData: 0
        };
    }

    // Find best AR
    let bestAR = mode === 'character' ? '9:16' : '16:9';
    if (learnings.best_aspect_ratios) {
        const sorted = Object.entries(learnings.best_aspect_ratios)
            .sort((a, b) => (b[1] as number) - (a[1] as number));
        if (sorted.length > 0) {
            bestAR = sorted[0][0];
        }
    }

    return {
        topKeywords: keywords.slice(0, 5),
        bestAspectRatio: bestAR,
        avgQuality: learnings.avg_quality_score || 0.7,
        successRate: learnings.approval_rate || 0,
        totalData: learnings.total_generations || 0
    };
}

console.log('[DOP Intelligence] Module loaded');
