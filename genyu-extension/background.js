// Background v8.1 - Token Pool with UI Controls
console.log('[Genyu BG] Background v8.1 - Token Pool with Controls');

// ==================== CONFIGURATION ====================
let IS_RUNNING = true; // Auto-start by default
let GENERATE_INTERVAL = 5000; // Default 5 seconds
let generationTimer = null;

const TOKEN_POOL = [];
const MAX_TOKEN_AGE = 90000; // 90 seconds

// ==================== TOKEN GENERATION ====================
async function generateAndPoolToken() {
    if (!IS_RUNNING) {
        console.log('[Token Pool] ⏸️ Generation paused');
        return;
    }

    try {
        const tabs = await chrome.tabs.query({});
        const labsTab = tabs.find(tab =>
            tab.url && (tab.url.includes('labs.google.com') || tab.url.includes('labs.google'))
        );

        if (!labsTab) {
            console.log('[Token Pool] ⚠️ No labs.google tab - skipping generation');
            return;
        }

        const results = await chrome.scripting.executeScript({
            target: { tabId: labsTab.id },
            func: async () => {
                if (typeof grecaptcha === 'undefined') {
                    return { error: 'grecaptcha not loaded' };
                }

                try {
                    const token = await grecaptcha.enterprise.execute(
                        "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV",
                        { action: "FLOW_GENERATION" }
                    );
                    return { token };
                } catch (e) {
                    return { error: e.message };
                }
            },
            world: 'MAIN'
        });

        const result = results[0]?.result;

        if (result?.token) {
            const tokenObj = {
                token: result.token,
                timestamp: Date.now(),
                used: false
            };

            TOKEN_POOL.push(tokenObj);
            console.log(`[Token Pool] ✅ Added token (Pool size: ${TOKEN_POOL.length})`);

            // Clean old tokens and sync to server
            cleanTokenPool();
            syncPoolToServer();
        } else if (result?.error) {
            console.log('[Token Pool] ⚠️ Generation failed:', result.error);
        }
    } catch (e) {
        console.error('[Token Pool] Error:', e.message);
    }
}

// Clean expired tokens from pool
function cleanTokenPool() {
    const now = Date.now();
    const before = TOKEN_POOL.length;

    for (let i = TOKEN_POOL.length - 1; i >= 0; i--) {
        const age = now - TOKEN_POOL[i].timestamp;
        if (age > MAX_TOKEN_AGE || TOKEN_POOL[i].used) {
            TOKEN_POOL.splice(i, 1);
        }
    }

    const removed = before - TOKEN_POOL.length;
    if (removed > 0) {
        console.log(`[Token Pool] 🧹 Cleaned ${removed} tokens (Pool size: ${TOKEN_POOL.length})`);
    }
}

// Send pool to server
async function syncPoolToServer() {
    try {
        cleanTokenPool();

        const availableTokens = TOKEN_POOL.filter(t => !t.used);

        await fetch('http://localhost:3001/api/update-token-pool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokens: availableTokens.map(t => ({
                    token: t.token,
                    age: Math.round((Date.now() - t.timestamp) / 1000)
                }))
            })
        });

        console.log(`[Token Pool] 📤 Synced ${availableTokens.length} tokens to server`);
    } catch (e) {
        // Server might be down
    }
}

// ==================== TIMER CONTROL ====================
function startGeneration() {
    if (generationTimer) {
        clearInterval(generationTimer);
    }

    IS_RUNNING = true;
    generationTimer = setInterval(generateAndPoolToken, GENERATE_INTERVAL);
    generateAndPoolToken(); // Generate immediately

    console.log(`[Token Pool] ▶️ Started (interval: ${GENERATE_INTERVAL / 1000}s)`);
}

function stopGeneration() {
    IS_RUNNING = false;

    if (generationTimer) {
        clearInterval(generationTimer);
        generationTimer = null;
    }

    console.log('[Token Pool] ⏸️ Stopped');
}

function setInterval_custom(interval) {
    GENERATE_INTERVAL = interval;

    if (IS_RUNNING) {
        // Restart with new interval
        startGeneration();
    }

    console.log(`[Token Pool] ⏱️ Interval set to ${interval / 1000}s`);
}

// ==================== SESSION TOKEN AUTO-SEND ====================
let lastSessionToken = null;

// Intercept requests to extract Bearer token
chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        const authHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'authorization');

        if (authHeader && authHeader.value) {
            const token = authHeader.value.replace('Bearer ', '');

            if (token && token.startsWith('ya29.') && token !== lastSessionToken) {
                lastSessionToken = token;

                // Send to server
                fetch('http://localhost:3001/api/update-tokens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: token })
                }).then(() => {
                    console.log('[Session Token] ✅ Intercepted and sent to server');
                }).catch(() => {
                    // Ignore
                });
            }
        }
    },
    { urls: ['https://aisandbox-pa.googleapis.com/*'] },
    ['requestHeaders']
);

console.log('[Session Token] 🎯 Network interception enabled');

// ==================== MESSAGE HANDLERS ====================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_STATUS') {
        sendResponse({
            isRunning: IS_RUNNING,
            interval: GENERATE_INTERVAL,
            poolSize: TOKEN_POOL.filter(t => !t.used).length
        });
    } else if (message.type === 'START_GENERATE') {
        if (message.interval) {
            setInterval_custom(message.interval);
        }
        startGeneration();
        sendResponse({ success: true });
    } else if (message.type === 'STOP_GENERATE') {
        stopGeneration();
        sendResponse({ success: true });
    }

    return true;
});

// ==================== STARTUP ====================
startGeneration(); // Auto-start on load

console.log('[Genyu BG] ✅ Ready - Token Pool with UI Controls');
