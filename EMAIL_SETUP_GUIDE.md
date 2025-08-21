# Email Setup Guide for Problem Reports

The problem report system is currently logging reports to the console but not sending email notifications because email configuration is not set up.

## Current Status
✅ Problem reports are being submitted and logged successfully  
❌ Email notifications are not being sent to admin@thediscourse.ai

## Quick Setup Options

### Option 1: EmailJS (Recommended - Free)
1. Go to [EmailJS](https://www.emailjs.com/) and create a free account
2. Create an email service (Gmail, Outlook, etc.)
3. Create an email template
4. Get your credentials and add them to your environment variables:
   ```
   EMAILJS_SERVICE_ID=your-service-id
   EMAILJS_TEMPLATE_ID=your-template-id
   EMAILJS_USER_ID=your-user-id
   ```

### Option 2: Resend API
1. Go to [Resend](https://resend.com/) and create an account
2. Get your API key
3. Add to environment variables:
   ```
   EMAIL_API_KEY=re_your-api-key-here
   ```

### Option 3: Webhook (Zapier/Make.com)
1. Create a Zapier or Make.com account
2. Set up a webhook that sends emails
3. Add to environment variables:
   ```
   EMAIL_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-url
   ```

## For Immediate Testing
If you want to test the system without setting up email, the problem reports are currently being logged to the console with all the details. You can check the server logs to see the reports.

## Next Steps
1. Choose one of the email setup options above
2. Add the required environment variables to your deployment
3. Restart the server
4. Test the problem report system again

The email will be sent to: **admin@thediscourse.ai**
