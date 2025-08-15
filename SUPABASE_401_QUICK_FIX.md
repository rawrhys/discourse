# Quick Fix for Supabase 401 Error

## 🚨 Current Issue
You're getting a 401 Unauthorized error from Supabase, even though the client initializes successfully.

## 🔍 Root Cause
The 401 error typically means:
1. **Wrong API key type** (using service key instead of anon key)
2. **Invalid/expired API key**
3. **Supabase project is paused**
4. **Environment variables not reloaded**

## ✅ Quick Fix Steps

### Step 1: Test Current Configuration
Run this on your VPS:
```bash
cd /root/discourse
node test-supabase-connection.js
```

### Step 2: Check Your Supabase Project
1. Go to https://supabase.com/dashboard
2. Select your project: `gaapqvkjblqvpokmhlmh`
3. Check if project is **active** (not paused)
4. Go to **Settings** → **API**
5. Copy the **anon public** key (NOT the service key)

### Step 3: Update Your VPS .env File
```bash
# SSH into your VPS
ssh root@your-vps-ip

# Edit the .env file
cd /root/discourse
nano .env
```

Make sure your `.env` has:
```env
SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
```

### Step 4: Force Environment Reload
```bash
# Stop PM2 process
pm2 stop discourse

# Delete to clear cache
pm2 delete discourse

# Start fresh with new environment
pm2 start server.js --name discourse

# Check logs
pm2 logs discourse --lines 20
```

### Step 5: Test Again
```bash
node test-supabase-connection.js
```

## 🎯 Expected Results
After the fix, you should see:
- ✅ No 401 errors in logs
- ✅ Successful user registration
- ✅ "Supabase client initialized successfully" in logs

## 🆘 If Still Having Issues
1. **Check Supabase billing** - Project might be paused
2. **Regenerate API key** - Go to Settings > API > Regenerate
3. **Verify domain settings** - Check Authentication > URL Configuration
4. **Contact Supabase support** if project issues persist 