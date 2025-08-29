@echo off
echo 🚀 Starting Discourse Learning Platform with PM2...
echo.

REM Check if PM2 is available locally
npx pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ PM2 is not available. Please run: npm install pm2 --save-dev
    pause
    exit /b 1
)

echo ✅ PM2 is available
echo.

REM Stop any existing instances
echo 🔄 Stopping any existing instances...
npx pm2 stop discourse-app >nul 2>&1
npx pm2 delete discourse-app >nul 2>&1

REM Start the application
echo 🚀 Starting Discourse app...
npx pm2 start ecosystem.config.json

REM Show status
echo.
echo 📊 PM2 Status:
npx pm2 status

echo.
echo 📝 To view logs: npx pm2 logs discourse-app
echo 🛑 To stop: npx pm2 stop discourse-app
echo 🔄 To restart: npx pm2 restart discourse-app
echo 📊 To monitor: npx pm2 monit
echo.
echo ✅ Discourse app started with PM2!
pause
