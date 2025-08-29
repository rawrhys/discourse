# Deployment Guide for Discourse Learning Platform

This guide explains how to deploy and manage the Discourse Learning Platform using the provided deployment scripts and process manager.

## 🚀 Quick Start

### Option 1: Using the Process Manager (Recommended)
```bash
# Start server with auto-restart
node process-manager.js start

# Check status
node process-manager.js status

# Restart server
node process-manager.js restart

# Stop server
node process-manager.js stop
```

### Option 2: Using Deployment Scripts
```bash
# Linux/Mac
./deploy.sh deploy

# Windows
deploy.bat deploy
```

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- All environment variables configured in `.env` file
- Port 4003 available (or change in scripts)

## 🛠️ Deployment Tools

### 1. Process Manager (`process-manager.js`)

The process manager is a Node.js application that:
- ✅ **Automatically restarts** the server if it crashes
- ✅ **Manages PID files** for process tracking
- ✅ **Logs all output** to `discourse.log`
- ✅ **Handles graceful shutdowns**
- ✅ **Limits restart attempts** to prevent infinite loops

#### Commands:
```bash
node process-manager.js start    # Start with auto-restart
node process-manager.js status   # Show current status
node process-manager.js restart  # Manual restart
node process-manager.js stop     # Stop server
```

#### Features:
- **Auto-restart**: Server automatically restarts if it crashes
- **Restart limits**: Maximum 10 restart attempts
- **Restart delay**: 5-second delay between restarts
- **Logging**: All server output captured in `discourse.log`
- **PID tracking**: Process ID saved in `discourse.pid`

### 2. Deployment Scripts

#### Linux/Mac (`deploy.sh`)
```bash
./deploy.sh deploy   # Build and deploy
./deploy.sh start    # Start server
./deploy.sh stop     # Stop server
./deploy.sh restart  # Restart server
./deploy.sh status   # Show status
./deploy.sh logs     # Show logs
./deploy.sh health   # Health check
```

#### Windows (`deploy.bat`)
```cmd
deploy.bat deploy   # Build and deploy
deploy.bat start    # Start server
deploy.bat stop     # Stop server
deploy.bat restart  # Restart server
deploy.bat status   # Show status
deploy.bat logs     # Show logs
deploy.bat health   # Health check
```

## 🔄 Deployment Process

### 1. Build and Deploy
```bash
# This will:
# 1. Install dependencies
# 2. Build the frontend
# 3. Stop existing server
# 4. Start new server
# 5. Verify server is running

node process-manager.js start
# OR
./deploy.sh deploy
```

### 2. Verify Deployment
```bash
# Check server status
node process-manager.js status

# Check health endpoint
curl http://localhost:4003/api/health

# View logs
tail -f discourse.log
```

## 🚨 Troubleshooting

### Server Won't Start
1. **Check port availability**:
   ```bash
   netstat -tulpn | grep :4003
   ```

2. **Check environment variables**:
   ```bash
   cat .env
   ```

3. **Check logs**:
   ```bash
   cat discourse.log
   ```

### Server Crashes Repeatedly
1. **Check restart count**:
   ```bash
   node process-manager.js status
   ```

2. **Review error logs**:
   ```bash
   tail -f discourse.log
   ```

3. **Check system resources**:
   ```bash
   free -h
   df -h
   ```

### Port Already in Use
```bash
# Find process using port 4003
lsof -i :4003

# Kill the process
kill -9 <PID>

# Or change port in scripts
```

## 🔧 Configuration

### Change Port
Edit the scripts and change:
```bash
set PORT=4003  # Windows
PORT=4003      # Linux/Mac
```

### Change Log Files
Edit the scripts and change:
```bash
set LOG_FILE=./discourse.log  # Windows
LOG_FILE="./discourse.log"    # Linux/Mac
```

### Environment Variables
Ensure your `.env` file contains:
```bash
NODE_ENV=production
PORT=4003
HOST=127.0.0.1
# ... other required variables
```

## 📊 Monitoring

### Health Check Endpoint
```bash
curl http://localhost:4003/api/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": { ... },
  "version": "v18.17.0",
  "platform": "linux",
  "pid": 12345
}
```

### Log Files
- **Server logs**: `discourse.log`
- **PID file**: `discourse.pid`
- **Process manager logs**: Console output

## 🚀 Production Deployment

### 1. Set up as System Service (Linux)
```bash
# Create systemd service file
sudo nano /etc/systemd/system/discourse.service
```

Service file content:
```ini
[Unit]
Description=Discourse Learning Platform
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/your/app
ExecStart=/usr/bin/node /path/to/your/app/process-manager.js start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable discourse
sudo systemctl start discourse
sudo systemctl status discourse
```

### 2. Use Screen/Tmux (Alternative)
```bash
# Start in screen session
screen -S discourse
node process-manager.js start

# Detach: Ctrl+A, D
# Reattach: screen -r discourse
```

### 3. Use Nohup (Simple)
```bash
nohup node process-manager.js start > discourse-manager.log 2>&1 &
```

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **Port Binding**: Bind to `127.0.0.1` for local access only
3. **Process Isolation**: Run as dedicated user, not root
4. **Log Rotation**: Implement log rotation for production
5. **Monitoring**: Set up monitoring and alerting

## 📝 Maintenance

### Regular Tasks
1. **Check server status**: `node process-manager.js status`
2. **Review logs**: `tail -f discourse.log`
3. **Monitor resources**: Check CPU, memory, disk usage
4. **Update dependencies**: `npm update`

### Backup
1. **Database**: Backup `data/db.json`
2. **Logs**: Archive old log files
3. **Configuration**: Backup `.env` and scripts

## 🆘 Support

If you encounter issues:

1. **Check logs**: `cat discourse.log`
2. **Check status**: `node process-manager.js status`
3. **Check health**: `curl http://localhost:4003/api/health`
4. **Review this guide** for troubleshooting steps

## 📚 Additional Resources

- [Node.js Process Management](https://nodejs.org/api/process.html)
- [Systemd Service Management](https://systemd.io/)
- [Linux Process Management](https://www.gnu.org/software/bash/manual/bash.html)
