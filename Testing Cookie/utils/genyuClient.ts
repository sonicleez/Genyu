// Client-side Direct Call to Google Labs API (Bypassing Server Proxy)
// Requires Extension with CORS bypass to be active.

interface DirectGenyuCallParams {
    prompt: string;
    aspect?: string;
    oauthToken?: string;
    recaptchaToken?: string;
    projectId?: string;
    imageInputs?: any[];
}

export const directGenyuCall = async (params: DirectGenyuCallParams) => {
    const {
        prompt,
        aspect = "IMAGE_ASPECT_RATIO_LANDSCAPE",
        oauthToken,
        recaptchaToken,
        projectId,
        imageInputs = []
    } = params;

    // Validation
    if (!oauthToken) {
        throw new Error('OAuth token is required. Generate an image on labs.google.com first.');
    }

    // Default Project ID fallback
    const EFFECTIVE_PROJECT_ID = projectId || '933ef5be-3d2f-480a-9e29-48c86b29298a';
    const API_URL = `https://aisandbox-pa.googleapis.com/v1/projects/${EFFECTIVE_PROJECT_ID}/flowMedia:batchGenerateImages`;

    const payload = {
        "clientContext": {
            ...(recaptchaToken && { "recaptchaToken": recaptchaToken }),
            "sessionId": `;${Date.now()}`,
            "projectId": EFFECTIVE_PROJECT_ID,
            "tool": "PINHOLE"
        },
        "requests": [
            {
                "clientContext": {
                    ...(recaptchaToken && { "recaptchaToken": recaptchaToken }),
                    "sessionId": `;${Date.now()}`,
                    "projectId": EFFECTIVE_PROJECT_ID,
                    "tool": "PINHOLE"
                },
                "seed": Math.floor(Math.random() * 1000000),
                "imageModelName": "GEM_PIX_2",
                "imageAspectRatio": aspect,
                "prompt": prompt,
                "imageInputs": imageInputs
            }
        ]
    };

    console.log("🚀 Direct Call to Google Labs API...");
    console.log("   Project:", EFFECTIVE_PROJECT_ID);
    console.log("   Aspect:", aspect);
    console.log("   Has reCAPTCHA:", !!recaptchaToken);

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${oauthToken}`,
                'content-type': 'application/json',
                'origin': 'https://labs.google.com',
                'x-browser-channel': 'stable',
                'x-browser-year': '2025'
            },
            // Don't include credentials - OAuth token in header is enough
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("❌ Direct Call Failed:", response.status, errText);

            let errorMsg = `API Error ${response.status}`;
            try {
                const errJson = JSON.parse(errText);
                errorMsg = errJson.error?.message || errorMsg;
            } catch (e) {
                errorMsg = errText.substring(0, 100);
            }

            throw new Error(errorMsg);
        }

        const data = await response.json();
        console.log("✅ Google Labs Response received");

        // Normalize Response
        const result = data.responses?.[0] || data.generatedImages?.[0] || data.images?.[0];

        if (!result) {
            console.error("No result in response:", data);
            throw new Error("No image data in API response");
        }

        // Extract image
        let foundBase64 = null;
        if (result.image?.content) foundBase64 = result.image.content;
        else if (typeof result === 'string') foundBase64 = result;
        else if (result.content) foundBase64 = result.content;

        if (!foundBase64) {
            console.error("No base64 found in result:", result);
            throw new Error("No image content in response");
        }

        const finalImage = foundBase64.startsWith('data:image')
            ? foundBase64
            : `data:image/jpeg;base64,${foundBase64}`;

        return {
            success: true,
            images: [finalImage],
            mediaId: result.submissionId || null
        };

    } catch (error: any) {
        console.error("❌ Direct Call Error:", error.message);
        throw error;
    }
};
