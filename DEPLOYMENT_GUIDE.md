# 🚀 Boutique Client Portal - Deployment Guide

## 📋 Overview
This is a living document for deploying the Boutique Client Portal to production servers. Update this guide as the deployment process evolves.

**Last Updated:** 2025-01-08  
**Target Server:** Hetzner VPS  
**Current Status:** Ready for initial deployment

---

## 🖥️ Server Information

### Production Server
- **IP Address:** `5.78.147.68`
- **SSH User:** `admin`
- **Sudo Password:** `SecurePassword#123`
- **Service User:** `boutique-client` (created during setup)
- **OS:** Ubuntu/Debian (Linux)
- **Architecture:** x86_64

### Repository
- **GitHub URL:** `https://github.com/Acid-Arch/boutiqueclient.git`
- **Main Branch:** `main`
- **Deploy Branch:** `main` (or create `production` branch)

---

## 📁 Directory Structure

```
/opt/boutique-client/
├── app/                    # Application code
├── logs/                   # Application logs
├── backups/               # Database backups
└── ssl/                   # SSL certificates (future)
```

---

## 🔧 Prerequisites

### Local Development Machine
- Node.js 18+ installed
- Git configured with repository access
- SSH key added to server (optional but recommended)
- `.env.production` file configured

### Server Requirements
- Ubuntu/Debian Linux
- 2GB+ RAM minimum
- 20GB+ disk space
- Open ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (App), 8081 (WebSocket)
- PostgreSQL database access

---

## 📝 Environment Configuration

### Required Environment Variables

Create `.env.production` with the following:

```bash
# Environment
NODE_ENV=production

# Database (PostgreSQL)
DATABASE_URL="postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=require"

# Authentication (MUST GENERATE NEW SECRET!)
AUTH_SECRET="[GENERATE-32-BYTE-SECRET-HERE]"
AUTH_URL="http://5.78.147.68:3000"

# Google OAuth (Optional for initial deployment)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Application URLs
PUBLIC_APP_URL="http://5.78.147.68:3000"
PUBLIC_WS_URL="ws://5.78.147.68:8081"

# WebSocket Configuration
WS_AUTH_TOKEN="[GENERATE-SECURE-TOKEN]"
INSTANCE_ID="production-001"

# Port Configuration
PORT=3000
PUBLIC_WS_PORT=8081
```

### Generate Secure Secrets

```bash
# Generate AUTH_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Generate WS_AUTH_TOKEN
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## 🚀 Deployment Process

### Step 1: Prepare Local Environment

```bash
# 1. Ensure all changes are committed
git add .
git commit -m "Prepare for production deployment"

# 2. Push to GitHub
git push origin main

# 3. Create production environment file
cp .env.example .env.production
# Edit .env.production with production values

# 4. Test build locally
npm run build
```

### Step 2: Initial Server Setup (First Time Only)

```bash
# Connect to server
ssh admin@5.78.147.68

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install global packages
sudo npm install -g pm2

# Create service user
sudo useradd -m -s /bin/bash boutique-client
sudo usermod -aG sudo boutique-client

# Create application directories
sudo mkdir -p /opt/boutique-client/{app,logs,backups}
sudo chown -R boutique-client:boutique-client /opt/boutique-client
sudo chmod -R 755 /opt/boutique-client

# Install nginx
sudo apt install -y nginx

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 8081/tcp
sudo ufw --force enable
```

### Step 3: Deploy Application

```bash
# Switch to service user
sudo su - boutique-client
cd /opt/boutique-client

# Clone repository
git clone https://github.com/Acid-Arch/boutiqueclient.git app
cd app

# Install dependencies
npm ci --production

# Copy production environment
# Upload .env.production from local machine
# Or create it on server with nano/vim

# Generate Prisma client
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate

# Run database migrations (if needed)
PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy

# Build application
NODE_ENV=production npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u boutique-client --hp /home/boutique-client
```

### Step 4: Configure Nginx

Create `/etc/nginx/sites-available/boutique-client`:

```nginx
upstream boutique_app {
    server 127.0.0.1:3000;
}

upstream boutique_ws {
    server 127.0.0.1:8081;
}

server {
    listen 80;
    server_name 5.78.147.68;
    
    # Main application
    location / {
        proxy_pass http://boutique_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://boutique_ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Static files
    location /_app {
        proxy_pass http://boutique_app;
        proxy_cache_valid 200 1d;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/boutique-client /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📊 PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'boutique-client-portal',
      script: 'build/index.js',
      cwd: '/opt/boutique-client/app',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/opt/boutique-client/logs/app-error.log',
      out_file: '/opt/boutique-client/logs/app-out.log',
      log_file: '/opt/boutique-client/logs/app-combined.log',
      time: true,
      max_memory_restart: '1G',
      autorestart: true,
      watch: false
    },
    {
      name: 'boutique-websocket-server',
      script: 'scripts/standalone-websocket-server.ts',
      interpreter: 'tsx',
      cwd: '/opt/boutique-client/app',
      env: {
        NODE_ENV: 'production',
        WS_PORT: 8081
      },
      error_file: '/opt/boutique-client/logs/ws-error.log',
      out_file: '/opt/boutique-client/logs/ws-out.log',
      autorestart: true,
      watch: false
    }
  ]
};
```

---

## 🔄 Update Deployment

For subsequent deployments:

```bash
# On local machine
git push origin main

# On server (as boutique-client user)
cd /opt/boutique-client/app
git pull origin main
npm ci --production
npm run build
pm2 reload all
```

---

## 🧪 Testing & Verification

### Health Checks

```bash
# Test health endpoint
curl http://5.78.147.68:3000/api/admin/health

# Test main page
curl -I http://5.78.147.68:3000/

# Test WebSocket
wscat -c ws://5.78.147.68:8081
```

### PM2 Monitoring

```bash
# Check status
pm2 status

# View logs
pm2 logs boutique-client-portal --lines 50
pm2 logs boutique-websocket-server --lines 50

# Monitor resources
pm2 monit
```

### Nginx Status

```bash
# Check nginx status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔒 Security Checklist

- [ ] Strong passwords for all users
- [ ] SSH key authentication enabled
- [ ] Firewall configured and enabled
- [ ] Database connection using SSL
- [ ] Environment variables secured
- [ ] Regular security updates scheduled
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] Rate limiting enabled
- [ ] HTTPS configured (future)

---

## 🚨 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs boutique-client-portal --lines 100

# Verify environment variables
pm2 env boutique-client-portal

# Check port availability
sudo lsof -i :3000
```

#### Database Connection Failed
```bash
# Test connection
PGPASSWORD=boutiquepassword123 psql -h 5.78.151.248 -p 5432 -U iglogin -d igloginagent -c "SELECT 1;"

# Check DATABASE_URL in .env
grep DATABASE_URL .env
```

#### Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check nginx error log
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart all
sudo systemctl restart nginx
```

---

## 📚 Useful Commands

### PM2 Commands
```bash
pm2 list              # List all processes
pm2 restart all       # Restart all processes
pm2 reload all        # Zero-downtime reload
pm2 stop all          # Stop all processes
pm2 delete all        # Remove all processes
pm2 save             # Save current process list
pm2 resurrect        # Restore saved process list
pm2 logs             # View all logs
pm2 flush            # Clear all logs
```

### Service Management
```bash
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl status nginx
sudo systemctl enable nginx
```

### Log Viewing
```bash
# Application logs
tail -f /opt/boutique-client/logs/app-out.log
tail -f /opt/boutique-client/logs/app-error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -u nginx -f
```

---

## 🔄 Backup Strategy

### Database Backup
```bash
# Manual backup
PGPASSWORD=boutiquepassword123 pg_dump -h 5.78.151.248 -p 5432 -U iglogin -d igloginagent > /opt/boutique-client/backups/db_$(date +%Y%m%d_%H%M%S).sql

# Automated daily backup (add to crontab)
0 2 * * * /opt/boutique-client/app/scripts/backup.sh
```

### Application Backup
```bash
# Backup application files
tar -czf /opt/boutique-client/backups/app_$(date +%Y%m%d).tar.gz /opt/boutique-client/app/
```

---

## 📈 Future Improvements

- [ ] Set up domain name and SSL certificates
- [ ] Implement CI/CD pipeline with GitHub Actions
- [ ] Add monitoring with Prometheus/Grafana
- [ ] Set up centralized logging with ELK stack
- [ ] Implement blue-green deployment strategy
- [ ] Add Redis for session management
- [ ] Configure CDN for static assets
- [ ] Implement automated testing before deployment
- [ ] Set up staging environment
- [ ] Add health check dashboard

---

## 📞 Support & Contact

- **Repository Issues:** https://github.com/Acid-Arch/boutiqueclient/issues
- **Documentation:** This file (DEPLOYMENT_GUIDE.md)
- **Server Access:** Contact system administrator

---

## 📝 Deployment Log

| Date | Version | Deployed By | Notes |
|------|---------|-------------|-------|
| 2025-01-08 | 0.0.1 | Initial | First production deployment |

---

## ⚠️ Important Notes

1. **Always test in development first**
2. **Backup database before migrations**
3. **Monitor logs after deployment**
4. **Keep this document updated**
5. **Never commit secrets to repository**
6. **Use strong, unique passwords**
7. **Regular security updates are critical**

---

*This is a living document. Update it as the deployment process evolves.*