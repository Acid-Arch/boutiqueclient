# Deployment Checklist - Hetzner Server (5.78.147.68)

This checklist ensures a systematic deployment of the Boutique Client Portal to the Hetzner server for IP-only testing.

## Pre-Deployment Checklist

### ✅ Local Preparation
- [x] **Configuration Files Ready**
  - [x] `.env.production` configured for IP deployment
  - [x] `nginx-production-ip.conf` created for HTTP-only access
  - [x] `ecosystem.config.js` updated for production paths
  - [x] IP-only authentication setup created

- [x] **Database Connection Verified**
  - [x] Connection to PostgreSQL (5.78.151.248:5432) tested
  - [x] Database `igloginagent` accessible
  - [x] Tables confirmed (56 tables, 23 users, 397 ig_accounts)

- [x] **Authentication Prepared**
  - [x] OAuth disabled for IP-only deployment
  - [x] Test credentials configured (admin/boutique2024!, client/client2024!)
  - [x] IP-only auth file ready to activate

### 📋 Server Requirements
- [ ] **Server Access**
  - [ ] SSH access to root@5.78.147.68 confirmed
  - [ ] SSH key authentication configured
  - [ ] Server accessible from your location

- [ ] **DNS/Network**
  - [ ] IP address 5.78.147.68 confirmed reachable
  - [ ] No domain setup required (IP-only deployment)
  - [ ] Firewall ports planning: 22, 80, 3000, 8081

## Deployment Steps

### Phase 1: Initial Server Setup

#### Step 1: Run Automated Server Setup
```bash
# From local machine
./scripts/deploy-to-hetzner.sh setup
```

**This script will:**
- [ ] Update system packages
- [ ] Install Node.js 18.x, PM2, Nginx, PostgreSQL client
- [ ] Create `boutique-client` service user
- [ ] Set up directory structure at `/opt/boutique-client`
- [ ] Configure UFW firewall (ports 22, 80, 3000, 8081)
- [ ] Configure Nginx with IP-only settings
- [ ] Enable fail2ban security

#### Step 2: Verify Initial Setup
```bash
# Connect to server and verify
ssh boutique-client@5.78.147.68
```

**Check these services:**
- [ ] `systemctl status nginx` - Nginx running
- [ ] `systemctl status ufw` - Firewall active
- [ ] `systemctl status fail2ban` - Security active
- [ ] `node --version` - Node.js 18.x installed
- [ ] `pm2 --version` - PM2 available
- [ ] `ls -la /opt/boutique-client` - Directory structure created

### Phase 2: Application Deployment

#### Step 3: Deploy Application Code
```bash
# From local machine
./scripts/deploy-to-hetzner.sh deploy
```

**This will:**
- [ ] Clone repository to `/opt/boutique-client/app`
- [ ] Install production dependencies
- [ ] Switch to IP-only authentication
- [ ] Configure production environment
- [ ] Generate Prisma client
- [ ] Run database migrations
- [ ] Build application
- [ ] Start services with PM2

#### Step 4: Verify Application Deployment
```bash
# Check PM2 status
ssh boutique-client@5.78.147.68 "pm2 status"
```

**Verify these processes:**
- [ ] `boutique-client-portal` - Running (should show "online")
- [ ] `boutique-websocket-server` - Running (should show "online")
- [ ] Both processes have recent uptime
- [ ] No error status or excessive restarts

### Phase 3: Testing and Verification

#### Step 5: Test Application Endpoints
```bash
# From local machine
./scripts/deploy-to-hetzner.sh test
```

**Manual verification:**
- [ ] **Health Check**: http://5.78.147.68:3000/api/admin/health
  - [ ] Returns 200 OK status
  - [ ] Shows system health information

- [ ] **Main Application**: http://5.78.147.68:3000/
  - [ ] Loads without errors
  - [ ] Shows Boutique Client Portal interface
  - [ ] No console errors in browser

- [ ] **Login Page**: http://5.78.147.68:3000/login
  - [ ] Loads login form
  - [ ] Shows username/password fields (not OAuth)
  - [ ] Test login with: admin / boutique2024!

- [ ] **WebSocket Connection**: ws://5.78.147.68:8081
  - [ ] Connection establishes successfully
  - [ ] No connection errors in browser console

#### Step 6: Authentication Testing
- [ ] **Admin Login**
  - [ ] Username: `admin`, Password: `boutique2024!`
  - [ ] Successfully redirects to client portal
  - [ ] Admin features accessible

- [ ] **Client Login**
  - [ ] Username: `client`, Password: `client2024!`
  - [ ] Successfully redirects to client portal
  - [ ] Client-level access confirmed

- [ ] **Session Management**
  - [ ] Sessions persist across page refreshes
  - [ ] Logout functionality works
  - [ ] Unauthorized access properly blocked

### Phase 4: System Monitoring

#### Step 7: Configure Monitoring
```bash
# Check system status
./scripts/deploy-to-hetzner.sh status
```

**Monitor these aspects:**
- [ ] **PM2 Monitoring**
  - [ ] `pm2 monit` - Resource usage acceptable
  - [ ] Memory usage under limits (< 1GB for main app, < 512MB for WebSocket)
  - [ ] CPU usage reasonable
  - [ ] No memory leaks detected

- [ ] **System Resources**
  - [ ] `df -h` - Disk space adequate (< 80% usage)
  - [ ] `free -m` - Memory availability sufficient
  - [ ] `htop` - Overall system performance

- [ ] **Log Files**
  - [ ] `/opt/boutique-client/logs/app-combined.log` - No critical errors
  - [ ] `/opt/boutique-client/logs/ws-combined.log` - WebSocket functioning
  - [ ] `/var/log/nginx/error.log` - No nginx errors

#### Step 8: Security Verification
- [ ] **Firewall Status**
  - [ ] `ufw status` shows active with correct rules
  - [ ] Only necessary ports open (22, 80, 3000, 8081)
  - [ ] SSH access restricted appropriately

- [ ] **Service Security**
  - [ ] Services running as `boutique-client` user (not root)
  - [ ] File permissions set correctly (755 for directories, 644 for files)
  - [ ] Environment file secure (600 permissions)

- [ ] **Network Security**
  - [ ] fail2ban active and monitoring
  - [ ] No unnecessary services running
  - [ ] Security headers configured in Nginx

## Post-Deployment Tasks

### ✅ Immediate (First Hour)
- [ ] **Functionality Testing**
  - [ ] Complete user flow testing (login → dashboard → features)
  - [ ] Test key application features
  - [ ] Verify data loading from database
  - [ ] Check real-time features (if any)

- [ ] **Performance Baseline**
  - [ ] Record initial response times
  - [ ] Note memory/CPU baseline usage
  - [ ] Test under light load

### 📊 First 24 Hours
- [ ] **Stability Monitoring**
  - [ ] Check for any service restarts or crashes
  - [ ] Monitor error logs for issues
  - [ ] Verify session stability

- [ ] **Usage Testing**
  - [ ] Test with multiple concurrent users
  - [ ] Verify database operations
  - [ ] Test all major features

### 📈 First Week
- [ ] **Performance Optimization**
  - [ ] Analyze slow queries or operations
  - [ ] Optimize any performance bottlenecks
  - [ ] Fine-tune PM2 configuration if needed

- [ ] **Documentation Updates**
  - [ ] Document any issues encountered
  - [ ] Update procedures based on experience
  - [ ] Plan domain migration strategy

## Troubleshooting Guide

### Common Issues and Solutions

#### 🚫 Application Won't Start
```bash
# Check PM2 status and logs
pm2 status
pm2 logs boutique-client-portal --lines 100

# Common fixes
pm2 restart all
pm2 delete all && pm2 start ecosystem.config.js --env production
```

#### 🔌 Database Connection Issues
```bash
# Test database connection
node test-db-connection.cjs

# Check environment variables
pm2 env 0
```

#### 🌐 Nginx/Network Issues
```bash
# Check nginx status and config
sudo systemctl status nginx
sudo nginx -t

# Check if ports are accessible
netstat -tulpn | grep :3000
netstat -tulpn | grep :8081
```

#### 🔐 Authentication Problems
- [ ] Verify IP-only authentication is active (`src/auth.ts`)
- [ ] Check test credentials are correct
- [ ] Verify JWT secret is configured
- [ ] Check browser console for auth errors

#### 📊 Performance Issues
```bash
# Check system resources
htop
df -h
free -m

# Check PM2 metrics
pm2 monit
```

## Rollback Procedure

If deployment fails and rollback is needed:

1. **Stop Current Services**
   ```bash
   pm2 delete all
   ```

2. **Restore Previous Version** (if applicable)
   ```bash
   cd /opt/boutique-client/app
   git checkout previous-working-commit
   npm ci --production
   npm run build
   pm2 start ecosystem.config.js --env production
   ```

3. **Emergency Contacts**
   - Primary: [Your contact information]
   - Server Provider: Hetzner support
   - Database Admin: [Database admin contact]

## Success Criteria

✅ **Deployment is considered successful when:**
- [ ] All health checks pass consistently
- [ ] Both admin and client logins work
- [ ] Application loads in < 3 seconds
- [ ] No critical errors in logs for 1 hour
- [ ] WebSocket connection stable
- [ ] Database operations functioning
- [ ] System resources within acceptable limits
- [ ] Security measures confirmed active

## Next Steps (Domain Migration)

When ready to add domain and SSL:
1. Configure DNS to point domain to 5.78.147.68
2. Switch back to OAuth authentication
3. Set up Let's Encrypt SSL certificates
4. Update Nginx configuration for HTTPS
5. Update all environment URLs to use domain
6. Re-enable secure cookie settings
7. Test OAuth functionality
8. Update CSP and security headers

---

## Quick Command Reference

```bash
# Deployment commands
./scripts/deploy-to-hetzner.sh setup     # Initial server setup
./scripts/deploy-to-hetzner.sh deploy    # Deploy application
./scripts/deploy-to-hetzner.sh test      # Test deployment
./scripts/deploy-to-hetzner.sh status    # Check status
./scripts/deploy-to-hetzner.sh logs      # View logs
./scripts/deploy-to-hetzner.sh restart   # Restart services

# Quick deployment commands
./scripts/quick-deploy.sh deploy         # Quick redeploy
./scripts/quick-deploy.sh status         # Quick status check
./scripts/quick-deploy.sh restart        # Quick restart
./scripts/quick-deploy.sh test           # Quick endpoint test

# Server access
ssh boutique-client@5.78.147.68         # Connect as service user
ssh root@5.78.147.68                     # Connect as root (for setup)

# Test credentials
Admin:  admin / boutique2024!
Client: client / client2024!
```

**🚀 Ready for deployment to 5.78.147.68!**