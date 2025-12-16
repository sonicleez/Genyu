// Content script - Listen for fresh reCAPTCHA tokens

console.log('[Genyu Content] Script loaded');

window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'GENYU_FRESH_RECAPTCHA') {
        console.log('[Genyu Content] Fresh reCAPTCHA received, forwarding to background...');

        try {
            chrome.runtime.sendMessage({
                type: 'GENYU_FRESH_RECAPTCHA_CAPTURED',
                token: event.data.token
            });
            console.log('[Genyu Content] ✅ Forwarded to background');
        } catch (e) {
            console.error('[Genyu Content] Error:', e.message);
        }
    }
});

console.log('[Genyu Content] Listener ready');
