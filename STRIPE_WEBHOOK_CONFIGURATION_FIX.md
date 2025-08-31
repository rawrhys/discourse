# Stripe Webhook Configuration Fix

## Problem Identified
The Stripe payment flow creates a checkout session successfully, but the webhook is never triggered, so:
- User details are never recorded in `db.json`
- Registration email is never sent via SMTP
- Users can't log in after payment

## Root Cause
**Stripe is not sending webhooks to your server** after successful payment completion.

## Solution Steps

### Step 1: Verify Webhook Endpoint in Stripe Dashboard

1. **Login to Stripe Dashboard**: https://dashboard.stripe.com/
2. **Go to Developers → Webhooks**
3. **Check if webhook exists** for your domain
4. **Verify the webhook URL** should be: `https://thediscourse.ai/api/stripe/webhook`

### Step 2: Create/Update Webhook in Stripe

If no webhook exists, create one:

1. **Click "Add endpoint"**
2. **Enter endpoint URL**: `https://thediscourse.ai/api/stripe/webhook`
3. **Select events to listen for**:
   - `checkout.session.completed` ✅ (Required for registration)
   - `customer.subscription.created` ✅ (Optional)
   - `invoice.payment_succeeded` ✅ (Optional)
   - `invoice.payment_failed` ✅ (Optional)

### Step 3: Verify Webhook Secret

1. **Copy the webhook signing secret** from Stripe dashboard
2. **Update your `.env` file**:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret_from_stripe
   ```
3. **Restart your server** after updating the environment variable

### Step 4: Test Webhook Delivery

1. **In Stripe Dashboard**, go to your webhook
2. **Click "Send test webhook"**
3. **Select event**: `checkout.session.completed`
4. **Click "Send test webhook"**
5. **Check your server logs** for webhook receipt

### Step 5: Monitor Webhook Delivery

1. **In Stripe Dashboard**, check webhook delivery status
2. **Look for failed deliveries** (red indicators)
3. **Check response codes** - should be 200 OK
4. **Review error messages** if webhooks are failing

## Current Status Check

### ✅ What's Working
- Stripe checkout session creation ✅
- Webhook endpoint accessibility ✅
- Webhook signature verification ✅
- User creation logic ✅
- Email sending logic ✅

### ❌ What's Not Working
- Stripe webhook delivery to your server ❌
- User account creation after payment ❌
- Email verification sending ❌

## Environment Variables to Verify

Make sure these are set in your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=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
STRIPE_PUBLISHABLE_KEY=pk_live_51RzaHbBTrJ3tlY9wyNScSIpVlUPyGKTtpE9nbBpTy4c5WdQmrUDUAGrzXlF5qgtf7jsgilsnHsRnsQEmbx3Z2w2R00Fo9gN6QD
STRIPE_WEBHOOK_SECRET=whsec_BtLjUh9KktzKs3P6tHvoveZSAoBfO4fB

# SMTP Configuration (Fix the host)
SMTP_HOST=smtp.hostinger.com  # ❌ Currently: your-smtp-hostinger.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=admin@thediscourse.ai
SMTP_PASS=Bobsburgers90?
SMTP_FROM=admin@thediscourse.ai
```

## Immediate Actions Required

1. **Fix SMTP host** in `.env` file:
   ```bash
   SMTP_HOST=smtp.hostinger.com
   ```

2. **Verify webhook URL** in Stripe dashboard matches:
   ```
   https://thediscourse.ai/api/stripe/webhook
   ```

3. **Enable webhook events** for `checkout.session.completed`

4. **Test webhook delivery** using Stripe's test feature

5. **Restart server** after environment changes

## Testing the Fix

1. **Update environment variables**
2. **Restart server**
3. **Create test webhook in Stripe dashboard**
4. **Send test webhook event**
5. **Verify user creation in logs**
6. **Check email delivery**

## Expected Flow After Fix

1. User completes Stripe payment ✅
2. Stripe sends webhook to your server ✅
3. Server creates user account in `db.json` ✅
4. Server sends verification email via SMTP ✅
5. User can verify email and log in ✅

## Troubleshooting

### If webhook still doesn't work:
1. Check Stripe dashboard for webhook delivery failures
2. Verify webhook URL is exactly correct
3. Ensure webhook events are enabled
4. Check server logs for webhook receipt
5. Verify webhook secret is correct

### If user creation fails:
1. Check database write permissions
2. Verify `generateId()` and `generateVerificationToken()` functions exist
3. Check SMTP configuration
4. Review server error logs

## Next Steps

1. **Fix SMTP host** in `.env` file
2. **Configure webhook in Stripe dashboard**
3. **Test webhook delivery**
4. **Verify user creation flow**
5. **Test complete registration process**
