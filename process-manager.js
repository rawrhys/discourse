#!/usr/bin/env node

/**
 * Simple Process Manager for Discourse Learning Platform
 * Automatically restarts the server if it crashes
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class ProcessManager {
  constructor() {
    this.process = null;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.restartDelay = 5000; // 5 seconds
    this.isShuttingDown = false;
    
    // Configuration
    this.scriptPath = './server.js';
    this.pidFile = './discourse.pid';
    this.logFile = './discourse.log';
    
    // Handle process termination
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('exit', () => this.cleanup());
  }

  start() {
    console.log('🚀 Starting Discourse Learning Platform...');
    console.log(`📁 Script: ${this.scriptPath}`);
    console.log(`📝 Logs: ${this.logFile}`);
    
    this.spawnProcess();
  }

  spawnProcess() {
    if (this.isShuttingDown) return;

    console.log(`🔄 Starting server (attempt ${this.restartCount + 1}/${this.maxRestarts + 1})...`);
    
    // Create log file if it doesn't exist
    const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    
    // Spawn the server process
    this.process = spawn('node', [this.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    // Save PID to file
    fs.writeFileSync(this.pidFile, this.process.pid.toString());
    console.log(`✅ Server started with PID: ${this.process.pid}`);

    // Handle stdout
    this.process.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logStream.write(`[${new Date().toISOString()}] ${output}\n`);
        console.log(`📤 [SERVER] ${output}`);
      }
    });

    // Handle stderr
    this.process.stderr.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logStream.write(`[${new Date().toISOString()}] ERROR: ${output}\n`);
        console.error(`❌ [SERVER ERROR] ${output}`);
      }
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      console.log(`🔄 Server process exited with code: ${code}, signal: ${signal}`);
      
      if (this.isShuttingDown) {
        console.log('🛑 Shutdown requested, not restarting');
        this.cleanup();
        process.exit(0);
      }

      if (this.restartCount < this.maxRestarts) {
        this.restartCount++;
        console.log(`⏰ Restarting in ${this.restartDelay / 1000} seconds... (${this.restartCount}/${this.maxRestarts})`);
        
        setTimeout(() => {
          this.spawnProcess();
        }, this.restartDelay);
      } else {
        console.error(`💥 Maximum restart attempts (${this.maxRestarts}) reached. Server will not restart automatically.`);
        console.error('🔧 Please check the logs and restart manually.');
        this.cleanup();
        process.exit(1);
      }
    });

    // Handle process errors
    this.process.on('error', (error) => {
      console.error(`💥 Failed to start server: ${error.message}`);
      logStream.write(`[${new Date().toISOString()}] PROCESS ERROR: ${error.message}\n`);
    });

    // Log stream error handling
    logStream.on('error', (error) => {
      console.error(`💥 Log stream error: ${error.message}`);
    });
  }

  restart() {
    console.log('🔄 Manual restart requested...');
    this.restartCount = 0;
    
    if (this.process) {
      this.process.kill('SIGTERM');
    } else {
      this.spawnProcess();
    }
  }

  stop() {
    console.log('🛑 Stopping server...');
    this.isShuttingDown = true;
    
    if (this.process) {
      this.process.kill('SIGTERM');
      
      // Force kill after 10 seconds if still running
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          console.log('💥 Force killing server...');
          this.process.kill('SIGKILL');
        }
      }, 10000);
    }
  }

  status() {
    if (this.process) {
      const pid = this.process.pid;
      const uptime = process.uptime();
      console.log('📊 Server Status:');
      console.log(`✅ Status: Running`);
      console.log(`🆔 PID: ${pid}`);
      console.log(`⏱️  Uptime: ${Math.floor(uptime)}s`);
      console.log(`🔄 Restarts: ${this.restartCount}/${this.maxRestarts}`);
      console.log(`📁 PID File: ${this.pidFile}`);
      console.log(`📝 Log File: ${this.logFile}`);
    } else {
      console.log('📊 Server Status:');
      console.log('❌ Status: Not Running');
      console.log(`📁 PID File: ${this.pidFile}`);
      console.log(`📝 Log File: ${this.logFile}`);
    }
  }

  cleanup() {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
        console.log('🧹 Cleaned up PID file');
      }
    } catch (error) {
      console.error('⚠️  Error cleaning up PID file:', error.message);
    }
  }

  shutdown() {
    console.log('\n🛑 Shutdown requested...');
    this.isShuttingDown = true;
    this.stop();
  }
}

// CLI interface
const manager = new ProcessManager();

const command = process.argv[2];

switch (command) {
  case 'start':
    manager.start();
    break;
    
  case 'restart':
    manager.restart();
    break;
    
  case 'stop':
    manager.stop();
    break;
    
  case 'status':
    manager.status();
    break;
    
  default:
    console.log('Discourse Learning Platform Process Manager');
    console.log('');
    console.log('Usage: node process-manager.js <command>');
    console.log('');
    console.log('Commands:');
    console.log('  start    - Start the server with auto-restart');
    console.log('  restart  - Restart the server');
    console.log('  stop     - Stop the server');
    console.log('  status   - Show server status');
    console.log('');
    console.log('Examples:');
    console.log('  node process-manager.js start    # Start server');
    console.log('  node process-manager.js status   # Check status');
    console.log('  node process-manager.js stop     # Stop server');
    break;
}
