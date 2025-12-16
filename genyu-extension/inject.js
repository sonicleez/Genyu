// Injected script - runs in page context to intercept fetch
(function () {
    'use strict';

    console.log('[Genyu Inject] 🚀 Starting...');

    // Store original fetch
    const originalFetch = window.fetch;

    if (!originalFetch) {
        console.error('[Genyu Inject] ❌ window.fetch not found!');
        return;
    }

    // Counter for debugging
    let fetchCount = 0;

    // Override fetch
    window.fetch = async function (...args) {
        const [url, options] = args;
        fetchCount++;

        // Log every fetch for debugging
        const urlStr = typeof url === 'string' ? url : String(url);

        if (urlStr.includes('googleapis.com')) {
            console.log(`[Genyu Inject] 📡 Fetch #${fetchCount}:`, urlStr.substring(0, 100));

            // Check if this is the API we want
            const patterns = [
                'flowMedia:batchGenerateImages',
                'batchAsyncGenerate',
                'video:batchAsyncGenerateVideoStartImage'
            ];

            const isTargetAPI = patterns.some(p => urlStr.includes(p));

            if (isTargetAPI) {
                console.log('[Genyu Inject] 🎯 TARGET API DETECTED!');

                if (options && options.body) {
                    try {
                        const bodyStr = typeof options.body === 'string'
                            ? options.body
                            : JSON.stringify(options.body);

                        const body = JSON.parse(bodyStr);
                        console.log('[Genyu Inject] 📦 Body keys:', Object.keys(body || {}));

                        // Try to find recaptcha token
                        let found = false;
                        const search = (obj, path = '') => {
                            if (!obj || typeof obj !== 'object') return;

                            for (const [key, val] of Object.entries(obj)) {
                                const currentPath = path ? `${path}.${key}` : key;

                                if (key === 'recaptchaToken' && typeof val === 'string') {
                                    console.log(`[Genyu Inject] ✅ FOUND TOKEN at ${currentPath}:`, val.substring(0, 30) + '...');
                                    found = true;
                                }

                                if (typeof val === 'object') {
                                    search(val, currentPath);
                                }
                            }
                        };

                        search(body);

                        if (!found) {
                            console.warn('[Genyu Inject] ⚠️ No recaptchaToken found in body');
                        }

                        // Send to content script
                        window.postMessage({
                            type: 'GENYU_TOKEN_CAPTURED',
                            body: body,
                            url: urlStr
                        }, '*');

                        console.log('[Genyu Inject] 📤 Message posted to content script');

                    } catch (e) {
                        console.error('[Genyu Inject] ❌ Parse error:', e.message);
                    }
                } else {
                    console.warn('[Genyu Inject] ⚠️ No body in request');
                }
            }
        }

        // Call original fetch
        return originalFetch.apply(this, args);
    };

    console.log('[Genyu Inject] ✅ Fetch interceptor installed');
    console.log('[Genyu Inject] 🔍 Watching for Google API calls...');

})();
