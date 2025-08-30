# VPS Deployment with PM2

This directory contains deployment scripts and workflows for deploying your Discourse AI application to a VPS using PM2 for process management.

## 🚀 Deployment Options

### 1. **GitHub Actions (Recommended)**
- **File**: `.github/workflows/deploy-vps.yml`
- **Trigger**: Automatically deploys on push to `main` branch
- **Features**: 
  - Builds project
  - Deploys to VPS via SSH
  - Restarts server using PM2
  - Verifies deployment

### 2. **Shell Script (Linux/Mac)**
- **File**: `deploy-vps.sh`
- **Usage**: Run manually on VPS
- **Features**: 
  - Pulls latest code
  - Installs dependencies
  - Builds project
  - Restarts with PM2

### 3. **Batch File (Windows)**
- **File**: `deploy-vps.bat`
- **Usage**: Run manually on Windows VPS
- **Features**: Same as shell script but for Windows

## ⚙️ Setup Required

### **GitHub Secrets**
Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```bash
VPS_HOST=your.vps.ip.address
VPS_USERNAME=your_username
VPS_SSH_KEY=your_private_ssh_key
VPS_PORT=22  # Optional, defaults to 22
```

### **VPS Configuration**
1. **Install PM2**: `npm install -g pm2`
2. **Setup SSH Key Authentication**
3. **Update Project Path** in scripts:
   - Shell: Update `PROJECT_DIR` in `deploy-vps.sh`
   - Batch: Update `PROJECT_DIR` in `deploy-vps.bat`
   - GitHub Actions: Update path in workflow

## 🔧 PM2 Commands

### **Basic PM2 Operations**
```bash
# Start application
pm2 start server.js --name discourse-app

# Restart application
pm2 restart discourse-app

# Stop application
pm2 stop discourse-app

# View status
pm2 status

# View logs
pm2 logs discourse-app

# Monitor resources
pm2 monit
```

### **PM2 Configuration**
Create `ecosystem.config.js` for advanced PM2 configuration:

```javascript
module.exports = {
  apps: [{
    name: 'discours',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

## 📋 Deployment Process

### **Automatic (GitHub Actions)**
1. Push to `main` branch
2. GitHub Actions builds project
3. Deploys to VPS via SSH
4. Restarts server using PM2
5. Verifies deployment

### **Manual (Scripts)**
1. Run deployment script on VPS
2. Script pulls latest code
3. Installs dependencies
4. Builds project
5. Restarts with PM2
6. Shows status and logs

## 🔍 Troubleshooting

### **Common Issues**
- **PM2 not found**: Run `npm install -g pm2`
- **Permission denied**: Check SSH key and user permissions
- **Port already in use**: Check if another instance is running
- **Build fails**: Check Node.js version and dependencies

### **Debug Commands**
```bash
# Check PM2 status
pm2 status

# View detailed logs
pm2 logs discourse-app --lines 100

# Check system resources
pm2 monit

# Restart with fresh logs
pm2 restart discourse-app && pm2 logs discourse-app
```

### **Health Check**
The deployment scripts check if your server responds to:
- `http://localhost:3000/api/health`

Make sure your server has a health endpoint or update the URL in the scripts.

## 📁 File Structure
```
├── .github/workflows/
│   └── deploy-vps.yml          # GitHub Actions workflow
├── deploy-vps.sh               # Linux/Mac deployment script
├── deploy-vps.bat              # Windows deployment script
├── ecosystem.config.js          # PM2 configuration (optional)
└── DEPLOYMENT_VPS_README.md    # This file
```

## 🎯 Next Steps

1. **Update project paths** in scripts
2. **Configure GitHub secrets** for automatic deployment
3. **Test deployment** with a small change
4. **Monitor logs** to ensure everything works
5. **Setup PM2 ecosystem config** for production use

## 🆘 Support

If you encounter issues:
1. Check PM2 logs: `pm2 logs discours`
2. Verify SSH connectivity
3. Check file permissions
4. Review GitHub Actions logs
5. Test manual deployment first
