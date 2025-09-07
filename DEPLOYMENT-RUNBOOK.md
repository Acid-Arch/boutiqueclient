# Boutique Client Portal - Production Deployment Runbook

## Overview
This runbook provides step-by-step instructions for deploying the Boutique Client Portal to production environments. It covers initial setup, regular deployments, troubleshooting, and emergency procedures.

**🚨 CRITICAL**: This application does NOT use Docker. All deployments are native Node.js applications.

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 22.04 LTS (recommended) or similar Linux distribution
- **Node.js**: Version 18+ (LTS recommended)
- **PostgreSQL**: Version 14+ with full admin access
- **Memory**: Minimum 2GB RAM (4GB+ recommended)
- **Storage**: Minimum 10GB free space (50GB+ recommended for logs/backups)
- **Network**: Static IP address and domain name configured

### Required Access
- [ ] Root/sudo access to production server
- [ ] PostgreSQL database credentials and admin access
- [ ] Domain DNS management access
- [ ] SSL certificate management (Let's Encrypt recommended)
- [ ] GitHub repository access (for CI/CD)
- [ ] Email/Slack credentials (for monitoring alerts)

## Initial Production Setup

### Phase 1: Server Preparation

1. **Run Production Setup Script**
   ```bash
   # Download and execute the automated setup script
   curl -o setup-production-server.sh https://raw.githubusercontent.com/your-org/boutique-client-portal/main/scripts/setup-production-server.sh
   chmod +x setup-production-server.sh
   sudo ./setup-production-server.sh --domain=your-domain.com --email=admin@your-domain.com
   ```

2. **Verify System Prerequisites**
   ```bash
   # Check system status after setup
   sudo systemctl status nginx postgresql ufw fail2ban
   node --version && npm --version
   pm2 --version
   ```

### Phase 2: Application Deployment

1. **Clone and Setup Application**
   ```bash
   # Switch to application user
   sudo su - boutique-client
   
   # Clone repository
   git clone https://github.com/your-org/boutique-client-portal.git /opt/boutique-client/app
   cd /opt/boutique-client/app
   
   # Install dependencies
   npm ci --production
   ```

2. **Configure Environment**
   ```bash
   # Copy production environment template
   cp /opt/boutique-client/config/.env.production.template .env.production
   
   # Edit with actual values
   nano .env.production
   ```

3. **Database Setup**
   ```bash
   # Generate Prisma client
   PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
   
   # Run migrations
   npx prisma migrate deploy
   
   # Verify database connection
   npx prisma db execute --stdin <<< "SELECT 1;"
   ```

4. **Build Application**
   ```bash
   # Build for production
   NODE_ENV=production npm run build
   
   # Verify build
   ls -la build/
   ```

5. **Start Services**
   ```bash
   # Start with PM2
   pm2 start ecosystem.config.js --env production
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

### Phase 3: SSL and Security Setup

1. **Configure SSL with Let's Encrypt**
   ```bash
   sudo ./scripts/setup-ssl.sh --domain=your-domain.com --email=admin@your-domain.com
   ```

2. **Verify Security Configuration**
   ```bash
   # Test SSL
   curl -I https://your-domain.com
   
   # Check security headers
   curl -I https://your-domain.com | grep -E "(Strict-Transport|X-Frame|X-Content)"
   
   # Verify firewall
   sudo ufw status
   ```

## Regular Deployment Process

### Pre-Deployment Checklist
- [ ] Code reviewed and approved
- [ ] Tests passing in CI/CD pipeline
- [ ] Database migrations tested
- [ ] Environment variables updated (if needed)
- [ ] Backup created
- [ ] Maintenance window scheduled (if required)

### Deployment Steps

1. **Create Backup**
   ```bash
   # Create database backup
   ./scripts/database-backup.sh --verify --upload
   
   # Backup current application
   sudo -u boutique-client tar -czf /opt/boutique-client/backups/app-backup-$(date +%Y%m%d_%H%M%S).tar.gz /opt/boutique-client/app
   ```

2. **Deploy New Version**
   ```bash
   # Switch to application user
   sudo su - boutique-client
   cd /opt/boutique-client/app
   
   # Pull latest changes
   git fetch origin
   git checkout main
   git pull origin main
   
   # Install/update dependencies
   npm ci --production
   
   # Run database migrations (if any)
   PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma migrate deploy
   
   # Regenerate Prisma client
   PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
   
   # Build application
   NODE_ENV=production npm run build
   ```

3. **Restart Services**
   ```bash
   # Graceful restart
   pm2 restart boutique-client-portal --update-env
   pm2 restart boutique-websocket-server --update-env
   
   # Verify services
   pm2 status
   pm2 logs boutique-client-portal --lines 50
   ```

4. **Post-Deployment Verification**
   ```bash
   # Health check
   curl -f https://your-domain.com/api/admin/health
   
   # Verify key endpoints
   curl -f https://your-domain.com/login
   curl -f https://your-domain.com/api/auth/me
   
   # Check application logs
   pm2 logs --lines 100
   ```

### Post-Deployment Checklist
- [ ] Health endpoints responding
- [ ] Authentication working
- [ ] Database connectivity verified
- [ ] WebSocket connections working
- [ ] SSL certificate valid
- [ ] Monitoring alerts cleared
- [ ] Performance metrics normal

## Rollback Procedures

### Quick Rollback (Application Only)
```bash
# Stop current application
pm2 stop all

# Restore from backup
sudo -u boutique-client tar -xzf /opt/boutique-client/backups/app-backup-YYYYMMDD_HHMMSS.tar.gz -C /

# Restart services
pm2 start ecosystem.config.js --env production
```

### Full Rollback (Database + Application)
```bash
# Use disaster recovery script
./scripts/disaster-recovery.sh --scenario=rollback --rollback-to=YYYYMMDD_HHMMSS
```

## Monitoring and Health Checks

### Automated Monitoring
- **System Monitor**: Runs every 5 minutes via cron
- **Health Checks**: Built into application (endpoint: `/api/admin/health`)
- **Database Monitoring**: Connection and performance checks
- **SSL Monitoring**: Certificate expiration tracking

### Manual Health Check
```bash
# Run comprehensive system check
./scripts/system-monitor.sh --summary

# Check application status
pm2 status
pm2 monit

# Database health
sudo -u boutique-client npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users;"

# Nginx status
sudo nginx -t
sudo systemctl status nginx
```

### Log Locations
- **Application Logs**: `/opt/boutique-client/app/logs/`
- **PM2 Logs**: `~/.pm2/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **System Logs**: `/var/log/syslog`
- **Security Logs**: `/var/log/auth.log`

## Troubleshooting Guide

### Common Issues

#### Application Won't Start
```bash
# Check PM2 status
pm2 status
pm2 logs boutique-client-portal --lines 100

# Check environment variables
pm2 env 0

# Verify build exists
ls -la /opt/boutique-client/app/build/

# Check permissions
ls -la /opt/boutique-client/app/
```

#### Database Connection Issues
```bash
# Test database connectivity
sudo -u boutique-client npx prisma db execute --stdin <<< "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"

# Verify DATABASE_URL
grep DATABASE_URL /opt/boutique-client/app/.env.production
```

#### SSL/HTTPS Issues
```bash
# Check SSL certificate
sudo certbot certificates

# Verify Nginx configuration
sudo nginx -t
sudo systemctl status nginx

# Check domain resolution
nslookup your-domain.com
dig your-domain.com
```

#### High Resource Usage
```bash
# Check system resources
./scripts/system-monitor.sh

# PM2 monitoring
pm2 monit

# Check for memory leaks
pm2 restart boutique-client-portal --update-env
```

#### WebSocket Connection Issues
```bash
# Check WebSocket server
pm2 describe boutique-websocket-server
curl -I http://localhost:8081/health

# Check port availability
sudo netstat -tlnp | grep 8081

# Verify Nginx WebSocket proxy
sudo nginx -T | grep -A5 -B5 "websocket"
```

### Emergency Procedures

#### Complete Service Failure
1. **Immediate Response**
   ```bash
   # Stop all services
   pm2 stop all
   sudo systemctl stop nginx
   
   # Start disaster recovery
   ./scripts/disaster-recovery.sh --scenario=full-restore --backup-date=$(date -d yesterday +%Y-%m-%d)
   ```

2. **Incident Communication**
   - Notify stakeholders immediately
   - Update status page (if available)
   - Document incident timeline

#### Database Corruption
```bash
# Stop application
pm2 stop all

# Restore from latest backup
./scripts/disaster-recovery.sh --scenario=db-restore --backup-date=$(date -d yesterday +%Y-%m-%d)

# Verify data integrity
sudo -u boutique-client npx prisma db execute --file=scripts/data-integrity-check.sql
```

#### Security Breach Response
1. **Immediate Actions**
   ```bash
   # Block suspicious IPs (example)
   sudo ufw insert 1 deny from SUSPICIOUS_IP
   
   # Check for unauthorized access
   sudo tail -100 /var/log/auth.log | grep -E "(Failed|Invalid|Accepted)"
   
   # Force logout all users
   sudo -u boutique-client npx prisma db execute --stdin <<< "DELETE FROM Session;"
   ```

2. **Investigation**
   - Review audit logs in database
   - Check application logs for suspicious activity
   - Review fail2ban logs: `sudo tail -100 /var/log/fail2ban.log`

## Maintenance Procedures

### Weekly Maintenance
- [ ] Review and rotate logs
- [ ] Update system packages (non-critical)
- [ ] Verify backups are working
- [ ] Check SSL certificate expiration
- [ ] Review security alerts and logs

### Monthly Maintenance
- [ ] Update Node.js (LTS versions only)
- [ ] Update npm packages (after testing)
- [ ] Review and update monitoring thresholds
- [ ] Disaster recovery testing
- [ ] Performance optimization review

### Quarterly Maintenance
- [ ] Security audit and penetration testing
- [ ] Dependency vulnerability scan and updates
- [ ] Infrastructure capacity planning
- [ ] Backup and disaster recovery plan review
- [ ] Documentation updates

## Environment-Specific Notes

### Production Environment
- **Domain**: Configure your actual domain
- **SSL**: Let's Encrypt certificates with auto-renewal
- **Database**: Dedicated PostgreSQL instance with replication
- **Monitoring**: Full alerting enabled (email + Slack)
- **Backups**: Daily automated backups with 30-day retention

### Staging Environment
- **Domain**: Use staging subdomain
- **SSL**: Let's Encrypt or self-signed certificates
- **Database**: Separate database instance
- **Monitoring**: Basic monitoring enabled
- **Backups**: Weekly backups with 7-day retention

## Security Considerations

### Network Security
- Firewall (UFW) configured to allow only necessary ports
- fail2ban enabled for brute force protection
- SSH key-based authentication required
- Regular security updates via unattended-upgrades

### Application Security
- Environment variables properly secured (600 permissions)
- Auth.js with secure session management
- Rate limiting enabled
- Security headers configured in Nginx
- CORS properly configured for production domains

### Database Security
- PostgreSQL configured with restricted access
- Connection encryption enabled
- Regular security updates
- Audit logging enabled

## Contact Information

### Emergency Contacts
- **Primary**: [Your Primary Contact]
- **Secondary**: [Your Secondary Contact]
- **Database Admin**: [Your Database Admin]

### External Services
- **DNS Provider**: [Your DNS Provider]
- **SSL Certificate**: Let's Encrypt (automated)
- **Monitoring**: [Your Monitoring Service]

---

## Appendix

### Useful Commands Reference
```bash
# PM2 Commands
pm2 status                              # Show all processes
pm2 logs boutique-client-portal         # Show application logs  
pm2 restart boutique-client-portal      # Restart specific process
pm2 reload boutique-client-portal       # Zero-downtime reload
pm2 delete boutique-client-portal       # Remove process
pm2 save                                # Save current configuration
pm2 resurrect                           # Restore saved configuration

# Nginx Commands  
sudo nginx -t                           # Test configuration
sudo systemctl reload nginx             # Reload configuration
sudo systemctl status nginx             # Check status

# Database Commands
npx prisma migrate status               # Check migration status
npx prisma db push                      # Push schema changes
npx prisma studio                       # Open database GUI

# SSL Commands
sudo certbot certificates               # List certificates
sudo certbot renew --dry-run           # Test renewal process
sudo certbot renew                      # Renew certificates

# System Commands
sudo systemctl status boutique-client  # Check service status
sudo journalctl -u boutique-client     # View service logs
sudo ufw status                         # Check firewall status
```

### Configuration File Locations
- **Application**: `/opt/boutique-client/app/`
- **Environment**: `/opt/boutique-client/app/.env.production`
- **PM2 Config**: `/opt/boutique-client/app/ecosystem.config.js`
- **Nginx Config**: `/etc/nginx/sites-available/boutique-client`
- **SSL Certificates**: `/etc/letsencrypt/live/your-domain.com/`
- **Systemd Service**: `/etc/systemd/system/boutique-client.service`

---

**Last Updated**: $(date '+%Y-%m-%d')  
**Version**: 1.0  
**Maintainer**: Production Team