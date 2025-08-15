# Let's Encrypt + Nginx Setup Guide for Ubuntu VPS

## Prerequisites
- Ubuntu VPS at 31.97.115.145
- Domain name pointing to your VPS (required for SSL certificate)
- Backend service running on port 4002

## Step 1: Install Required Packages

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install nginx
sudo apt install nginx -y

# Install certbot and nginx plugin
sudo apt install certbot python3-certbot-nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 2: Configure Firewall (if enabled)

```bash
# Allow nginx traffic
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH

# Check firewall status
sudo ufw status
```

## Step 3: Create Nginx Configuration

Create the nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/course-backend
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Redirect all HTTP requests to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL configuration will be added by certbot

    location / {
        proxy_pass http://localhost:4002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }
}
```

## Step 4: Enable the Site

```bash
# Create symbolic link to enable the site
sudo ln -s /etc/nginx/sites-available/course-backend /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

## Step 5: Obtain SSL Certificate

**IMPORTANT**: Replace `your-domain.com` with your actual domain name.

```bash
# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts:
# 1. Enter email address
# 2. Agree to terms of service
# 3. Choose whether to share email with EFF
# 4. Certbot will automatically configure SSL
```

## Step 6: Verify Setup

```bash
# Check nginx status
sudo systemctl status nginx

# Check SSL certificate
sudo certbot certificates

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 7: Update Your Frontend Configuration

After successful SSL setup, update your `.env` file:

```bash
# Replace with your actual domain
VITE_API_BASE_URL=https://your-domain.com

# Keep Supabase configuration unchanged
VITE_SUPABASE_URL=https://gaapqvkjblqvpokmhlmh.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-key
```

## Step 8: Test the Setup

1. Visit `https://your-domain.com` in browser
2. Should redirect to HTTPS and show valid SSL certificate
3. API calls should work without mixed content errors

## Troubleshooting

### Common Issues:

1. **Domain not pointing to VPS**: Update DNS A record
2. **Port 80/443 blocked**: Check firewall settings
3. **Backend not running**: Ensure your Node.js server is running on port 4002
4. **SSL renewal fails**: Check nginx configuration syntax

### Useful Commands:

```bash
# Check nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check nginx access logs
sudo tail -f /var/log/nginx/access.log

# Restart nginx
sudo systemctl restart nginx

# Check if backend is running
sudo netstat -tulpn | grep :4002

# Check SSL certificate status
sudo certbot certificates
```

## Alternative: If You Don't Have a Domain

If you don't have a domain name, you can use these alternatives:

1. **Free subdomain services**: No-IP, DuckDNS, FreeDNS
2. **Self-signed certificate** (not recommended for production)
3. **Use ngrok** (temporary solution)

## Auto-Renewal

Certbot automatically sets up a cron job for certificate renewal. Verify with:

```bash
sudo systemctl list-timers | grep certbot
```

Certificates will auto-renew every 60 days. 