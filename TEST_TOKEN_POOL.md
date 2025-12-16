# 🧪 TEST TOKEN POOL

## Bước 1: Reload Extension
```
chrome://extensions → Reload "Genyu Token Pool"
```

## Bước 2: Mở Extension Console
```
chrome://extensions → Click "Service Worker"
```

Phải thấy:
```
[Token Pool] ✅ Added token (Pool size: 1)
[Token Pool] 📤 Synced 1 tokens to server
[Token Pool] ✅ Added token (Pool size: 2)
[Token Pool] 📤 Synced 2 tokens to server
...
```

## Bước 3: Kiểm tra Server nhận Pool
```bash
curl http://localhost:3001/api/tokens | jq '.tokenPool'
```

Kết quả mong đợi:
```json
[
  {
    "token": "03AFcWeA...",
    "age": 5
  },
  {
    "token": "03AFcWeA...",
    "age": 10
  },
  {
    "token": "03AFcWeA...",
    "age": 15
  }
]
```

## Bước 4: Kiểm tra Pool Size
```bash
curl http://localhost:3001/api/tokens | jq '.poolSize'
```

Kết quả: Số lượng tokens (ví dụ: `3`, `5`, `10`...)

## Bước 5: Xem Full Response
```bash
curl -s http://localhost:3001/api/tokens | jq '.'
```

Phải có:
- ✅ `sessionToken`: "eyJhbGc..."
- ✅ `tokenPool`: [...]
- ✅ `poolSize`: 3

## Bước 6: Test trên App

Mở App → Modal "Genyu Token & Extension"

Phải thấy:
- ✅ Extension Active (màu xanh)
- ✅ reCAPTCHA Token Pool: **X tokens** (thay vì 1 token)
- ✅ Danh sách tokens với age

## Nếu không thấy Pool

### Check Extension Console:
```javascript
// Paste vào Extension console:
console.log('Pool:', TOKEN_POOL);
console.log('Pool size:', TOKEN_POOL.length);
```

### Force sync:
```javascript
// Paste vào Extension console:
syncPoolToServer();
```

### Manual generate:
```javascript
// Paste vào Extension console:
generateAndPoolToken();
```

## Debug

### Server logs:
```bash
tail -f /tmp/server.log
```

Phải thấy:
```
📥 Token pool updated: 3 tokens
📥 Token pool updated: 4 tokens
...
```

### Extension logs:
Phải thấy mỗi 5s:
```
[Token Pool] ✅ Added token (Pool size: X)
[Token Pool] 📤 Synced X tokens to server
```

## Success Criteria

- [ ] Extension console hiện "Synced X tokens"
- [ ] `curl /api/tokens` trả về `tokenPool` array
- [ ] `poolSize` > 0
- [ ] App modal hiển thị số lượng tokens
- [ ] Mỗi 5s pool tăng thêm 1 token
