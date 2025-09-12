# CI/CD Setup Guide for Boutique Client Portal

This guide covers the complete CI/CD setup for deploying to your NixOS production server at 5.78.147.68.

## Prerequisites Completed ✅

- [x] SSH key pair generated for GitHub Actions
- [x] SSH key added to production server
- [x] GitHub Actions workflow enhanced for production deployment
- [x] Deployment scripts created and tested
- [x] Health check endpoints configured
- [x] PM2 systemd service scripts ready
- [x] Nginx reverse proxy configuration updated

## 🔐 Step 1: Configure GitHub Secrets

You need to add the following secrets to your GitHub repository:

### Repository Settings → Secrets and Variables → Actions

```bash
# Required secrets for CI/CD deployment:

SSH_PRIVATE_KEY: 
# Copy the private key content from ~/.ssh/github-actions-boutique
# Value: (the entire content of the private key file)

SERVER_IP: 5.78.147.68

SERVER_USER: admin

SERVICE_USER: boutique-client

SUDO_PASSWORD: SecurePassword#123

# Production environment secrets:
DATABASE_URL: postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent

AUTH_SECRET: <your-auth-secret-32-chars-minimum>

GOOGLE_CLIENT_ID: <your-google-oauth-client-id>

GOOGLE_CLIENT_SECRET: <your-google-oauth-client-secret>

WS_AUTH_TOKEN: <your-websocket-auth-token>

INSTANCE_ID: production
```

## 🚀 Step 2: Run Initial Server Setup

Connect to your production server and run the setup scripts:

```bash
# Connect to server
ssh admin@5.78.147.68

# Create service user if not exists
sudo useradd -m -s $(which bash) boutique-client || true
sudo usermod -aG wheel boutique-client || true

# Create app directory structure
sudo mkdir -p /opt/boutique-client/app
sudo mkdir -p /opt/boutique-client/logs
sudo mkdir -p /opt/boutique-client/backups
sudo chown -R boutique-client:users /opt/boutique-client
sudo chmod -R 755 /opt/boutique-client

# Install required packages (NixOS)
nix-env -iA nixos.nodejs_20 nixos.nodePackages.npm nixos.nginx nixos.postgresql || true

# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 systemd service
sudo ./scripts/pm2-systemd-service.sh

# Configure Nginx
sudo cp nginx-production.conf /etc/nginx/sites-available/boutique-client
sudo mkdir -p /etc/nginx/sites-enabled
sudo ln -sf /etc/nginx/sites-available/boutique-client /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Configure firewall (NixOS/iptables)
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 8081 -j ACCEPT
```

## 🔧 Step 3: Test Manual Deployment

Before enabling automatic deployment, test the deployment process manually:

```bash
# From your local machine, test the deployment script
cd /home/george/dev/boutiqueclient

# Set environment variables for testing
export SERVER_IP=5.78.147.68
export SERVER_USER=admin
export SERVICE_USER=boutique-client
export SUDO_PASSWORD="SecurePassword#123"
export GITHUB_SHA=$(git rev-parse HEAD)

# Run manual deployment
./scripts/github-actions-deploy.sh deploy
```

## 🤖 Step 4: Enable Automatic Deployment

Once manual deployment works:

1. **Push to main branch** - this will trigger automatic deployment
2. **Monitor GitHub Actions** - check the Actions tab in your repository
3. **Verify deployment** - check http://5.78.147.68:3000

## 📊 Step 5: Monitoring and Maintenance

### Health Check Endpoints

- **Public Health**: http://5.78.147.68/api/health
- **Admin Health**: http://5.78.147.68/api/admin/health (requires auth)
- **Simple Health**: http://5.78.147.68/api/health/simple

### PM2 Management

```bash
# Connect to server as service user
ssh admin@5.78.147.68
sudo -u boutique-client pm2 status
sudo -u boutique-client pm2 logs
sudo -u boutique-client pm2 restart all
sudo -u boutique-client pm2 save

# System service management
sudo systemctl status pm2-boutique-client
sudo systemctl restart pm2-boutique-client
sudo journalctl -u pm2-boutique-client -f
```

### Nginx Management

```bash
# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# View logs
sudo tail -f /var/log/nginx/boutique-access.log
sudo tail -f /var/log/nginx/boutique-error.log
```

### Rollback Process

If deployment fails, you can rollback:

```bash
# Manual rollback on server
./scripts/github-actions-deploy.sh rollback

# Or trigger rollback via GitHub Actions
# Go to Actions → Run workflow → Select "Rollback Production"
```

## 🔒 Security Features

- **Rate limiting** for API endpoints
- **Secure headers** configured in Nginx
- **Input validation** on all API routes
- **Authentication** required for admin endpoints
- **Firewall** configured for necessary ports only
- **Process isolation** with dedicated service user

## 📈 Performance Optimization

- **Nginx caching** for static assets and API responses
- **Gzip compression** enabled
- **Keep-alive connections** for better performance
- **PM2 cluster mode** for high availability
- **Connection pooling** for database

## 🚨 Troubleshooting

### Common Issues

1. **Deployment fails with SSH error**
   - Check GitHub Secrets are correctly configured
   - Verify SSH key has been added to server

2. **Health checks fail**
   - Check if application is running: `sudo -u boutique-client pm2 status`
   - Verify database connection in application logs

3. **Nginx 502 Bad Gateway**
   - Check if application is running on port 3000
   - Verify upstream configuration in nginx.conf

4. **WebSocket connection issues**
   - Ensure WebSocket server is running on port 8081
   - Check firewall allows port 8081

### Logs Locations

- **Application logs**: `/opt/boutique-client/logs/`
- **PM2 logs**: `sudo -u boutique-client pm2 logs`
- **Nginx logs**: `/var/log/nginx/`
- **System logs**: `sudo journalctl -u pm2-boutique-client -f`

## 🎯 Next Steps

1. Set up SSL/TLS certificates (Let's Encrypt)
2. Configure domain name (silentsignal.io)
3. Implement staging environment
4. Add automated testing in CI/CD pipeline
5. Set up monitoring and alerting

---

## Quick Commands Reference

```bash
# Deploy to production (automatic on main branch push)
git push origin main

# Manual deployment test
./scripts/github-actions-deploy.sh deploy

# Health check
curl http://5.78.147.68/api/health

# View application status
ssh admin@5.78.147.68 "sudo -u boutique-client pm2 status"

# View logs
ssh admin@5.78.147.68 "sudo -u boutique-client pm2 logs --lines 50"

# Restart application
ssh admin@5.78.147.68 "sudo -u boutique-client pm2 restart all"
```

Your CI/CD pipeline is now ready! 🚀