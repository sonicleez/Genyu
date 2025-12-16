# 🎮 Extension v8.1 - UI Controls

## ✨ Tính năng mới

### 1. **Start/Stop Button**
- ▶️ **Start**: Bắt đầu auto-generate tokens
- ⏸️ **Stop**: Tạm dừng generation (giữ tokens hiện tại)

### 2. **Configurable Interval**
- Đặt thời gian giữa các lần generate (3-60 giây)
- Mặc định: 5 giây
- Thay đổi ngay lập tức khi đang chạy

### 3. **Real-time Status**
- 🟢 **Running**: Đang auto-generate
- 🔴 **Stopped**: Đã tạm dừng
- **Pool Size**: Số lượng tokens hiện có
- **Current Interval**: Thời gian generate hiện tại

## 🚀 Hướng dẫn sử dụng

### Bước 1: Reload Extension
```
chrome://extensions
→ Tìm "Genyu Token Pool"
→ Click RELOAD
```

### Bước 2: Mở Popup
```
Click vào icon Extension trên toolbar
→ Popup sẽ hiện ra
```

### Bước 3: Cấu hình

**Thay đổi interval:**
1. Nhập số giây (3-60)
2. Click "Start" để áp dụng

**Tạm dừng:**
- Click "Stop" khi không cần generate nữa
- Tokens hiện tại vẫn được giữ

**Tiếp tục:**
- Click "Start" để generate tiếp

## 📊 UI Layout

```
┌─────────────────────────────┐
│  🎯 Genyu Token Pool v8.1  │
├─────────────────────────────┤
│  Status:    🟢 Running      │
│  Pool Size: 15 tokens       │
│  Interval:  5s              │
├─────────────────────────────┤
│  Generate Interval          │
│  [  5  ] seconds            │
│                             │
│  [⏸️ Stop Auto-Generate]    │
└─────────────────────────────┘
```

## ⚙️ Cài đặt khuyến nghị

### Tạo ảnh thường xuyên:
- **Interval**: 3-5 giây
- **Pool size**: 15-20 tokens

### Tạo ảnh ít:
- **Interval**: 10-15 giây
- **Pool size**: 5-10 tokens

### Tiết kiệm tài nguyên:
- **Stop** khi không dùng
- **Start** trước khi tạo ảnh

## 🔍 Debug

### Kiểm tra status:
```javascript
// Paste vào Extension console:
chrome.runtime.sendMessage(
  { type: 'GET_STATUS' },
  (response) => console.log(response)
);
```

### Force start:
```javascript
chrome.runtime.sendMessage({
  type: 'START_GENERATE',
  interval: 5000
});
```

### Force stop:
```javascript
chrome.runtime.sendMessage({ type: 'STOP_GENERATE' });
```

## 💡 Tips

1. **Mở tab labs.google** trước khi Start
2. **Interval quá nhỏ** (< 3s) có thể bị Google chặn
3. **Pool size lớn** (> 20) không cần thiết (tokens chỉ sống 90s)
4. **Stop khi không dùng** để tiết kiệm CPU

## 🎯 Next Steps

1. Reload Extension
2. Mở popup
3. Đặt interval (nếu cần)
4. Click Start
5. Đợi pool có >= 2 tokens
6. Tạo ảnh!
