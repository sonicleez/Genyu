# Debug Instructions

## Kiểm tra Chrome Version
1. Mở tab mới
2. Gõ: `chrome://version`
3. Xem dòng "Google Chrome" - cần version >= 111

## Kiểm tra Extension Errors
1. Mở `chrome://extensions`
2. Tìm "Genyu Token Helper"
3. Click "Errors" (nếu có nút màu đỏ)
4. Copy toàn bộ error message

## Kiểm tra Background Service Worker
1. `chrome://extensions`
2. Click "service worker" (link xanh)
3. Xem Console tab
4. Copy toàn bộ lỗi (nếu có màu đỏ)

## Kiểm tra Tab labs.google.com
1. Mở labs.google.com
2. F12 → Console
3. Generate 1 ảnh
4. Copy toàn bộ log (cả màu xanh và đỏ)

## Test nhanh
Paste command này vào Console của tab labs.google.com:

```javascript
window.postMessage({ type: 'GENYU_TOKEN', body: { test: 'hello' } }, '*');
```

Sau đó check background service worker xem có nhận message không.
