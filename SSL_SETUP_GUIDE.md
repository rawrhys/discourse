# SSL Setup Guide - Fixing SSL Protocol Errors

## 🔧 Problem Solved

The `net::ERR_SSL_PROTOCOL_ERROR` was caused by a mismatch between HTTP and HTTPS configurations. The server was running on HTTP but the `.htaccess` file was forcing HTTPS redirects, creating a conflict.

## ✅ What We Fixed

1. **Added HTTPS Support**: Server now supports both HTTP and HTTPS
2. **Self-Signed Certificates**: Automatic generation for development
3. **Flexible .htaccess**: HTTPS redirects only in production
4. **Updated Vite Config**: Proxy now uses HTTPS
5. **Dual Port Support**: HTTP on 4003, HTTPS on 4004

## 🚀 Quick Setup

### Step 1: Test SSL Setup
```bash
node test-ssl-setup.js
```

### Step 2: Start the Server
```bash
node server.js
```

You should see:
```
[SERVER] HTTP running on http://0.0.0.0:4003
[SERVER] HTTPS running on https://0.0.0.0:4004
```

### Step 3: Start Development Server
```bash
npm run dev
```

## 🔍 What Changed

### Server.js Changes
- ✅ Added HTTPS server support
- ✅ Automatic self-signed certificate generation
- ✅ Dual port configuration (HTTP: 4003, HTTPS: 4004)
- ✅ Graceful fallback to HTTP if HTTPS fails

### Vite Config Changes
- ✅ Updated proxy to use `https://localhost:4004`
- ✅ Added `secure: false` for self-signed certificates

### .htaccess Changes
- ✅ HTTPS redirects only for production domains
- ✅ Excludes localhost and development IPs
- ✅ Added HTTPS_PORT environment variable

## 🌐 Access URLs

### Development
- **Frontend**: http://localhost:5173
- **HTTP API**: http://localhost:4003
- **HTTPS API**: https://localhost:4004

### Production
- **Frontend**: https://yourdomain.com
- **API**: https://yourdomain.com/api/*

## 🔧 Troubleshooting

### If you get certificate warnings:
1. **Chrome**: Click "Advanced" → "Proceed to localhost"
2. **Firefox**: Click "Advanced" → "Accept the Risk and Continue"
3. **Edge**: Click "Advanced" → "Continue to localhost"

### If HTTPS doesn't start:
```bash
# Check if OpenSSL is installed
openssl version

# Manually create certificates
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

### If ports are in use:
```bash
# Check what's using the ports
netstat -tulpn | grep :4003
netstat -tulpn | grep :4004

# Kill processes if needed
kill -9 <PID>
```

## 🎯 Expected Behavior

### Before (Broken)
- ❌ SSL protocol errors
- ❌ Mixed content warnings
- ❌ HTTPS redirects on HTTP server

### After (Fixed)
- ✅ Both HTTP and HTTPS work
- ✅ No SSL protocol errors
- ✅ Proper certificate handling
- ✅ Development and production ready

## 📝 Environment Variables

Add these to your `.env` file:
```env
NODE_ENV=development
PORT=4003
HTTPS_PORT=4004
HOST=0.0.0.0
```

## 🔒 Production SSL

For production, replace self-signed certificates with real ones:

1. **Let's Encrypt** (Free):
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

2. **Manual Setup**:
   - Place `cert.pem` and `key.pem` in project root
   - Update server to use production certificates

## 🎉 Success Indicators

- ✅ No SSL protocol errors in browser console
- ✅ API calls work on both HTTP and HTTPS
- ✅ Frontend loads without mixed content warnings
- ✅ Development and production environments work

## 📞 Support

If you still see SSL errors:
1. Clear browser cache and cookies
2. Restart both server and dev server
3. Check browser console for specific error messages
4. Run `node test-ssl-setup.js` to verify setup 