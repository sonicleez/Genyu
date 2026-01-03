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
 */
export interface GommoSubject {
    name: string;           // Character/object name
    base64Image: string;    // Full base64 with prefix: data:image/jpeg;base64,xxxxx
    description?: string;   // Optional description
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

const GOMMO_ENDPOINTS = {
    createImage: 'https://api.gommo.net/ai/generateImage',
    checkImageStatus: 'https://api.gommo.net/ai/image',
    accountInfo: 'https://api.gommo.net/api/apps/go-mmo/ai/me',
    listModels: 'https://api.gommo.net/ai/models',
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
        const result = await this.request<GommoImageResult>(GOMMO_ENDPOINTS.checkImageStatus, {
            id_base,
        });

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
                throw new Error('Gommo image generation failed');
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
