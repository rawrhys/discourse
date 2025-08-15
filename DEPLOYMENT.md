# Deployment Guide

## Backend Deployment (server.js)

### Option 1: Railway (Recommended)
1. Go to [railway.app](https://railway.app)
2. Create a new project
3. Connect your GitHub repository
4. Set the following environment variables:
   ```
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
   MISTRAL_API_KEY=your_mistral_api_key
   JWT_SECRET=your_jwt_secret
   ```
5. Deploy the project
6. Copy the generated URL (e.g., `https://your-app.railway.app`)

### Option 2: Heroku
1. Install Heroku CLI
2. Run: `heroku create your-app-name`
3. Set environment variables: `heroku config:set STRIPE_SECRET_KEY=...`
4. Deploy: `git push heroku main`

### Option 3: Vercel
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Set environment variables in the dashboard
4. Deploy

## Frontend Configuration

After deploying the backend, update the frontend to use the correct API URL:

1. Set the environment variable in your hosting platform:
   ```
   VITE_API_BASE_URL=https://your-backend-url.com
   ```

2. Or update the code in `src/components/Dashboard.jsx`:
   ```javascript
   const API_BASE_URL = 'https://your-backend-url.com';
   ```

## Environment Variables Required

### Backend (.env or hosting platform)
```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
MISTRAL_API_KEY=your_mistral_api_key
JWT_SECRET=your_jwt_secret
```

### Frontend (environment variable)
```env
VITE_API_BASE_URL=https://your-backend-url.com
```

## Testing

1. Deploy the backend first
2. Update the frontend with the correct API URL
3. Deploy the frontend
4. Test the "Buy More" button
5. Check that credits show as 1 for all users

## Troubleshooting

- **404 Errors**: Make sure the backend is deployed and the API URL is correct
- **CORS Errors**: The backend now allows requests from thediscourse.ai and localhost
- **Stripe Errors**: Make sure your Stripe keys are set correctly
- **Authentication Errors**: Make sure Supabase keys are set correctly 