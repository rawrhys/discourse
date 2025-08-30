#!/bin/bash

# Deploy Fresh Build to VPS
# This script copies all files to VPS and runs a fresh build

set -e

# Configuration
VPS_HOST="your-vps-ip"
VPS_USER="root"
VPS_PATH="/root/discourse"
LOCAL_PATH="."

echo "🚀 Starting fresh deployment to VPS..."

# Build frontend locally first
echo "📦 Building frontend..."
npm run build

# Create backup on VPS
echo "💾 Creating backup on VPS..."
ssh $VPS_USER@$VPS_HOST << 'EOF'
cd /root/discourse
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup important files
if [ -f "server.js" ]; then cp server.js $BACKUP_DIR/; fi
if [ -d "dist" ]; then cp -r dist $BACKUP_DIR/; fi
if [ -f "package.json" ]; then cp package.json $BACKUP_DIR/; fi
if [ -f "package-lock.json" ]; then cp package-lock.json $BACKUP_DIR/; fi
if [ -f "ecosystem.config.js" ]; then cp ecosystem.config.js $BACKUP_DIR/; fi
if [ -f "db.json" ]; then cp db.json $BACKUP_DIR/; fi

echo "Backup created in $BACKUP_DIR"
EOF

# Copy all files to VPS
echo "📁 Copying files to VPS..."
rsync -avz --progress --exclude='node_modules' --exclude='.git' --exclude='.github' --exclude='logs' --exclude='*.log' $LOCAL_PATH/ $VPS_USER@$VPS_HOST:$VPS_PATH/

# Setup and build on VPS
echo "🔧 Setting up and building on VPS..."
ssh $VPS_USER@$VPS_HOST << 'EOF'
cd /root/discourse

# Set proper permissions
chmod 755 .
chmod 644 package.json package-lock.json ecosystem.config.js

# Install dependencies (including dev dependencies for build)
echo "Installing dependencies..."
npm ci

# Build frontend
echo "Building frontend..."
npm run build

# Ensure database directory exists
mkdir -p data

# Create db.json if it doesn't exist
if [ ! -f "db.json" ]; then
    echo '{"users":[],"courses":[],"images":[],"imageCache":[],"onboardingCompletions":[],"trialRecords":[],"deletedUsers":[]}' > db.json
fi

# Set proper permissions for database
chmod 644 db.json

# Restart PM2 process
if pm2 list | grep -q "discours"; then
    echo "Restarting existing PM2 process..."
    pm2 restart discours
else
    echo "Starting new PM2 process..."
    pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed successfully!"
echo "Server should be running on port 4003"
EOF

# Health check
echo "🏥 Running health check..."
sleep 10

if ssh $VPS_USER@$VPS_HOST "curl -f http://localhost:4003/api/health > /dev/null 2>&1"; then
    echo "✅ Server is running and responding"
else
    echo "❌ Server health check failed"
    exit 1
fi

# Show PM2 status
echo "📊 PM2 Status:"
ssh $VPS_USER@$VPS_HOST "pm2 list"

echo "🎉 Deployment completed successfully!"
echo "Your server is now running on the VPS with a fresh build!"
