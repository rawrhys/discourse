module.exports = {
  apps: [{
    name: 'discourse-app',
    script: 'server.js',
    watch: false,
    env: {
      "NODE_ENV": "production",
      "PORT": 4003,
      "HOST": "127.0.0.1",
      "TRUST_PROXY": "1",
      "BACKEND_PUBLIC_URL": "https://api.thediscourse.ai",
      "CORS_ALLOWED_ORIGINS": "https://thediscourse.ai,https://api.thediscourse.ai",
      "SUPABASE_REDIRECT_URL": "https://thediscourse.ai",
      "VITE_API_BASE_URL": "https://api.thediscourse.ai",
      "JWT_SECRET": "3VZ4eeAbeY/q9n4tKT2p15DHoEaUtcjke0YmIXdWCzvimV3S66N+w0zlPHdOQfLRzh7+wce2kBR3vv+KE9vhDw==",
      "SUPABASE_URL": "https://gaapqvkjblqvpokmhlmh.supabase.co",
      "SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE",
      "VITE_SUPABASE_URL": "https://gaapqvkjblqvpokmhlmh.supabase.co",
      "VITE_SUPABASE_ANON_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE",
      "MISTRAL_API_KEY": "U6H9sL8iT1oGHb0UGrcP2LCtSlLArxcD",
      "STRIPE_SECRET_KEY": "sk_live_51RdxSMFNQjl8MEDK7VYVUa09KMVQrIKn3PsBU4GWX4VnHzaauUk1FPl1XCmzsuVUdID8EqyTTRzKPdSvz",
      "STRIPE_WEBHOOK_SECRET": "pk_live_51RdxSMFNQjl8MEDKrhjj7o2yqul1fICsuElLfWyio6Unf2C1G00tGDilwXaJVh6jQ0FTlnFD4nfQ6",
      "PIXABAY_API_KEY": "50334893-d400c4c9c21f87c28cb7d46c2",
      "BUILD_PATH": "./dist",
      "DB_PATH": "./data/db.json",
      "DEBUG_IMAGE": "0"
    }
  }]
}; 