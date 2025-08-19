#!/bin/bash

echo "🚀 Deploying Backend to VPS Server..."
echo ""

# Check if we're in the right directory
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js not found. Please run this script from the project root."
    exit 1
fi

if [ ! -f "src/services/TTSService.js" ]; then
    echo "❌ Error: TTSService.js not found. Please ensure the file exists."
    exit 1
fi

echo "📦 Preparing files for deployment..."

# Create a temporary deployment directory
DEPLOY_DIR="deploy_temp_$(date +%s)"
mkdir -p $DEPLOY_DIR

# Copy essential backend files
echo "📋 Copying backend files..."
cp server.js $DEPLOY_DIR/
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp ecosystem.config.cjs $DEPLOY_DIR/

# Copy the updated TTSService.js
mkdir -p $DEPLOY_DIR/src/services/
cp src/services/TTSService.js $DEPLOY_DIR/src/services/

# Copy other essential directories
if [ -d "src/services" ]; then
    cp -r src/services/* $DEPLOY_DIR/src/services/
fi

if [ -d "server" ]; then
    cp -r server/* $DEPLOY_DIR/server/
fi

if [ -d "data" ]; then
    cp -r data $DEPLOY_DIR/
fi

echo "✅ Files prepared for deployment"
echo ""

echo "📁 Files to upload to VPS:"
ls -la $DEPLOY_DIR/
echo ""

echo "🎯 Next Steps:"
echo "1. Upload the contents of '$DEPLOY_DIR/' to your VPS server"
echo "2. SSH into your VPS server"
echo "3. Navigate to your backend directory"
echo "4. Run: pm2 restart discourse-app"
echo "5. Check logs: pm2 logs discourse-app"
echo ""

echo "🔧 Manual VPS Update Steps:"
echo "1. SSH to your VPS: ssh user@your-vps-ip"
echo "2. Navigate to backend: cd /path/to/your/backend"
echo "3. Stop the app: pm2 stop discourse-app"
echo "4. Upload new files (via SFTP/SCP or git pull)"
echo "5. Install dependencies: npm install"
echo "6. Start the app: pm2 start discourse-app"
echo "7. Check status: pm2 status"
echo "8. Monitor logs: pm2 logs discourse-app --lines 50"
echo ""

echo "🧹 Cleanup:"
echo "After successful deployment, you can remove the temporary directory:"
echo "rm -rf $DEPLOY_DIR"
echo ""

echo "📊 Deployment Summary:"
echo "✅ Backend files prepared"
echo "✅ TTSService.js updated with stop logic fixes"
echo "✅ Ready for VPS upload"
echo ""

echo "⚠️  Important: Make sure to restart the PM2 process after uploading!"
echo "   pm2 restart discourse-app"
echo ""
