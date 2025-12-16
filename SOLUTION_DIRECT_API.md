# 🎯 GIẢI PHÁP CUỐI CÙNG: Direct Client-Side API Call

## Vấn đề hiện tại
- ❌ reCAPTCHA token chỉ dùng được **1 lần duy nhất**
- ❌ Extension capture token khi generate trên Labs → token đó đã bị "consume"
- ❌ Server proxy không thể reuse token đó

## ✅ Giải pháp
**Gọi trực tiếp Google Labs API từ browser** (client-side), không qua server proxy.

### Tại sao hoạt động?
1. Extension đã setup **CORS bypass** (declarativeNetRequest)
2. Browser có **same cookies** như labs.google.com
3. Không cần reCAPTCHA token riêng - dùng cookie session

## 📝 Cách triển khai

### Bước 1: Import directGenyuCall
File: `App.tsx` (dòng ~15)
```typescript
import { directGenyuCall } from './utils/genyuClient';
```

### Bước 2: Sửa handleGenerate trong CharacterGeneratorModal
File: `App.tsx` (dòng ~285-350)

Thay thế đoạn code Genyu Proxy (dòng 287-320) bằng:

```typescript
if (genyuToken) {
    console.log("Using Direct Genyu Call...");
    
    let genyuAspect = "IMAGE_ASPECT_RATIO_PORTRAIT";
    if (aspectRatio === "16:9") genyuAspect = "IMAGE_ASPECT_RATIO_LANDSCAPE";
    if (aspectRatio === "1:1") genyuAspect = "IMAGE_ASPECT_RATIO_SQUARE";
    if (aspectRatio === "4:3") genyuAspect = "IMAGE_ASPECT_RATIO_LANDSCAPE";
    
    try {
        // Fetch latest tokens from Extension
        const tokenData = await fetch('http://localhost:3001/api/tokens').then(r => r.json());
        
        // Direct call to Google Labs API (client-side)
        const result = await directGenyuCall({
            prompt: fullPrompt,
            aspect: genyuAspect,
            oauthToken: tokenData.oauthToken || genyuToken,
            recaptchaToken: tokenData.recaptchaToken,
            projectId: tokenData.projectId
        });
        
        if (result.success && result.images && result.images.length > 0) {
            currentImage = result.images[0];
        } else {
            throw new Error("No images returned from Genyu");
        }
    } catch (error) {
        console.error("Direct Genyu call failed:", error);
        // Fallback to Gemini
        console.log("Falling back to Gemini API...");
        genyuFailed = true;
    }
}
```

### Bước 3: Test
1. **Không cần generate trên Labs trước**
2. **Chỉ cần có OAuth token** trong Extension (từ lần generate trước đó)
3. App sẽ gọi trực tiếp API với cookies từ browser

## 🔧 Lưu ý quan trọng

### Extension cần có CORS bypass
Kiểm tra `genyu-extension/manifest.json` có:
```json
"permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestWithHostAccess"
]
```

Và file `genyu-extension/rules.json`:
```json
{
    "id": 1,
    "priority": 1,
    "action": {
        "type": "modifyHeaders",
        "responseHeaders": [
            {"header": "access-control-allow-origin", "operation": "set", "value": "*"}
        ]
    },
    "condition": {
        "urlFilter": "*://aisandbox-pa.googleapis.com/*",
        "resourceTypes": ["xmlhttprequest"]
    }
}
```

## 📊 Flow hoạt động

```
User clicks Generate in App
   ↓
App fetches latest tokens from localhost:3001/api/tokens
   ↓
App calls directGenyuCall() with OAuth token
   ↓
Browser sends request to aisandbox-pa.googleapis.com
   ✅ Uses browser's cookies (same session as labs.google.com)
   ✅ Extension's CORS rules bypass CORS
   ↓
Google API returns images
   ↓
✅ SUCCESS - Display in App
```

## ⚠️ Nếu vẫn lỗi

### Lỗi: CORS
→ Cần file `rules.json` và reload Extension

### Lỗi: 401 Unauthorized
→ OAuth token hết hạn, cần generate 1 ảnh trên Labs để refresh

### Lỗi: 403 Forbidden
→ Browser session hết hạn, cần login lại labs.google.com

## 🎯 Kết luận

**KHÔNG CẦN** server proxy nữa!  
**KHÔNG CẦN** capture reCAPTCHA token riêng!  
**CHỈ CẦN** OAuth token + browser cookies!

Extension chỉ cần:
1. Capture OAuth token (từ Authorization header)
2. Setup CORS bypass
3. Browser tự sử dụng cookies của labs.google.com!
