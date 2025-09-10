import type { Handle, HandleServerError } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';
import { authHandle } from './auth.js';
import { AuthService } from '$lib/server/auth-direct.ts';
import type { SessionUser } from '$lib/server/auth-direct.ts';
import { userCan, checkRoutePermission } from '$lib/permissions.ts';
import type { UserRole } from '@prisma/client';
import { requestLoggingHandle } from '$lib/server/logging/request-logger.js';
import { errorHandler } from '$lib/server/error-handler.js';
import { logger, LogLevel } from '$lib/server/logging/logger.js';
import { rateLimitMiddleware } from '$lib/server/rate-limiter-comprehensive.js';
import { securityMiddleware } from '$lib/server/security-headers-disabled.js';

// Declare locals type
declare global {
	namespace App {
		interface Locals {
			user?: SessionUser;
			requestId?: string;
			cspNonce?: string;
		}
	}
}

// Define route categories for better organization
const ADMIN_ONLY_ROUTES = ['/accounts', '/devices', '/scraping', '/settings'];
const CLIENT_PORTAL_ROUTES = ['/client-portal'];
const UNAUTHORIZED_ROUTES = ['/access-pending'];
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/api/auth', '/api/test-login'];
const PUBLIC_ROUTES = ['/unauthorized'];


// Rate limiting handler
const rateLimitHandle: Handle = async ({ event, resolve }) => {
	// Skip rate limiting in development or for basic page loads to fix deployment testing
	const pathname = event.url.pathname;
	const isBasicPageLoad = pathname === '/' || pathname === '/login' || pathname.startsWith('/client-portal');
	
	// Apply rate limiting only to API endpoints and auth actions
	if (!isBasicPageLoad && (pathname.startsWith('/api/') || event.request.method !== 'GET')) {
		const rateLimitResponse = await rateLimitMiddleware(event);
		if (rateLimitResponse) {
			return rateLimitResponse;
		}
	}
	
	return resolve(event);
};

// Unified authentication handler using Auth.js only
const authSessionHandle: Handle = async ({ event, resolve }) => {
	const { cookies, url } = event;

	// Use Auth.js session for all authentication
	if (event.locals.auth) {
		try {
			const authSession = await event.locals.auth();
			if (authSession?.user?.email) {
				// Convert Auth.js session to our SessionUser format
				const sessionUser: SessionUser = {
					id: authSession.user.id || `oauth_${authSession.user.email}`,
					email: authSession.user.email,
					name: authSession.user.name || authSession.user.email,
					role: authSession.user.role || 'CLIENT', // Use role from Auth.js token or default to CLIENT
					isActive: true,
					company: authSession.user.company || null,
					avatar: authSession.user.image || null,
					subscription: authSession.user.subscription || 'Basic',
					lastLoginAt: new Date()
				};
				
				event.locals.user = sessionUser;
				console.log(`🔐 Auth.js session found for: ${authSession.user.email} (role: ${sessionUser.role})`);
			}
		} catch (error) {
			console.error('Error checking Auth.js session:', error);
		}
	}

	// Clean up any old session cookies that might exist
	const oldSessionCookie = cookies.get('session');
	if (oldSessionCookie) {
		console.log('🧹 Cleaning up old session cookie');
		cookies.delete('session', { path: '/', secure: !dev, httpOnly: true, sameSite: 'lax' });
	}

	// Route classification
	const pathname = url.pathname;
	const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));
	const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
	const isUnauthorizedRoute = UNAUTHORIZED_ROUTES.some(route => pathname.startsWith(route));
	const isOAuthRoute = pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/oauth/');
	const isApiRoute = pathname.startsWith('/api/');
	const isAdminRoute = ADMIN_ONLY_ROUTES.some(route => pathname.startsWith(route));
	const isClientPortalRoute = CLIENT_PORTAL_ROUTES.some(route => pathname.startsWith(route));

	// Skip auth redirects for OAuth routes, public routes, and unauthorized routes
	if (isOAuthRoute || isPublicRoute || isUnauthorizedRoute) {
		return resolve(event);
	}

	// Step 1: Check if user is authenticated
	if (!event.locals.user) {
		// Allow access to auth routes for unauthenticated users
		if (isAuthRoute) {
			return resolve(event);
		}
		
		// Redirect unauthenticated users to login
		const redirectUrl = `/login?redirectTo=${encodeURIComponent(pathname)}`;
		throw redirect(302, redirectUrl);
	}

	// Step 2: User is authenticated - check if they should be redirected away from auth pages
	if (isAuthRoute && event.locals.user) {
		// Redirect authenticated users away from auth pages
		// All authenticated users go to client portal (dashboard)
		if (userCan.accessClientPortal(event.locals.user) || userCan.accessAdminPortal(event.locals.user)) {
			throw redirect(302, '/client-portal');
		} else if (event.locals.user.role === 'UNAUTHORIZED') {
			throw redirect(302, '/access-pending');
		}
		// Fallback to login if role is invalid
		throw redirect(302, '/login');
	}

	// Step 3: User is authenticated - check role-based route permissions
	if (!event.locals.user) {
		return resolve(event); // Safety check for unauthenticated users
	}
	
	const userRole = event.locals.user.role as UserRole;
	
	// UNAUTHORIZED users can only access the access-pending route
	if (userRole === 'UNAUTHORIZED' && !isUnauthorizedRoute) {
		throw redirect(302, '/access-pending');
	}
	
	// Check admin-only routes, but allow clients to access profile pages for viewing their data
	if (isAdminRoute && !userCan.accessAdminPortal(event.locals.user)) {
		// Special exception: Allow CLIENT and VIEWER users to access profile pages
		const isProfilePage = pathname.startsWith('/scraping/profile/');
		if (isProfilePage && (userRole === 'CLIENT' || userRole === 'VIEWER')) {
			// Allow access - the specific layout.server.ts will handle the details
		} else {
			throw redirect(302, `/unauthorized?from=${encodeURIComponent(pathname)}`);
		}
	}
	
	// Check client portal routes
	if (isClientPortalRoute && !userCan.accessClientPortal(event.locals.user)) {
		throw redirect(302, `/unauthorized?from=${encodeURIComponent(pathname)}`);
	}
	
	// Step 4: API endpoint protection
	if (isApiRoute) {
		const method = event.request.method;
		const apiPath = pathname;
		
		// UNAUTHORIZED users have no API access
		if (userRole === 'UNAUTHORIZED') {
			return new Response(
				JSON.stringify({ 
					error: 'Access pending: Your account requires administrator approval',
					code: 'ACCESS_PENDING'
				}), 
				{ 
					status: 403, 
					headers: { 'Content-Type': 'application/json' } 
				}
			);
		}
		
		// Check if this is a modification operation (POST, PUT, DELETE)
		if (['POST', 'PUT', 'DELETE'].includes(method)) {
			// VIEWER users cannot modify data
			if (userRole === 'VIEWER') {
				return new Response(
					JSON.stringify({ 
						error: 'Forbidden: Viewers cannot perform modification operations',
						code: 'INSUFFICIENT_PERMISSIONS'
					}), 
					{ 
						status: 403, 
						headers: { 'Content-Type': 'application/json' } 
					}
				);
			}
			
			// Check specific API permissions
			if (apiPath.startsWith('/api/devices') && userRole !== 'ADMIN') {
				return new Response(
					JSON.stringify({ 
						error: 'Forbidden: Only administrators can manage devices',
						code: 'ADMIN_REQUIRED'
					}), 
					{ 
						status: 403, 
						headers: { 'Content-Type': 'application/json' } 
					}
				);
			}
		}
		
		// Check read permissions for admin-only APIs
		if (apiPath.startsWith('/api/devices') && userRole !== 'ADMIN') {
			return new Response(
				JSON.stringify({ 
					error: 'Forbidden: Only administrators can access device information',
					code: 'ADMIN_REQUIRED'
				}), 
				{ 
					status: 403, 
					headers: { 'Content-Type': 'application/json' } 
				}
			);
		}
	}

	// Continue with request
	return resolve(event);
};

// Global error handler for server-side errors
export const handleError: HandleServerError = async ({ error, event, status, message }) => {
	// Generate error ID for tracking
	const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	
	// Extract user and request info
	const userId = event.locals.user?.id;
	const requestId = event.locals.requestId;
	const ip = event.getClientAddress();
	const userAgent = event.request.headers.get('user-agent');

	// Log the server error
	logger.logSystem(LogLevel.ERROR, `Server error: ${message}`, {
		component: 'server-error-handler',
		event: 'server_error',
		details: {
			errorId,
			status,
			message,
			url: event.url.pathname,
			method: event.request.method,
			userId,
			requestId,
			ip,
			userAgent,
			stack: dev && error instanceof Error ? error.stack : undefined
		},
		error: error instanceof Error ? error : undefined
	});

	// For critical errors (5xx), also log as security event if needed
	if (status >= 500) {
		logger.logSecurity(LogLevel.ERROR, `Critical server error: ${message}`, {
			eventType: 'server_error',
			severity: 'high',
			userId,
			ip,
			userAgent,
			details: {
				errorId,
				status,
				url: event.url.pathname,
				method: event.request.method
			}
		});
	}

	// Return error details (will be available to error page)
	return {
		id: errorId,
		message: dev ? message : 'An internal error occurred',
		...(dev && error instanceof Error && { stack: error.stack })
	};
};

// Enable authentication middleware with proper sequence
export const handle: Handle = sequence(
	rateLimitHandle,
	authHandle,
	authSessionHandle
);