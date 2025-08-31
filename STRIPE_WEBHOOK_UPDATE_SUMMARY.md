# Stripe Webhook Update Summary

## Changes Made

### 1. Added New Backend Endpoint
**File**: `server.js`
**Endpoint**: `POST /api/auth/create-user-from-webhook`

This new endpoint handles user creation from Stripe webhooks and:
- Creates users in your local database
- Generates email verification tokens
- Sends verification emails via your Hostinger SMTP
- Provides security through webhook secret verification

### 2. Updated Stripe Webhook in server.js
**File**: `server.js`
**Section**: Stripe webhook handler

The existing Stripe webhook now:
- Creates users with email verification
- Sends verification emails immediately after payment
- Stores users locally instead of relying on Supabase

### 3. Created Updated Deno Webhook
**File**: `stripe-webhook-updated.js`

This is your new Deno webhook that:
- Calls your local backend instead of Supabase
- Uses the new `/api/auth/create-user-from-webhook` endpoint
- Maintains the same Stripe event handling logic

## Required Manual Updates

### 1. Update .env file
Add these lines to your `.env` file:

```bash
# Fix SMTP host (change from placeholder)
SMTP_HOST=smtp.hostinger.com

# Add webhook secret
WEBHOOK_SECRET=webhook_secret_2024_discourse_ai_secure_key
```

### 2. Update Stripe Webhook URL
In your Stripe dashboard, update your webhook endpoint to use the new Deno file:
- **Old**: Your previous Supabase-based webhook
- **New**: Use `stripe-webhook-updated.js` with Deno

## How It Works Now

### 1. User Registration Flow
1. User fills registration form
2. Redirected to Stripe checkout
3. After successful payment, Stripe sends webhook
4. Deno webhook calls your local backend
5. Backend creates user and sends verification email
6. User can verify email and log in

### 2. Email Verification
- Uses your Hostinger SMTP service
- Sends verification emails immediately after user creation
- Users must verify email before logging in

### 3. Security
- Webhook secret verification prevents unauthorized access
- All user data stored locally in your database
- No dependency on Supabase for authentication

## Testing

### 1. Test the New Endpoint
```bash
curl -X POST https://thediscourse.ai/api/auth/create-user-from-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer webhook_secret_2024_discourse_ai_secure_key" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "paymentIntentId": "pi_test123",
    "source": "test"
  }'
```

### 2. Test User Registration
1. Go through the registration flow
2. Complete Stripe payment
3. Check if user is created in database
4. Check if verification email is sent
5. Verify email and test login

## Benefits

✅ **No more Supabase dependency** for authentication
✅ **Local user management** with your own database
✅ **Immediate email verification** after payment
✅ **Secure webhook handling** with secret verification
✅ **Hostinger SMTP integration** for reliable email delivery

## Next Steps

1. **Update your .env file** with the correct SMTP host and webhook secret
2. **Deploy the updated server.js** to your backend
3. **Update your Stripe webhook** to use the new Deno file
4. **Test the complete flow** from registration to login
5. **Monitor logs** to ensure everything is working correctly

## Troubleshooting

### Email Not Sending
- Check SMTP_HOST is correct (should be `smtp.hostinger.com`)
- Verify SMTP credentials in .env
- Check server logs for SMTP errors

### Webhook Not Working
- Verify WEBHOOK_SECRET matches between .env and Deno webhook
- Check if backend endpoint is accessible
- Monitor server logs for webhook requests

### User Creation Failing
- Check database permissions
- Verify generateVerificationToken function exists
- Monitor server logs for detailed error messages
