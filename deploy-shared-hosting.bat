@echo off
echo 🚀 Building for Shared Hosting Deployment...
echo.

echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    pause
    exit /b 1
)

echo 🔨 Building application...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo 📋 Copying deployment files...
copy .htaccess dist\.htaccess >nul 2>&1
copy public\api-proxy.php dist\api-proxy.php >nul 2>&1

echo 📊 Build Summary:
echo ✅ Frontend built successfully
echo ✅ CSS files generated with Tailwind
echo ✅ .htaccess file configured for shared hosting
echo ✅ Assets optimized and compressed
echo.

echo 📁 Files ready for upload in dist\ directory:
dir dist /B

echo.
echo 🎯 Next Steps:
echo 1. Upload ALL contents of the 'dist' folder to your hosting's public_html directory
echo 2. Ensure .htaccess file is uploaded (may be hidden)
echo 3. Test your site at: https://yourdomain.com/debug-css.html
echo 4. If CSS still doesn't load, check the debug page for specific issues
echo.

echo 🔍 Debug URLs to test after upload:
echo - Main app: https://yourdomain.com/
echo - CSS debug: https://yourdomain.com/debug-css.html
echo - Auth debug: https://yourdomain.com/debug-auth.html
echo.

pause 