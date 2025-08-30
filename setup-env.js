#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Setting up environment variables for the application...\n');

// Check if .env file already exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Backing up to .env.backup...');
  fs.copyFileSync(envPath, path.join(__dirname, '.env.backup'));
}

// Create .env file with the correct values
const envContent = `# Frontend API Configuration
VITE_API_BASE_URL=https://thediscourse.ai
FRONTEND_URL=https://thediscourse.ai

# Backend Server Configuration
PORT=4003
HOST=0.0.0.0

# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Mistral AI API Key (required for course generation)
# Get your API key from: https://console.mistral.ai/
# API keys should start with "mist-"
MISTRAL_API_KEY=mist-your-actual-api-key-here

# Supabase Configuration (required for user authentication)
SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
# Optional: Service role key for admin operations (e.g., account deletion)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

# Frontend Supabase Configuration
VITE_SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE

# Stripe Configuration (optional - for payments)
STRIPE_SECRET_KEY=your-stripe-secret-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret-here

# Frontend Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here

# Build path for static files
BUILD_PATH=./dist

# Pixabay (optional fallback for images)
PIXABAY_API_KEY=your-pixabay-api-key-here

# Admin emails allowed to access maintenance endpoints (comma-separated)
# Leave empty to allow any authenticated user
ADMIN_EMAILS=admin@example.com

# Email Configuration for Problem Reports
# Choose one of the following options:

# Option 1: SMTP Server (Recommended - Use your own SMTP server)
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com

# Option 2: Webhook-based email service (Zapier, Make.com, etc.)
# EMAIL_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-url

# Option 3: Resend API (https://resend.com)
# EMAIL_API_KEY=re_your-resend-api-key-here

# Option 4: EmailJS (https://www.emailjs.com) - Free tier available
# EMAILJS_SERVICE_ID=your-service-id
# EMAILJS_TEMPLATE_ID=your-template-id
# EMAILJS_USER_ID=your-user-id
`;

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📝 Please review and update the following values:');
  console.log('   - JWT_SECRET: Change to a secure random string');
  console.log('   - MISTRAL_API_KEY: Add your Mistral AI API key');
  console.log('   - SMTP settings: Configure if you want email functionality');
  console.log('   - Stripe keys: Configure if you want payment functionality');
  console.log('\n🔄 Now restart your server for the changes to take effect:');
  console.log('   npm run stop');
  console.log('   npm run start');
} catch (error) {
  console.error('❌ Failed to create .env file:', error.message);
  console.log('\n📝 Please manually create a .env file with the following content:');
  console.log(envContent);
}
