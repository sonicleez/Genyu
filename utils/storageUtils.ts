import { supabase } from './supabaseClient';

/**
 * Uploads a base64 image string to Supabase Storage.
 * @param base64Data The base64 image data (including the data:image/...;base64, prefix)
 * @param bucket The name of the storage bucket
 * @param path The path/filename within the bucket
 * @returns The public URL of the uploaded image
 */
export async function uploadImageToSupabase(
    base64Data: string,
    bucket: string = 'project-assets',
    path: string = `assets/${Date.now()}.jpg`
): Promise<string> {
    try {
        // Remove prefix (e.g., "data:image/jpeg;base64,")
        const base64Body = base64Data.split(',')[1];

        // Convert base64 to Uint8Array/Blob
        const binaryData = Uint8Array.from(atob(base64Body), c => c.charCodeAt(0));

        // Determine content type from base64 prefix
        const contentType = base64Data.match(/:(.*?);/)?.[1] || 'image/jpeg';

        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(path, binaryData, {
                contentType,
                upsert: true
            });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);

        return publicUrl;
    } catch (error: any) {
        const errMsg = error?.message || 'Lỗi không xác định';
        console.error(`[Storage] Upload failed for path "${path}":`, error);
        throw new Error(`Lỗi tải ảnh lên Storage (${path}): ${errMsg}`);
    }
}

/**
 * Scans a ProjectState for base64 images and uploads them to Supabase Storage.
 * Returns a new ProjectState with URLs replacing base64 data.
 */
export async function processProjectAssets(state: any, userId: string): Promise<any> {
    console.log('[Storage] Starting asset processing for cloud save...');
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone
    const timestamp = Date.now();
    let uploadCount = 0;

    // 2. Process Characters
    if (newState.characters) {
        for (const char of newState.characters) {
            const fields = ['masterImage', 'faceImage', 'bodyImage', 'sideImage', 'backImage', 'generatedImage'];
            for (const field of fields) {
                if (char[field]?.startsWith('data:')) {
                    console.log(`[Storage] Uploading character ${field}: ${char.id}`);
                    char[field] = await uploadImageToSupabase(
                        char[field],
                        'project-assets',
                        `${userId}/characters/${char.id}_${field}_${timestamp}.jpg`
                    );
                    uploadCount++;
                }
            }
            if (char.props) {
                for (const prop of char.props) {
                    if (prop.image?.startsWith('data:')) {
                        console.log(`[Storage] Uploading character prop: ${prop.id}`);
                        prop.image = await uploadImageToSupabase(
                            prop.image,
                            'project-assets',
                            `${userId}/characters/${char.id}_prop_${prop.id}_${timestamp}.jpg`
                        );
                        uploadCount++;
                    }
                }
            }
        }
    }

    // 3. Process Products
    if (newState.products) {
        for (const prod of newState.products) {
            if (prod.masterImage?.startsWith('data:')) {
                console.log(`[Storage] Uploading product master: ${prod.id}`);
                prod.masterImage = await uploadImageToSupabase(
                    prod.masterImage,
                    'project-assets',
                    `${userId}/products/${prod.id}_master_${timestamp}.jpg`
                );
                uploadCount++;
            }
            if (prod.views) {
                const views = ['front', 'back', 'left', 'right', 'top'];
                for (const view of views) {
                    if (prod.views[view]?.startsWith('data:')) {
                        console.log(`[Storage] Uploading product view ${view}: ${prod.id}`);
                        prod.views[view] = await uploadImageToSupabase(
                            prod.views[view],
                            'project-assets',
                            `${userId}/products/${prod.id}_view_${view}_${timestamp}.jpg`
                        );
                        uploadCount++;
                    }
                }
            }
        }
    }

    console.log(`[Storage] Finished processing. Uploaded ${uploadCount} assets.`);
    return newState;
}

export async function syncUserStatsToCloud(userId: string, stats: any) {
    if (!userId) return;
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ usage_stats: stats })
            .eq('id', userId);

        if (error) {
            console.warn('[Storage] Failed to sync usage stats (profiles table might miss usage_stats column?):', error);
        } else {
            console.log('[Storage] Usage stats synced to cloud.');
        }
    } catch (e) {
        console.error("[Storage] Exception syncing stats", e);
    }
}

export async function fetchUserStatsFromCloud(userId: string) {
    if (!userId) return null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('usage_stats')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.usage_stats;
    } catch (e) {
        console.warn("[Storage] Failed to fetch usage stats:", e);
        return null; // Return null to fallback to local project stats
    }
}

/**
 * Track text API token usage and sync to Supabase
 * Should be called after text API calls to accumulate token counts
 */
export async function trackTextTokenUsage(
    userId: string | null | undefined,
    currentStats: any,
    updateStateAndRecord: (fn: (s: any) => any) => void
) {
    // Get token usage from window (set by callGeminiText)
    const tokenUsage = (window as any).__lastTextTokenUsage;
    if (!tokenUsage) return;

    // Clear for next call
    (window as any).__lastTextTokenUsage = null;

    const updatedStats = {
        ...currentStats,
        textTokens: (currentStats?.textTokens || 0) + (tokenUsage.totalTokens || 0),
        promptTokens: (currentStats?.promptTokens || 0) + (tokenUsage.promptTokens || 0),
        candidateTokens: (currentStats?.candidateTokens || 0) + (tokenUsage.candidateTokens || 0),
        textCalls: (currentStats?.textCalls || 0) + 1,
        lastGeneratedAt: new Date().toISOString()
    };

    updateStateAndRecord(s => ({
        ...s,
        usageStats: updatedStats
    }));

    if (userId) {
        syncUserStatsToCloud(userId, updatedStats);
    }

    console.log('[Storage] Token usage tracked:', {
        added: tokenUsage.totalTokens,
        totalAccumulated: updatedStats.textTokens,
        calls: updatedStats.textCalls
    });
}
