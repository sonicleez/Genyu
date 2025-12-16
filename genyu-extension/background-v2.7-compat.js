// Background v2.7 - Compatible với Chrome cũ (không dùng world:MAIN)

console.log('[Genyu BG] Background v2.7 loaded');

const TOKENS = { recaptcha: null, projectId: null, lastUpdate: null };

// Inject code khi tab load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url?.includes('labs.google')) {
        console.log('[Genyu BG] Tab ready, injecting...', tabId);

        // Inject vào ISOLATED world (không cần world:MAIN)
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                // Code này chạy trong isolated world
                console.log('[Genyu Isolated] Injecting to MAIN...');

                const script = document.createElement('script');
                script.textContent = `
                    (function() {
                        console.log('[Genyu MAIN] Interceptor installing...');
                        const orig = window.fetch;
                        window.fetch = async function(...args) {
                            const [url, opt] = args;
                            const u = String(url);
                            
                            if (u.includes('googleapis.com')) {
                                console.log('[Genyu] API:', u.substring(0, 80));
                                
                                if ((u.includes('flowMedia') || u.includes('batchGenerate')) && opt?.body) {
                                    console.log('[Genyu] *** CAPTURED ***');
                                    try {
                                        const body = JSON.parse(opt.body);
                                        window.postMessage({ type: 'GENYU_TOKEN', body }, '*');
                                    } catch(e) { console.error('[Genyu] Parse error:', e); }
                                }
                            }
                            
                            return orig.apply(this, args);
                        };
                        console.log('[Genyu MAIN] Interceptor ready');
                    })();
                `;
                (document.head || document.documentElement).appendChild(script);
                script.remove();
                console.log('[Genyu Isolated] Injection complete');
            }
        }).then(() => {
            console.log('[Genyu BG] Injection success');
        }).catch(err => {
            console.error('[Genyu BG] Injection error:', err.message);
        });
    }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender) => {
    console.log('[Genyu BG] Message:', message?.type, 'from tab:', sender.tab?.id);

    if (message.type === 'GENYU_TOKEN_CAPTURED') {
        const body = message.body;
        if (!body) {
            console.error('[Genyu BG] No body!');
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
            console.log('[Genyu BG] ✅ Token:', recaptchaToken.length, 'chars');

            TOKENS.recaptcha = recaptchaToken;
            TOKENS.projectId = projectId;
            TOKENS.lastUpdate = new Date().toISOString();

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
                .then(r => {
                    console.log('[Genyu BG] Server response:', r.status);
                    return r.json();
                })
                .then(data => console.log('[Genyu BG] Server data:', data))
                .catch(e => console.error('[Genyu BG] Server error:', e.message));
        } else {
            console.warn('[Genyu BG] No token found in body');
        }
    }
});

console.log('[Genyu BG] Ready');
