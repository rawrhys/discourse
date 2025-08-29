@echo off
setlocal enabledelayedexpansion

REM Discourse Learning Platform Deployment Script for Windows
REM This script handles building and deploying the application with automatic server restart

echo 🚀 Starting deployment...

REM Configuration
set APP_NAME=discourse-app
set PORT=4003
set PID_FILE=discourse.pid
set LOG_FILE=discourse.log

REM Function to log with timestamp
:log
echo [%date% %time%] %~1
goto :eof

REM Function to log errors
:log_error
echo [%date% %time%] ERROR: %~1
goto :eof

REM Function to log warnings
:log_warn
echo [%date% %time%] WARNING: %~1
goto :eof

REM Function to check if server is running
:is_server_running
if exist "%PID_FILE%" (
    set /p pid=<"%PID_FILE%"
    tasklist /FI "PID eq !pid!" 2>nul | find /I "node.exe" >nul
    if !errorlevel! equ 0 (
        exit /b 0
    ) else (
        REM PID file exists but process is dead, clean it up
        del "%PID_FILE%" 2>nul
    )
)
exit /b 1

REM Function to stop server
:stop_server
call :is_server_running
if !errorlevel! equ 0 (
    set /p pid=<"%PID_FILE%"
    call :log "Stopping server (PID: !pid!)..."
    
    REM Try graceful shutdown first
    taskkill /PID !pid! /F 2>nul
    
    REM Wait for process to end
    set count=0
    :wait_loop
    tasklist /FI "PID eq !pid!" 2>nul | find /I "node.exe" >nul
    if !errorlevel! equ 0 (
        if !count! lss 10 (
            timeout /t 1 /nobreak >nul
            set /a count+=1
            goto wait_loop
        )
    )
    
    del "%PID_FILE%" 2>nul
    call :log "Server stopped"
) else (
    call :log "Server is not running"
)
goto :eof

REM Function to start server
:start_server
call :log "Starting server..."

REM Start server in background
start /B node server.js > "%LOG_FILE%" 2>&1

REM Get the PID of the started process
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| find "node.exe"') do (
    set pid=%%a
    set pid=!pid:"=!
)

REM Save PID to file
echo !pid! > "%PID_FILE%"

REM Wait for server to start
call :log "Waiting for server to start..."
set count=0
:start_wait_loop
curl -s "http://localhost:%PORT%/api/health" >nul 2>&1
if !errorlevel! equ 0 (
    call :log "✅ Server started successfully (PID: !pid!)"
    call :log "📊 Server is responding on port %PORT%"
    exit /b 0
)
if !count! lss 30 (
    timeout /t 1 /nobreak >nul
    set /a count+=1
    goto start_wait_loop
)

REM If we get here, server failed to start
call :log_error "❌ Server failed to start within 30 seconds"
call :log_error "Check logs at: %LOG_FILE%"
del "%PID_FILE%" 2>nul
exit /b 1

REM Function to build the application
:build_app
call :log "Building application..."

REM Install dependencies if needed
if not exist "node_modules" (
    call :log "Installing dependencies..."
    npm install
)

REM Build the frontend
call :log "Building frontend..."
npm run build

call :log "✅ Build completed"
goto :eof

REM Function to check server health
:check_health
call :is_server_running
if !errorlevel! equ 0 (
    set /p pid=<"%PID_FILE%"
    curl -s "http://localhost:%PORT%/api/health" >nul 2>&1
    if !errorlevel! equ 0 (
        call :log "✅ Server is healthy (PID: !pid!)"
        exit /b 0
    ) else (
        call :log_warn "⚠️  Server process exists but not responding"
        exit /b 1
    )
) else (
    call :log_warn "⚠️  Server is not running"
    exit /b 1
)
goto :eof

REM Function to restart server
:restart_server
call :log "Restarting server..."
call :stop_server
timeout /t 2 /nobreak >nul
call :start_server
goto :eof

REM Function to show server status
:show_status
echo 📊 Server Status:
echo ==================
call :is_server_running
if !errorlevel! equ 0 (
    set /p pid=<"%PID_FILE%"
    echo ✅ Status: Running
    echo 🆔 PID: !pid!
    echo 🌐 Port: %PORT%
    echo 📁 PID File: %PID_FILE%
    echo 📝 Log File: %LOG_FILE%
    
    REM Check if server is responding
    curl -s "http://localhost:%PORT%/api/health" >nul 2>&1
    if !errorlevel! equ 0 (
        echo 💚 Health: Healthy
    ) else (
        echo ⚠️  Health: Not Responding
    )
) else (
    echo ❌ Status: Not Running
    echo 📁 PID File: %PID_FILE% (not found)
    echo 📝 Log File: %LOG_FILE%
)
goto :eof

REM Main deployment logic
if "%1"=="" goto deploy
if "%1"=="deploy" goto deploy
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="status" goto status
if "%1"=="logs" goto logs
if "%1"=="health" goto health
goto usage

:deploy
call :log "Starting deployment process..."
call :build_app
call :stop_server
call :start_server
if !errorlevel! equ 0 (
    call :log "🎉 Deployment completed successfully!"
    call :show_status
) else (
    call :log_error "💥 Deployment failed!"
    exit /b 1
)
goto :eof

:start
call :is_server_running
if !errorlevel! equ 0 (
    call :log_warn "Server is already running"
    call :show_status
) else (
    call :start_server
)
goto :eof

:stop
call :stop_server
goto :eof

:restart
call :restart_server
goto :eof

:status
call :show_status
goto :eof

:logs
if exist "%LOG_FILE%" (
    type "%LOG_FILE%"
) else (
    call :log_warn "No log file found"
)
goto :eof

:health
call :check_health
goto :eof

:usage
echo Usage: %0 {deploy^|start^|stop^|restart^|status^|logs^|health}
echo.
echo Commands:
echo   deploy   - Build and deploy the application (default)
echo   start    - Start the server if not running
echo   stop     - Stop the server
echo   restart  - Restart the server
echo   status   - Show server status
echo   logs     - Show logs
echo   health   - Check server health
exit /b 1

:end
