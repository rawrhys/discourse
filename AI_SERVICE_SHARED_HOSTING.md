# AI Service Shared Hosting Configuration Guide

This guide will help you configure the AI service (Mistral API) for shared hosting deployment.

## 🚨 Current Issue

The AI service was originally configured for localhost development and needs to be updated for shared hosting environments.

## 🔧 What Needs to Be Updated

### 1. Environment Variables
The AI service requires the `MISTRAL_API_KEY` environment variable to be set on your hosting provider.

### 2. API Configuration
The frontend needs to know how to connect to your backend API on shared hosting.

### 3. CORS Configuration
The server needs to allow requests from your domain.

## 📋 Step-by-Step Configuration

### Step 1: Get Your Mistral API Key

1. Visit https://console.mistral.ai/
2. Sign up or log in to your account
3. Create a new API key
4. Copy the API key (it starts with `mist-`)

### Step 2: Set Environment Variables on Your Hosting

#### Option A: Hosting Control Panel
1. Log into your hosting control panel
2. Find "Environment Variables" or "App Settings"
3. Add these variables:
   ```
   MISTRAL_API_KEY=your-actual-mistral-api-key
   JWT_SECRET=your-secure-jwt-secret
   NODE_ENV=production
   PORT=4002
   ```

#### Option B: .env File (if supported)
1. Create a `.env` file in your project root
2. Add your variables:
   ```env
   MISTRAL_API_KEY=your-actual-mistral-api-key
   JWT_SECRET=your-secure-jwt-secret
   NODE_ENV=production
   PORT=4002
   ```

#### Option C: Contact Hosting Support
If you can't find environment variable settings:
1. Contact your hosting provider
2. Ask them to enable environment variables
3. Provide them with the required variables

### Step 3: Update API Configuration

The API configuration has been updated to automatically detect shared hosting environments. The system will now:

- Detect common hosting providers (Netlify, Vercel, Heroku, etc.)
- Use the correct API URL pattern for your domain
- Handle different subdomain patterns

### Step 4: Test Your Configuration

#### Test 1: Health Endpoint
Visit: `https://yourdomain.com/api/health`

Expected response:
```json
{
  "status": "ok",
  "mistralApiKey": "configured",
  "jwtSecret": "configured"
}
```

#### Test 2: AI Service Test
Visit: `https://yourdomain.com/api/test-ai`

Expected response:
```json
{
  "status": "success",
  "message": "AI service is working correctly",
  "configured": true
}
```

#### Test 3: Course Generation
Try generating a course through the web interface.

## 🛠️ Automated Setup

Run the setup script to automatically configure everything:

```bash
node setup-shared-hosting.js
```

This script will:
- Create/update the `.env` file
- Update API configuration for shared hosting
- Create deployment scripts
- Generate testing tools

## 🔍 Troubleshooting

### "AI service is not configured" Error

**Cause:** The `MISTRAL_API_KEY` environment variable is not set.

**Solution:**
1. Check your hosting control panel for environment variables
2. Verify the API key is correct at https://console.mistral.ai/
3. Restart your application after setting the variable

### "Failed to fetch" Error

**Cause:** The frontend can't connect to the backend API.

**Solution:**
1. Check that your server is running
2. Verify the API URL in browser console (F12)
3. Ensure CORS is properly configured

### CORS Errors

**Cause:** The server doesn't allow requests from your domain.

**Solution:**
1. Check the `allowedOrigins` array in `server.js`
2. Add your domain to the allowed origins
3. Contact hosting support if issues persist

### 404 Errors

**Cause:** The API endpoints are not accessible.

**Solution:**
1. Ensure your hosting provider supports Node.js
2. Check that `server.js` is in the correct location
3. Verify `.htaccess` file is properly configured

## 📊 Monitoring and Debugging

### Check Server Logs
Look for these log messages:
- `[SERVER] Mistral API key is configured`
- `[AIService] API request successful`
- `[API Config] Possible API URLs:`

### Browser Console Debugging
Open Developer Tools (F12) and look for:
- API configuration logs
- Network request errors
- CORS errors

### Test Scripts
Use the provided test scripts:
```bash
# Test local configuration
node test-shared-hosting.js

# Test course generation
node test-course-generation.js

# Diagnose issues
node diagnose-shared-hosting.js
```

## 🚀 Deployment Checklist

- [ ] Set `MISTRAL_API_KEY` environment variable
- [ ] Set `JWT_SECRET` environment variable
- [ ] Set `NODE_ENV=production`
- [ ] Upload `server.js` to your hosting
- [ ] Upload `.env` file (if supported)
- [ ] Test health endpoint: `/api/health`
- [ ] Test AI service: `/api/test-ai`
- [ ] Test course generation through web interface

## 📞 Getting Help

If you're still having issues:

1. **Check the troubleshooting guide:** `SHARED_HOSTING_TROUBLESHOOTING.md`
2. **Run diagnostics:** `node diagnose-shared-hosting.js`
3. **Contact your hosting provider** for environment variable support
4. **Check Mistral API status:** https://status.mistral.ai/

## 🔄 Updates Made

### Files Updated:
- `src/config/api.js` - Added shared hosting domain detection
- `server.js` - Added AI test endpoint
- `setup-shared-hosting.js` - Enhanced configuration script

### New Files Created:
- `ENVIRONMENT_SETUP.md` - Environment variable guide
- `deploy-shared-hosting.sh` - Deployment script
- `test-shared-hosting.js` - Testing script

The AI service is now properly configured for shared hosting deployment! 