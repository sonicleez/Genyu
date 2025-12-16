# 🎯 ON-DEMAND reCAPTCHA Generation Flow

## Flow hoạt động

```
1. User clicks "Generate Character" in App
   ↓
2. App calls requestFreshRecaptcha()
   ↓  
3. Helper function:
   POST /api/genyu/request-fresh-token
   → Server creates pending request with ID
   ↓
4. Extension polling (every 2s):
   GET /api/genyu/check-pending-requests
   → Sees pending request
   ↓
5. Extension:
   - Finds labs.google.com tab
   - Executes: grecaptcha.enterprise.execute(...)
   - Gets fresh token
   ↓
6. Extension submits:
   POST /api/genyu/submit-fresh-token
   {requestId, token}
   ↓
7. Helper function waiting:
   GET /api/genyu/wait-for-token/:requestId
   → Receives token (or timeout after 15s)
   ↓
8. App uses fresh token to generate image
   ↓
✅ SUCCESS!
```

## Setup

### 1. Restart server
```bash
cd "Testing Cookie/server"
pkill -f "node index.js"
node index.js &
```

### 2. Reload Extension v7.0
```
chrome://extensions
→ Remove old
→ Load unpacked: genyu-extension
```

### 3. Open labs.google.com tab
**QUAN TRỌNG**: Phải có tab labs.google.com đang mở!
```
https://labs.google.com/fx/vi/tools/flow/project/62c5b3fe-4cf4-42fe-b1b2-f621903e7e23
```

### 4. Check Extension is polling
```
chrome://extensions → Genyu → Service Worker → Inspect
Should see: "✅ Ready - Polling for token requests every 2s"
```

## Test Flow

### Test 1: Request token manually
```bash
# Create request
curl -X POST http://localhost:3001/api/genyu/request-fresh-token

# Response: {"requestId": "req_123..."}

# Extension will see this and generate token (check Extension logs)

# Wait for token
curl http://localhost:3001/api/genyu/wait-for-token/req_123...

# Response: {"success": true, "token": "..."}
```

### Test 2: Use in App

File: `App.tsx` - Add import:
```typescript
import { requestFreshRecaptcha } from './utils/recaptchaHelper';
```

In `handleGenerate` function:
```typescript
const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
        // 🔑 REQUEST FRESH RECAPTCHA FROM EXTENSION
        const recaptchaToken = await requestFreshRecaptcha();
        console.log('✅ Got fresh token, length:', recaptchaToken.length);
        
        // Now use token to generate image...
        const response = await fetch('http://localhost:3001/api/proxy/genyu/image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: fullPrompt,
                recaptchaToken: recaptchaToken,
                // ... other params
            })
        });
        
        // ... handle response
        
    } catch (error) {
        console.error('Generation failed:', error);
        alert('❌ ' + error.message);
    } finally {
        setIsGenerating(false);
    }
};
```

## Troubleshooting

### Extension không nhận request
- ✅ Check Service Worker đang chạy
- ✅ Check polling logs (should run every 2s)
- ✅ Server phải đang chạy

### Timeout (15s)
- ✅ labs.google.com tab phải đang mở
- ✅ Tab đã load xong (grecaptcha available)
- ✅ Extension có permission tabs + scripting

### Token invalid
- ✅ Verify token có đúng format không
- ✅ Check token length (~1600 chars)

## Timing

- Extension polls: Every 2s
- Server wait timeout: 15s
- Typical token generation: 1-3s

**Total time from click to token**: ~3-5 seconds

## Next Steps

1. ✅ Restart server
2. ✅ Reload Extension v7.0  
3. ✅ Open labs.google.com tab
4. ✅ Test with curl
5. ✅ Integrate into App
6. 🎉 DONE!
