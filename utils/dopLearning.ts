/**
 * DOP Learning System - Supabase RAG Version
 * 
 * Tracks successful prompts and learns patterns for each model.
 * Uses Supabase + pgvector for semantic search.
 */

import { GoogleGenAI } from "@google/genai";
import { supabase } from './storageUtils';
import { detectModelType, ModelType } from './promptNormalizer';

// Types
export interface PromptRecord {
    id: string;
    user_id: string;
    original_prompt: string;
    normalized_prompt: string;
    embedding?: number[];
    model_id: string;
    model_type: ModelType;
    mode: 'character' | 'scene';
    aspect_ratio: string;
    quality_score?: number;
    full_body_score?: number;
    background_score?: number;
    face_clarity_score?: number;
    match_score?: number;
    was_approved: boolean;
    was_retried: boolean;
    retry_count: number;
    created_at: string;
    keywords?: string[];
    tags?: string[];
}

export interface ModelLearnings {
    model_type: ModelType;
    total_generations: number;
    approved_count: number;
    avg_quality_score: number;
    approval_rate: number;
    best_aspect_ratios: { [ar: string]: number };
    common_keywords: { [keyword: string]: number };
    successful_patterns: string[];
}

export interface SimilarPrompt {
    id: string;
    original_prompt: string;
    normalized_prompt: string;
    model_type: string;
    mode: string;
    quality_score: number;
    similarity: number;
}

// Important keywords to extract
const IMPORTANT_KEYWORDS = [
    'full body', 'white background', 'studio', 'cinematic', 'realistic',
    '8k', '4k', 'detailed', 'sharp', 'professional', 'lighting',
    'portrait', 'landscape', 'ultra', 'high quality', 'masterpiece',
    'anime', 'cartoon', 'pixar', 'illustration', 'photorealistic',
    'soft lighting', 'golden hour', 'dramatic', 'vibrant', 'moody',
    'a-pose', 't-pose', 'standing', 'full length', 'head to toe'
];

/**
 * Generate embedding using Gemini
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
    try {
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const response = await ai.models.embedContent({
            model: 'text-embedding-004',
            contents: [{ parts: [{ text }] }]
        });

        return response.embedding?.values || null;
    } catch (err) {
        console.error('[DOP Learning] Embedding generation failed:', err);
        return null;
    }
}

/**
 * Extract keywords from a prompt
 */
function extractKeywords(prompt: string): string[] {
    const promptLower = prompt.toLowerCase();
    return IMPORTANT_KEYWORDS.filter(kw => promptLower.includes(kw));
}

/**
 * Record a prompt generation to Supabase
 */
export async function recordPrompt(
    userId: string,
    originalPrompt: string,
    normalizedPrompt: string,
    modelId: string,
    mode: 'character' | 'scene',
    aspectRatio: string,
    apiKey: string
): Promise<string | null> {
    try {
        const modelType = detectModelType(modelId);
        const keywords = extractKeywords(normalizedPrompt);

        // Generate embedding for semantic search
        const embedding = await generateEmbedding(normalizedPrompt, apiKey);

        const record = {
            user_id: userId,
            original_prompt: originalPrompt,
            normalized_prompt: normalizedPrompt,
            embedding: embedding,
            model_id: modelId,
            model_type: modelType,
            mode: mode,
            aspect_ratio: aspectRatio,
            keywords: keywords,
            was_approved: false,
            was_retried: false,
            retry_count: 0
        };

        const { data, error } = await supabase
            .from('dop_prompt_records')
            .insert(record)
            .select('id')
            .single();

        if (error) {
            console.error('[DOP Learning] Failed to record prompt:', error);
            return null;
        }

        console.log('[DOP Learning] Recorded prompt:', data.id);

        // Update model learnings
        await updateModelLearnings(modelType);

        return data.id;
    } catch (err) {
        console.error('[DOP Learning] Record error:', err);
        return null;
    }
}

/**
 * Approve a prompt (user saved/used the result)
 */
export async function approvePrompt(
    recordId: string,
    qualityScores?: {
        overall: number;
        fullBody?: number;
        background?: number;
        faceClarity?: number;
        match?: number;
    }
): Promise<boolean> {
    try {
        const updates: any = {
            was_approved: true
        };

        if (qualityScores) {
            updates.quality_score = qualityScores.overall;
            updates.full_body_score = qualityScores.fullBody;
            updates.background_score = qualityScores.background;
            updates.face_clarity_score = qualityScores.faceClarity;
            updates.match_score = qualityScores.match;
        }

        const { error } = await supabase
            .from('dop_prompt_records')
            .update(updates)
            .eq('id', recordId);

        if (error) {
            console.error('[DOP Learning] Failed to approve:', error);
            return false;
        }

        // Get record to update model learnings
        const { data: record } = await supabase
            .from('dop_prompt_records')
            .select('model_type')
            .eq('id', recordId)
            .single();

        if (record) {
            await updateModelLearnings(record.model_type);
        }

        console.log('[DOP Learning] Approved:', recordId);
        return true;
    } catch (err) {
        console.error('[DOP Learning] Approve error:', err);
        return false;
    }
}

/**
 * Mark prompt as retried
 */
export async function markRetried(recordId: string): Promise<void> {
    await supabase
        .from('dop_prompt_records')
        .update({
            was_retried: true,
            retry_count: supabase.sql`retry_count + 1`
        })
        .eq('id', recordId);
}

/**
 * Update aggregated model learnings
 */
async function updateModelLearnings(modelType: string): Promise<void> {
    try {
        // Get all records for this model type
        const { data: records } = await supabase
            .from('dop_prompt_records')
            .select('*')
            .eq('model_type', modelType);

        if (!records || records.length === 0) return;

        const totalGenerations = records.length;
        const approvedRecords = records.filter(r => r.was_approved);
        const approvedCount = approvedRecords.length;
        const approvalRate = totalGenerations > 0 ? approvedCount / totalGenerations : 0;

        // Calculate avg quality score
        const scoredRecords = records.filter(r => r.quality_score !== null);
        const avgQualityScore = scoredRecords.length > 0
            ? scoredRecords.reduce((sum, r) => sum + (r.quality_score || 0), 0) / scoredRecords.length
            : 0;

        // Count aspect ratios from approved prompts
        const bestAspectRatios: { [ar: string]: number } = {};
        approvedRecords.forEach(r => {
            bestAspectRatios[r.aspect_ratio] = (bestAspectRatios[r.aspect_ratio] || 0) + 1;
        });

        // Count keywords from approved prompts
        const commonKeywords: { [kw: string]: number } = {};
        approvedRecords.forEach(r => {
            (r.keywords || []).forEach((kw: string) => {
                commonKeywords[kw] = (commonKeywords[kw] || 0) + 1;
            });
        });

        // Top 50 patterns
        const successfulPatterns = Object.entries(commonKeywords)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([kw]) => kw);

        // Upsert learnings
        await supabase
            .from('dop_model_learnings')
            .upsert({
                model_type: modelType,
                total_generations: totalGenerations,
                approved_count: approvedCount,
                avg_quality_score: avgQualityScore,
                approval_rate: approvalRate,
                best_aspect_ratios: bestAspectRatios,
                common_keywords: commonKeywords,
                successful_patterns: successfulPatterns,
                updated_at: new Date().toISOString()
            }, { onConflict: 'model_type' });

        console.log('[DOP Learning] Updated learnings for:', modelType);
    } catch (err) {
        console.error('[DOP Learning] Update learnings error:', err);
    }
}

/**
 * Search for similar successful prompts using vector similarity
 */
export async function searchSimilarPrompts(
    prompt: string,
    modelId: string,
    mode: 'character' | 'scene',
    apiKey: string,
    limit: number = 5
): Promise<SimilarPrompt[]> {
    try {
        const modelType = detectModelType(modelId);

        // Generate embedding for query
        const embedding = await generateEmbedding(prompt, apiKey);
        if (!embedding) return [];

        // Call Supabase RPC function for vector search
        const { data, error } = await supabase.rpc('search_similar_prompts', {
            query_embedding: embedding,
            match_model_type: modelType,
            match_mode: mode,
            match_count: limit,
            similarity_threshold: 0.6
        });

        if (error) {
            console.error('[DOP Learning] Search error:', error);
            return [];
        }

        console.log('[DOP Learning] Found', data?.length || 0, 'similar prompts');
        return data || [];
    } catch (err) {
        console.error('[DOP Learning] Search error:', err);
        return [];
    }
}

/**
 * Get learnings for a specific model type
 */
export async function getModelLearnings(modelId: string): Promise<ModelLearnings | null> {
    try {
        const modelType = detectModelType(modelId);

        const { data, error } = await supabase
            .from('dop_model_learnings')
            .select('*')
            .eq('model_type', modelType)
            .single();

        if (error) return null;
        return data;
    } catch (err) {
        return null;
    }
}

/**
 * Get suggested keywords based on model learnings
 */
export async function getSuggestedKeywords(
    modelId: string,
    mode: 'character' | 'scene'
): Promise<string[]> {
    const learnings = await getModelLearnings(modelId);

    if (!learnings || !learnings.successful_patterns || learnings.successful_patterns.length === 0) {
        // Return defaults
        if (mode === 'character') {
            return ['full body', 'white background', '8k', 'detailed', 'professional lighting'];
        }
        return ['cinematic', 'detailed', 'professional'];
    }

    return learnings.successful_patterns.slice(0, 10);
}

/**
 * Get best aspect ratio for model based on learnings
 */
export async function getSuggestedAspectRatio(
    modelId: string,
    mode: 'character' | 'scene'
): Promise<string> {
    const learnings = await getModelLearnings(modelId);

    const defaults: { [mode: string]: string } = {
        'character': '9:16',
        'scene': '16:9'
    };

    if (!learnings || !learnings.best_aspect_ratios || Object.keys(learnings.best_aspect_ratios).length === 0) {
        return defaults[mode] || '16:9';
    }

    // Find most successful AR
    const sortedARs = Object.entries(learnings.best_aspect_ratios)
        .sort((a, b) => (b[1] as number) - (a[1] as number));

    return sortedARs[0]?.[0] || defaults[mode] || '16:9';
}

/**
 * Get learning stats for UI display
 */
export async function getLearningStats(): Promise<{
    totalRecords: number;
    totalApproved: number;
    modelStats: { [key: string]: { total: number; approved: number; avgScore: number } };
}> {
    try {
        const { data: learnings } = await supabase
            .from('dop_model_learnings')
            .select('*');

        const modelStats: { [key: string]: { total: number; approved: number; avgScore: number } } = {};
        let totalRecords = 0;
        let totalApproved = 0;

        (learnings || []).forEach((l: any) => {
            modelStats[l.model_type] = {
                total: l.total_generations,
                approved: l.approved_count,
                avgScore: l.avg_quality_score
            };
            totalRecords += l.total_generations;
            totalApproved += l.approved_count;
        });

        return { totalRecords, totalApproved, modelStats };
    } catch (err) {
        return { totalRecords: 0, totalApproved: 0, modelStats: {} };
    }
}

/**
 * Get best performing prompts for a model (for reference/inspiration)
 */
export async function getBestPrompts(
    modelId: string,
    mode: 'character' | 'scene',
    limit: number = 10
): Promise<PromptRecord[]> {
    try {
        const modelType = detectModelType(modelId);

        const { data } = await supabase
            .from('dop_prompt_records')
            .select('*')
            .eq('model_type', modelType)
            .eq('mode', mode)
            .eq('was_approved', true)
            .gte('quality_score', 0.8)
            .order('quality_score', { ascending: false })
            .limit(limit);

        return data || [];
    } catch (err) {
        return [];
    }
}

console.log('[DOP Learning] Supabase RAG module loaded');
