# 🔧 Genyu Token Helper Extension - Debug Guide

## 📋 Checklist

### 1. Server Status ✅
```bash
# Check if server is running
curl http://localhost:3001/api/tokens

# Should see: {"hasRecaptcha":false,...}
# If connection refused, start server:
cd "Testing Cookie/server" && node index.js &
```

### 2. Extension Installation
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select folder: `genyu-extension`
5. Should see: **Genyu Token Helper v2.4**

### 3. Test Extension

#### A. Test Page Method
1. Open `genyu-extension/test.html` in Chrome
2. Open Console (F12)
3. You should see:
   - `[Genyu MAIN] Interceptor loaded`
4. Click "Test Fetch Interception"
5. Check console for `[Genyu MAIN] API call: ...`

#### B. Real Labs.google.com Method
1. Open `https://labs.google.com/fx/tools/pinhole`
2. Open Console (F12)
3. You should see:
   ```
   [Genyu MAIN] Interceptor loaded on: labs.google.com
   [Genyu MAIN] Fetch interceptor installed
   ```
4. Generate 1 image
5. Look for:
   ```
   [Genyu MAIN] API call: https://aisandbox-pa.googleapis.com/...
   [Genyu MAIN] **** CAPTURED REQUEST ****
   [Genyu Content] Received capture, forwarding to background...
   ```

### 4. Extension Popup Debug
1. Click Extension icon (puzzle piece in Chrome toolbar)
2. Click **Genyu Token Helper**
3. Popup should show:
   - 🟢 Server Connection: **✅ Connected**
   - Extension Token: Should change to **✅ Has Token** after capture

### 5. Check Background Service Worker
1. Go to `chrome://extensions`
2. Find **Genyu Token Helper**
3. Click **service worker** (blue link)
4. New DevTools window opens
5. Check Console tab for logs

## 🐛 Common Issues

### Issue: "Extension Disconnected" in App
**Cause**: Server not running or Extension not capturing
**Fix**:
1. Start server: `cd server && node index.js &`
2. Reload extension
3. Refresh labs.google.com

### Issue: No `[Genyu MAIN]` logs
**Cause**: Chrome version < 102 doesn't support `world: "MAIN"`
**Fix**: Update Chrome to latest version

### Issue: "Server Connection: ❌ Offline"
**Cause**: Server crashed or not started
**Fix**: 
```bash
# Kill old server
pkill -f "node index.js"
# Start new
cd "Testing Cookie/server" && node index.js &
```

### Issue: CSP errors in console
**Cause**: Old extension code
**Fix**: Make sure you're using v2.4 with `world: "MAIN"`

## 📊 Expected Flow

```
1. User generates image on labs.google.com
   ↓
2. inject.js (MAIN world) intercepts fetch()
   ↓
3. window.postMessage() → content.js
   ↓
4. chrome.runtime.sendMessage() → background.js
   ↓
5. background.js extracts token
   ↓
6. POST to localhost:3001/api/update-tokens
   ↓
7. Server stores token in EXTENSION_TOKENS
   ↓
8. App fetches from localhost:3001/api/tokens
   ✅ SUCCESS
```

## 🔍 Manual Debug Steps

1. **Check all files exist**:
   ```bash
   ls genyu-extension/
   # Should see: manifest.json, inject.js, content.js, background.js, popup.html, popup.js
   ```

2. **Verify inject.js syntax**:
   ```bash
   node -c genyu-extension/inject.js
   # Should be silent (no errors)
   ```

3. **Test server endpoint manually**:
   ```bash
   # Send test token
   curl -X POST http://localhost:3001/api/update-tokens \
     -H "Content-Type: application/json" \
     -d '{"recaptchaToken":"TEST123","projectId":"test"}'
   
   # Check it's stored
   curl http://localhost:3001/api/tokens
   ```

4. **Check Chrome version**:
   - `chrome://version`
   - Need version >= 102 for `world: "MAIN"`
