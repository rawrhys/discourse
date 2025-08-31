# Fix Stripe Webhook Logic - Step by Step

## Problem Identified
The current Stripe webhook in your `server.js` is **missing verification token storage**. Users are created but without the `verificationToken` field, so email verification can't work.

## What Needs to Be Fixed

### Current Code (WRONG):
```javascript
// Create new user account
const newUser = {
  id: generateId(),
  email: registrationEmail.toLowerCase(),
  password: registrationPassword,
  name: registrationEmail.split('@')[0],
  createdAt: new Date().toISOString(),
  emailVerified: false,
  // ❌ MISSING: verificationToken and verificationTokenCreatedAt
  stripeSubscriptionId: session.subscription,
  // ... other fields
};
```

### Corrected Code (RIGHT):
```javascript
// Create new user account with proper verification token
const verificationToken = generateVerificationToken();
const newUser = {
  id: generateId(),
  email: registrationEmail.toLowerCase(),
  password: registrationPassword,
  name: registrationEmail.split('@')[0],
  createdAt: new Date().toISOString(),
  emailVerified: false,
  verificationToken: verificationToken,                    // ✅ ADD THIS
  verificationTokenCreatedAt: new Date().toISOString(),   // ✅ ADD THIS
  stripeSubscriptionId: session.subscription,
  // ... other fields
};
```

## Step-by-Step Fix

### Step 1: Locate the Webhook Section
In your `server.js`, find this section:
```javascript
// Handle registration subscription (new users)
if (session.metadata?.registrationEmail) {
  // ... existing code
  } else {
    // Create new user account
    const newUser = {
      // ... user object
    };
  }
}
```

### Step 2: Replace the User Creation Logic
Replace the entire `else` block (lines ~7812-7840) with this corrected version:

```javascript
} else {
  // Create new user account with proper verification token
  const verificationToken = generateVerificationToken();
  const newUser = {
    id: generateId(),
    email: registrationEmail.toLowerCase(),
    password: registrationPassword, // Note: In production, this should be hashed
    name: registrationEmail.split('@')[0], // Use email prefix as name
    createdAt: new Date().toISOString(),
    emailVerified: false,
    verificationToken: verificationToken,
    verificationTokenCreatedAt: new Date().toISOString(),
    stripeSubscriptionId: session.subscription,
    subscriptionStatus: 'active',
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    courseCredits: 10, // Give initial credits
    gdprConsent: true,
    policyVersion: '1.0',
    source: 'stripe_registration'
  };
  
  db.data.users.push(newUser);
  console.log(`[Stripe] Created new user account: ${registrationEmail} with ID: ${newUser.id}`);
  
  // Save to database first
  await db.write();
  console.log(`[Stripe] User saved to database: ${registrationEmail}`);
  
  // Send email verification email
  try {
    console.log(`[Stripe] Attempting to send verification email to: ${registrationEmail}`);
    console.log(`[Stripe] SMTP Configuration:`, {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER ? 'SET' : 'NOT SET',
      pass: process.env.SMTP_PASS ? 'SET' : 'NOT SET'
    });
    
    await sendVerificationEmail(registrationEmail, verificationToken, newUser.name);
    console.log(`[Stripe] Email verification sent successfully to: ${registrationEmail}`);
    
    // Update user record to confirm email was sent
    newUser.verificationEmailSent = true;
    newUser.verificationEmailSentAt = new Date().toISOString();
    await db.write();
    
  } catch (emailError) {
    console.error('[Stripe] Failed to send email verification:', emailError);
    console.error('[Stripe] Email error details:', {
      message: emailError.message,
      stack: emailError.stack
    });
    
    // Mark that email failed but don't fail the user creation
    newUser.verificationEmailSent = false;
    newUser.verificationEmailError = emailError.message;
    await db.write();
  }
}
```

### Step 3: Remove the Old Email Logic
After the user creation block, **remove** this old code:
```javascript
// ❌ REMOVE THIS OLD CODE:
await db.write();
console.log(`[Stripe] User account setup completed for: ${registrationEmail}`);

// Send email verification email
try {
  const verificationToken = generateVerificationToken();
  await sendVerificationEmail(registrationEmail, verificationToken, registrationEmail.split('@')[0]);
  console.log(`[Stripe] Email verification sent to: ${registrationEmail}`);
} catch (emailError) {
  console.error('[Stripe] Failed to send email verification:', emailError);
}
```

### Step 4: Test the Fix
1. **Save server.js**
2. **Restart your server**
3. **Register a new user** through Stripe
4. **Check server logs** for the new messages
5. **Verify user appears** in db.json with verification token

## Expected Results After Fix

### Server Logs:
```
[Stripe] Registration subscription started for email: user@example.com
[Stripe] Created new user account: user@example.com with ID: stripe_1234567890
[Stripe] User saved to database: user@example.com
[Stripe] Attempting to send verification email to: user@example.com
[Stripe] SMTP Configuration: { host: 'smtp.hostinger.com', port: '587', user: 'SET', pass: 'SET' }
[Stripe] Email verification sent successfully to: user@example.com
[Stripe] User account setup completed for: user@example.com
```

### Database Entry:
```json
{
  "id": "stripe_1234567890",
  "email": "user@example.com",
  "emailVerified": false,
  "verificationToken": "abc123...",
  "verificationTokenCreatedAt": "2024-01-30T...",
  "verificationEmailSent": true,
  "verificationEmailSentAt": "2024-01-30T...",
  "stripeSubscriptionId": "sub_...",
  "subscriptionStatus": "active"
}
```

## Why This Fixes the Issue

1. **Verification tokens are now stored** in the user record
2. **Users are saved to database** before sending emails
3. **Email verification can work** because tokens are properly stored
4. **Login will work** after email verification
5. **Comprehensive logging** for debugging

## After Applying the Fix

- ✅ Users will be created in local database
- ✅ Verification emails will be sent via SMTP
- ✅ Users can verify email and log in
- ✅ No more 401 login errors
- ✅ Complete user registration flow works
