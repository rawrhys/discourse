# Shared Hosting Deployment Guide

This guide explains how to deploy the LMS Generator to shared hosting services.

## Prerequisites

- A shared hosting account with PHP support
- Access to cPanel or similar hosting control panel
- Domain name configured

## Frontend Deployment (Static Files)

### 1. Build the Frontend

```bash
npm run build
```

This will create a `dist` folder with all the static files needed for deployment.

### 2. Upload Frontend Files

Upload the contents of the `dist` folder to your hosting's public directory (usually `public_html` or `www`).

### 3. Configure .htaccess for React Router

Create a `.htaccess` file in your public directory with the following content:

```apache
RewriteEngine On
RewriteBase /

# Handle React Router - redirect all requests to index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [QSA,L]

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>
```

## Backend Deployment

### Option 1: Separate Backend Hosting

If you have access to a separate backend hosting service:

1. Upload the backend files (`server.js`, `package.json`, etc.) to your backend hosting
2. Install dependencies: `npm install`
3. Set up environment variables
4. Start the server

### Option 2: API-as-a-Service

Use services like:
- Railway
- Render
- Heroku
- Vercel (for serverless functions)

### Option 3: Shared Hosting with Node.js Support

Some shared hosting providers support Node.js applications:

1. Upload backend files to a subdirectory
2. Configure the hosting to run Node.js
3. Set up environment variables through hosting control panel

## Configuration Updates

### 1. Update API Base URL

Edit `src/config/api.js` and update the production base URL:

```javascript
production: {
  baseUrl: 'https://your-backend-domain.com/api',
  timeout: 30000,
},
```

### 2. Environment Variables

Set up the following environment variables on your backend hosting:

```bash
# Required
JWT_SECRET=your-super-secret-jwt-key
MISTRAL_API_KEY=your-mistral-api-key

# Optional
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
```

## Testing the Deployment

1. Visit your domain to ensure the frontend loads
2. Test the login/registration functionality
3. Test course generation
4. Verify all interactive features work

## Troubleshooting

### Common Issues

1. **404 Errors on Page Refresh**: Ensure `.htaccess` is properly configured
2. **API Connection Errors**: Verify the API base URL is correct
3. **CORS Errors**: Ensure your backend allows requests from your frontend domain
4. **Build Errors**: Check that all dependencies are properly installed

### Performance Optimization

1. Enable gzip compression on your hosting
2. Use a CDN for static assets
3. Implement proper caching headers
4. Optimize images and assets

## Security Considerations

1. Use HTTPS for all API communications
2. Implement proper CORS policies
3. Secure your JWT secret
4. Regularly update dependencies
5. Monitor for security vulnerabilities

## Maintenance

1. Regularly backup your database
2. Monitor application performance
3. Update dependencies as needed
4. Keep environment variables secure 