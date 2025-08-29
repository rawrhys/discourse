#!/bin/bash

# Discourse Learning Platform Deployment Script
# This script handles building and deploying the application with automatic server restart

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="discourse-app"
PORT=4003
PID_FILE="./discourse.pid"
LOG_FILE="./discourse.log"

# Function to log with timestamp
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# Function to log errors
log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

# Function to log warnings
log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Function to check if server is running
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0  # Server is running
        else
            # PID file exists but process is dead, clean it up
            rm -f "$PID_FILE"
        fi
    fi
    return 1  # Server is not running
}

# Function to stop server
stop_server() {
    if is_server_running; then
        local pid=$(cat "$PID_FILE")
        log "Stopping server (PID: $pid)..."
        
        # Try graceful shutdown first
        kill -TERM "$pid" 2>/dev/null || true
        
        # Wait for graceful shutdown
        local count=0
        while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        # Force kill if still running
        if ps -p "$pid" > /dev/null 2>&1; then
            log_warn "Force killing server..."
            kill -KILL "$pid" 2>/dev/null || true
        fi
        
        rm -f "$PID_FILE"
        log "Server stopped"
    else
        log "Server is not running"
    fi
}

# Function to start server
start_server() {
    log "Starting server..."
    
    # Start server in background with proper logging
    nohup node server.js > "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # Save PID to file
    echo "$pid" > "$PID_FILE"
    
    # Wait for server to start
    log "Waiting for server to start..."
    local count=0
    while [ $count -lt 30 ]; do
        if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
            log "✅ Server started successfully (PID: $pid)"
            log "📊 Server is responding on port $PORT"
            return 0
        fi
        sleep 1
        count=$((count + 1))
    done
    
    # If we get here, server failed to start
    log_error "❌ Server failed to start within 30 seconds"
    log_error "Check logs at: $LOG_FILE"
    rm -f "$PID_FILE"
    return 1
}

# Function to build the application
build_app() {
    log "Building application..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log "Installing dependencies..."
        npm install
    fi
    
    # Build the frontend
    log "Building frontend..."
    npm run build
    
    log "✅ Build completed"
}

# Function to check server health
check_health() {
    if is_server_running; then
        local pid=$(cat "$PID_FILE")
        if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
            log "✅ Server is healthy (PID: $pid)"
            return 0
        else
            log_warn "⚠️  Server process exists but not responding"
            return 1
        fi
    else
        log_warn "⚠️  Server is not running"
        return 1
    fi
}

# Function to restart server
restart_server() {
    log "Restarting server..."
    stop_server
    sleep 2
    start_server
}

# Function to show server status
show_status() {
    echo "📊 Server Status:"
    echo "=================="
    
    if is_server_running; then
        local pid=$(cat "$PID_FILE")
        echo "✅ Status: Running"
        echo "🆔 PID: $pid"
        echo "🌐 Port: $PORT"
        echo "📁 PID File: $PID_FILE"
        echo "📝 Log File: $LOG_FILE"
        
        # Check if server is responding
        if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
            echo "💚 Health: Healthy"
        else
            echo "⚠️  Health: Not Responding"
        fi
    else
        echo "❌ Status: Not Running"
        echo "📁 PID File: $PID_FILE (not found)"
        echo "📝 Log File: $LOG_FILE"
    fi
}

# Main deployment logic
main() {
    case "${1:-deploy}" in
        "deploy")
            log "Starting deployment process..."
            
            # Build the application
            build_app
            
            # Stop existing server
            stop_server
            
            # Start new server
            if start_server; then
                log "🎉 Deployment completed successfully!"
                show_status
            else
                log_error "💥 Deployment failed!"
                exit 1
            fi
            ;;
            
        "start")
            if is_server_running; then
                log_warn "Server is already running"
                show_status
            else
                start_server
            fi
            ;;
            
        "stop")
            stop_server
            ;;
            
        "restart")
            restart_server
            ;;
            
        "status")
            show_status
            ;;
            
        "logs")
            if [ -f "$LOG_FILE" ]; then
                tail -f "$LOG_FILE"
            else
                log_warn "No log file found"
            fi
            ;;
            
        "health")
            check_health
            ;;
            
        *)
            echo "Usage: $0 {deploy|start|stop|restart|status|logs|health}"
            echo ""
            echo "Commands:"
            echo "  deploy   - Build and deploy the application (default)"
            echo "  start    - Start the server if not running"
            echo "  stop     - Stop the server"
            echo "  restart  - Restart the server"
            echo "  status   - Show server status"
            echo "  logs     - Show live logs"
            echo "  health   - Check server health"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
