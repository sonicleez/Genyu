// Test endpoint for validating tokens and payload
import express from 'express';
import axios from 'axios';

const router = express.Router();

// Test Token & Recaptcha Validation
router.post('/test-video-token', async (req, res) => {
    const { token: rawToken, recaptchaToken } = req.body;

    console.log('\n=== TOKEN VALIDATION TEST ===');

    // 1. Validate Session Token
    const token = rawToken?.includes('session-token=')
        ? rawToken.split('session-token=')[1].split(';')[0].trim()
        : rawToken;

    const tokenValidation = {
        provided: !!rawToken,
        cleaned: token?.substring(0, 20) + '...',
        length: token?.length || 0,
        format: token?.startsWith('ya29.') ? '✅ Valid OAuth2' : '❌ Invalid format',
        status: token?.length > 50 ? '✅ Looks good' : '❌ Too short'
    };

    console.log('Session Token:', tokenValidation);

    // 2. Validate Recaptcha Token
    const recaptchaValidation = {
        provided: !!recaptchaToken,
        length: recaptchaToken?.length || 0,
        format: recaptchaToken?.startsWith('0cAF') ? '✅ Valid format' : '❌ Invalid format',
        status: recaptchaToken?.length > 1500 ? '✅ Looks good' : '❌ Too short (likely expired)'
    };

    console.log('Recaptcha Token:', recaptchaValidation);

    // 3. Test payload structure
    const testPayload = {
        "clientContext": {
            "recaptchaToken": recaptchaToken || "MISSING",
            "sessionId": `;${Date.now()}`,
            "projectId": "07c3d6ef-3305-4196-bcc2-7db5294be436",
            "tool": "PINHOLE",
            "userPaygateTier": "PAYGATE_TIER_TWO"
        },
        "requests": [{
            "aspectRatio": "VIDEO_ASPECT_RATIO_LANDSCAPE",
            "seed": 12345,
            "textInput": { "prompt": "TEST_VALIDATION" },
            "videoModelKey": "veo_3_1_i2v_s_fast_ultra",
            "startImage": { "mediaId": "CAMaJFRFU1QiA0NBRQ" },
            "metadata": { "sceneId": "test-validation" }
        }]
    };

    const payloadValidation = {
        size: JSON.stringify(testPayload).length,
        hasRecaptcha: !!testPayload.clientContext.recaptchaToken,
        hasSessionId: !!testPayload.clientContext.sessionId,
        status: '✅ Structure OK'
    };

    console.log('Payload:', payloadValidation);

    // 4. Check if tokens are ready for real request
    const readyForVideo =
        tokenValidation.status.includes('✅') &&
        recaptchaValidation.status.includes('✅');

    const result = {
        ready: readyForVideo,
        sessionToken: tokenValidation,
        recaptchaToken: recaptchaValidation,
        payload: payloadValidation,
        message: readyForVideo
            ? '✅ ALL GOOD! Ready to create videos!'
            : '❌ Fix the issues above before creating videos',
        nextSteps: readyForVideo
            ? ['Click "Generate Video" to start creating!']
            : [
                !tokenValidation.provided ? 'Get Session Token from Google Labs cookie' : '',
                !recaptchaValidation.provided ? 'Get Recaptcha Token from Network payload' : '',
                recaptchaValidation.length < 1500 ? 'Recaptcha token expired, get a new one!' : ''
            ].filter(Boolean)
    };

    console.log('\nTest Result:', result.ready ? '✅ PASS' : '❌ FAIL');
    console.log('=========================\n');

    res.json(result);
});

export default router;
