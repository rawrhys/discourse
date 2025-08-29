# Supabase Dashboard Settings Checklist

## Authentication Settings to Verify

### 1. Go to Supabase Dashboard
- URL: https://supabase.com/dashboard
- Project: gaapqvkjblqvpokmhlmh

### 2. Authentication → Settings → External OAuth & Email
- ✅ **Email & Password**: Must be toggled ON
- ✅ **Enable email confirmations**: Should be ON (for security)
- ✅ **Allow unverified email sign-in**: Should be OFF (for security)

### 3. Authentication → Email Templates
- Verify confirmation email template exists
- Check redirect URL: `https://thediscourse.ai/verify-email`

### 4. Check User Status
Run this SQL query in SQL Editor:
```sql
SELECT email,
       email_confirmed_at,
       is_super_admin,
       banned_until,
       deleted_at,
       encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = 'test@example.com';
```

### 5. Check Auth Logs
- Go to Logs → Filter by "auth"
- Look for failed login attempts
- Note the exact error message

## Current Issues Found
1. **Request Format**: Sending JSON instead of form-encoded data
2. **Content-Type**: Using `application/json` instead of `application/x-www-form-urlencoded`
3. **Missing Proper Error Handling**: Need to handle Supabase-specific errors

## Next Steps After Verification
1. Fix the authentication request format
2. Update error handling for Supabase responses
3. Test with proper form-encoded requests
4. Verify email confirmation flow works
