@echo off
echo Setting up environment variables for Supabase authentication...
echo.

echo Creating .env file...
(
echo # Frontend API Configuration
echo VITE_API_BASE_URL=https://thediscourse.ai
echo FRONTEND_URL=https://thediscourse.ai
echo.
echo # Backend Server Configuration
echo PORT=4003
echo HOST=0.0.0.0
echo.
echo # JWT Secret for authentication
echo JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
echo.
echo # Supabase Configuration ^(REQUIRED for authentication^)
echo SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
echo SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
echo.
echo # Frontend Supabase Configuration
echo VITE_SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
echo VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE
echo.
echo # Stripe Configuration ^(optional - for payments^)
echo STRIPE_SECRET_KEY=your-stripe-secret-key-here
echo STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here
echo STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret-here
echo.
echo # Frontend Stripe Configuration
echo VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key-here
echo.
echo # Build path for static files
echo BUILD_PATH=./dist
echo.
echo # Pixabay ^(optional fallback for images^)
echo PIXABAY_API_KEY=your-pixabay-api-key-here
echo.
echo # Admin emails allowed to access maintenance endpoints ^(comma-separated^)
echo # Leave empty to allow any authenticated user
echo ADMIN_EMAILS=admin@example.com
echo.
echo # Email Configuration for Problem Reports
echo # Choose one of the following options:
echo.
echo # Option 1: SMTP Server ^(Recommended - Use your own SMTP server^)
echo SMTP_HOST=your-smtp-server.com
echo SMTP_PORT=587
echo SMTP_SECURE=false
echo SMTP_USER=your-smtp-username
echo SMTP_PASS=your-smtp-password
echo SMTP_FROM=noreply@yourdomain.com
echo.
echo # Option 2: Webhook-based email service ^(Zapier, Make.com, etc.^)
echo # EMAIL_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-url
echo.
echo # Option 3: Resend API ^(https://resend.com^)
echo # EMAIL_API_KEY=re_your-resend-api-key-here
echo.
echo # Option 4: EmailJS ^(https://www.emailjs.com^) - Free tier available
echo # EMAILJS_SERVICE_ID=your-service-id
echo # EMAILJS_TEMPLATE_ID=your-template-id
echo # EMAILJS_USER_ID=your-user-id
) > .env

echo .env file created successfully!
echo.
echo IMPORTANT: You need to get your Supabase Service Role Key from your Supabase dashboard:
echo 1. Go to https://supabase.com/dashboard
echo 2. Select your project: gaapqvkjblqvpokmhlmh
echo 3. Go to Settings ^> API
echo 4. Copy the "service_role" key
echo 5. Replace "your-supabase-service-role-key-here" in the .env file
echo.
echo After updating the .env file, restart your development server.
echo.
pause
