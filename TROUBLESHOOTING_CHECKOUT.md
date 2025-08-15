# Troubleshooting Checkout Error

## Problem
When clicking "Buy More Credits", the application shows:
```
Error starting checkout: Server did not return JSON. Response: <!doctype html>...
```

## Root Cause
The frontend is expecting a JSON response from the API endpoint `/api/create-checkout-session`, but instead receives an HTML page. This typically happens when:

1. **API endpoint is not accessible** - The server is not running or the endpoint doesn't exist
2. **Wrong API URL** - The frontend is calling the wrong URL
3. **Server serving static files** - The server falls back to serving `index.html` for unmatched routes
4. **CORS issues** - The request is being blocked
5. **Authentication issues** - The token is invalid or missing

## Debugging Steps

### 1. Check API Configuration
Open browser console and run:
```javascript
// Check current API configuration
console.log('API_BASE_URL:', API_BASE_URL);
console.log('Current hostname:', window.location.hostname);
```

### 2. Test API Endpoints
Run the API test script:
```bash
npm run test:api
```

### 3. Check Server Status
Make sure the server is running:
```bash
npm run server
```

### 4. Verify Environment Variables
Check that these environment variables are set:
- `JWT_SECRET`
- `MISTRAL_API_KEY`
- `STRIPE_SECRET_KEY` (for checkout functionality)

### 5. Test API Manually
In browser console, test the API directly:
```javascript
// Test health endpoint
fetch('http://localhost:4002/api/health')
  .then(r => r.json())
  .then(console.log);

// Test checkout endpoint (without auth)
fetch('http://localhost:4002/api/test-checkout')
  .then(r => r.json())
  .then(console.log);
```

## Solutions

### For Development
1. **Start the server**: `npm run server`
2. **Check API URL**: Verify `src/config/api.js` has correct development URL
3. **Test endpoints**: Run `npm run test:api`

### For Production Deployment
1. **Update API URL**: Edit `src/config/api.js` with your backend URL
2. **Deploy backend**: Ensure your backend is running on the correct domain
3. **Check CORS**: Verify backend allows requests from your frontend domain
4. **Test connectivity**: Use browser console to test API endpoints

### Common Fixes

#### Fix 1: Update API Configuration
Edit `src/config/api.js`:
```javascript
production: {
  baseUrl: 'https://your-backend-domain.com/api',
  timeout: 30000,
},
```

#### Fix 2: Check Server Routes
Ensure the server has the correct route:
```javascript
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
  // ... checkout logic
});
```

#### Fix 3: Verify Authentication
Check that the user is properly authenticated:
```javascript
// In browser console
localStorage.getItem('token'); // Should return a valid token
```

#### Fix 4: Test with curl
Test the API endpoint directly:
```bash
curl -X POST http://localhost:4002/api/create-checkout-session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Prevention

1. **Always test API endpoints** before deploying
2. **Use the test script**: `npm run test:api`
3. **Check browser console** for detailed error messages
4. **Verify environment variables** are set correctly
5. **Test authentication flow** before testing checkout

## Support

If the issue persists:
1. Check browser console for detailed error messages
2. Run `npm run test:api` and share the output
3. Verify your backend deployment is working
4. Test with a simple curl command to isolate the issue 