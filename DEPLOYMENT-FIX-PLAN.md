# Deployment Login Fix Plan

## Executive Summary
The deployed SvelteKit client portal has login failures due to competing authentication systems, environment variable conflicts, and database connection issues. This document outlines the systematic approach to resolve these critical deployment problems.

## Critical Issues Identified

### 1. Authentication System Conflicts (CRITICAL)
- **Problem**: Two competing authentication files exist:
  - `src/auth.ts` - Hardcoded IP-based credential system
  - `src/auth-unified.ts` - Database-backed OAuth + credentials system
- **Impact**: `hooks.server.ts` may load wrong authentication handler
- **Status**: Needs immediate resolution

### 2. Environment Configuration Chaos (CRITICAL)
- **Problem**: Conflicting environment files:
  - `.env`: IP `5.78.147.68:3000`, `NODE_ENV=production`, OAuth DISABLED
  - `.env.production`: Domain `silentsignal.io`, `NODE_ENV=development`, OAuth ENABLED
- **Impact**: Production deployment uses wrong configuration
- **Status**: Environment variables inconsistent

### 3. Database Connection Issues (HIGH)
- **Problem**: SSL configuration conflicts
  - Some configs use `sslmode=require`, others `sslmode=disable`
  - Database IP mismatches between environments
- **Server**: `postgresql://iglogin:boutiquepassword123@5.78.151.248:5732/igloginagent`
- **Impact**: Connection failures prevent authentication queries

### 4. Google OAuth Configuration Problems (HIGH)
- **Problem**: OAuth disabled for IP deployment vs enabled with real credentials
- **Impact**: OAuth login fails on production server
- **Status**: Needs production redirect URI configuration

## Server Access Information
- **Admin User**: admin
- **Sudo Password**: SecurePassword#123
- **Database Server**: 5.78.151.248:5732
- **Deployment Type**: Native NixOS (no Docker)
- **Service Management**: systemd

## Implementation Phases

### Phase 1: Documentation & Analysis ✅
- [x] Create comprehensive fix documentation
- [x] Analyze authentication system conflicts
- [ ] Document current system state

### Phase 2: Authentication System Cleanup
- [ ] Remove conflicting `src/auth.ts` file
- [ ] Standardize on `src/auth-unified.ts` system
- [ ] Fix all imports to use unified authentication
- [ ] Update `hooks.server.ts` configuration

### Phase 3: Environment & Database Fixes
- [ ] Resolve environment variable conflicts
- [ ] Create proper production `.env` configuration
- [ ] Fix database SSL settings consistency
- [ ] Test database connectivity

### Phase 4: Git Synchronization & Deployment
- [ ] Commit authentication fixes
- [ ] Push changes to GitHub repository
- [ ] SSH to deployment server
- [ ] Pull latest changes on production
- [ ] Update production environment variables

### Phase 5: OAuth Configuration & Testing
- [ ] Configure Google Console redirect URIs
- [ ] Test OAuth callback handling
- [ ] Verify credential-based login
- [ ] Test dashboard access after authentication

## Expected Resolution Timeline
- **Phase 1**: 10 minutes (Documentation)
- **Phase 2**: 25 minutes (Auth cleanup)
- **Phase 3**: 20 minutes (Environment fixes)
- **Phase 4**: 15 minutes (Git sync & deploy)
- **Phase 5**: 20 minutes (OAuth & testing)
- **Total**: ~90 minutes

## Success Criteria
- [ ] Login page loads correctly on deployed server
- [ ] Database credential authentication works
- [ ] Google OAuth authentication works
- [ ] Dashboard accessible after login
- [ ] Local and production environments synchronized

## Risk Mitigation
- Backup current authentication files before changes
- Test database connectivity before deployment
- Verify OAuth configuration in staging environment
- Rollback plan: restore from git commits if needed

---
**Document Created**: $(date)
**Status**: Implementation in progress
**Next Phase**: Authentication System Cleanup