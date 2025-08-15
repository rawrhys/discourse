# React Template

A modern React application template with Vite, Tailwind CSS, and more.

## Features

- ⚡️ Vite for fast development and building
- 🎨 Tailwind CSS for styling
- 🔧 ESLint for code linting
- 📱 Responsive design
- 🚀 Optimized for production

## Getting Started
       hi there
1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Build for production: `npm run build`

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