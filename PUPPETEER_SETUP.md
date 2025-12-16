# 🤖 Puppeteer Auto-Generate - Setup Guide

## ✅ Đã hoàn tất

1. ✅ Installed Puppeteer
2. ✅ Created `puppeteer-genyu.js` module
3. ✅ Added endpoints to server
4. ✅ Updated Extension v5.0 to auto-save cookies
5. ✅ Server restarted

## 📝 Hướng dẫn test

### Bước 1: Reload Extension
```
1. chrome://extensions
2. Remove extension cũ
3. Load unpacked: genyu-extension folder
4. Should see "Genyu Puppeteer Helper v5.0"
```

### Bước 2: Mở labs.google.com để Extension save cookies
```
1. Mở https://labs.google.com
2. Login nếu chưa
3. Check Background Service Worker log:
   - Should see: "✅ Cookies saved to server: XX cookies"
```

### Bước 3: Test Puppeteer endpoint trực tiếp
```bash
curl -X POST http://localhost:3001/api/genyu/auto-generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a beautiful sunset over mountains",
    "projectId": "62c5b3fe-4cf4-42fe-b1b2-f621903e7e23"
  }'
```

**Expect**: 
- Browser sẽ mở ra (không headless để debug)
- Tự động navigate labs.google.com
- Nhập prompt
- Click Generate
- Đợi ảnh xong
- Return base64 image

### Bước 4: Sửa App.tsx để dùng endpoint mới

File: `App.tsx` - Function `handleGenerate`

Thay đổi từ:
```typescript
const response = await fetch('http://localhost:3001/api/proxy/genyu/image', {
    ...
});
```

Thành:
```typescript
const response = await fetch('http://localhost:3001/api/genyu/auto-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

## 🐛 Debug Tips

### Nếu browser không mở:
- Check Puppeteer installed: `ls node_modules/puppeteer`
- Check server logs

### Nếu cookies không save:
- Check Extension background logs
- Manually trigger: Navigate to labs.google.com

### Nếu không tìm được button/image:
- Selectors có thể sai
- Xem browser window (headless: false)
- Update selectors trong `puppeteer-genyu.js`

## ⚙️ Configuration

### Để chạy headless (production):
File: `puppeteer-genyu.js` line ~48
```javascript
headless: true, // Change from false to true
```

### Timeout settings:
- Navigate: 30s
- Button click: 10s
- Image wait: 60s

Adjust nếu cần trong file `puppeteer-genyu.js`

## 🎯 Next Steps

1. Test endpoint với curl
2. Nếu OK → Update App.tsx
3. Optimize selectors nếu cần
4. Switch to headless mode
5. Done! 🎉
