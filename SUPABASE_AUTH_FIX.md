# Supabase Authentication Fix Guide

## Problem Description
Users can register successfully but get a 400 error when trying to login:
```
gaapqvkjblqvpokmhlmh.supabase.co/auth/v1/token?grant_type=password:1 Failed to load resource: the server responded with a status of 400 ()
```

## Root Cause
The issue is that Supabase requires email confirmation before users can login, but the current flow doesn't properly handle this requirement.

## Solutions Implemented

### 1. Environment Variables Setup
Run the setup script to create the required `.env` file:
```bash
# Windows
setup-env.bat

# Linux/Mac
# Copy env-template.txt to .env and update the values
```

**Required Environment Variables:**
- `SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co`
- `SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here`
- `VITE_SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co`
- `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Supabase Client Configuration
Updated `src/config/supabase.js` to:
- Handle email confirmation properly
- Set proper redirect URLs
- Use PKCE flow for better security

### 3. Authentication Flow Improvements
Updated `src/contexts/AuthContext.jsx` to:
- Better handle email confirmation requirements
- Provide clearer error messages
- Log authentication steps for debugging

### 4. Registration Flow Fixes
Updated `src/components/auth/Register.jsx` to:
- Show email verification step when needed
- Handle the complete registration flow properly
- Provide better user feedback

## Step-by-Step Fix

### Step 1: Set Up Environment Variables
1. Run `setup-env.bat` (Windows) or copy `env-template.txt` to `.env`
2. Get your Supabase Service Role Key:
   - Go to https://supabase.com/dashboard
   - Select project: `gaapqvkjblqvpokmhlmh`
   - Go to Settings > API
   - Copy the "service_role" key
   - Update `.env` file with the real key

### Step 2: Restart Development Server
```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
# or
node server.js
```

### Step 3: Test the Flow
1. Register a new user
2. Check if email verification step appears
3. Verify email (check inbox/spam)
4. Try logging in

## Expected Behavior After Fix

### Registration Flow:
1. User fills registration form
2. User completes payment (if required)
3. **NEW**: Email verification step appears
4. User receives verification email
5. User clicks verification link
6. User is redirected to login

### Login Flow:
1. User enters credentials
2. If email not verified: Clear error message
3. If email verified: Successful login

## Troubleshooting

### Still Getting 400 Error?
1. Check browser console for detailed error messages
2. Verify `.env` file exists and has correct values
3. Ensure Supabase project is active and accessible
4. Check if email confirmation is enabled in Supabase dashboard

### Email Not Received?
1. Check spam folder
2. Verify SMTP settings in `.env`
3. Check Supabase email settings
4. Use Supabase dashboard to manually send verification

### Service Role Key Issues?
1. Ensure you have admin access to Supabase project
2. Check if the key has proper permissions
3. Verify the key format (should start with `eyJ...`)

## Supabase Dashboard Settings

### Authentication > Settings
- **Enable email confirmations**: Should be ON
- **Secure email change**: Recommended ON
- **Enable phone confirmations**: Optional

### Authentication > Email Templates
- Customize verification email template
- Ensure redirect URL is correct: `https://thediscourse.ai/verify-email`

### SQL Editor
If you need to manually verify a user:
```sql
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'user@example.com';
```

## Alternative Solutions

### Option 1: Disable Email Confirmation (Not Recommended)
In Supabase dashboard:
- Go to Authentication > Settings
- Turn OFF "Enable email confirmations"
- **Warning**: This reduces security

### Option 2: Use Magic Link Authentication
- Enable magic link authentication in Supabase
- Users get login links via email instead of passwords
- More secure but different UX

### Option 3: Custom Email Service
- Set up your own SMTP server
- Configure in `.env` file
- More control over email delivery

## Testing

### Test Registration:
```bash
# Check server logs for:
[AUTH] Registration attempt for email: test@example.com
[AUTH] Supabase registration successful
[AUTH] Email confirmation required: true
```

### Test Login:
```bash
# Check server logs for:
[LOGIN] Login attempt for email: test@example.com
[LOGIN] Supabase configured: true
```

## Support

If issues persist:
1. Check server logs for detailed error messages
2. Verify Supabase project status
3. Test with a simple Supabase client
4. Check network tab for failed requests

## Files Modified
- `src/config/supabase.js` - Enhanced Supabase configuration
- `src/contexts/AuthContext.jsx` - Improved authentication flow
- `src/components/auth/Register.jsx` - Better registration handling
- `setup-env.bat` - Environment setup script
- `SUPABASE_AUTH_FIX.md` - This troubleshooting guide
