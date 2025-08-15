# Setup Instructions for Course Generation

## Issue Fixed ✅

The course generation was failing silently because:
1. The server wasn't running properly due to import issues
2. The Mistral API key wasn't configured
3. Error handling wasn't showing detailed error messages

## What Was Fixed

1. **Fixed AIService import issue** - Removed the client-side import that was causing server startup failures
2. **Fixed API key reference** - Changed from client-side environment variable to server-side `process.env.MISTRAL_API_KEY`
3. **Improved error handling** - Added detailed error messages and health checks
4. **Added server health checks** - The app now checks if the server is accessible before attempting course generation

## To Get Course Generation Working

### 1. Set up the Mistral API Key

Create a `.env` file in the root directory with the following content:

```env
# Server Configuration
PORT=4002
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-secret-key-change-in-production

# Supabase Configuration
SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
SUPABASE_SERVICE_KEY=

# AI Service Configuration (REQUIRED for course generation)
MISTRAL_API_KEY=your-mistral-api-key-here

# Stripe Configuration (optional for testing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### 2. Get a Mistral API Key

1. Go to https://console.mistral.ai/
2. Sign up or log in
3. Create a new API key
4. Copy the API key and replace `your-mistral-api-key-here` in the .env file

### 3. Start the Server

```bash
npm run server
```

### 4. Test Course Generation

1. Open the application in your browser
2. Log in to your account
3. Click "Generate New Course"
4. Enter a course topic and parameters
5. Click "Generate Course"

## Error Messages You'll See Now

- **"AI service is not configured"** - Set up the MISTRAL_API_KEY in .env
- **"Server is not accessible"** - Make sure the server is running with `npm run server`
- **"No credits left"** - Purchase more credits using the "Buy More Credits" button
- **"Inappropriate content"** - The course topic contains banned words

## Troubleshooting

1. **Server not starting**: Check that port 4002 is available
2. **API key errors**: Make sure the MISTRAL_API_KEY is set correctly in .env
3. **Authentication errors**: Make sure you're logged in with Supabase
4. **Network errors**: Check your internet connection

## Testing

Run the test script to verify everything is working:

```bash
node test-server.js
```

This should show:
- ✅ Health endpoint working
- ✅ Course generation endpoint accessible (requires auth) 