import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Config
const GENYU_API = 'https://aisandbox-pa.googleapis.com/v1/projects/07c3d6ef-3305-4196-bcc2-7db5294be436/flowMedia:batchGenerateImages';
const VIDEO_API = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoStartImage';

// --- Image Generation Proxy (Labs Google / Fx Flow) ---
app.post('/api/proxy/genyu/image', async (req, res) => {
    const { token: rawToken, prompt, aspect = "IMAGE_ASPECT_RATIO_LANDSCAPE", style, recaptchaToken } = req.body;
    console.log(`[Proxy] Genyu Image Req. Token: ${rawToken ? 'Yes' : 'No'}, Recaptcha: ${recaptchaToken ? 'Yes' : 'No'}`);

    const token = rawToken?.includes('session-token=') ? rawToken.split('session-token=')[1].split(';')[0].trim() : rawToken;

    if (!token) return res.status(401).json({ error: "Missing Token" });

    // Use provided Recaptcha or fallback
    const RECAPTCHA_TOKEN = recaptchaToken || "0cAFcWeA72-Q4udY92nSYo5u7IrOT_j0i95CNLsnp95Hd44041WFn15bVYwTLWS5HKeolnilFX1a0I90OQ1MTMDI31DlNl8d1yCBi8rGlPxyDIfAXDIzcoBj2j7dm8DFGldWYV7yaL0FhSIwWDUa8akadIFSefpdf6JNHgCdnoUgh3bP9zAmycGKhcQV1X8QSOGEz4OjU6HBBbpMqCozYtFVD8YIhb94ze6reOvjmcjPI9XaJXWyxbsYuHO6CPUd1ezZLQ6hHPbj0st3IPL1dsSaLeeltBzMifUA8QS5Ckw_0xemsOgk4ckJd7CRZIiF-x5fPgKlQtDMOtjba_zIxCh1UiltIBxwBe722koxfUm92G0Rl8D4-kp-q8Ja6J-KFGmIWm9Y82SlrmTLBD7sIsOmkUn6gNZjdw6maIA5dDxjdER99Wad3Uqyb-zagDLcZMBXsVfTozC2vTLTze1M2loblwQT_gFWKHMWTpPw2vZ9Msf1YU7HkyrPzJFizms8eUn3gclsPJj-wCzRRDlj7zWfaKyR3lFOFs8U8h_02vXPqsi7gCnBp8bGkoEgiekJCkIESdayQtWM0UK2Xn00jiWBWUQ-NMR_v-JRgHMrNKbucmogDUUTICPvVjbbdTnFjzgz2VUuOrpeEw8ivYrO3zksPXRdsEy_hhN1RYWd46VXfITnZvNfsCLvyJVOYkYoaaJa12j3UI4zaVfVDwxBzvU8r8EIszHVFkTFYhvVVp0dGJKEeV75bISm90Ba2KKr_-NBZC5gdQUebN_twYI2SmKitmO3CKU7ll0TgYykqc8JyR4jbbxBx-DeyopNbCkZa8rJovkA1JTHooyhxJ-kzmyikK7R_lKcL7KLoZNtPF1m9pdwArA0km-Un8nEzzUA42fDrdDtyIZ-lLvBLBT7qDTYitbHKi_8zdUsrH9ziUJgdo5HN3YI5eW4E-2dYAdvAiQwUhiJS0v98MP6c1VAbHfazwX0kUB-dL4KjPFLUKbxfYwuLGRjRPRyRriwcj5D5uivxrFWWVrgFBUHl3C11-DD31KlkiouExuM4ivadmtYeVgZV7hgwJECdGy5sdpzswh2hf10N-RFmuBuHo54UNQLEvScUlPVd9lfgWNojX_HyAgWFCRQnaHBn37fwvSkhkIwamjxDfbJCNNv-mbpqCejVsNyz3LPcUYF2vcRWZumt391u1iaewEKtWDwEIxoegznjaU34QzVAl0cCEfKVbftzkj91V53EZggNcfigFXhTpf2dCOHxW0TFPKCT3Ik4yfu4T2bW_PCvU9UpHPr3RPxmrOtmoZVHw97DlHQ9gVU7tjgJhvWIbVf_7VaneOD2pk9X3SgdkdsdCtA2lX4s-1iEeavQynj1c8NNTRaSenzBZXUFjJGv-H4OX682RW5ZyJZ40I65sLfBht40SeVfzIvld3Ufk4JER63mgo2R4ZRNbPQjvoXh5JkLIuS6EpN2ohfweorDl3Obcm3Cj1UqM8z5Cs6ih0vfQyn5uy6MBJFMSYPhrx4yEEnnAHEEVFzg9fHDmeH3Hw-w2-gFOFpl4tBI_MPKB2eMAdXeVFiHyFhx1XFpOmBbuGwxmor20FF8jXhwEYoX2KLxP";

    // Construct Complex Payload for Google Labs
    const fullPrompt = prompt + (style ? `, ${style}` : "");
    const googlePayload = {
        "clientContext": {
            "recaptchaToken": RECAPTCHA_TOKEN,
            "sessionId": `;${Date.now()}`,
            "projectId": "07c3d6ef-3305-4196-bcc2-7db5294be436",
            "tool": "PINHOLE"
        },
        "requests": [
            {
                "clientContext": {
                    "recaptchaToken": RECAPTCHA_TOKEN,
                    "sessionId": `;${Date.now()}`,
                    "projectId": "07c3d6ef-3305-4196-bcc2-7db5294be436",
                    "tool": "PINHOLE"
                },
                "seed": Math.floor(Math.random() * 1000000),
                "imageModelName": "GEM_PIX_2",
                "imageAspectRatio": aspect,
                "prompt": fullPrompt,
                "imageInputs": []
            }
        ]
    };

    try {
        const response = await axios.post(GENYU_API, googlePayload, {
            headers: {
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'origin': 'https://labs.google',
                'referer': 'https://labs.google/',
                'user-agent': req.headers['user-agent'] || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'x-browser-channel': 'stable',
                'x-browser-year': '2025'
            }
        });

        // Labs Google Response format logic
        console.log("Google Labs Response:", JSON.stringify(response.data, null, 2));

        // Expected structure from Fx Flow is usually base64 or a weird list. 
        // We log it to find out.
        res.json(response.data);

    } catch (error) {
        console.error("Labs Google Proxy Error:", error.response?.data || error.message);
        res.status(500).json({
            error: "Labs Google API Failed",
            details: error.response?.data || error.message
        });
    }
});

// --- General Image Proxy (Bypass CORS for Analysis) ---
app.get('/api/proxy/fetch-image', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("Missing URL");

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                // Mimic a browser to avoid some bot protections
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error("Image Fetch Proxy Error:", error.message);
        res.status(500).send("Failed to fetch image");
    }
});

// --- Google Veo 3.1 Video Generation Proxy ---

// 1. Start Video Generation (Image-to-Video)
app.post('/api/proxy/google/video/start', async (req, res) => {
    const { token: rawToken, prompt, mediaId, aspectRatio = "VIDEO_ASPECT_RATIO_LANDSCAPE", recaptchaToken } = req.body;
    const token = rawToken?.includes('session-token=') ? rawToken.split('session-token=')[1].split(';')[0].trim() : rawToken;
    if (!token || !mediaId) return res.status(400).json({ error: "Missing Token or MediaId" });

    // Use provided Recaptcha or fallback to hardcoded (likely expired)
    const RECAPTCHA_TOKEN = (recaptchaToken || "0cAFcWeA72-Q4udY92nSYo5u7IrOT_j0i95CNLsnp95Hd44041WFn15bVYwTLWS5HKeolnilFX1a0I90OQ1MTMDI31DlNl8d1yCBi8rGlPxyDIfAXDIzcoBj2j7dm8DFGldWYV7yaL0FhSIwWDUa8akadIFSefpdf6JNHgCdnoUgh3bP9zAmycGKhcQV1X8QSOGEz4OjU6HBBbpMqCozYtFVD8YIhb94ze6reOvjmcjPI9XaJXWyxbsYuHO6CPUd1ezZLQ6hHPbj0st3IPL1dsSaLeeltBzMifUA8QS5Ckw_0xemsOgk4ckJd7CRZIiF-x5fPgKlQtDMOtjba_zIxCh1UiltIBxwBe722koxfUm92G0Rl8D4-kp-q8Ja6J-KFGmIWm9Y82SlrmTLBD7sIsOmkUn6gNZjdw6maIA5dDxjdER99Wad3Uqyb-zagDLcZMBXsVfTozC2vTLTze1M2loblwQT_gFWKHMWTpPw2vZ9Msf1YU7HkyrPzJFizms8eUn3gclsPJj-wCzRRDlj7zWfaKyR3lFOFs8U8h_02vXPqsi7gCnBp8bGkoEgiekJCkIESdayQtWM0UK2Xn00jiWBWUQ-NMR_v-JRgHMrNKbucmogDUUTICPvVjbbdTnFjzgz2VUuOrpeEw8ivYrO3zksPXRdsEy_hhN1RYWd46VXfITnZvNfsCLvyJVOYkYoaaJa12j3UI4zaVfVDwxBzvU8r8EIszHVFkTFYhvVVp0dGJKEeV75bISm90Ba2KKr_-NBZC5gdQUebN_twYI2SmKitmO3CKU7ll0TgYykqc8JyR4jbbxBx-DeyopNbCkZa8rJovkA1JTHooyhxJ-kzmyikK7R_lKcL7KLoZNtPF1m9pdwArA0km-Un8nEzzUA42fDrdDtyIZ-lLvBLBT7qDTYitbHKi_8zdUsrH9ziUJgdo5HN3YI5eW4E-2dYAdvAiQwUhiJS0v98MP6c1VAbHfazwX0kUB-dL4KjPFLUKbxfYwuLGRjRPRyRriwcj5D5uivxrFWWVrgFBUHl3C11-DD31KlkiouExuM4ivadmtYeVgZV7hgwJECdGy5sdpzswh2hf10N-RFmuBuHo54UNQLEvScUlPVd9lfgWNojX_HyAgWFCRQnaHBn37fwvSkhkIwamjxDfbJCNNv-mbpqCejVsNyz3LPcUYF2vcRWZumt391u1iaewEKtWDwEIxoegznjaU34QzVAl0cCEfKVbftzkj91V53EZggNcfigFXhTpf2dCOHxW0TFPKCT3Ik4yfu4T2bW_PCvU9UpHPr3RPxmrOtmoZVHw97DlHQ9gVU7tjgJhvWIbVf_7VaneOD2pk9X3SgdkdsdCtA2lX4s-1iEeavQynj1c8NNTRaSenzBZXUFjJGv-H4OX682RW5ZyJZ40I65sLfBht40SeVfzIvld3Ufk4JER63mgo2R4ZRNbPQjvoXh5JkLIuS6EpN2ohfweorDl3Obcm3Cj1UqM8z5Cs6ih0vfQyn5uy6MBJFMSYPhrx4yEEnnAHEEVFzg9fHDmeH3Hw-w2-gFOFpl4tBI_MPKB2eMAdXeVFiHyFhx1XFpOmBbuGwxmor20FF8jXhwEYoX2KLxP").trim();

    // console.log(`[Proxy] Start Video - Prompt: ${prompt.substring(0, 20)}... Recaptcha Length: ${RECAPTCHA_TOKEN.length}`);

    const payload = {
        "clientContext": {
            "recaptchaToken": RECAPTCHA_TOKEN,
            "sessionId": `;${Date.now()}`,
            "projectId": "07c3d6ef-3305-4196-bcc2-7db5294be436",
            "tool": "PINHOLE",
            "userPaygateTier": "PAYGATE_TIER_TWO"
        },
        "requests": [
            {
                "aspectRatio": aspectRatio,
                "seed": Math.floor(Math.random() * 1000000),
                "textInput": { "prompt": prompt },
                "videoModelKey": "veo_3_1_i2v_s_fast_ultra",
                "startImage": { "mediaId": mediaId },
                "metadata": { "sceneId": `sc-${Date.now()}` }
            }
        ]
    };

    console.log("[Proxy] FULL Payload:", JSON.stringify(payload, null, 2)); // DEBUG: Check what we send

    try {
        const response = await axios.post(VIDEO_API, payload, {
            headers: {
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'origin': 'https://labs.google',
                'user-agent': req.headers['user-agent']
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Video Start Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Video Start Failed", details: error.response?.data });
    }
});

// 2. Check Video Status (Polling)
app.post('/api/proxy/google/video/status', async (req, res) => {
    const { token: rawToken, operations } = req.body;
    const token = rawToken?.includes('session-token=') ? rawToken.split('session-token=')[1].split(';')[0].trim() : rawToken;
    if (!token || !operations) return res.status(400).json({ error: "Missing Token or Operations" });

    const STATUS_API = "https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus";
    const RECAPTCHA_TOKEN = "0cAFcWeA72-Q4udY92nSYo5u7IrOT_j0i95CNLsnp95Hd44041WFn15bVYwTLWS5HKeolnilFX1a0I90OQ1MTMDI31DlNl8d1yCBi8rGlPxyDIfAXDIzcoBj2j7dm8DFGldWYV7yaL0FhSIwWDUa8akadIFSefpdf6JNHgCdnoUgh3bP9zAmycGKhcQV1X8QSOGEz4OjU6HBBbpMqCozYtFVD8YIhb94ze6reOvjmcjPI9XaJXWyxbsYuHO6CPUd1ezZLQ6hHPbj0st3IPL1dsSaLeeltBzMifUA8QS5Ckw_0xemsOgk4ckJd7CRZIiF-x5fPgKlQtDMOtjba_zIxCh1UiltIBxwBe722koxfUm92G0Rl8D4-kp-q8Ja6J-KFGmIWm9Y82SlrmTLBD7sIsOmkUn6gNZjdw6maIA5dDxjdER99Wad3Uqyb-zagDLcZMBXsVfTozC2vTLTze1M2loblwQT_gFWKHMWTpPw2vZ9Msf1YU7HkyrPzJFizms8eUn3gclsPJj-wCzRRDlj7zWfaKyR3lFOFs8U8h_02vXPqsi7gCnBp8bGkoEgiekJCkIESdayQtWM0UK2Xn00jiWBWUQ-NMR_v-JRgHMrNKbucmogDUUTICPvVjbbdTnFjzgz2VUuOrpeEw8ivYrO3zksPXRdsEy_hhN1RYWd46VXfITnZvNfsCLvyJVOYkYoaaJa12j3UI4zaVfVDwxBzvU8r8EIszHVFkTFYhvVVp0dGJKEeV75bISm90Ba2KKr_-NBZC5gdQUebN_twYI2SmKitmO3CKU7ll0TgYykqc8JyR4jbbxBx-DeyopNbCkZa8rJovkA1JTHooyhxJ-kzmyikK7R_lKcL7KLoZNtPF1m9pdwArA0km-Un8nEzzUA42fDrdDtyIZ-lLvBLBT7qDTYitbHKi_8zdUsrH9ziUJgdo5HN3YI5eW4E-2dYAdvAiQwUhiJS0v98MP6c1VAbHfazwX0kUB-dL4KjPFLUKbxfYwuLGRjRPRyRriwcj5D5uivxrFWWVrgFBUHl3C11-DD31KlkiouExuM4ivadmtYeVgZV7hgwJECdGy5sdpzswh2hf10N-RFmuBuHo54UNQLEvScUlPVd9lfgWNojX_HyAgWFCRQnaHBn37fwvSkhkIwamjxDfbJCNNv-mbpqCejVsNyz3LPcUYF2vcRWZumt391u1iaewEKtWDwEIxoegznjaU34QzVAl0cCEfKVbftzkj91V53EZggNcfigFXhTpf2dCOHxW0TFPKCT3Ik4yfu4T2bW_PCvU9UpHPr3RPxmrOtmoZVHw97DlHQ9gVU7tjgJhvWIbVf_7VaneOD2pk9X3SgdkdsdCtA2lX4s-1iEeavQynj1c8NNTRaSenzBZXUFjJGv-H4OX682RW5ZyJZ40I65sLfBht40SeVfzIvld3Ufk4JER63mgo2R4ZRNbPQjvoXh5JkLIuS6EpN2ohfweorDl3Obcm3Cj1UqM8z5Cs6ih0vfQyn5uy6MBJFMSYPhrx4yEEnnAHEEVFzg9fHDmeH3Hw-w2-gFOFpl4tBI_MPKB2eMAdXeVFiHyFhx1XFpOmBbuGwxmor20FF8jXhwEYoX2KLxP";

    // Payload matches user provided status check curl
    const payload = {
        "operations": operations // expect array of { operation: {name}, sceneId, status }
    };

    try {
        const response = await axios.post(STATUS_API, payload, {
            headers: {
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'origin': 'https://labs.google',
                'user-agent': req.headers['user-agent']
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Video Status Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Video Status Failed", details: error.response?.data });
    }
});

// 3. Generic Workflow Status (for Character Image Generation)
app.post('/api/proxy/google/workflow/status', async (req, res) => {
    const { token: rawToken, workflowId } = req.body;
    const token = rawToken?.includes('session-token=') ? rawToken.split('session-token=')[1].split(';')[0].trim() : rawToken;
    if (!token || !workflowId) return res.status(400).json({ error: "Missing Token or WorkflowId" });

    const WORKFLOW_STATUS_API = `https://aisandbox-pa.googleapis.com/v1/projects/07c3d6ef-3305-4196-bcc2-7db5294be436/workflows/${workflowId}`;

    try {
        const response = await axios.get(WORKFLOW_STATUS_API, {
            headers: {
                'authorization': `Bearer ${token}`,
                'origin': 'https://labs.google',
                'user-agent': req.headers['user-agent']
            }
        });
        console.log(`[Proxy] Workflow ${workflowId} Status:`, response.data.state);
        res.json(response.data);
    } catch (error) {
        console.error("Workflow Status Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Workflow Status Failed", details: error.response?.data });
    }
});

const PORT = 3001;
const server = app.listen(PORT, () => {
    console.log(`🚀 Proxy running at http://localhost:${PORT}`);
});

// Set timeout to 5 minutes (300000 ms) to handle slow Google Labs API
server.setTimeout(300000);
