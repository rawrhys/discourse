#!/bin/bash

# Let's Encrypt + Nginx Setup - Quick Commands
# Run these commands on your Ubuntu VPS (31.97.115.145)
# Replace 'your-domain.com' with your actual domain name

echo "=== Let's Encrypt + Nginx Setup ==="
echo "IMPORTANT: Replace 'your-domain.com' with your actual domain!"
echo ""

# Step 1: Install packages
echo "Step 1: Installing nginx and certbot..."
sudo apt update && sudo apt upgrade -y
sudo apt install nginx certbot python3-certbot-nginx -y

# Step 2: Start nginx
echo "Step 2: Starting nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Step 3: Configure firewall (optional)
echo "Step 3: Configuring firewall..."
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH

# Step 4: Create nginx config (manual step)
echo "Step 4: Creating nginx configuration..."
echo "Run this command and paste the nginx config:"
echo "sudo nano /etc/nginx/sites-available/course-backend"
echo ""
echo "--- Copy this nginx config ---"
cat << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

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
EOF
echo "--- End nginx config ---"
echo ""

# Step 5: Enable site and test
echo "Step 5: After creating the config file, run these commands:"
echo "sudo ln -s /etc/nginx/sites-available/course-backend /etc/nginx/sites-enabled/"
echo "sudo rm /etc/nginx/sites-enabled/default"
echo "sudo nginx -t"
echo "sudo systemctl restart nginx"
echo ""

# Step 6: Get SSL certificate
echo "Step 6: Get SSL certificate (replace with your domain):"
echo "sudo certbot --nginx -d your-domain.com -d www.your-domain.com"
echo ""

# Step 7: Test setup
echo "Step 7: Test the setup:"
echo "sudo systemctl status nginx"
echo "sudo certbot certificates"
echo "sudo certbot renew --dry-run"
echo ""

echo "=== Setup Complete! ==="
echo "Don't forget to update your frontend .env file with:"
echo "VITE_API_BASE_URL=https://your-domain.com" 