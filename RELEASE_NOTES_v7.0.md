# 🚀 Genyu Update Release v7.0

## 📦 Các thay đổi chính (Changelog)

### 1. Server (Backend)
- **Puppeteer Integration**: Thêm module tự động điều khiển browser để tạo ảnh.
- **Queue System**: Thêm cơ chế hàng đợi để xử lý yêu cầu tạo ảnh tuần tự.
- **API Mới**: `/api/genyu/auto-generate` để trigger tạo ảnh qua Puppeteer.
- **On-Demand Token**: API request/response để lấy reCAPTCHA token tươi từ Extension khi cần.

### 2. Chrome Extension (v7.0)
- **Cơ chế Polling**: Extension tự động kiểm tra server mỗi 2 giây xem có yêu cầu lấy token nào không.
- **Auto-Generate reCAPTCHA**: Tự động chạy lệnh `grecaptcha.enterprise.execute` khi Server yêu cầu và gửi token về.
- **Permissions**: Cập nhật manifest để cho phép scripting trên `labs.google.com`.

### 3. Frontend (React App)
- **AsyncQueue**: Thêm helper để xếp hàng đợi cho các tác vụ tạo ảnh hàng loạt.
- **Puppeteer Integration**: Endpoint `performImageGeneration` giờ gọi qua Puppeteer thay vì API trực tiếp cũ.
- **Error Handling**: Cải thiện xử lý lỗi và fallback.

---

## 🛠 Hướng dẫn Cài đặt & Chạy lại (QUAN TRỌNG)

Để bản update hoạt động, bạn CẦN thực hiện các bước sau:

### Bước 1: Restart Server Node.js
Do có thay đổi file `index.js` và thêm modules mới.
```bash
# Tại terminal đang chạy server
Ctrl + C
cd "/Users/dangle/Desktop/Antigrafity/BlogAI/Testing Cookie/server"
node index.js
```

### Bước 2: Reload Chrome Extension
Do update lên v7.0.
1. Mở `chrome://extensions`
2. Tìm **Genyu On-Demand reCAPTCHA**
3. Nhấn nút **Reload** (icon vòng tròn mũi tên)
4. Đảm bảo phiên bản hiển thị là **7.0**

### Bước 3: Chuẩn bị Môi trường Browser
1. Mở một tab mới và truy cập: `https://labs.google.com/fx/vi/tools/flow/project/62c5b3fe-4cf4-42fe-b1b2-f621903e7e23`
2. Đăng nhập Google nếu chưa.
3. Giữ tab này mở để Extension có thể hoạt động (nó cần context của trang này để lấy reCAPTCHA).

### Bước 4: Chạy App
Reload trang `http://localhost:3000` và thử tính năng **Tạo nhân vật** hoặc **Tạo ảnh hàng loạt**.

---

## ⚠️ Lưu ý
- **Tốc độ**: Tạo ảnh qua Puppeteer sẽ chậm hơn API trực tiếp một chút (do phải thao tác browser thật), nhưng ổn định hơn nhiều.
- **Tab Google Labs**: Luôn giữ ít nhất 1 tab Google Labs mở để Extension hoạt động tối ưu.
