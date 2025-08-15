# Environment Variables Setup for Shared Hosting
# ======================================================

## Required Environment Variables

Your hosting provider needs these environment variables set:

### 1. MISTRAL_API_KEY (REQUIRED)
- Get your API key from: https://console.mistral.ai/
- This is required for course generation to work

### 2. JWT_SECRET (REQUIRED)
- A secure random string for JWT token signing
- Generate one: https://generate-secret.vercel.app/32

### 3. PORT (Optional)
- Usually 4002 or your hosting provider's default
- Some providers auto-assign this

## How to Set Environment Variables

### Option 1: Hosting Control Panel
1. Log into your hosting control panel
2. Find "Environment Variables" or "App Settings"
3. Add each variable with its value

### Option 2: .env File (if supported)
1. Create a .env file in your project root
2. Add the variables in format: KEY=value
3. Upload with your project

### Option 3: Contact Hosting Support
If you can't find environment variable settings:
1. Contact your hosting provider
2. Ask them to enable environment variables
3. Provide them with the required variables

## Testing Your Configuration

After setting up environment variables:

1. Visit: https://yourdomain.com/api/health
2. Expected response:
   {
     "status": "ok",
     "mistralApiKey": "configured",
     "jwtSecret": "configured"
   }

3. If you see "mistralApiKey": "not configured", your API key is not set correctly.

## Troubleshooting

### "AI service is not configured" Error
- Check that MISTRAL_API_KEY is set in your hosting environment
- Verify the API key is valid at https://console.mistral.ai/

### CORS Errors
- Make sure your domain is added to the allowed origins in server.js
- Contact hosting support if CORS issues persist

### 404 Errors
- Ensure your hosting provider supports Node.js
- Check that the server.js file is in the correct location
- Verify .htaccess file is properly configured
