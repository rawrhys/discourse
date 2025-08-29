# Captcha Implementation Guide for Supabase Authentication

## 🎯 Overview

This guide explains how to properly implement captcha verification for Supabase authentication, solving the "captcha verification process failed" error.

## 🚨 Current Problem

Your Supabase project has captcha protection enabled, which is causing authentication failures:
- **Error**: `"captcha verification process failed"`
- **Status**: 500
- **Code**: `unexpected_failure`

## ✅ Solutions Available

### Option 1: Disable Captcha (Quick Fix for Development)

**Steps:**
1. Go to https://supabase.com/dashboard
2. Select project: `gaapqvkjblqvpokmhlmh`
3. Navigate to **Authentication → Settings → Security**
4. **Disable** Captcha Protection
5. Test authentication

**Pros:** Quick fix, no code changes needed
**Cons:** Reduces security, not suitable for production

### Option 2: Implement Proper Captcha Handling (Recommended)

**Steps:**
1. Integrate a captcha service (hCaptcha, reCAPTCHA, etc.)
2. Update authentication code to include captcha tokens
3. Handle captcha errors gracefully
4. Test with real captcha tokens

**Pros:** Maintains security, production-ready
**Cons:** Requires development time, captcha service setup

### Option 3: Use Supabase Client (Simplest)

**Steps:**
1. Replace direct API calls with Supabase client methods
2. Let the client handle captcha automatically
3. Minimal code changes required

**Pros:** Automatic captcha handling, minimal code changes
**Cons:** Less control over the authentication process

## 🚀 Implementing Option 2: Proper Captcha Handling

### Step 1: Choose a Captcha Service

#### hCaptcha (Recommended)
- **Website**: https://www.hcaptcha.com/
- **Free Tier**: 1M requests/month
- **Integration**: Easy React integration
- **Cost**: Free for most use cases

#### reCAPTCHA v3
- **Website**: https://developers.google.com/recaptcha
- **Free Tier**: 1M requests/month
- **Integration**: Google's solution
- **Cost**: Free for most use cases

### Step 2: Install Captcha Dependencies

```bash
# For hCaptcha
npm install @hcaptcha/react-hcaptcha

# For reCAPTCHA
npm install react-google-recaptcha
```

### Step 3: Update Frontend Components

#### Login Component with hCaptcha
```jsx
import React, { useState, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const captchaRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!captchaToken) {
      setError('Please complete the captcha verification');
      return;
    }

    try {
      await login(email, password, captchaToken);
      // Handle successful login
    } catch (error) {
      setError(error.message);
      // Reset captcha on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  const onCaptchaVerify = (token) => {
    setCaptchaToken(token);
    setError(''); // Clear any previous errors
  };

  const onCaptchaExpire = () => {
    setCaptchaToken(null);
    setError('Captcha expired. Please try again.');
  };

  const onCaptchaError = (err) => {
    setCaptchaToken(null);
    setError('Captcha error. Please try again.');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      
      <HCaptcha
        ref={captchaRef}
        sitekey="your-hcaptcha-site-key"
        onVerify={onCaptchaVerify}
        onExpire={onCaptchaExpire}
        onError={onCaptchaError}
      />
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={!captchaToken}>
        Login
      </button>
    </form>
  );
};

export default Login;
```

#### Register Component with hCaptcha
```jsx
import React, { useState, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useAuth } from '../../contexts/AuthContext';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [captchaToken, setCaptchaToken] = useState(null);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const captchaRef = useRef();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!captchaToken) {
      setError('Please complete the captcha verification');
      return;
    }

    try {
      await register(email, password, name, { captchaToken });
      // Handle successful registration
    } catch (error) {
      setError(error.message);
      // Reset captcha on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    }
  };

  const onCaptchaVerify = (token) => {
    setCaptchaToken(token);
    setError('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full Name"
        required
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      
      <HCaptcha
        ref={captchaRef}
        sitekey="your-hcaptcha-site-key"
        onVerify={onCaptchaVerify}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
      />
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={!captchaToken}>
        Register
      </button>
    </form>
  );
};

export default Register;
```

### Step 4: Update Environment Variables

Add your captcha service keys to `.env`:

```bash
# hCaptcha
VITE_HCAPTCHA_SITE_KEY=your-hcaptcha-site-key
HCAPTCHA_SECRET_KEY=your-hcaptcha-secret-key

# reCAPTCHA
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret-key
```

### Step 5: Test the Implementation

```bash
# Test with captcha handling
node test-supabase-with-captcha.js
```

## 🔧 Testing Your Captcha Implementation

### 1. Test Without Captcha Token
- Should fail with captcha error
- Error message should be clear about captcha requirement

### 2. Test With Valid Captcha Token
- Should succeed if captcha is valid
- Should fail if captcha is invalid/expired

### 3. Test Captcha Expiration
- Complete captcha, wait for expiration
- Try to authenticate with expired token
- Should fail with appropriate error

## 🎯 Best Practices

### 1. User Experience
- Show captcha early in the form
- Clear error messages for captcha issues
- Reset captcha on authentication errors
- Disable submit button until captcha is complete

### 2. Security
- Validate captcha tokens on both frontend and backend
- Use HTTPS for all captcha requests
- Implement rate limiting for failed attempts
- Log captcha failures for monitoring

### 3. Error Handling
- Specific error messages for different captcha issues
- Graceful fallback when captcha service is unavailable
- User-friendly retry mechanisms

## 🚨 Troubleshooting

### Common Issues:

1. **"Invalid captcha token"**
   - Token expired
   - Wrong site key
   - Token already used

2. **"Captcha service unavailable"**
   - Check captcha service status
   - Verify API keys
   - Check network connectivity

3. **"Captcha verification failed"**
   - User didn't complete captcha
   - Captcha service error
   - Invalid request format

### Debug Steps:

1. Check browser console for errors
2. Verify captcha service configuration
3. Test captcha service independently
4. Check Supabase logs for detailed errors
5. Verify environment variables are set correctly

## 🏁 Next Steps

1. **Choose your captcha service** (hCaptcha recommended)
2. **Implement captcha in your components** (use examples above)
3. **Test thoroughly** with the provided test scripts
4. **Deploy and monitor** for any issues
5. **Consider rate limiting** and additional security measures

## 📚 Additional Resources

- [hCaptcha Documentation](https://docs.hcaptcha.com/)
- [reCAPTCHA Documentation](https://developers.google.com/recaptcha)
- [Supabase Authentication Docs](https://supabase.com/docs/guides/auth)
- [React Captcha Integration Examples](https://github.com/hCaptcha/react-hcaptcha)

With proper captcha implementation, your authentication will be both secure and user-friendly!
