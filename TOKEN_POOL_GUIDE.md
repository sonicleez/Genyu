# 🎯 TOKEN POOL SYSTEM v8.0

## Tính năng mới

Extension giờ sẽ **TỰ ĐỘNG** generate và lưu trữ reCAPTCHA tokens:

- ✅ Tự động generate token mỗi **5 giây**
- ✅ Lưu trữ trong pool (tối đa **90 giây**)
- ✅ Khi cần dùng → lấy token mới nhất
- ✅ Sau khi dùng → tự động xóa
- ✅ Token cũ → tự động dọn dẹp

## Cách hoạt động

```
┌─────────────────────────────────────────┐
│  Extension (Background)                 │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  TOKEN POOL                      │  │
│  │  [Token1] age: 5s  ✓ unused     │  │
│  │  [Token2] age: 10s ✓ unused     │  │
│  │  [Token3] age: 15s ✓ unused     │  │
│  └──────────────────────────────────┘  │
│                                         │
│  Auto-generate every 5s ──────────────┐│
│  Auto-clean old tokens (>90s) ────────┘│
└─────────────────────────────────────────┘
           │
           │ When App needs token
           ▼
    Get newest unused token
           │
           ▼
    Mark as "used" → Auto-delete later
```

## Setup

### 1. Reload Extension
```
chrome://extensions → Reload "Genyu Token Pool"
```

### 2. Mở tab Google Labs
```
https://labs.google.com
```
(Extension cần tab này để generate tokens)

### 3. Kiểm tra Console
```
[Token Pool] 🔄 Auto-generating tokens every 5s
[Token Pool] ✅ Added token (Pool size: 1)
[Token Pool] ✅ Added token (Pool size: 2)
...
```

### 4. Sử dụng trong App
App sẽ tự động lấy token từ pool khi cần!

## API

### Get Token from Pool
```javascript
// In Extension context
chrome.runtime.sendMessage(
  { type: 'GET_RECAPTCHA_TOKEN' },
  (response) => {
    console.log('Token:', response.token);
  }
);
```

### Get Pool Status
```javascript
chrome.runtime.sendMessage(
  { type: 'GET_POOL_STATUS' },
  (response) => {
    console.log('Available tokens:', response.availableTokens);
    console.log('Total tokens:', response.totalTokens);
  }
);
```

## Lợi ích

### Trước (v7.0):
```
User click "Tạo ảnh"
  → App request token
  → Extension generate (2-3s)
  → Return token
  → App call API
  → Image generated
Total: ~5-8s
```

### Sau (v8.0):
```
User click "Tạo ảnh"
  → App get token from pool (instant!)
  → App call API
  → Image generated
Total: ~2-3s
```

**Nhanh hơn 2-3 lần!** 🚀

## Monitoring

### Check pool size
```javascript
// In Extension console
console.log('Pool:', TOKEN_POOL.length);
console.log('Available:', TOKEN_POOL.filter(t => !t.used).length);
```

### Manual generate
```javascript
// In Extension console
generateAndPoolToken();
```

### Clear pool
```javascript
// In Extension console
TOKEN_POOL.length = 0;
```

## Troubleshooting

### Pool không tăng?
- ✅ Check tab labs.google.com có mở không
- ✅ Check console có lỗi không
- ✅ Reload extension

### Token hết quá nhanh?
- Tăng `GENERATE_INTERVAL` (hiện tại 5s)
- Tăng `MAX_TOKEN_AGE` (hiện tại 90s)

### Muốn generate nhanh hơn?
```javascript
// Trong background.js, đổi:
const GENERATE_INTERVAL = 3000; // 3 seconds thay vì 5
```

## Next Steps

1. ✅ Reload Extension
2. ✅ Mở labs.google.com
3. ✅ Đợi pool có ít nhất 2-3 tokens
4. ✅ Thử tạo ảnh → Sẽ nhanh hơn rất nhiều!
