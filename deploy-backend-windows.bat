@echo off
echo 🚀 Preparing Backend Files for VPS Deployment...
echo.

REM Check if we're in the right directory
if not exist "server.js" (
    echo ❌ Error: server.js not found. Please run this script from the project root.
    exit /b 1
)

if not exist "src\services\StudentProgressService.js" (
    echo ❌ Error: StudentProgressService.js not found. Please ensure the file exists.
    exit /b 1
)

echo 📦 Preparing files for deployment...

REM Create a temporary deployment directory
set DEPLOY_DIR=deploy_temp_%RANDOM%
mkdir %DEPLOY_DIR%

REM Copy essential backend files
echo 📋 Copying backend files...
copy server.js %DEPLOY_DIR%\
copy package.json %DEPLOY_DIR%\
copy package-lock.json %DEPLOY_DIR%\
copy ecosystem.config.cjs %DEPLOY_DIR%\

REM Copy the src/services directory
echo 📋 Copying services directory...
mkdir %DEPLOY_DIR%\src\services
xcopy src\services\* %DEPLOY_DIR%\src\services\ /E /I /Y

REM Copy other essential directories
if exist "server" (
    echo 📋 Copying server directory...
    xcopy server\* %DEPLOY_DIR%\server\ /E /I /Y
)

if exist "data" (
    echo 📋 Copying data directory...
    xcopy data\* %DEPLOY_DIR%\data\ /E /I /Y
)

echo ✅ Files prepared for deployment
echo.

echo 📁 Files to upload to VPS:
dir %DEPLOY_DIR% /B
echo.

echo 🎯 Next Steps:
echo 1. Upload the contents of '%DEPLOY_DIR%\' to your VPS server
echo 2. SSH into your VPS server
echo 3. Navigate to your backend directory
echo 4. Run: pm2 restart discourse-app
echo 5. Check logs: pm2 logs discourse-app
echo.

echo 🔧 Manual VPS Update Steps:
echo 1. SSH to your VPS: ssh user@your-vps-ip
echo 2. Navigate to backend: cd /path/to/your/backend
echo 3. Stop the app: pm2 stop discourse-app
echo 4. Upload new files (via SFTP/SCP or git pull)
echo 5. Install dependencies: npm install
echo 6. Start the app: pm2 start discourse-app
echo 7. Check status: pm2 status
echo 8. Monitor logs: pm2 logs discourse-app --lines 50
echo.

echo 📊 Deployment Summary:
echo ✅ Backend files prepared
echo ✅ StudentProgressService.js included
echo ✅ Ready for VPS upload
echo.

echo ⚠️  Important: Make sure to restart the PM2 process after uploading!
echo    pm2 restart discourse-app
echo.

echo 🧹 Cleanup:
echo After successful deployment, you can remove the temporary directory:
echo rmdir /s /q %DEPLOY_DIR%
echo.

pause

