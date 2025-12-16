# 🔍 HƯỚNG DẪN KIỂM TRA VÀ SỬA LỖI

## Vấn đề hiện tại
Extension chưa gửi token về server → Server không có token → Không thể gọi Google Labs API

## ✅ BƯỚC KIỂM TRA

### 1. Kiểm tra Extension có đang chạy không
```
1. Mở chrome://extensions
2. Tìm "Genyu On-Demand reCAPTCHA"
3. Kiểm tra:
   - ✅ Extension được BẬT (toggle màu xanh)
   - ✅ Version hiển thị là 7.0
   - ✅ Không có lỗi đỏ
```

### 2. Xem Extension Background Logs
```
1. Trong chrome://extensions
2. Tìm extension "Genyu On-Demand"
3. Click "Service Worker" (hoặc "background page")
4. Xem console logs

EXPECT:
[Genyu BG] Background v7.0 - On-Demand Token Generator
[Genyu BG] ✅ Ready - Polling for tokens + Auto-saving Cookies + Auto-updating Session Token
[Genyu Token] ✅ Session token updated on server  <-- QUAN TRỌNG!
```

### 3. Trigger Extension gửi token
```
1. Mở tab mới: https://labs.google.com
2. Đăng nhập Google (nếu chưa)
3. Đợi trang load xong
4. Refresh lại trang (F5)
5. Kiểm tra Extension console → phải thấy log "[Genyu Token] ✅..."
```

### 4. Verify token đã về server
```bash
# Chạy lệnh này trong terminal:
curl http://localhost:3001/api/tokens

# EXPECT (nếu thành công):
{
  "sessionToken": "eyJhbGc...",  <-- PHẢI CÓ GIÁ TRỊ
  "hasRecaptcha": false,
  ...
}

# HIỆN TẠI (lỗi):
{
  "sessionToken": null,  <-- NULL = CHƯA CÓ TOKEN
  ...
}
```

## 🔧 CÁCH SỬA

### Nếu Extension không gửi token:

**Option 1: Reload Extension**
```
1. chrome://extensions
2. Tìm Genyu extension
3. Click nút RELOAD (vòng tròn mũi tên)
4. Đợi 5 giây
5. Mở tab labs.google.com
6. Check lại curl http://localhost:3001/api/tokens
```

**Option 2: Reinstall Extension**
```
1. chrome://extensions
2. Remove extension cũ
3. Click "Load unpacked"
4. Chọn folder: /Users/dangle/Desktop/Antigrafity/BlogAI/genyu-extension
5. Mở labs.google.com
6. Check token
```

**Option 3: Manual trigger (nếu vẫn không tự động)**
```javascript
// Mở Extension Background console
// Paste và chạy lệnh này:
checkAndSendToken();

// Hoặc:
saveAllCookies();
```

## 🧪 TEST ENDPOINT PROXY (sau khi có token)

```bash
# 1. Lấy token từ server
TOKEN=$(curl -s http://localhost:3001/api/tokens | jq -r '.sessionToken')

# 2. Test endpoint proxy
curl -X POST http://localhost:3001/api/proxy/genyu/image \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"prompt\": \"A cute orange cat\",
    \"aspect\": \"IMAGE_ASPECT_RATIO_SQUARE\"
  }"

# EXPECT: JSON response với image data
# KHÔNG EXPECT: 400/403 error
```

## 📊 CHECKLIST ĐẦY ĐỦ

- [ ] Extension đang chạy (v7.0)
- [ ] Extension Background console có log "Token updated"
- [ ] Tab labs.google.com đang mở và đã login
- [ ] `curl http://localhost:3001/api/tokens` trả về sessionToken != null
- [ ] Server đang chạy (port 3001)
- [ ] Test endpoint proxy thành công

## ❓ NẾU VẪN LỖI

Gửi cho tôi:
1. Screenshot Extension Background console
2. Output của: `curl http://localhost:3001/api/tokens`
3. Lỗi cụ thể trong Browser console khi click "Tạo FaceID + Body"
