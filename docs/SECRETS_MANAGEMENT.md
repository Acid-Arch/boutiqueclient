# Secrets Management Guide

## Overview
This document provides comprehensive guidance for managing secrets and sensitive configuration in the Boutique Client Portal application.

## 🚨 Critical Security Notice
- **NEVER** commit `.env` files or any files containing secrets to version control
- **ALWAYS** use environment variables for sensitive data in production
- **ROTATE** secrets regularly (recommended: every 90 days)
- **VALIDATE** your environment configuration before deployment

## Quick Start

### 1. Generate Secure Secrets
```bash
# For production
npm run generate:secrets

# For development  
npm run generate:secrets:dev

# Validate existing secrets
npm run validate:secrets
```

### 2. Set Up Environment Files
```bash
# Copy the appropriate template
cp .env.production.example .env     # For production
cp .env.development.example .env    # For development

# Edit .env with your actual values
# Replace ALL placeholder values with real credentials
```

### 3. Validate Configuration
```bash
# Validate environment variables
npm run validate:env

# Run security checks
npm run security:check

# Full production validation
npm run production:validate
```

## Environment File Structure

### Development Setup
```bash
.env.development.example    # Development template
.env                       # Your local development config (ignored by git)
```

### Production Setup
```bash
.env.production.example    # Production template (safe to commit)
.env                      # Production config (NEVER commit)
```

## Required Secrets

### 1. Authentication Secrets
| Variable | Description | How to Generate |
|----------|-------------|----------------|
| `AUTH_SECRET` | JWT signing secret | `npm run generate:secrets` |
| `NEXTAUTH_SECRET` | Should match AUTH_SECRET | Same as AUTH_SECRET |

**Security Requirements:**
- Minimum 32 characters
- No weak patterns (password, secret, test, etc.)
- Cryptographically random

### 2. Database Credentials
| Variable | Description | Source |
|----------|-------------|--------|
| `DATABASE_URL` | PostgreSQL connection string | Your database provider |
| `DB_PASSWORD` | Database password | Generate with `npm run generate:secrets` |

**Security Requirements:**
- Use SSL in production (`sslmode=require`)
- Strong password (16+ characters)
- No default or weak passwords

### 3. OAuth Credentials
| Variable | Description | Source |
|----------|-------------|--------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console |

**Setup Instructions:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Development: `http://localhost:5173/auth/callback/google`
   - Production: `https://your-domain.com/auth/callback/google`

### 4. Optional Services
| Variable | Description | Required |
|----------|-------------|----------|
| `HIKER_API_KEY` | HikerAPI service key | If using HikerAPI |
| `SENTRY_DSN` | Error tracking | Recommended for production |
| `WS_AUTH_TOKEN` | WebSocket authentication | For real-time features |

## Secrets Generation

### Using the Built-in Generator
```bash
# Generate all secrets for production
npm run generate:secrets

# Generate for development
npm run generate:secrets:dev

# Get help
npm run generate:secrets -- --help
```

### Manual Generation
If you prefer to generate secrets manually:

```bash
# AUTH_SECRET (32 bytes, base64)
openssl rand -base64 32

# Database password (24 characters)
openssl rand -base64 18

# API key (32 alphanumeric)
openssl rand -hex 16
```

## Validation and Security

### Environment Validation
The validation script checks for:
- Required variables present
- Proper format validation  
- Security requirements met
- Production-specific constraints

```bash
# Validate current environment
npm run validate:env

# Check for security issues
npm run security:check
```

### Security Checks
Automated security validation includes:
- ✅ HTTPS enforcement in production
- ✅ Secret strength validation
- ✅ Cookie security configuration
- ✅ Database SSL requirements
- ✅ No weak or default values

### Common Issues and Solutions

#### ❌ "AUTH_SECRET too short"
```bash
# Solution: Generate a proper secret
npm run generate:secrets
# Copy the AUTH_SECRET value to your .env file
```

#### ❌ "Contains weak pattern"
```bash
# Problem: Using weak values like 'password', 'secret', 'test'
# Solution: Generate cryptographically secure values
npm run generate:secrets
```

#### ❌ "HTTPS required in production"
```bash
# Problem: Using http:// in production environment
# Solution: Update PUBLIC_APP_URL and AUTH_URL to use https://
PUBLIC_APP_URL="https://your-domain.com"
AUTH_URL="https://your-domain.com"
```

## Production Deployment Checklist

### Before Deployment
- [ ] Generate new production secrets
- [ ] Update database password on server
- [ ] Create production OAuth credentials
- [ ] Configure SSL certificates
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Validate environment: `npm run production:validate`

### During Deployment
- [ ] Use environment variable injection (not .env files)
- [ ] Verify HTTPS is working
- [ ] Test OAuth flow
- [ ] Check health endpoints
- [ ] Monitor error logs

### After Deployment
- [ ] Rotate development secrets
- [ ] Document credential locations
- [ ] Set up monitoring alerts
- [ ] Schedule regular secret rotation

## Secrets Rotation

### Recommended Schedule
- **Critical secrets** (AUTH_SECRET, DB_PASSWORD): Every 90 days
- **API keys**: Every 180 days
- **OAuth credentials**: Annually or when compromised

### Rotation Process
1. **Generate new secrets**
   ```bash
   npm run generate:secrets
   ```

2. **Update external services**
   - Database password on server
   - OAuth credentials in Google Cloud Console
   - API keys with service providers

3. **Deploy with zero downtime**
   - Use rolling deployment strategy
   - Keep old secrets active during transition
   - Verify new secrets work before removing old ones

4. **Clean up**
   - Remove old secrets from environment
   - Update documentation
   - Notify team of changes

## Emergency Procedures

### Suspected Compromise
1. **Immediate Actions**
   - Rotate ALL secrets immediately
   - Change database passwords
   - Revoke OAuth credentials
   - Check access logs for suspicious activity

2. **Investigation**
   - Review git history for accidental commits
   - Check server logs for unauthorized access
   - Audit team access to secrets management systems

3. **Recovery**
   - Generate completely new secrets
   - Update all systems with new credentials
   - Monitor for continued suspicious activity

### Secret Accidentally Committed
1. **Remove from git history**
   ```bash
   # Remove sensitive file from git history
   git filter-branch --force --index-filter \
   'git rm --cached --ignore-unmatch .env' \
   --prune-empty --tag-name-filter cat -- --all
   ```

2. **Rotate compromised secrets immediately**

3. **Update .gitignore** (already done in this setup)

## Tools and Commands

### Available NPM Scripts
```bash
npm run generate:secrets        # Generate production secrets
npm run generate:secrets:dev    # Generate development secrets  
npm run validate:secrets        # Validate existing secrets
npm run validate:env           # Validate environment variables
npm run security:check         # Run security audit
npm run production:validate    # Full production readiness check
```

### Useful Git Commands
```bash
# Check what files are ignored
git status --ignored

# Verify no secrets in git history
git log --oneline --name-only | grep -E "\\.env|\\.key|secret"

# Check for accidentally tracked files
git ls-files | grep -E "\\.env|\\.key|secret"
```

## Best Practices

### Development
- ✅ Use separate secrets for each environment
- ✅ Never share development credentials
- ✅ Use weak/test credentials for local development
- ✅ Validate environment on startup

### Production
- ✅ Use a secrets management system (AWS Secrets Manager, HashiCorp Vault)
- ✅ Implement least privilege access
- ✅ Enable audit logging for secret access
- ✅ Use different secrets per deployment environment
- ✅ Monitor for unauthorized access attempts

### Team Workflow
- ✅ Never share secrets via email/chat
- ✅ Use secure password managers for team sharing
- ✅ Document secret rotation procedures
- ✅ Regular security training for team members
- ✅ Code review for any authentication changes

## Troubleshooting

### Common Error Messages

#### "AUTH_SECRET environment variable is required in production"
- **Cause**: Missing AUTH_SECRET in .env file
- **Solution**: Run `npm run generate:secrets` and update .env

#### "Invalid Google profile structure"
- **Cause**: Incorrect Google OAuth configuration
- **Solution**: Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET

#### "Database connection failed"
- **Cause**: Incorrect DATABASE_URL or database not accessible
- **Solution**: Check connection string and database server status

#### "Cannot link OAuth account"
- **Cause**: OAuth configuration mismatch or user already linked
- **Solution**: Check OAuth redirect URLs and user account status

### Debug Mode
Enable debug logging in development:
```bash
DEBUG_MODE=true npm run dev
```

## Support and Resources

### Internal Resources
- Production readiness document: `/PRODUCTION_READINESS.md`
- Environment templates: `.env.*.example`
- Validation scripts: `scripts/validate-env.cjs`

### External Resources
- [Google OAuth 2.0 Setup](https://developers.google.com/identity/protocols/oauth2)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [OWASP Secrets Management](https://owasp.org/www-community/vulnerabilities/Exposing_secrets)

### Getting Help
1. Run diagnostics: `npm run production:validate`
2. Check logs for specific error messages
3. Verify environment configuration against templates
4. Review this document for common solutions

---

**Last Updated**: 2025-01-05  
**Next Review**: After any security incident or quarterly review