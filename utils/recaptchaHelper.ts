// Helper để request fresh reCAPTCHA token từ Extension thông qua Server

const SERVER_URL = 'http://localhost:3001';

/**
 * Request fresh reCAPTCHA token từ Extension
 * Flow: App → Server → Extension → Server → App
 * Timeout: 15 seconds
 */
export async function requestFreshRecaptcha(): Promise<string> {
    console.log('[reCAPTCHA Helper] 🔄 Requesting fresh token...');

    // 1. Create pending request on server
    const requestRes = await fetch(`${SERVER_URL}/api/genyu/request-fresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!requestRes.ok) {
        throw new Error('Failed to create token request');
    }

    const { requestId } = await requestRes.json();
    console.log(`[reCAPTCHA Helper] 📋 Created request: ${requestId}`);

    // 2. Wait for Extension to fulfill the request
    const tokenRes = await fetch(`${SERVER_URL}/api/genyu/wait-for-token/${requestId}`);

    if (!tokenRes.ok) {
        if (tokenRes.status === 408) {
            throw new Error('reCAPTCHA timeout - Extension may not be running or labs.google tab not open');
        }
        throw new Error(`Failed to get token: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();

    if (!tokenData.success || !tokenData.token) {
        throw new Error('Failed to get fresh reCAPTCHA token');
    }

    console.log(`[reCAPTCHA Helper] ✅ Got token (${tokenData.token.length} chars)`);
    return tokenData.token;
}

/**
 * Get token from pool (faster but may be stale)
 */
export async function getPooledToken(): Promise<string | null> {
    try {
        const res = await fetch(`${SERVER_URL}/api/consume-tokens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ count: 1 })
        });

        if (!res.ok) {
            return null;
        }

        const data = await res.json();
        return data.tokens?.[0]?.token || null;
    } catch (e) {
        return null;
    }
}

/**
 * Get token - ALWAYS request fresh one (pool tokens are often too old)
 */
export async function getRecaptchaToken(): Promise<string> {
    // Always get fresh token - pool tokens are often stale and rejected by Google
    console.log('[reCAPTCHA Helper] 🔄 Requesting fresh token (skipping pool for reliability)...');
    return requestFreshRecaptcha();
}
