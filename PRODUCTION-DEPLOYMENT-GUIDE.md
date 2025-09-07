# Production Deployment Guide - Boutique Client Portal

## Overview

This guide provides step-by-step instructions for deploying the Boutique Client Portal to a production server. Follow this guide carefully to ensure a secure and successful production deployment.

**🚨 IMPORTANT**: This deployment is Docker-free and uses native Node.js with PM2 process management.

## ⚡ Quick Start - Automated Deployment

**NEW**: We've created automated deployment scripts that handle the entire deployment process for you!

### For IP-Only Deployment (Testing on Hetzner 5.78.147.68)

```bash
# 1. Initial server setup (run once)
./scripts/deploy-to-hetzner.sh setup

# 2. Deploy the application
./scripts/deploy-to-hetzner.sh deploy

# 3. Test the deployment
./scripts/deploy-to-hetzner.sh test

# 4. Access your application
# Open: http://5.78.147.68:3000
# Login: admin / boutique2024! or client / client2024!
```

**Quick operations:**
```bash
./scripts/quick-deploy.sh deploy    # Quick redeploy
./scripts/quick-deploy.sh status    # Check status
./scripts/quick-deploy.sh restart   # Restart services
./scripts/quick-deploy.sh test      # Test endpoints
```

## 📋 Deployment Options

### Option 1: IP-Only Deployment (Recommended for Testing)
- **Target**: Hetzner server 5.78.147.68
- **Access**: HTTP-only via IP address
- **Authentication**: Test credentials (no OAuth)
- **SSL**: None (will be added later with domain)
- **Use Case**: Testing and validation before domain setup

### Option 2: Full Production with Domain
- **Target**: Your production server with domain
- **Access**: HTTPS with SSL certificates
- **Authentication**: Full OAuth with Google
- **SSL**: Let's Encrypt certificates
- **Use Case**: Final production deployment

---

## 🔧 What We've Prepared for You

The following files have been pre-configured for your deployment:

### ✅ Environment Configuration
- **`.env.production`** - Production environment variables configured for Hetzner IP
- **Database**: Pre-configured for PostgreSQL at 5.78.151.248:5432
- **URLs**: Set to http://5.78.147.68:3000 for IP-only access
- **Authentication**: OAuth disabled, test credentials enabled

### ✅ Server Configuration
- **`nginx-production-ip.conf`** - HTTP-only Nginx configuration for IP access
- **`ecosystem.config.js`** - PM2 process management for production
- **Security headers and rate limiting configured**
- **WebSocket proxy setup for real-time features**

### ✅ Authentication Setup
- **`src/auth-ip-only.ts`** - Temporary authentication bypassing OAuth
- **Test credentials**: admin/boutique2024!, client/client2024!
- **Automatically activated during deployment**

### ✅ Deployment Scripts
- **`scripts/deploy-to-hetzner.sh`** - Comprehensive automated deployment
- **`scripts/quick-deploy.sh`** - Quick operations and maintenance
- **`test-db-connection.cjs`** - Database connectivity verification
- **Error handling and rollback procedures included**

### ✅ Documentation
- **`DEPLOYMENT-CHECKLIST.md`** - Detailed step-by-step checklist
- **`IP-DEPLOYMENT-README.md`** - IP-only deployment guide
- **Troubleshooting guides and common solutions**

## 📊 Database Verification

We've tested and confirmed database connectivity:
- **✅ Connection**: Successfully connected to PostgreSQL
- **✅ Tables**: 56 tables found including users, ig_accounts, audit_logs
- **✅ Data**: 23 users and 397 Instagram accounts available
- **✅ Migrations**: Ready to run Prisma migrations during deployment

## Prerequisites

### For IP-Only Deployment (Immediate Use)
- [ ] **SSH access** to root@5.78.147.68
- [ ] **SSH key authentication** configured
- [ ] **Local machine** with Node.js and Git
- [ ] **Scripts executable**: `chmod +x scripts/*.sh`

**That's it!** Everything else is automated.

### For Full Domain Deployment (Later)
- [ ] **Domain name** pointing to 5.78.147.68
- [ ] **Google OAuth credentials** (Client ID and Secret)
- [ ] **SSL certificate** requirements
- [ ] **Production email** for Let's Encrypt

## 🚀 Automated Deployment Instructions

### Step 1: Initial Server Setup (One-Time)

Run this command from your local machine to set up the server:

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run automated server setup
./scripts/deploy-to-hetzner.sh setup
```

**What this script does automatically:**
- ✅ Updates system packages (Ubuntu/Debian)
- ✅ Installs Node.js 18.x, PM2, Nginx, PostgreSQL client
- ✅ Creates `boutique-client` service user
- ✅ Sets up directory structure at `/opt/boutique-client`
- ✅ Configures UFW firewall (ports 22, 80, 3000, 8081)
- ✅ Installs fail2ban security
- ✅ Configures Nginx with IP-only settings
- ✅ Sets proper file permissions

**Verification (automatic):**
The script will verify all services are running and report success/failure.

### Step 2: Deploy Application

```bash
# Deploy the application code
./scripts/deploy-to-hetzner.sh deploy
```

**What this script does automatically:**
- ✅ Clones your repository to `/opt/boutique-client/app`
- ✅ Installs production dependencies (`npm ci --production`)
- ✅ Switches to IP-only authentication (disables OAuth)
- ✅ Configures production environment variables
- ✅ Generates Prisma client for database access
- ✅ Runs database migrations if needed
- ✅ Builds the application (`npm run build`)
- ✅ Starts services with PM2 (main app + WebSocket server)
- ✅ Configures PM2 to start on boot

### Step 3: Test Deployment

```bash
# Run automated tests
./scripts/deploy-to-hetzner.sh test
```

**What this script tests:**
- ✅ Health endpoint: http://5.78.147.68:3000/api/admin/health
- ✅ Main application: http://5.78.147.68:3000/
- ✅ Login page: http://5.78.147.68:3000/login
- ✅ WebSocket connection on port 8081

### Step 4: Access Your Application

**🎉 Your application is now live!**

- **URL**: http://5.78.147.68:3000
- **Admin Login**: username=`admin`, password=`boutique2024!`
- **Client Login**: username=`client`, password=`boutique2024!`

## 🔧 Maintenance Commands

### Quick Operations
```bash
# Quick status check
./scripts/quick-deploy.sh status

# Quick restart
./scripts/quick-deploy.sh restart

# View live logs
./scripts/quick-deploy.sh logs

# Test all endpoints
./scripts/quick-deploy.sh test

# Quick redeploy (pull latest code and restart)
./scripts/quick-deploy.sh deploy
```

### Detailed Operations
```bash
# Check detailed status
./scripts/deploy-to-hetzner.sh status

# View application logs
./scripts/deploy-to-hetzner.sh logs

# Restart services
./scripts/deploy-to-hetzner.sh restart
```

### Manual Server Access
```bash
# Connect as service user
ssh boutique-client@5.78.147.68

# Connect as root (for system administration)
ssh root@5.78.147.68

# Check PM2 status
pm2 status

# View PM2 logs
pm2 logs

# Restart specific service
pm2 restart boutique-client-portal
```

## 🔧 Script Reference Guide

### Available Scripts

#### Main Deployment Script: `deploy-to-hetzner.sh`

```bash
./scripts/deploy-to-hetzner.sh <action> [options]

Actions:
  setup     - Initial server setup (run as root)
  deploy    - Deploy application code  
  restart   - Restart services
  status    - Check deployment status
  logs      - Show application logs
  test      - Test deployment endpoints

Options:
  --repo-url=URL    - Repository URL (auto-detected by default)
  --branch=BRANCH   - Git branch to deploy (default: main)
  --skip-build      - Skip building the application
  --skip-deps       - Skip installing dependencies
```

#### Quick Operations Script: `quick-deploy.sh`

```bash
./scripts/quick-deploy.sh <command>

Commands:
  deploy    - Quick deploy (build + deploy + test)
  status    - Check status and recent logs
  restart   - Restart PM2 processes
  logs      - Show live logs (Ctrl+C to exit)
  test      - Test all endpoints
```

#### Database Testing: `test-db-connection.cjs`

```bash
node test-db-connection.cjs
```
Tests PostgreSQL connectivity and displays table information.

### File Structure After Deployment

```
/opt/boutique-client/
├── app/                          # Application code
│   ├── build/                    # Built application
│   ├── src/                      # Source code
│   ├── scripts/                  # Deployment scripts
│   ├── .env.production          # Production environment
│   ├── ecosystem.config.js      # PM2 configuration
│   └── package.json             # Dependencies
├── logs/                        # Application logs
│   ├── app-combined.log         # Main app logs
│   ├── app-out.log             # stdout logs
│   ├── app-error.log           # stderr logs
│   ├── ws-combined.log         # WebSocket logs
│   ├── ws-out.log              # WebSocket stdout
│   └── ws-error.log            # WebSocket stderr
└── security-reports/           # Security scan results
```

---

## 📚 Original Manual Deployment Guide

*The following section contains the original manual deployment instructions. The automated scripts above handle all of these steps automatically, but this information is preserved for reference and customization.*

### Manual Step 2: Application Deployment

#### 2.1 Clone the Repository
```bash
# Switch to the service user
sudo su - boutique-client

# Navigate to application directory
cd /opt/boutique-client

# Clone your repository (replace with your actual repository URL)
git clone https://github.com/your-username/boutique-client-portal.git app
cd app

# Verify the code
ls -la
git branch
git log --oneline -5
```

### 2.2 Install Dependencies
```bash
# Install production dependencies only
npm ci --production

# Verify installation
npm list --depth=0
```

### 2.3 Configure Environment Variables
```bash
# Copy the environment template
cp .env.production.example .env.production

# Edit with your actual values
nano .env.production
```

**Required environment variables:**
```env
# Database
DATABASE_URL="postgresql://username:password@host:5432/database_name?sslmode=require"

# Authentication
AUTH_SECRET="your-super-secure-32-char-secret-key-here"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-super-secure-32-char-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Application
PUBLIC_APP_NAME="Your Production App Name"
NODE_ENV="production"
ORIGIN="https://yourdomain.com"

# WebSocket (if using)
WS_AUTH_TOKEN="your-websocket-auth-token"
WS_PORT="8081"

# Instance identification
INSTANCE_ID="production-001"
```

### 2.4 Set Secure File Permissions
```bash
# Secure environment file
chmod 600 .env.production

# Verify permissions
ls -la .env*
```

## Step 3: Database Setup

### 3.1 Test Database Connection
```bash
# Test the connection
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db execute --stdin <<< "SELECT 1 as test;"
```

### 3.2 Run Database Migrations
```bash
# Generate Prisma client
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

# Run migrations
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy

# Verify database schema
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
```

### 3.3 Seed Database (if needed)
```bash
# If you have seed data
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db seed
```

## Step 4: Build and Test Application

### 4.1 Build the Application
```bash
# Build for production
NODE_ENV=production npm run build

# Verify build output
ls -la build/
du -sh build/
```

### 4.2 Test the Application
```bash
# Test the production build locally
NODE_ENV=production npm run preview &
sleep 5

# Test health endpoint
curl -f http://localhost:4173/api/admin/health || echo "Health check failed"

# Kill preview server
pkill -f "npm run preview"
```

## Step 5: Configure Process Management

### 5.1 Set Up PM2 Configuration
```bash
# Verify ecosystem config exists
ls -la ecosystem.config.js

# If it doesn't exist, create it:
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'boutique-client-portal',
      script: 'build/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      log_file: '/opt/boutique-client/logs/app-combined.log',
      out_file: '/opt/boutique-client/logs/app-out.log',
      error_file: '/opt/boutique-client/logs/app-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 5000
    },
    {
      name: 'boutique-websocket-server',
      script: 'build/websocket-server.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        WS_PORT: 8081
      },
      log_file: '/opt/boutique-client/logs/ws-combined.log',
      out_file: '/opt/boutique-client/logs/ws-out.log',
      error_file: '/opt/boutique-client/logs/ws-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF
```

### 5.2 Start Application with PM2
```bash
# Start the application
pm2 start ecosystem.config.js --env production

# Check status
pm2 status

# View logs
pm2 logs --lines 50

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
# Follow the instructions provided by the startup command
```

## Step 6: Configure Web Server (Nginx)

### 6.1 Configure Nginx for Your Domain
```bash
# Exit back to root user
exit

# Create Nginx configuration
cat > /etc/nginx/sites-available/boutique-client << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss://yourdomain.com ws://yourdomain.com; frame-ancestors 'none';" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Security
        proxy_hide_header X-Powered-By;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:8081;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files with caching
    location /_app/ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Health check endpoint
    location /api/admin/health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
EOF

# Replace yourdomain.com with your actual domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' /etc/nginx/sites-available/boutique-client

# Enable the site
ln -sf /etc/nginx/sites-available/boutique-client /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t
```

### 6.2 Set Up SSL Certificate
```bash
# Install certbot if not already installed
apt-get update && apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com --non-interactive --agree-tos --email admin@yourdomain.com

# Verify SSL configuration
nginx -t && systemctl reload nginx

# Test SSL certificate
curl -I https://yourdomain.com | head -1
```

## Step 7: Configure Monitoring

### 7.1 Set Up Monitoring Dashboard
```bash
# Run monitoring setup
sudo ./scripts/setup-monitoring-dashboard.sh \
  --domain=yourdomain.com \
  --admin-email=admin@yourdomain.com \
  --admin-user=admin

# Start monitoring service
systemctl start boutique-monitoring
systemctl enable boutique-monitoring

# Check monitoring status
systemctl status boutique-monitoring
```

### 7.2 Configure System Monitoring
```bash
# Set up system monitoring cron job
sudo su - boutique-client
crontab -e

# Add this line to run system monitoring every 5 minutes
*/5 * * * * /opt/boutique-client/app/scripts/system-monitor.sh --quiet
```

## Step 8: Security Hardening

### 8.1 Run Security Review
```bash
# Run comprehensive security review
sudo /opt/boutique-client/app/scripts/security-review.sh \
  --fix-issues \
  --report-file=/opt/boutique-client/security-reports/production-security-review.txt

# Review the security report
less /opt/boutique-client/security-reports/production-security-review.txt
```

### 8.2 Configure Firewall Rules
```bash
# Verify firewall is active and properly configured
ufw status verbose

# Should show:
# - 22/tcp (SSH)
# - 80/tcp (HTTP)
# - 443/tcp (HTTPS)
# - Deny all other incoming connections
```

## Step 9: Final Verification

### 9.1 Health Checks
```bash
# Test all endpoints
curl -f https://yourdomain.com/api/admin/health
curl -f https://yourdomain.com/login
curl -I https://yourdomain.com/

# Check PM2 status
sudo su - boutique-client
pm2 status
pm2 logs --lines 20
```

### 9.2 Performance Testing
```bash
# Test application performance
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/

# Where curl-format.txt contains:
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}s\n
        time_connect:  %{time_connect}s\n
     time_appconnect:  %{time_appconnect}s\n
    time_pretransfer:  %{time_pretransfer}s\n
       time_redirect:  %{time_redirect}s\n
  time_starttransfer:  %{time_starttransfer}s\n
                     ----------\n
          time_total:  %{time_total}s\n
EOF
```

### 9.3 Security Testing
```bash
# Test SSL configuration
curl -I https://yourdomain.com | grep -E "(Strict-Transport|X-Frame|X-Content)"

# Test authentication
curl -f https://yourdomain.com/api/auth/me

# Test that HTTP redirects to HTTPS
curl -I http://yourdomain.com | grep -i location
```

## Step 10: Go Live Checklist

### Pre-Launch Checklist
- [ ] **Domain and DNS**: Domain points to production server
- [ ] **SSL Certificate**: HTTPS working with valid certificate
- [ ] **Application**: All services running (pm2 status shows online)
- [ ] **Database**: Migrations applied, connection working
- [ ] **Authentication**: OAuth configured and working
- [ ] **Monitoring**: System monitoring and alerts configured
- [ ] **Firewall**: UFW active with proper rules
- [ ] **Security**: Security review passed with acceptable risk level
- [ ] **Backups**: Backup system configured and tested
- [ ] **Performance**: Response times < 2 seconds for main pages

### Launch Day Checklist
- [ ] **Final deployment**: Latest code deployed and tested
- [ ] **Monitoring active**: All monitoring systems running
- [ ] **Team notified**: Support team aware of go-live
- [ ] **Incident response**: Incident response procedures reviewed
- [ ] **Rollback plan**: Rollback procedures ready if needed

## Step 11: Post-Launch Tasks

### Immediate (First 24 hours)
1. **Monitor closely**: Watch logs, performance, and error rates
2. **Test key functions**: Authentication, core features, integrations
3. **Check certificates**: Verify SSL certificate auto-renewal
4. **Backup verification**: Confirm backups are working

### First Week
1. **Performance tuning**: Optimize based on real usage patterns
2. **Security monitoring**: Review security logs and alerts
3. **User feedback**: Collect and address any user issues
4. **Documentation updates**: Update any procedures based on experience

### First Month
1. **Capacity planning**: Analyze usage and plan for scaling
2. **Security review**: Conduct follow-up security assessment
3. **Disaster recovery test**: Test backup and recovery procedures
4. **Process refinement**: Improve deployment and monitoring processes

## Troubleshooting Common Issues

### Application Won't Start
```bash
# Check PM2 status and logs
pm2 status
pm2 logs boutique-client-portal --lines 100

# Check environment variables
pm2 env 0

# Restart application
pm2 restart boutique-client-portal
```

### SSL Certificate Issues
```bash
# Check certificate status
certbot certificates

# Renew certificate
certbot renew --dry-run

# Check Nginx configuration
nginx -t
systemctl reload nginx
```

### Database Connection Issues
```bash
# Test database connection
sudo -u boutique-client bash
cd /opt/boutique-client/app
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma db execute --stdin <<< "SELECT 1;"

# Check database logs (if accessible)
# This depends on your database setup
```

### Performance Issues
```bash
# Check system resources
./scripts/system-monitor.sh

# Check PM2 metrics
pm2 monit

# Review application logs for errors
pm2 logs --lines 200 | grep -i error
```

## Emergency Procedures

### Complete Rollback
```bash
# Use the disaster recovery script
sudo /opt/boutique-client/app/scripts/disaster-recovery.sh \
  --scenario=full-restore \
  --backup-date=YYYY-MM-DD
```

### Service Recovery
```bash
# Restart all services
pm2 restart all
systemctl restart nginx

# If issues persist, restore from backup
sudo /opt/boutique-client/app/scripts/disaster-recovery.sh \
  --scenario=app-restore \
  --backup-date=YYYY-MM-DD
```

## Support Contacts

### Emergency Contacts
- **Primary**: [Your Contact Information]
- **Secondary**: [Backup Contact]
- **Hosting Provider**: [Provider Support]

### Useful Resources
- **Deployment Runbook**: `/opt/boutique-client/app/DEPLOYMENT-RUNBOOK.md`
- **Incident Response**: `/opt/boutique-client/app/INCIDENT-RESPONSE-PROCEDURES.md`
- **Security Reports**: `/opt/boutique-client/security-reports/`
- **Application Logs**: `/opt/boutique-client/logs/`

---

## 🎉 Congratulations!

Your Boutique Client Portal is now live in production! 

Remember to:
- Monitor the application closely in the first few days
- Keep your security certificates up to date
- Run regular backups and test recovery procedures
- Stay updated with security patches and updates

**Your production deployment is complete and secure!** 🚀