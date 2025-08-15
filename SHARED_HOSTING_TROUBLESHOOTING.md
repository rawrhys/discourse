# Shared Hosting Troubleshooting Guide

This guide helps you fix common issues when deploying the LMS Generator to shared hosting.

## 🔍 Quick Diagnosis

### 1. Check if the API is accessible
Visit: `https://yourdomain.com/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "mistralApiKey": "configured",
  "jwtSecret": "configured"
}
```

### 2. Check browser console for errors
Open Developer Tools (F12) and look for:
- Network errors (404, 500, CORS errors)
- JavaScript errors
- API connection failures

## 🚨 Common Issues & Solutions

### Issue 1: "AI service is not configured" Error

**Symptoms:**
- Course generation fails with "AI service is not configured"
- Error message mentions MISTRAL_API_KEY

**Solutions:**

1. **Create/Update .env file:**
   ```bash
   # Create .env file in your project root
   MISTRAL_API_KEY=your-actual-mistral-api-key
   JWT_SECRET=your-secure-jwt-secret
   ```

2. **For shared hosting providers that don't support .env files:**
   - Contact your hosting provider to enable environment variables
   - Set variables in your hosting control panel
   - Or modify server.js to hardcode the API key (not recommended for production)

3. **Get a Mistral API key:**
   - Visit: https://console.mistral.ai/
   - Create an account and get your API key
   - Add it to your .env file

### Issue 2: CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- API calls fail with "Not allowed by CORS"

**Solutions:**

1. **Check your domain in server.js:**
   ```javascript
   const allowedOrigins = [
     'https://thediscourse.ai',
     'http://localhost:5173',
     'http://localhost:3000',
     'http://localhost:4002',
     'https://yourdomain.com'  // Add your domain here
   ];
   ```

2. **For shared hosting, the server should automatically allow your domain**

### Issue 3: API Endpoint Not Found (404)

**Symptoms:**
- API calls return 404 errors
- Health check endpoint doesn't work

**Solutions:**

1. **Check your API base URL configuration:**
   - Open browser console
   - Look for "[API Config] Possible API URLs:" log
   - Verify the URL matches your server location

2. **Update API configuration:**
   ```javascript
   // In src/config/api.js, add your domain:
   if (hostname === 'yourdomain.com') {
     return 'https://yourdomain.com/api';
   }
   ```

3. **Verify server is running:**
   - Check if Node.js server is started
   - Look for server logs showing "Server is running on port X"

### Issue 4: Course Generation Timeout

**Symptoms:**
- Course generation starts but never completes
- Browser shows loading spinner indefinitely

**Solutions:**

1. **Increase timeout settings:**
   ```javascript
   // In src/config/api.js
   timeout: 60000, // Increase to 60 seconds
   ```

2. **Check server logs for errors:**
   - Look for "[COURSE_GENERATION]" log messages
   - Check for Mistral API errors

3. **Verify internet connection:**
   - Ensure your server can reach api.mistral.ai
   - Check for firewall restrictions

### Issue 5: Database Errors

**Symptoms:**
- Users can't save courses
- Database file permission errors

**Solutions:**

1. **Check file permissions:**
   ```bash
   chmod 644 db.json
   chmod 755 .
   ```

2. **Ensure write permissions for the server directory**

3. **Check disk space on your hosting**

## 🔧 Advanced Troubleshooting

### Debug API Configuration

Add this to your browser console:
```javascript
// Check current API configuration
import { debugApiConfig } from './src/config/api.js';
debugApiConfig();
```

### Test API Endpoints Manually

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Test course generation (replace with your token)
curl -X POST https://yourdomain.com/api/courses/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"topic":"test","difficulty":"beginner","numModules":1,"numLessonsPerModule":1}'
```

### Check Server Logs

Look for these log messages:
- `[SERVER] Environment check:` - Shows if environment variables are loaded
- `[COURSE_GENERATION]` - Shows course generation progress
- `[AIService]` - Shows AI API calls
- `[CORS]` - Shows CORS issues

## 📋 Environment Variables Checklist

Make sure these are set in your .env file:

```bash
# Required
MISTRAL_API_KEY=your-mistral-api-key
JWT_SECRET=your-jwt-secret

# Optional
STRIPE_SECRET_KEY=your-stripe-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-key
PORT=4002
NODE_ENV=production
```

## 🚀 Deployment Checklist

1. ✅ Environment variables configured
2. ✅ Server is running and accessible
3. ✅ Frontend is built and uploaded
4. ✅ API endpoints are working
5. ✅ CORS is properly configured
6. ✅ Database has write permissions
7. ✅ Mistral API key is valid

## 📞 Getting Help

If you're still having issues:

1. **Check the server logs** for specific error messages
2. **Test the API endpoints** manually using curl or Postman
3. **Verify your hosting provider** supports Node.js applications
4. **Contact your hosting provider** for environment variable support
5. **Check the browser console** for client-side errors

## 🔗 Useful Links

- [Mistral AI Console](https://console.mistral.ai/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) 