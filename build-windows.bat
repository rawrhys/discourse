@echo off
echo Cleaning previous build...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite

echo Setting Node.js memory limit and building...
node --max-old-space-size=4096 node_modules/vite/dist/node/cli.js build

if %errorlevel% neq 0 (
    echo Build failed with error code %errorlevel%
    pause
    exit /b %errorlevel%
)

echo Running compression...
node compress.js

if %errorlevel% neq 0 (
    echo Compression failed with error code %errorlevel%
    pause
    exit /b %errorlevel%
)

echo Build completed successfully!
pause

