# 500 Error Fix Guide - Living Document
Last Updated: 2025-09-08

## Current Status Summary

### Critical Issues Found:
1. **500 Internal Server Error** on `/client-portal` - NULL reference error
2. **503 Service Unavailable** on `/api/health` - Database connection failure  
3. **Environment Variables** not loading properly in development server
4. **Prisma Client** initialization issues with duplicate implementations

## Issue Analysis & Solutions

### Issue 1: Client Portal 500 Error

**Error Details:**
```
TypeError: Cannot read properties of null (reading 'subscription')
Location: src/routes/client-portal/+page.svelte:175:62
```

**Root Cause:**
- The page template tries to access `data.user.subscription` when `data.user` is null
- This happens when unauthenticated users access the page
- The server-side loader returns `user: null` but the template doesn't handle this case

**Solution:**
```svelte
<!-- In src/routes/client-portal/+page.svelte line 175 -->
<!-- BEFORE (causes error): -->
<Badge class="bg-blue-500/20 text-blue-300">{data.user.subscription || 'Basic'}</Badge>

<!-- AFTER (null-safe): -->
<Badge class="bg-blue-500/20 text-blue-300">{data.user?.subscription || 'Basic'}</Badge>
```

**Additional Fixes Needed:**
- Add authentication check at the beginning of the template
- Redirect to login if user is null
- Add null-safety to all user property accesses (lines 179, 183)

### Issue 2: Database Connection Failure

**Error Details:**
```
Health check endpoint returning 503
Database check failing with: "DATABASE_URL environment variable is required"
Prisma client initialization failed
```

**Root Cause:**
- DATABASE_URL is defined in .env but not loaded into the Node.js process
- The application runs with `npm run dev` but doesn't load environment variables
- Vite doesn't automatically load .env for server-side code

**Solution:**
1. **Add dotenv loading to vite.config.ts:**
```javascript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default defineConfig({
  plugins: [sveltekit()],
  // ... rest of config
});
```

2. **Or use the dev:local script that includes dotenv:**
```bash
npm run dev:local  # This uses dotenv-cli to load .env
```

### Issue 3: Conflicting Prisma Implementations

**Problem:**
- Two Prisma client files exist:
  - `/src/lib/server/database.ts` (main implementation with connection pooling)
  - `/src/lib/server/prisma.js` (fallback implementation)
- Health check imports from `prisma.js` which doesn't properly initialize

**Solution:**
1. Remove the duplicate `src/lib/server/prisma.js`
2. Update all imports to use `database.ts`:
```typescript
// In src/routes/api/health/+server.ts
import { prisma } from '$lib/server/database.js';  // Not prisma.js
```

3. Ensure Prisma client is generated:
```bash
DATABASE_URL="postgresql://..." npx prisma generate
```

### Issue 4: Missing Authentication Guards

**Problem:**
- Client portal doesn't redirect unauthenticated users
- Pages assume user exists without checking

**Solution:**
Add to `src/routes/client-portal/+page.server.ts`:
```typescript
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    throw redirect(302, '/login');
  }
  // ... rest of the loader
}
```

## Complete Fix Implementation Plan

### Step 1: Fix Environment Loading
```bash
# Option A: Use the existing dev:local script
npm run dev:local

# Option B: Add dotenv to vite.config.ts (see above)

# Verify DATABASE_URL is loaded
echo $DATABASE_URL  # Should show the connection string
```

### Step 2: Fix Prisma Setup
```bash
# 1. Remove duplicate Prisma file
rm src/lib/server/prisma.js

# 2. Generate Prisma client with correct environment
export DATABASE_URL="postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=require"
npx prisma generate

# 3. Update imports in health check
# Change: import { prisma } from '$lib/server/prisma.js';
# To: import { prisma } from '$lib/server/database.js';
```

### Step 3: Fix Client Portal Null Safety
Update `src/routes/client-portal/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  
  export let data;
  
  // Add authentication check
  $: if (!data.user) {
    goto('/login');
  }
</script>

<!-- Update all user property accesses to use optional chaining -->
<!-- Line 175: -->
<Badge>{data.user?.subscription || 'Basic'}</Badge>

<!-- Line 179: -->
<span>{data.stats?.totalAccounts || 0} / {data.user?.accountsLimit || 10}</span>

<!-- Line 183: -->
<Badge>{data.user?.isActive ? 'Active' : 'Inactive'}</Badge>
```

### Step 4: Add Server-Side Authentication Check
Update `src/routes/client-portal/+page.server.ts`:

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  // Add authentication guard
  if (!locals.user) {
    throw redirect(302, '/login');
  }
  
  // Existing code continues...
  try {
    const recentActivity = await getRecentActivity(locals.user.id);
    // ...
```

## Testing Checklist

After implementing fixes, test:

1. **Environment Variables:**
   ```bash
   curl -I http://localhost:5173/api/health
   # Should return 200 OK (not 503)
   ```

2. **Client Portal (Unauthenticated):**
   ```bash
   curl -I http://localhost:5173/client-portal
   # Should return 302 redirect to /login (not 500)
   ```

3. **Client Portal (Authenticated):**
   - Login first
   - Navigate to /client-portal
   - Should load without errors

4. **Database Connection:**
   ```bash
   curl http://localhost:5173/api/health?details=true
   # Check database.status = "pass"
   ```

## Common Development Commands

```bash
# Start with environment variables loaded
npm run dev:local

# Generate Prisma client
DATABASE_URL="..." npx prisma generate

# Check database connection
npx prisma db pull --print

# Run with debugging
DEBUG=* npm run dev:local

# Test endpoints
curl -I http://localhost:5173/api/health
curl -I http://localhost:5173/client-portal
curl -I http://localhost:5173/login
```

## Environment Configuration

### Required .env Variables:
```env
DATABASE_URL="postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=require"
AUTH_SECRET="your-auth-secret-here"
NODE_ENV="development"  # or "production"
```

### Verify Environment Loading:
```javascript
// Add to src/hooks.server.ts for debugging
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
```

## Troubleshooting

### Issue: Prisma client not found
```bash
# Solution: Generate client
npx prisma generate
```

### Issue: DATABASE_URL not defined
```bash
# Solution: Use dev:local script or add dotenv
npm run dev:local
```

### Issue: Still getting 500 errors
1. Check server logs for stack traces
2. Verify all null-safety fixes are applied
3. Ensure authentication is working
4. Check Prisma client initialization

### Issue: Authentication not working
1. Verify AUTH_SECRET is set
2. Check session cookie is being set
3. Verify user exists in database
4. Check locals.user is populated in hooks

## Future Improvements

1. **Add comprehensive error boundaries** in Svelte components
2. **Implement proper loading states** for async data
3. **Add retry logic** for database connections
4. **Create health check dashboard** for monitoring
5. **Add automated tests** for authentication flows
6. **Implement graceful degradation** when database is unavailable

## Notes for Deployment

- Production uses different environment loading
- Ensure all environment variables are set in production
- Use `npm run build` and test the production build locally
- Consider using PM2 or similar for process management
- Set up proper logging and monitoring

## References

- [SvelteKit Documentation](https://kit.svelte.dev)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- Project specific auth implementation: `src/lib/server/auth-direct.ts`

---
*This is a living document. Update as new issues are discovered and solutions are implemented.*