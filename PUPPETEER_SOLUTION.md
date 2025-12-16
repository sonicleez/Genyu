# 🎯 GIẢI PHÁP MỚI: Server-Side Browser Automation

## Ý tưởng

Thay vì:
- ❌ Call API trực tiếp (bị CORS + reCAPTCHA)
- ❌ Capture token (chỉ dùng 1 lần)

Hãy:
- ✅ **Server điều khiển browser thật** (Puppeteer/Playwright)
- ✅ Browser đã login labs.google.com
- ✅ Tự động generate ảnh trong browser
- ✅ Lấy ảnh result và return về App

## Flow hoạt động

```
User clicks Generate in App
   ↓
POST /api/genyu/auto-generate
   ↓
Server launches headless browser (Puppeteer)
   ↓
Navigate to labs.google.com/fx/tools/flow
   ↓
Browser tự động:
  1. Login (dùng cookies đã lưu)
  2. Nhập prompt
  3. Click Generate
  4. Đợi ảnh xong
  5. Download ảnh
   ↓
Server return base64 image về App
   ↓
✅ SUCCESS!
```

## Implementation

### Bước 1: Install Puppeteer

```bash
cd "Testing Cookie/server"
npm install puppeteer
```

### Bước 2: Lưu cookies từ browser

Extension capture cookies và lưu vào file:
```javascript
// Extension gửi cookies đến server
const cookies = await chrome.cookies.getAll({domain: 'google.com'});
fetch('http://localhost:3001/api/save-cookies', {
    method: 'POST',
    body: JSON.stringify({cookies})
});
```

Server lưu cookies:
```javascript
app.post('/api/save-cookies', (req, res) => {
    fs.writeFileSync('./google-cookies.json', JSON.stringify(req.body.cookies));
    res.json({success: true});
});
```

### Bước 3: Server auto-generate với Puppeteer

```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');

app.post('/api/genyu/auto-generate', async (req, res) => {
    const { prompt, projectId } = req.body;
    
    try {
        // Launch browser
        const browser = await puppeteer.launch({
            headless: false, // Để debug, sau này set true
            args: ['--no-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Load cookies
        const cookies = JSON.parse(fs.readFileSync('./google-cookies.json', 'utf8'));
        await page.setCookie(...cookies);
        
        // Navigate to project
        await page.goto(`https://labs.google.com/fx/vi/tools/flow/project/${projectId}`);
        await page.waitForTimeout(2000);
        
        // Enter prompt
        const promptSelector = 'textarea';
        await page.waitForSelector(promptSelector);
        await page.type(promptSelector, prompt);
        
        // Click generate button
        const generateBtn = 'button:has-text("Tạo")';
        await page.click(generateBtn);
        
        // Wait for image to appear (adjust selector)
        await page.waitForSelector('img[src*="base64"]', {timeout: 60000});
        
        // Get image
        const imageData = await page.evaluate(() => {
            const img = document.querySelector('img[src*="base64"]');
            return img ? img.src : null;
        });
        
        await browser.close();
        
        if (imageData) {
            res.json({
                success: true,
                image: imageData
            });
        } else {
            throw new Error('No image found');
        }
        
    } catch (error) {
        console.error('Auto-generate error:', error);
        res.status(500).json({
            error: error.message
        });
    }
});
```

### Bước 4: App gọi endpoint mới

```typescript
// App.tsx
const response = await fetch('http://localhost:3001/api/genyu/auto-generate', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        prompt: fullPrompt,
        projectId: '62c5b3fe-4cf4-42fe-b1b2-f621903e7e23'
    })
});

const data = await response.json();
if (data.success) {
    onSave(data.image);
    alert('✅ Generated successfully!');
}
```

## Ưu điểm

✅ **Không cần CORS bypass** - Server điều khiển browser thật
✅ **Không cần capture reCAPTCHA** - Browser tự solve reCAPTCHA
✅ **Không cần OAuth token** - Dùng cookies session
✅ **100% giống user thật** - Ít bị block
✅ **Dễ debug** - Có thể xem browser hoạt động (headless: false)

## Nhược điểm

⚠️ Chậm hơn API call trực tiếp (15-30s)
⚠️ Cần maintain cookies session
⚠️ Tốn tài nguyên server hơn

## Alternative: Playwright

Nếu Puppeteer không work, dùng Playwright (tương tự nhưng robust hơn):

```bash
npm install playwright
npx playwright install chromium
```

```javascript
const { chromium } = require('playwright');

const browser = await chromium.launch();
// ... tương tự Puppeteer
```

## Next Steps

1. Install Puppeteer
2. Implement cookie saving từ Extension
3. Implement auto-generate endpoint
4. Test với headless: false để debug
5. Optimize selectors và timing
6. Switch to headless: true khi stable

Bạn muốn tôi implement solution này không?
