@echo off
echo 🚀 Starting Discourse Learning Platform with PM2...
echo.

REM Check if PM2 is installed
pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PM2 is not installed. Installing PM2 globally...
    npm install -g pm2
    if %errorlevel% neq 0 (
        echo ❌ Failed to install PM2. Please install manually: npm install -g pm2
        pause
        exit /b 1
    )
)

echo ✅ PM2 is available
echo.

REM Stop any existing instances
echo 🔄 Stopping any existing instances...
pm2 stop discourse-app >nul 2>&1
pm2 delete discourse-app >nul 2>&1

REM Start the application
echo 🚀 Starting Discourse app...
pm2 start ecosystem.config.js

REM Show status
echo.
echo 📊 PM2 Status:
pm2 status

echo.
echo 📝 To view logs: pm2 logs discourse-app
echo 🛑 To stop: pm2 stop discourse-app
echo 🔄 To restart: pm2 restart discourse-app
echo 📊 To monitor: pm2 monit
echo.
echo ✅ Discourse app started with PM2!
pause
