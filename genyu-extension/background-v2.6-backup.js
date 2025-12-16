// Background script - injects code into labs.google.com tabs

console.log('[Genyu BG] Background script loaded v2.6');

// Function to inject into page
function injectInterceptor() {
    console.log('[Genyu Inject] Installing interceptor...');

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const [url, options] = args;
        const urlStr = String(url);

        if (urlStr.includes('googleapis.com')) {
            console.log('[Genyu] API call:', urlStr.substring(0, 80));

            if ((urlStr.includes('flowMedia') || urlStr.includes('batchGenerate')) && options?.body) {
                console.log('[Genyu] *** CAPTURED ***');
                try {
                    const body = JSON.parse(options.body);
                    window.postMessage({ type: 'GENYU_TOKEN', body }, '*');
                } catch (e) { }
            }
        }

        return originalFetch.apply(this, args);
    };

    console.log('[Genyu] Interceptor ready');
}

// Inject when tab loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tab.url?.includes('labs.google')) {
        console.log('[Genyu BG] Injecting into tab', tabId);

        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: injectInterceptor,
            world: 'MAIN'
        }).catch(err => {
            console.error('[Genyu BG] Injection failed:', err.message);
        });
    }
});

// Store tokens
const TOKENS = { recaptcha: null, projectId: null, lastUpdate: null };

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender) => {
    console.log('[Genyu BG] ===== MESSAGE RECEIVED =====');
    console.log('[Genyu BG] Type:', message?.type);
    console.log('[Genyu BG] From tab:', sender.tab?.id);
    console.log('[Genyu BG] URL:', sender.url);

    if (message.type === 'GENYU_TOKEN_CAPTURED') {
        console.log('[Genyu BG] Processing token...');
        const body = message.body;

        if (!body) {
            console.error('[Genyu BG] No body in message!');
            return;
        }

        let recaptchaToken = null;
        let projectId = null;

        const search = (obj, depth = 0) => {
            if (!obj || depth > 10) return;
            if (typeof obj === 'object') {
                if (obj.recaptchaToken) recaptchaToken = obj.recaptchaToken;
                if (obj.projectId) projectId = obj.projectId;
                Object.values(obj).forEach(v => search(v, depth + 1));
            }
        };

        search(body);

        if (recaptchaToken) {
            TOKENS.recaptcha = recaptchaToken;
            TOKENS.projectId = projectId;
            TOKENS.lastUpdate = new Date().toISOString();

            console.log('[Genyu BG] Token captured:', recaptchaToken.length, 'chars');

            chrome.storage.local.set({
                lastToken: recaptchaToken,
                lastProjectId: projectId,
                lastCapture: TOKENS.lastUpdate
            });

            fetch('http://localhost:3001/api/update-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recaptchaToken, projectId })
            })
                .then(r => console.log('[Genyu BG] Server updated:', r.status))
                .catch(e => console.error('[Genyu BG] Server error:', e.message));
        }
    }
});
