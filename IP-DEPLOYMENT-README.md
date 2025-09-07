# IP-Only Deployment Setup

This documentation explains how to configure the Boutique Client Portal for IP-only deployment on the Hetzner server (5.78.147.68) without domain/SSL setup.

## Quick Start

### 1. Switch to IP-Only Authentication
Since OAuth requires valid domains, we've created a temporary authentication system:

**To enable IP-only authentication:**
1. Rename `src/auth.ts` to `src/auth-oauth.ts` (backup)
2. Rename `src/auth-ip-only.ts` to `src/auth.ts`

**Test Credentials:**
- Admin: `admin` / `boutique2024!`
- Client: `client` / `client2024!`

### 2. Environment Configuration
The `.env.production` file is already configured for IP deployment:
- Database: Points to production PostgreSQL server
- URLs: All set to `http://5.78.147.68:3000`
- OAuth: Disabled for IP-only deployment

### 3. Nginx Configuration
Use the provided `nginx-production-ip.conf`:
```bash
# On the server:
sudo cp nginx-production-ip.conf /etc/nginx/sites-available/boutique-client
sudo ln -s /etc/nginx/sites-available/boutique-client /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. PM2 Configuration
The `ecosystem.config.js` is configured for:
- Production paths: `/opt/boutique-client/app`
- Logging: `/opt/boutique-client/logs/`
- WebSocket server on port 8081

## Deployment Commands

### On the Hetzner Server (5.78.147.68):

1. **Clone repository:**
   ```bash
   sudo su - boutique-client
   cd /opt/boutique-client
   git clone [your-repo-url] app
   cd app
   ```

2. **Install dependencies:**
   ```bash
   npm ci --production
   ```

3. **Configure environment:**
   ```bash
   cp .env.production .env
   # Verify database connection
   PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate
   ```

4. **Build application:**
   ```bash
   NODE_ENV=production npm run build
   ```

5. **Start with PM2:**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

## Testing Access

After deployment, test these URLs:

- **Main App**: http://5.78.147.68:3000
- **Login**: http://5.78.147.68:3000/login
- **Health Check**: http://5.78.147.68:3000/api/admin/health
- **WebSocket**: ws://5.78.147.68:8081

## Security Notes

⚠️ **IMPORTANT**: This IP-only setup is for testing purposes only:

1. **No SSL/HTTPS** - All traffic is unencrypted
2. **Hardcoded credentials** - Not suitable for production
3. **No domain validation** - OAuth providers won't work
4. **IP-based cookies** - Limited security features

## Switching Back to OAuth

When ready to configure a domain:

1. **Restore OAuth authentication:**
   ```bash
   mv src/auth.ts src/auth-ip-only.ts.backup
   mv src/auth-oauth.ts src/auth.ts
   ```

2. **Update environment:**
   - Set proper domain URLs
   - Configure real OAuth credentials
   - Enable HTTPS settings

3. **Configure SSL:**
   - Set up Let's Encrypt certificates
   - Update Nginx for HTTPS redirect
   - Enable secure cookie settings

4. **Update CSP and security headers:**
   - Replace IP addresses with domain names
   - Enable HTTPS-only policies

## Troubleshooting

### Authentication Issues
- Ensure you're using the test credentials exactly as specified
- Check browser console for auth errors
- Verify session cookies are being set

### Connection Issues
- Verify the server is running on port 3000
- Check PM2 status: `pm2 status`
- Review logs: `pm2 logs`

### Database Issues
- Test connection: `npx prisma db execute --stdin <<< "SELECT 1;"`
- Check environment variables
- Verify PostgreSQL server accessibility

### WebSocket Issues
- Ensure WebSocket server is running on port 8081
- Check firewall rules allow port 8081
- Test WebSocket connection from browser console

## File Overview

| File | Purpose |
|------|---------|
| `.env.production` | IP-only environment configuration |
| `nginx-production-ip.conf` | HTTP-only Nginx configuration |
| `ecosystem.config.js` | PM2 process configuration |
| `src/auth-ip-only.ts` | Temporary authentication setup |
| `IP-DEPLOYMENT-README.md` | This documentation |

---

**Remember**: This is a temporary setup for testing. Always implement proper security measures for production deployments!