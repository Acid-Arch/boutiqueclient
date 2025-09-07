# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a client portal application that combines the robust backend infrastructure from Boutique Portal with the modern UI design system from the Frontend Template Kit. The project implements glass morphism design with SvelteKit, PostgreSQL, and comprehensive authentication.

## Architecture
- **Backend Framework**: SvelteKit 2.22.0 with TypeScript
- **Database**: PostgreSQL with Prisma ORM (comprehensive schema with users, Instagram accounts, audit logs)
- **Authentication**: Auth.js with Google OAuth + custom auth, 2FA support
- **UI Framework**: shadcn-svelte with TailwindCSS 4.0.0-alpha.31 (glass morphism theme)
- **State Management**: Svelte stores + TanStack Query
- **WebSocket**: Real-time features for live updates
- **Testing**: Playwright for E2E, Vitest for unit tests

## Development Commands

### Core Development
```bash
# Start development server with hot reload
npm run dev

# Start development with WebSocket server
npm run dev:full

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development Environments
```bash
# Local development with .env
npm run dev:local

# Hetzner development environment
npm run dev:hetzner

# Production environment
npm run dev:production
```

### WebSocket Server
```bash
# Start standalone WebSocket server (port 8081)
npm run ws:dev

# Test WebSocket connection
npm run ws:test
```

### Quality Assurance
```bash
# Type checking
npm run check

# Type checking with watch mode
npm run check:watch

# Run tests
npm run test

# Run E2E tests
npm run test:ui

# Lint code (must pass before build)
npm run lint
```

### Database Operations
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Key File Locations

### Configuration
- `prisma/schema.prisma` - Database schema with user management, Instagram accounts, audit logs
- `src/auth.ts` - Authentication configuration (Auth.js setup)
- `src/hooks.server.ts` - Server-side hooks for auth and request handling
- `vite.config.ts` - Vite configuration with TensorFlow.js optimizations

### API Structure
- `src/routes/api/` - RESTful API endpoints (copied from Boutique Portal)
- `src/lib/api/` - API client utilities and services
- `src/lib/server/` - Server-side utilities and database operations

### UI Components
- `src/lib/components/` - Reusable shadcn-svelte components (glass morphism theme)
- `src/app.css` - Global CSS with glass morphism design system
- `tailwind.config.js` - TailwindCSS 4.0 alpha configuration

## Environment Variables Required
```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
AUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Application
PUBLIC_APP_NAME="Client Portal"
NODE_ENV="development"
```

## Database Schema Highlights
The Prisma schema includes:
- **Users**: Complete user management with roles (ADMIN, CLIENT, VIEWER), 2FA, audit logging
- **IgAccount**: Instagram account management with ownership, visibility, and account types
- **Audit System**: Comprehensive security audit trail with login attempts, password resets
- **Sessions**: Custom session management alongside Auth.js sessions
- **CloneInventory**: Device and clone management for Instagram automation

## Development Workflow

1. **Setup**: Copy configuration from Boutique Portal, apply Frontend Template Kit UI
2. **Database**: Use existing Prisma schema, run migrations
3. **Authentication**: Leverage Auth.js setup with Google OAuth
4. **API**: All backend endpoints maintain exact structure from Boutique Portal
5. **UI**: Apply glass morphism theme with shadcn-svelte components
6. **Testing**: Run type checks and tests before any commits

## Code Standards
- TypeScript strict mode enabled
- Follows SvelteKit file-based routing
- Uses server-side rendering with progressive enhancement
- Glass morphism design with consistent dark/light theme support
- WebSocket integration for real-time features
- Comprehensive error handling and audit logging

## Service Dependencies
- PostgreSQL database (required for all operations)
- WebSocket server (port 8081, for real-time features)
- External APIs: Hiker API for Instagram data (when configured)

## Build Requirements
- Node.js 18+
- PostgreSQL database connection
- All environment variables configured
- Type checking must pass (`npm run check`)
- All tests must pass before production builds