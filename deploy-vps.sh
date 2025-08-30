#!/bin/bash

# VPS Deployment Script with PM2
# This script deploys your application and restarts it using PM2

set -e  # Exit on any error

echo "🚀 Starting VPS deployment..."

# Configuration
PROJECT_DIR="/path/to/your/project"  # Update this path
BRANCH="main"
PM2_APP_NAME="discours"
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from your project root."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_error "PM2 is not installed. Installing PM2..."
    npm install -g pm2
fi

# Check if we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    print_warning "Currently on branch '$CURRENT_BRANCH'. Switching to '$BRANCH'..."
    git checkout $BRANCH
fi

print_status "Pulling latest changes from $BRANCH..."
git pull origin $BRANCH

print_status "Installing dependencies..."
npm ci --production

print_status "Building project..."
npm run build

print_status "Checking PM2 status..."
pm2 status

print_status "Restarting application with PM2..."
if pm2 list | grep -q "$PM2_APP_NAME"; then
    print_status "Application exists, restarting..."
    pm2 restart $PM2_APP_NAME
else
    print_status "Application doesn't exist, starting new instance..."
    pm2 start server.js --name $PM2_APP_NAME
fi

print_status "Waiting for application to start..."
sleep 5

print_status "PM2 Status:"
pm2 status

print_status "Recent logs:"
pm2 logs $PM2_APP_NAME --lines 20

print_status "Checking application health..."
if curl -f http://localhost:3000/health &> /dev/null; then
    print_success "Application is responding to health check!"
else
    print_warning "Health check failed, but application might still be starting..."
fi

print_status "System resources:"
pm2 monit --no-daemon &
MONIT_PID=$!
sleep 10
kill $MONIT_PID 2>/dev/null || true

print_success "Deployment completed successfully!"
print_status "Use 'pm2 logs discours' to view logs"
print_status "Use 'pm2 monit' to monitor resources"
print_status "Use 'pm2 restart discours' to restart manually"
