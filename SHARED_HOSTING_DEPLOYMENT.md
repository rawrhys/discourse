# Shared Hosting Deployment Guide

This guide will help you deploy the application to shared hosting environments like cPanel, Plesk, or similar platforms.

## 🔧 Prerequisites

1. A shared hosting account with:
   - Node.js support (version 14 or higher)
   - SSH access (recommended)
   - Ability to set environment variables
   - Support for .htaccess files (Apache)

2. Your domain name configured to point to your hosting

## 📋 Pre-Deployment Steps

### 1. Build the Application

```bash
# Install dependencies
npm install

# Build the frontend
npm run build
```

### 2. Prepare Environment Variables

Create a `.env` file with your production settings:

```env
# Server Configuration
NODE_ENV=production
PORT=4002  # Your hosting provider might assign a different port

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret

# AI Service Configuration
MISTRAL_API_KEY=your-mistral-api-key

# Domain Configuration
HOST=yourdomain.com
ALLOWED_DOMAIN=yourdomain.com
ADDITIONAL_DOMAINS=subdomain.yourdomain.com,otherdomain.com

# Database Configuration
DB_PATH=/path/to/writable/directory/db.json

# Build Configuration
BUILD_PATH=/path/to/public_html/dist
```

## 🚀 Deployment Steps

### 1. Upload Files

Upload these files to your hosting:

```
├── dist/           → Upload to public_html/ or www/
├── server.js       → Upload to private directory
├── package.json    → Upload to private directory
├── .env           → Upload to private directory
└── .htaccess      → Upload to public_html/ or www/
```

### 2. Set Up Directory Structure

```bash
public_html/        # Public directory
  ├── dist/        # React build files
  └── .htaccess    # Apache configuration
private/           # Private directory
  ├── server.js    # Node.js server
  ├── package.json # Dependencies
  └── .env        # Environment variables
```

### 3. Configure Environment Variables

#### Option A: Through Hosting Control Panel
1. Go to your hosting control panel
2. Find "Environment Variables" or similar
3. Add all variables from your `.env` file

#### Option B: Through .htaccess
Add to your `.htaccess`:
```apache
SetEnv NODE_ENV production
SetEnv PORT 4002
SetEnv MISTRAL_API_KEY your-api-key
SetEnv JWT_SECRET your-jwt-secret
```

### 4. Install Dependencies

SSH into your server and run:
```bash
cd private
npm install --production
```

### 5. Start the Server

#### Option A: Using Hosting Control Panel
1. Go to your hosting control panel
2. Find "Node.js Applications" or similar
3. Add a new application:
   - Entry point: server.js
   - Node version: 14 or higher
   - Environment: production

#### Option B: Using PM2 (if available)
```bash
npm install -g pm2
pm2 start server.js --name "course-app"
```

#### Option C: Using Screen (if available)
```bash
screen -S course-app
node server.js
# Press Ctrl+A, then D to detach
```

## 🔍 Verify Deployment

1. Visit your domain: `https://yourdomain.com`
2. Check API health: `https://yourdomain.com/api/health`
3. Test course generation (requires login)

## 🔒 Security Considerations

1. **Environment Variables**:
   - Never commit `.env` to version control
   - Use secure values for JWT_SECRET
   - Protect your MISTRAL_API_KEY

2. **File Permissions**:
   ```bash
   chmod 644 .htaccess
   chmod 644 .env
   chmod 755 server.js
   chmod -R 755 dist/
   ```

3. **Database Security**:
   - Place db.json outside web root
   - Set proper file permissions
   - Regular backups

## 📝 Troubleshooting

### Common Issues

1. **"API not found" Error**
   - Check .htaccess configuration
   - Verify server.js path in .htaccess
   - Ensure mod_rewrite is enabled

2. **CORS Errors**
   - Add your domain to ALLOWED_DOMAIN
   - Check SSL/HTTPS configuration
   - Verify origin settings

3. **Database Errors**
   - Check DB_PATH is writable
   - Verify file permissions
   - Ensure directory exists

4. **Server Won't Start**
   - Check if port is available
   - Verify Node.js version
   - Check error logs

5. **"AI service is not configured" Error**
   - Verify MISTRAL_API_KEY is set in your environment variables
   - Check server logs for API errors
   - Test the AI endpoint directly:
     ```bash
     curl -X POST https://yourdomain.com/api/ai/generate \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer your-auth-token" \
       -d '{"prompt":"test prompt","intent":"test","maxTokens":100}'
     ```

6. **Course Generation Not Working**
   - Check browser console for API errors
   - Verify authentication token is present
   - Test AI endpoint health:
     ```bash
     curl https://yourdomain.com/api/health
     ```
   - Check server logs for Mistral API errors
   - Verify streaming response is working:
     ```bash
     curl -N https://yourdomain.com/api/ai/generate # Should see streaming data
     ```

### Debugging

1. **Check Server Logs**:
   ```bash
   tail -f /path/to/error.log
   ```

2. **Test API Endpoints**:
   ```bash
   curl https://yourdomain.com/api/health
   ```

3. **Monitor Server**:
   ```bash
   # If using PM2
   pm2 logs course-app
   pm2 status
   ```

## 📞 Getting Help

If you encounter issues:

1. Check the server logs
2. Review the troubleshooting section
3. Verify environment variables
4. Contact your hosting provider's support
5. Check GitHub issues or create a new one

## 🔄 Updates and Maintenance

### Updating the Application

1. Build new version locally
2. Back up production files
3. Upload new files
4. Restart the server

### Backup Process

1. Back up database:
   ```bash
   cp db.json db.json.backup
   ```

2. Back up environment variables:
   ```bash
   cp .env .env.backup
   ```

3. Back up build files:
   ```bash
   tar -czf dist-backup.tar.gz dist/
   ```

The application should now be running on your shared hosting environment! 