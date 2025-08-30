@echo off
setlocal enabledelayedexpansion

REM VPS Deployment Script with PM2 (Windows)
REM This script deploys your application and restarts it using PM2

echo 🚀 Starting VPS deployment...

REM Configuration
set PROJECT_DIR=C:\path\to\your\project
set BRANCH=main
set PM2_APP_NAME=discours
set NODE_VERSION=18

REM Check if we're in the right directory
if not exist "package.json" (
    echo [ERROR] package.json not found. Please run this script from your project root.
    exit /b 1
)

REM Check if PM2 is installed
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PM2 is not installed. Installing PM2...
    npm install -g pm2
)

REM Check current branch
for /f "tokens=*" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if not "%CURRENT_BRANCH%"=="%BRANCH%" (
    echo [WARNING] Currently on branch '%CURRENT_BRANCH%'. Switching to '%BRANCH%'...
    git checkout %BRANCH%
)

echo [INFO] Pulling latest changes from %BRANCH%...
git pull origin %BRANCH%

echo [INFO] Installing dependencies...
npm ci --production

echo [INFO] Building project...
npm run build

echo [INFO] Checking PM2 status...
pm2 status

echo [INFO] Restarting application with PM2...
pm2 list | findstr "%PM2_APP_NAME%" >nul
if errorlevel 1 (
    echo [INFO] Application doesn't exist, starting new instance...
    pm2 start server.js --name %PM2_APP_NAME%
) else (
    echo [INFO] Application exists, restarting...
    pm2 restart %PM2_APP_NAME%
)

echo [INFO] Waiting for application to start...
timeout /t 5 /nobreak >nul

echo [INFO] PM2 Status:
pm2 status

echo [INFO] Recent logs:
pm2 logs %PM2_APP_NAME% --lines 20

echo [INFO] Checking application health...
curl -f http://localhost:3000/api/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Health check failed, but application might still be starting...
) else (
    echo [SUCCESS] Application is responding to health check!
)

echo [SUCCESS] Deployment completed successfully!
echo [INFO] Use 'pm2 logs discours' to view logs
echo [INFO] Use 'pm2 monit' to monitor resources
echo [INFO] Use 'pm2 restart discours' to restart manually

pause
