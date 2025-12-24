import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COOKIES_FILE = path.join(__dirname, 'google-cookies.json');

// Save cookies from Extension
export async function saveCookies(req, res) {
    try {
        const { cookies } = req.body;
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
        console.log('✅ Cookies saved:', cookies.length, 'cookies');
        res.json({ success: true, count: cookies.length });
    } catch (error) {
        console.error('Error saving cookies:', error);
        res.status(500).json({ error: error.message });
    }
}

// Auto-generate image using Puppeteer
export async function autoGenerate(req, res) {
    const { prompt, projectId = '62c5b3fe-4cf4-42fe-b1b2-f621903e7e23' } = req.body;

    console.log('🤖 Starting Puppeteer auto-generate...');
    console.log('   Prompt:', prompt.substring(0, 50) + '...');
    console.log('   Project:', projectId);

    let browser;
    try {
        // Check if cookies exist
        if (!fs.existsSync(COOKIES_FILE)) {
            return res.status(400).json({
                error: 'No cookies found',
                message: 'Please save cookies first via /api/save-cookies'
            });
        }

        // Launch browser
        browser = await puppeteer.launch({
            headless: false, // Set to false for debugging
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: { width: 1280, height: 720 }
        });

        const page = await browser.newPage();

        // Load cookies
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        await page.setCookie(...cookies);
        console.log('✅ Cookies loaded');

        // Navigate to project
        const url = `https://labs.google.com/fx/vi/tools/flow/project/${projectId}`;
        console.log('🌐 Navigating to:', url);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for page to be ready
        await page.waitForTimeout(3000);

        // Find and fill prompt textarea
        console.log('✍️ Entering prompt...');
        const promptSelector = 'textarea, input[type="text"]';
        await page.waitForSelector(promptSelector, { timeout: 10000 });

        // Clear and type
        await page.click(promptSelector);
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await page.type(promptSelector, prompt, { delay: 50 });

        // 🔑 GENERATE FRESH RECAPTCHA TOKEN!
        console.log('🔑 Generating fresh reCAPTCHA token...');
        const recaptchaToken = await page.evaluate(() => {
            return grecaptcha.enterprise.execute(
                "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV",
                { action: "FLOW_GENERATION" }
            );
        });

        if (recaptchaToken) {
            console.log('✅ Fresh reCAPTCHA generated:', recaptchaToken.substring(0, 50) + '... (', recaptchaToken.length, 'chars)');
        } else {
            console.warn('⚠️ No reCAPTCHA token generated');
        }

        console.log('🚀 Clicking generate button...');
        // Find generate button - try multiple selectors
        const buttonSelectors = [
            'button:has-text("Tạo")',
            'button:has-text("Generate")',
            'button[type="submit"]',
            'button.generate'
        ];

        let clicked = false;
        for (const selector of buttonSelectors) {
            try {
                await page.click(selector);
                clicked = true;
                console.log('✅ Clicked button:', selector);
                break;
            } catch (e) {
                // Try next selector
            }
        }

        if (!clicked) {
            throw new Error('Could not find generate button');
        }

        // Wait for image to appear
        console.log('⏳ Waiting for image generation (up to 60s)...');

        // Wait for image result - try multiple selectors
        const imageSelectors = [
            'img[src*="base64"]',
            'img[src*="googleusercontent"]',
            'img[alt*="generated"]',
            'canvas'
        ];

        let imageData = null;
        for (const selector of imageSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 60000 });

                if (selector === 'canvas') {
                    // Get canvas as base64
                    imageData = await page.evaluate(() => {
                        const canvas = document.querySelector('canvas');
                        return canvas ? canvas.toDataURL() : null;
                    });
                } else {
                    // Get img src
                    imageData = await page.evaluate((sel) => {
                        const img = document.querySelector(sel);
                        return img ? img.src : null;
                    }, selector);
                }

                if (imageData) {
                    console.log('✅ Image found with selector:', selector);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        await browser.close();

        if (imageData) {
            console.log('✅ Auto-generate SUCCESS!');
            res.json({
                success: true,
                image: imageData
            });
        } else {
            throw new Error('No image found after generation');
        }

    } catch (error) {
        console.error('❌ Auto-generate error:', error.message);
        if (browser) await browser.close();

        res.status(500).json({
            error: error.message,
            details: error.stack
        });
    }
}
