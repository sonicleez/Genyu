# ⚡ QUICK TEST - On-Demand reCAPTCHA

## ✅ Setup đã hoàn tất:
- ✅ Server v7.0 (với on-demand endpoints)
- ✅ Extension v7.0 (polling + generate)
- ✅ Helper function (requestFreshRecaptcha)

## 📝 Test ngay (3 bước):

### Bước 1: Reload Extension v7.0
```
chrome://extensions
→ Remove "Genyu..." extension
→ Load unpacked → Chọn /genyu-extension
→ Should see: "Genyu On-Demand reCAPTCHA v7.0"
```

### Bước 2: Mở labs.google.com
```
https://labs.google.com/fx/vi/tools/flow/project/62c5b3fe-4cf4-42fe-b1b2-f621903e7e23
```

**Check Extension hoạt động:**
- Click Extension icon → Service Worker → Inspect
- Should see: "✅ Ready - Polling for token requests every 2s"

### Bước 3: Test với curl

**Terminal 1 - Request token:**
```bash
curl -X POST http://localhost:3001/api/genyu/request-fresh-token
```

**Expect:**
```json
{
  "success": true,
  "requestId": "req_1765874...",
  "message": "Extension will generate token shortly"
}
```

**Extension logs sẽ show:**
```
🔔 Pending token request detected: ["req_1765874..."]
🔑 Generating fresh reCAPTCHA for request: req_1765874...
✅ Token generated: 03AHaCkAa0... (1636 chars)
✅ Token submitted: {success: true}
```

**Terminal 2 - Get token (dùng requestId từ step trên):**
```bash
curl http://localhost:3001/api/genyu/wait-for-token/req_1765874...
```

**Expect:**
```json
{
  "success": true,
  "token": "03AHaCkAa0..."
}
```

## 🎯 Nếu test thành công:

Extension code đang dùng ĐÚNG:
```javascript
const token = await grecaptcha.enterprise.execute(
    "6LdsFiUsAAAAAIjVDZcuLhaHiDn5nnHVXVRQGeMV",
    { action: "FLOW_GENERATION" }
);
```

✅ Fresh token generated on-demand
✅ Token length ~1600-1700 chars
✅ Ready to integrate vào App!

## 🐛 Troubleshooting

### Extension không polling:
- Check Service Worker running (blue badge)
- Reload Extension

### "No labs.google.com tab found":
- Mở tab labs.google.com
- Tab phải load xong (có grecaptcha)

### Timeout:
- Extension có permission "tabs" + "scripting"
- Server đang chạy (port 3001)

## 📋 Ready cho production:

File: `ON_DEMAND_RECAPTCHA.md` có hướng dẫn integrate vào App.
```typescript
import { requestFreshRecaptcha } from './utils/recaptchaHelper';

const token = await requestFreshRecaptcha(); // ✅ Fresh token!
```

Test ngay!
