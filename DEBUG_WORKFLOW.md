# 🔍 DEBUG WORKFLOW - Character Generation

## 📋 Workflow Overview

```
Extension → reCAPTCHA Token → Server Pool → App Request → Google API → Response
```

## 🧪 Testing Steps

### 1. Check Extension Token Generation

**Extension Console** (`chrome://extensions` → Service Worker):

```
✅ Expected logs:
[Token Pool] ✅ Added token (Pool size: X)
[Token Pool] 🔄 Syncing X tokens to server...
[Token Pool] ✅ Synced X tokens to server (Server pool size: X)

❌ Error logs to watch:
[Token Pool] ❌ Sync failed: 500 Internal Server Error
[Token Pool] ❌ Sync error: Failed to fetch
```

**Debug commands**:
```javascript
// Paste in Extension console:
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (r) => console.log(r));
```

### 2. Check Server Token Pool

**Terminal**:
```bash
# Check pool size
curl -s http://localhost:3001/api/tokens | jq '.poolSize'

# Check tokens (first 3)
curl -s http://localhost:3001/api/tokens | jq '.tokenPool[0:3]'

# Check session token
curl -s http://localhost:3001/api/tokens | jq '.sessionToken' | head -c 50
```

**Expected**:
- `poolSize`: > 0 (e.g., 15-20)
- `tokenPool`: Array of `{token, age}`
- `sessionToken`: `"ya29.a0...` (OAuth token, NOT `"eyJhbGci...` JWT)

### 3. Check App Request

**Browser Console** (F12 on App):

When generating character, watch for:

```
✅ Expected:
Using Genyu Proxy for Character Gen...
Genyu Scene Response: {submissionResults: [...]}

❌ Error patterns:
POST http://localhost:3001/api/proxy/genyu/image 400 (Bad Request)
  → Check: Token missing in request
  
POST http://localhost:3001/api/proxy/genyu/image 401 (Unauthorized)
  → Check: Session token expired (get new from Labs)
  
POST http://localhost:3001/api/proxy/genyu/image 403 (Forbidden)
  → Check: reCAPTCHA token invalid or reused
```

### 4. Check Server Logs

**Terminal** (where server is running):

```
✅ Expected logs:
[abc123] 📥 Incoming image generation request
[abc123] 📋 Request details:
  - Token: ya29.a0Aa7pCA9mr0E0...
  - reCAPTCHA: 0cAFcWeA5AbXRNrgDY...
  - Prompt: Create an extreme clos...
  - Aspect: IMAGE_ASPECT_RATIO_PORTRAIT
[abc123] 🚀 Calling Google Labs API...
[abc123] 📡 Google response: 200 OK
[abc123] ✅ Success! Response keys: [ 'submissionResults', 'workflows' ]
[abc123]    - submissionResults: 1 items

❌ Error logs:
[abc123] ❌ Token missing!
  → Fix: App not sending token
  
[abc123] 📡 Google response: 401 Unauthorized
  → Fix: Session token expired, get new from Labs
  
[abc123] 📡 Google response: 403 Forbidden
  → Fix: reCAPTCHA token reused or invalid
  
[abc123] ❌ Google API Error: {"error": {"code": 403, "message": "..."}}
  → Fix: Check Google API response for details
```

## 🐛 Common Issues

### Issue 1: Pool Size = 0

**Symptoms**:
```bash
curl -s http://localhost:3001/api/tokens | jq '.poolSize'
# Returns: 0
```

**Causes**:
- Extension not running
- No `labs.google` tab open
- Extension generation stopped

**Fix**:
1. Open Extension popup → Check status
2. If stopped, click "Start"
3. Open `https://labs.google/fx/tools/flow`
4. Wait 5-10 seconds for tokens to generate

### Issue 2: Session Token = JWT (eyJhbGci...)

**Symptoms**:
```bash
curl -s http://localhost:3001/api/tokens | jq '.sessionToken'
# Returns: "eyJhbGciOiJkaXIi..."
```

**Causes**:
- Extension intercepting wrong cookie
- Manual token not saved

**Fix**:
1. Get fresh OAuth token from Labs:
   - Open `https://labs.google/fx/tools/flow`
   - F12 → Network → Create image
   - Find `batchGenerateImages` request
   - Copy `authorization: Bearer ya29...`
2. Paste into App modal "Session Token"
3. Click "Save & Close"

### Issue 3: 403 Forbidden

**Symptoms**:
```
POST /api/proxy/genyu/image 403 (Forbidden)
```

**Causes**:
- reCAPTCHA token reused
- reCAPTCHA token too old (> 90s)
- Token pool empty

**Fix**:
1. Check pool size: `curl -s http://localhost:3001/api/tokens | jq '.poolSize'`
2. If pool empty, wait for Extension to generate
3. If pool has tokens, check token age:
   ```bash
   curl -s http://localhost:3001/api/tokens | jq '.tokenPool[0].age'
   ```
4. If age > 90, tokens are stale → Restart Extension

### Issue 4: No Image in Response

**Symptoms**:
```
[abc123] ✅ Success! Response keys: [ 'workflows' ]
```
(No `submissionResults` or `media`)

**Causes**:
- Google API returned workflow ID instead of image
- Image still processing

**Fix**:
- Check App code for workflow polling logic
- May need to poll `/workflows/{id}` endpoint

## 📊 Health Check Script

```bash
#!/bin/bash
echo "=== Extension Token Pool ==="
curl -s http://localhost:3001/api/tokens | jq '{poolSize, sessionToken: (.sessionToken | if . then .[0:30] else "null" end)}'

echo "\n=== First Token Age ==="
curl -s http://localhost:3001/api/tokens | jq '.tokenPool[0].age'

echo "\n=== Server Status ==="
curl -s http://localhost:3001/api/tokens | jq '{extensionActive, hasRecaptcha}'
```

Save as `health-check.sh`, run with `bash health-check.sh`

## 🎯 Quick Fixes

**Extension not syncing?**
```javascript
// Force sync in Extension console:
syncPoolToServer();
```

**Need fresh token NOW?**
```bash
# Get from Labs Network tab, then:
curl -X POST http://localhost:3001/api/update-tokens \
  -H 'Content-Type: application/json' \
  -d '{"sessionToken":"ya29.YOUR_TOKEN_HERE"}'
```

**Server not responding?**
```bash
# Check if running:
lsof -i :3001

# Restart:
pkill -f "node.*index.js"
cd "Testing Cookie/server" && node index.js &
```
