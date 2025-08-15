# Quick Deployment Guide for Shared Hosting

## 🚀 Quick Start

1. **Build the application:**
   ```bash
   npm run deploy:shared-hosting
   ```

2. **Upload files:**
   - Upload all contents of the `dist` folder to your hosting's public directory
   - Make sure to include the `.htaccess` file

3. **Configure API:**
   - Update `src/config/api.js` with your backend API URL
   - Deploy your backend separately (Railway, Render, Heroku, etc.)

## 📁 What gets built

The build process creates:
- `dist/index.html` - Main application file
- `dist/assets/` - All JavaScript, CSS, and other assets
- `dist/.htaccess` - Apache configuration for React Router
- `dist/DEPLOYMENT_INFO.json` - Build information

## 🔧 Configuration

### API Configuration
Edit `src/config/api.js`:
```javascript
production: {
  baseUrl: 'https://your-backend-domain.com/api',
  timeout: 30000,
},
```

### Backend Requirements
Your backend needs these environment variables:
- `JWT_SECRET` - For authentication
- `MISTRAL_API_KEY` - For AI course generation

## 🌐 Hosting Options

### Frontend (Static Files)
- Any shared hosting with PHP support
- cPanel, Plesk, or similar control panels
- Upload to `public_html` or `www` directory

### Backend (API)
- Railway (recommended)
- Render
- Heroku
- Vercel (serverless)
- Shared hosting with Node.js support

## ✅ Testing

After deployment, test:
1. ✅ Application loads without errors
2. ✅ Login/registration works
3. ✅ Course generation functions
4. ✅ All interactive features work
5. ✅ Mobile responsiveness

## 🐛 Troubleshooting

- **404 on page refresh**: Check `.htaccess` file is uploaded
- **API errors**: Verify backend URL in `src/config/api.js`
- **CORS errors**: Ensure backend allows your domain
- **Build errors**: Run `npm install` first

## 📖 Full Documentation

See `DEPLOYMENT_SHARED_HOSTING.md` for detailed instructions. 