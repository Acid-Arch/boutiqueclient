module.exports = {
  apps: [
    {
      name: 'boutique-client-portal',
      script: 'build/index.js',
      cwd: '/opt/boutique-client/app',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      
      // Environment configuration
      env: {
        NODE_ENV: 'development',
        PORT: 5173
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Load production environment variables
        dotenv: '.env.production'
      },
      
      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      
      // Memory and performance
      max_memory_restart: '1G',
      
      // Logging configuration
      log_file: '/opt/boutique-client/logs/app-combined.log',
      out_file: '/opt/boutique-client/logs/app-out.log',
      error_file: '/opt/boutique-client/logs/app-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Advanced PM2 features
      watch: false, // Disabled in production
      ignore_watch: [
        'node_modules',
        'logs',
        '.git'
      ],
      
      // Health monitoring
      health_check_grace_period: 30000,
      
      // Process management
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // Source map support
      source_map_support: true,
      
      // Instance configuration
      instance_var: 'INSTANCE_ID',
      
      // PM2 instance tracking
      PM2_INSTANCE_ID: process.env.NODE_APP_INSTANCE || 0
    },
    
    // Separate WebSocket server configuration
    {
      name: 'boutique-websocket-server',
      script: 'scripts/standalone-websocket-server.ts',
      interpreter: 'tsx',
      cwd: '/opt/boutique-client/app',
      instances: 1, // Single instance for WebSocket coordination
      
      env: {
        NODE_ENV: 'development',
        WS_PORT: 8743
      },
      
      env_production: {
        NODE_ENV: 'production',
        WS_PORT: 8081
      },
      
      // Auto restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      restart_delay: 2000,
      
      // Memory limits
      max_memory_restart: '512M',
      
      // Logging
      log_file: '/opt/boutique-client/logs/ws-combined.log',
      out_file: '/opt/boutique-client/logs/ws-out.log',
      error_file: '/opt/boutique-client/logs/ws-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // No watch in production
      watch: false,
      
      // Health check
      health_check_grace_period: 10000
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'boutique-client',
      host: ['5.78.147.68'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/boutique-client-portal.git',
      path: '/opt/boutique-client',
      
      // Pre-deployment commands
      'pre-deploy-local': '',
      'post-deploy': 'npm ci --production && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /opt/boutique-client/logs'
    },
    
    staging: {
      user: 'boutique-client',
      host: ['5.78.147.68'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/boutique-client-portal.git',
      path: '/opt/boutique-client-staging',
      
      'post-deploy': 'npm ci --production && PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate && npm run build && pm2 reload ecosystem.config.js --env staging'
    }
  }
};