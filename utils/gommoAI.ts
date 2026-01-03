/**
 * Gommo AI Client
 * Integration for Google Nano Banana Pro image generation via Gommo API
 * 
 * API Docs: https://api.gommo.net
 */

export interface GommoImageParams {
    prompt: string;
    model?: string;
    ratio?: '16_9' | '9_16' | '1_1';
    project_id?: string;
    editImage?: boolean;
    base64Image?: string;
    subjects?: GommoSubject[]; // For character/object references (Face ID support)
}

/**
 * Subject reference for Gommo API
 * Used to pass character Face ID or object references
 * Matches actual Gommo API format
 */
export interface GommoSubject {
    id_base?: string;       // Optional: existing image id_base if available
    url?: string;           // Optional: URL to reference image
    data?: string;          // Base64 data WITHOUT prefix (no data:image/...,)
}

export interface GommoImageResult {
    id_base: string;
    status: 'PENDING_ACTIVE' | 'PENDING_PROCESSING' | 'SUCCESS' | 'ERROR';
    url?: string;
    prompt?: string;
}

export interface GommoAccountInfo {
    userInfo: {
        name: string;
        username: string;
        avatar?: string;
    };
    balancesInfo: {
        balance: number;
        credits_ai: number;
        currency: string;
    };
}

/**
 * Gommo AI Model definition from listModels API
 */
export interface GommoModel {
    id_base: string;
    name: string;
    description?: string;
    server: string;
    model: string;
    ratios?: Array<{ name: string; type: string }>;
    resolutions?: Array<{ name: string; type: string }>;
    price?: number;
    startText?: boolean;
    startImage?: boolean;
}

/**
 * Gommo Space (for organizing media assets)
 */
export interface GommoSpace {
    id_base: string;
    name: string;
    description?: string;
    project_id?: string;
    created_time: number;
    updated_time: number;
}

/**
 * Gommo Generation Group (collection of generated images/videos)
 */
export interface GommoGenerationGroup {
    id_base: string;
    name: string;
    description?: string;
    project_id?: string;
    status: 'ACTIVE' | 'ARCHIVED';
    type: 'IMAGE' | 'VIDEO';
    created_at: number;
    updated_at: number;
    // Images in the group (may be populated from API)
    images?: GommoImageItem[];
}

/**
 * Gommo Image Item (individual image in a generation group)
 */
export interface GommoImageItem {
    id_base: string;
    url: string;
    prompt?: string;
    created_at?: number;
}

const GOMMO_ENDPOINTS = {
    createImage: 'https://api.gommo.net/ai/generateImage',
    checkImageStatus: 'https://api.gommo.net/ai/image',
    accountInfo: 'https://api.gommo.net/api/apps/go-mmo/ai/me',
    listModels: 'https://api.gommo.net/ai/models',
    // Library Management
    generationGroups: 'https://api.gommo.net/ai/generationGroups',
    listImages: 'https://api.gommo.net/ai/images', // List images from a group
    listSpaces: 'https://api.gommo.net/api/apps/go-mmo/ai_spaces/getAll',
    createSpace: 'https://api.gommo.net/api/apps/go-mmo/ai_spaces/create',
};

/**
 * Delay helper for polling
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Gommo AI Client Class
 */
export class GommoAI {
    private domain: string;
    private accessToken: string;

    constructor(domain: string, accessToken: string) {
        if (!domain || !accessToken) {
            throw new Error('Domain and Access Token are required for Gommo AI');
        }
        this.domain = domain;
        this.accessToken = accessToken;
    }

    /**
     * Internal request method - all Gommo API calls use POST with form-urlencoded
     */
    private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
        const body = new URLSearchParams();

        // Add authentication
        body.append('access_token', this.accessToken);
        body.append('domain', this.domain);

        // Add method-specific parameters
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined && value !== '') {
                if (typeof value === 'object') {
                    body.append(key, JSON.stringify(value));
                } else {
                    body.append(key, String(value));
                }
            }
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body.toString(),
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.message || data.error || 'Gommo API request failed');
            }

            return data;
        } catch (error: any) {
            console.error(`[Gommo AI] Error in request to ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * Get account info and credit balance
     */
    async getAccountInfo(): Promise<GommoAccountInfo> {
        const result = await this.request<GommoAccountInfo>(GOMMO_ENDPOINTS.accountInfo);
        return result;
    }

    /**
     * Verify credentials by fetching account info
     */
    async verifyCredentials(): Promise<boolean> {
        try {
            const info = await this.getAccountInfo();
            console.log('[Gommo AI] ✅ Credentials verified:', info.userInfo.name);
            return true;
        } catch (error) {
            console.error('[Gommo AI] ❌ Credential verification failed:', error);
            return false;
        }
    }

    /**
     * Get available credits
     */
    async getCredits(): Promise<number> {
        const info = await this.getAccountInfo();
        return info.balancesInfo.credits_ai || 0;
    }

    /**
     * Get list of available AI models
     * @param type - 'image', 'video', or 'tts'
     */
    async listModels(type: 'image' | 'video' | 'tts' = 'image'): Promise<GommoModel[]> {
        const result = await this.request<{ data: GommoModel[]; runtime: number }>(
            GOMMO_ENDPOINTS.listModels,
            { type }
        );
        console.log(`[Gommo AI] Found ${result.data?.length || 0} ${type} models`);
        return result.data || [];
    }

    // ═══════════════════════════════════════════════════════════════
    // LIBRARY MANAGEMENT (Spaces & Generation Groups)
    // ═══════════════════════════════════════════════════════════════

    /**
     * List all spaces (folders for organizing media)
     * @param projectId - Optional project ID to filter
     */
    async listSpaces(projectId?: string): Promise<GommoSpace[]> {
        const result = await this.request<{ data: GommoSpace[]; runtime: number }>(
            GOMMO_ENDPOINTS.listSpaces,
            { project_id: projectId || 'default' }
        );
        console.log(`[Gommo AI] Found ${result.data?.length || 0} spaces`);
        return result.data || [];
    }

    /**
     * Create a new space for organizing media
     */
    async createSpace(name: string, description?: string, projectId?: string): Promise<GommoSpace> {
        const result = await this.request<{ spaceInfo: GommoSpace; runtime: number }>(
            GOMMO_ENDPOINTS.createSpace,
            {
                name,
                description: description || '',
                project_id: projectId || 'default'
            }
        );
        console.log(`[Gommo AI] Created space: ${result.spaceInfo?.name}`);
        return result.spaceInfo;
    }

    /**
     * List generation groups (collections of generated images/videos)
     * @param type - 'IMAGE' or 'VIDEO'
     * @param projectId - Optional project ID to filter
     */
    async listGenerationGroups(type: 'IMAGE' | 'VIDEO' = 'IMAGE', projectId?: string): Promise<GommoGenerationGroup[]> {
        const result = await this.request<{ data: GommoGenerationGroup[]; runtime: number }>(
            GOMMO_ENDPOINTS.generationGroups,
            {
                type,
                project_id: projectId || 'default'
            }
        );
        console.log(`[Gommo AI] Found ${result.data?.length || 0} ${type} generation groups`);
        return result.data || [];
    }

    /**
     * List images from a generation group or all images
     * @param groupId - Optional group ID to filter
     * @param limit - Maximum number of images to return
     */
    async listImages(groupId?: string, limit: number = 300): Promise<GommoImageItem[]> {
        try {
            const result = await this.request<{ data: GommoImageItem[]; runtime: number }>(
                GOMMO_ENDPOINTS.listImages,
                {
                    group_id: groupId,
                    limit,
                    project_id: 'default'
                }
            );
            console.log(`[Gommo AI] Found ${result.data?.length || 0} images`);
            return result.data || [];
        } catch (err) {
            console.error('[Gommo AI] listImages error:', err);
            return [];
        }
    }

    /**
     * Create an image from prompt
     * Returns job info - use checkImageStatus or waitForImage for result
     */
    async createImage(params: GommoImageParams): Promise<GommoImageResult> {
        const payload: Record<string, any> = {
            action_type: 'create',
            model: params.model || 'google_nano_banana_pro',
            prompt: params.prompt,
            ratio: params.ratio || '16_9',
            project_id: params.project_id || 'default',
        };

        // Add edit image mode if specified
        if (params.editImage) {
            payload.editImage = 'true';
            payload.base64Image = params.base64Image;
        }

        // Add subjects for Face ID / character references
        if (params.subjects && params.subjects.length > 0) {
            // Gommo expects subjects as JSON array
            payload.subjects = params.subjects;
            console.log(`[Gommo AI] Adding ${params.subjects.length} subject(s) for reference`);
        }

        const result = await this.request<{ imageInfo: GommoImageResult; success: boolean }>(
            GOMMO_ENDPOINTS.createImage,
            payload
        );

        console.log('[Gommo AI] Image job created:', result.imageInfo?.id_base);
        return result.imageInfo;
    }

    /**
     * Check status of an image generation job
     */
    async checkImageStatus(id_base: string): Promise<GommoImageResult> {
        const result = await this.request<any>(GOMMO_ENDPOINTS.checkImageStatus, {
            id_base,
        });

        console.log('[Gommo AI] checkImageStatus raw response:', JSON.stringify(result).substring(0, 500));

        // Response might be wrapped in imageInfo
        if (result.imageInfo) {
            return result.imageInfo;
        }
        return result;
    }

    /**
     * Wait for image completion with polling
     * @param id_base - Job ID from createImage
     * @param maxRetries - Maximum poll attempts (default 60 = ~3 minutes)
     * @param pollInterval - Milliseconds between polls (default 3000)
     * @param onProgress - Optional callback for status updates
     */
    async waitForImage(
        id_base: string,
        maxRetries: number = 60,
        pollInterval: number = 3000,
        onProgress?: (status: string, attempt: number) => void
    ): Promise<string> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const result = await this.checkImageStatus(id_base);

            if (onProgress) {
                onProgress(result.status, attempt);
            }

            if (result.status === 'SUCCESS' && result.url) {
                console.log('[Gommo AI] ✅ Image ready:', result.url);
                return result.url;
            }

            if (result.status === 'ERROR') {
                // Extract error details from response
                const r = result as any;
                const errorMsg = r.error || r.message || r.reason || 'Unknown error';
                console.error('[Gommo AI] ❌ Generation failed:', result);
                throw new Error(`Gommo error: ${errorMsg}. Model may not support this request.`);
            }

            // Still processing, wait and retry
            console.log(`[Gommo AI] Polling... attempt ${attempt}/${maxRetries}, status: ${result.status}`);
            await delay(pollInterval);
        }

        throw new Error('Timeout waiting for Gommo image generation');
    }

    /**
     * High-level method: Generate image and wait for result
     * Returns the CDN URL of the generated image
     * 
     * @param subjects - Optional array of character/object references for Face ID
     */
    async generateImage(
        prompt: string,
        options: {
            ratio?: '16_9' | '9_16' | '1_1';
            model?: string;
            subjects?: GommoSubject[];
            onProgress?: (status: string, attempt: number) => void;
        } = {}
    ): Promise<string> {
        // Step 1: Create image job
        const job = await this.createImage({
            prompt,
            ratio: options.ratio,
            model: options.model,
            subjects: options.subjects,
        });

        // Step 2: Poll until complete
        const imageUrl = await this.waitForImage(job.id_base, 60, 3000, options.onProgress);

        return imageUrl;
    }

    /**
     * Convert aspect ratio format: '16:9' -> '16_9'
     */
    static convertRatio(ratio: string): '16_9' | '9_16' | '1_1' {
        const map: Record<string, '16_9' | '9_16' | '1_1'> = {
            '16:9': '16_9',
            '9:16': '9_16',
            '1:1': '1_1',
        };
        return map[ratio] || '16_9';
    }
}

/**
 * Helper: Fetch image URL and convert to base64
 * Useful when downstream code expects base64 format
 */
export async function urlToBase64(imageUrl: string): Promise<string> {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('[Gommo AI] Failed to convert URL to base64:', error);
        throw error;
    }
}

/**
 * Factory function to create GommoAI instance
 */
export function createGommoClient(domain: string, accessToken: string): GommoAI | null {
    if (!domain || !accessToken) {
        return null;
    }
    return new GommoAI(domain, accessToken);
}
