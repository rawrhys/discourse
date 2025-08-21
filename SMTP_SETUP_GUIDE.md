# SMTP Email Setup for Problem Reports

## Quick Setup

Add these environment variables to your backend deployment:

```
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
```

## Configuration Details

- **SMTP_HOST**: Your SMTP server address (e.g., smtp.gmail.com, smtp.outlook.com, or your own server)
- **SMTP_PORT**: Usually 587 (TLS) or 465 (SSL)
- **SMTP_SECURE**: Set to 'true' for port 465, 'false' for port 587
- **SMTP_USER**: Your SMTP username/email
- **SMTP_PASS**: Your SMTP password
- **SMTP_FROM**: The "from" email address (can be same as SMTP_USER)

## Common SMTP Settings

### Gmail
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Outlook/Hotmail
```
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

### Custom SMTP Server
```
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
```

## Testing

Once you've added the environment variables:
1. Restart your server
2. Submit a test problem report
3. Check your email at admin@thediscourse.ai
4. Check server logs for email confirmation

The system will automatically send emails to **admin@thediscourse.ai** whenever someone submits a problem report.
