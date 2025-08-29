# Email Verification Setup Guide

This guide explains how to set up SMTP email verification for user registration using Supabase and Nodemailer.

## Overview

The system now requires users to verify their email address before they can access the platform. This is implemented using:

1. **Supabase Authentication** - Handles user registration and email confirmation
2. **Nodemailer** - Sends verification emails via SMTP
3. **Custom Verification Endpoints** - Manages verification tokens and status

## Prerequisites

- Supabase project with authentication enabled
- SMTP server credentials (Gmail, Outlook, or custom SMTP server)
- Environment variables configured

## Environment Variables

Add these to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=your-supabase-url-here
SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# SMTP Configuration
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# Frontend URL for verification links
FRONTEND_URL=https://yourdomain.com
```

## SMTP Server Options

### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Note**: For Gmail, you need to:
1. Enable 2-factor authentication
2. Generate an "App Password" (not your regular password)
3. Use the app password in SMTP_PASS

### Outlook/Hotmail
```bash
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

### Custom SMTP Server
```bash
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASS=your-password
```

## How It Works

### 1. User Registration
1. User fills out registration form
2. System creates Supabase user account
3. System generates verification token
4. Verification email is sent via SMTP
5. User sees "Check Your Email" message

### 2. Email Verification
1. User clicks verification link in email
2. Link contains token and email parameters
3. Frontend calls `/api/auth/verify-email` endpoint
4. Backend validates token and marks email as verified
5. User is redirected to login page

### 3. Login Process
1. User attempts to log in
2. System checks if email is verified
3. If not verified, shows error message
4. If verified, allows login

## API Endpoints

### POST /api/auth/register
- Creates user account
- Sends verification email
- Returns `requiresEmailVerification: true`

### GET /api/auth/verify-email
- Verifies email with token
- Updates user verification status
- Returns success/error message

### POST /api/auth/resend-verification
- Resends verification email
- Generates new verification token

## Frontend Components

### VerifyEmail Component
- Handles email verification links
- Shows verification status
- Allows resending verification emails

### Register Component
- Updated to show email verification step
- Handles verification requirement

## Testing

### 1. Test Registration
1. Register a new user
2. Check if verification email is sent
3. Verify email verification step is shown

### 2. Test Email Verification
1. Click verification link in email
2. Check if user is redirected to login
3. Verify user can log in after verification

### 3. Test Login Without Verification
1. Try to log in with unverified account
2. Check if error message is shown
3. Verify user cannot access protected routes

## Troubleshooting

### Email Not Sending
1. Check SMTP credentials
2. Verify SMTP server settings
3. Check server logs for errors
4. Ensure SMTP server allows authentication

### Verification Link Not Working
1. Check FRONTEND_URL environment variable
2. Verify route is properly configured
3. Check browser console for errors
4. Ensure verification endpoint is accessible

### User Cannot Log In After Verification
1. Check if email is marked as verified in database
2. Verify Supabase user confirmation status
3. Check server logs for verification errors

## Security Considerations

1. **Token Expiration**: Verification tokens expire after 24 hours
2. **Rate Limiting**: Implement rate limiting on verification endpoints
3. **HTTPS**: Always use HTTPS in production
4. **Token Storage**: Tokens are stored in memory (consider database storage for production)

## Production Deployment

1. **Database Storage**: Move verification tokens to database
2. **Email Templates**: Customize email templates for your brand
3. **Monitoring**: Add logging and monitoring for email delivery
4. **Backup SMTP**: Consider backup SMTP providers

## Support

If you encounter issues:

1. Check server logs for error messages
2. Verify all environment variables are set
3. Test SMTP connection manually
4. Check Supabase authentication settings

## Files Modified

- `server.js` - Added email verification endpoints
- `src/components/auth/VerifyEmail.jsx` - New verification component
- `src/components/auth/Register.jsx` - Added verification step
- `src/contexts/AuthContext.jsx` - Updated registration flow
- `src/config/supabase.js` - Enhanced Supabase configuration
- `src/App.jsx` - Added verification route
- `env-template.txt` - Added SMTP configuration
