# Shared Hosting Deployment Guide - Course Generation Fix

This guide will help you fix the course generation issue on your shared hosting platform.

## 🔍 Current Status

✅ **Local API is working correctly**
✅ **Mistral API key is configured**
✅ **Server is running properly**
✅ **Course generation endpoint is accessible**

## 🚨 The Problem

The issue is likely that your **frontend is not connecting to your backend** on shared hosting. Here's how to fix it:

## 🔧 Step-by-Step Fix

### Step 1: Verify Your Environment Variables

Your `.env` file should contain:
```bash
MISTRAL_API_KEY=your-actual-mistral-api-key
JWT_SECRET=your-secure-jwt-secret
PORT=4002
NODE_ENV=production
```

### Step 2: Deploy Backend to Shared Hosting

1. **Upload these files to your backend directory:**
   - `server.js`
   - `package.json`
   - `.env` (with your actual API keys)
   - `db.json` (if it exists)

2. **Install dependencies on your hosting:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   node server.js
   ```

### Step 3: Update Frontend API Configuration

The main issue is likely that your frontend is trying to connect to the wrong API URL. Update your API configuration:

1. **Check your current API base URL:**
   - Open browser console (F12)
   - Look for "[API Config] Possible API URLs:" log
   - Note the URL it's trying to use

2. **Update the API configuration if needed:**
   ```javascript
   // In src/config/api.js, add your domain:
   if (hostname === 'yourdomain.com') {
     return 'https://yourdomain.com/api';
   }
   ```

### Step 4: Build and Deploy Frontend

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Upload the `dist/` folder contents to your hosting's public directory**

3. **Create `.htaccess` file in your public directory:**
   ```apache
   RewriteEngine On
   RewriteBase /
   
   # Handle React Router - redirect all requests to index.html
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule ^(.*)$ index.html [QSA,L]
   ```

### Step 5: Test Your Deployment

1. **Test the API health endpoint:**
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

2. **Test course generation:**
   - Visit your website
   - Try to generate a course
   - Check browser console for errors

## 🔍 Troubleshooting

### If API health endpoint returns 404:

1. **Check if your server is running:**
   - Contact your hosting provider
   - Verify Node.js is supported
   - Check server logs

2. **Verify file paths:**
   - Make sure `server.js` is in the correct directory
   - Check that `.env` file is uploaded

### If course generation fails with "AI service is not configured":

1. **Check your `.env` file:**
   ```bash
   MISTRAL_API_KEY=your-actual-mistral-api-key
   ```

2. **Verify the API key is valid:**
   - Test with curl: `curl -H "Authorization: Bearer YOUR_KEY" https://api.mistral.ai/v1/models`

### If you get CORS errors:

1. **Check your domain in server.js:**
   ```javascript
   const allowedOrigins = [
     'https://thediscourse.ai',
     'https://yourdomain.com',  // Add your domain here
     'http://localhost:5173'
   ];
   ```

### If API calls timeout:

1. **Increase timeout in frontend:**
   ```javascript
   // In src/config/api.js
   timeout: 60000, // Increase to 60 seconds
   ```

2. **Check server logs for errors**

## 📋 Deployment Checklist

- [ ] Environment variables configured in `.env`
- [ ] Backend files uploaded to hosting
- [ ] Dependencies installed (`npm install`)
- [ ] Server started (`node server.js`)
- [ ] Frontend built (`npm run build`)
- [ ] Frontend files uploaded to public directory
- [ ] `.htaccess` file created
- [ ] API health endpoint working
- [ ] Course generation working

## 🚀 Quick Test Commands

Test your API endpoints:

```bash
# Test health endpoint
curl https://yourdomain.com/api/health

# Test course generation (replace with your token)
curl -X POST https://yourdomain.com/api/courses/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"topic":"test","difficulty":"beginner","numModules":1,"numLessonsPerModule":1}'
```

## 📞 Need More Help?

If you're still having issues:

1. **Check server logs** for specific error messages
2. **Test API endpoints manually** using curl or Postman
3. **Verify your hosting provider** supports Node.js applications
4. **Contact your hosting provider** for environment variable support
5. **Check the browser console** for client-side errors

## 🔗 Useful Resources

- [Mistral AI Console](https://console.mistral.ai/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) 