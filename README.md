# React Template

A modern React application template with Vite, Tailwind CSS, and more.

## Features

- ⚡️ Vite for fast development and building
- 🎨 Tailwind CSS for styling
- 🔧 ESLint for code linting
- 📱 Responsive design
- 🚀 Optimized for production

## Getting Started
       
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Build for production: `npm run build`

## Email Verification System

The application now includes a comprehensive email verification system that requires users to verify their email address before accessing the platform.

### Features

- ✅ SMTP-based email delivery
- ✅ Secure verification tokens
- ✅ 24-hour token expiration
- ✅ Resend verification functionality
- ✅ Integration with Supabase authentication

### Configuration

1. Set up your SMTP server credentials
2. Configure the following environment variables:
   - `SMTP_HOST`: Your SMTP server address
   - `SMTP_PORT`: SMTP port (usually 587 or 465)
   - `SMTP_USER`: Your SMTP username
   - `SMTP_PASS`: Your SMTP password
   - `SMTP_FROM`: From email address
   - `FRONTEND_URL`: Your frontend URL for verification links

### How It Works

1. User registers an account
2. Verification email is sent via SMTP
3. User clicks verification link in email
4. Account is verified and user can log in
5. Unverified users cannot access protected routes

For detailed setup instructions, see `EMAIL_VERIFICATION_SETUP.md`.

## Stripe Integration

The application includes Stripe payment integration for purchasing course credits.

### Configuration

1. Set up your Stripe account and get your API keys
2. Configure the following environment variables:
   - `STRIPE_SECRET_KEY`: Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET`: Your Stripe webhook secret

### Payment Flow

1. Users click "Buy More Credits" to purchase 10 credits for £20
2. They are redirected to the Stripe checkout page
3. After successful payment, they are redirected back to the dashboard
4. Credits are automatically added to their account

### Setting up Success URL

To ensure credits are added after payment, configure your Stripe checkout page to redirect to:
```
https://your-domain.com/dashboard?payment=success
```

This will trigger the automatic credit addition process.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.
This is a template for a React application.
Triggering deployment.
