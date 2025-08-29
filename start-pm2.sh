#!/bin/bash

echo "🚀 Starting Discourse Learning Platform with PM2..."
echo

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 is not installed. Installing PM2 globally..."
    npm install -g pm2
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install PM2. Please install manually: npm install -g pm2"
        exit 1
    fi
fi

echo "✅ PM2 is available"
echo

# Stop any existing instances
echo "🔄 Stopping any existing instances..."
pm2 stop discourse-app 2>/dev/null
pm2 delete discourse-app 2>/dev/null

# Start the application
echo "🚀 Starting Discourse app..."
pm2 start ecosystem.config.json

# Show status
echo
echo "📊 PM2 Status:"
pm2 status

echo
echo "📝 To view logs: pm2 logs discourse-app"
echo "🛑 To stop: pm2 stop discourse-app"
echo "🔄 To restart: pm2 restart discourse-app"
echo "📊 To monitor: pm2 monit"
echo
echo "✅ Discourse app started with PM2!"
