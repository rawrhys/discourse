module.exports = {
  apps: [
    {
      name: 'discourse-app',
      script: './server.cjs',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 4003
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4003
      },
      // Process management
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 5000,
      wait_ready: true,
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Monitoring
      min_uptime: '10s',
      max_restarts: 10,
      
      // Environment variables
      env_file: '.env',
      
      // Graceful shutdown
      listen_timeout: 8000,
      shutdown_with_message: true,
      
      // Health check
      health_check_grace_period: 3000,
      
      // Performance
      node_args: '--max-old-space-size=4096',
      
      // Security
      uid: null,
      gid: null,
      
      // Additional options
      source_map_support: true,
      disable_source_map_support: false,
      
      // Custom PM2 options
      pmx: true,
      vizion: false,
      
      // Merge logs
      merge_logs: true,
      
      // Ignore watch patterns
      ignore_watch: [
        'node_modules',
        'logs',
        'dist',
        '.git',
        '*.log'
      ]
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'node',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'https://github.com/rawrhys/discourse.git',
      path: '/var/www/discourse',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': ''
    }
  }
};
