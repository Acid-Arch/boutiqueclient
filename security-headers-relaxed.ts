import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { logger, LogLevel } from './logging/logger.js';

// Relaxed security header configurations for HTTP deployment
const SECURITY_HEADERS = {
	// Relaxed Content Security Policy for HTTP deployment
	'Content-Security-Policy': [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
		"font-src 'self' https://fonts.gstatic.com",
		"img-src 'self' data: blob: https: http:",
		"media-src 'self' blob:",
		"connect-src 'self' ws: wss: https: http:",
		"worker-src 'self' blob:",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'"
		// Removed: upgrade-insecure-requests and block-all-mixed-content for HTTP deployment
	].join('; '),

	// Prevent clickjacking attacks
	'X-Frame-Options': 'DENY',

	// Prevent MIME type sniffing
	'X-Content-Type-Options': 'nosniff',

	// Enable XSS filtering in browsers
	'X-XSS-Protection': '1; mode=block',

	// Control referrer information
	'Referrer-Policy': 'strict-origin-when-cross-origin',

	// Relaxed Cross-Origin policies for HTTP deployment
	'Cross-Origin-Embedder-Policy': 'unsafe-none',
	'Cross-Origin-Opener-Policy': 'unsafe-none',
	'Cross-Origin-Resource-Policy': 'cross-origin',

	// Permissions Policy (feature policy)
	'Permissions-Policy': [
		'geolocation=()',
		'microphone=()',
		'camera=()',
		'payment=()',
		'usb=()',
		'magnetometer=()',
		'gyroscope=()',
		'speaker=()', 
		'vibrate=()',
		'fullscreen=(self)',
		'sync-xhr=()'
	].join(', '),

	// Strict Transport Security - DISABLED for HTTP deployment
	// 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

	// Cache control for security sensitive pages
	'Cache-Control': 'no-cache, no-store, must-revalidate, private',
	'Pragma': 'no-cache',
	'Expires': '0'
};

// Routes that should have relaxed security headers
const SECURITY_SENSITIVE_ROUTES = [
	'/login',
	'/api',
	'/auth',
	'/dashboard',
	'/admin'
];

// Enhanced logging for security header application
function logSecurityHeaders(event: RequestEvent, headers: Record<string, string>) {
	if (dev) {
		logger.debug(`Security headers applied to ${event.url.pathname}:`, headers);
	}
}

/**
 * Security headers middleware for HTTP deployment
 * Applies relaxed security headers suitable for HTTP-only deployment
 */
export const securityHeaders: Handle = async ({ event, resolve }) => {
	try {
		const response = await resolve(event);
		
		// Apply security headers to all routes, but with relaxed policies
		const currentHeaders = Object.fromEntries(response.headers.entries());
		
		// Apply the relaxed security headers
		Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
			response.headers.set(key, value);
		});

		// Log security headers in development
		logSecurityHeaders(event, SECURITY_HEADERS);

		return response;
	} catch (error) {
		logger.error('Error applying security headers:', error);
		
		// If there's an error, still try to return the response
		const response = await resolve(event);
		
		// Apply minimal security headers as fallback
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('X-Frame-Options', 'DENY');
		
		return response;
	}
};

/**
 * Get security headers as an object (useful for manual application)
 */
export function getSecurityHeaders(): Record<string, string> {
	return { ...SECURITY_HEADERS };
}

/**
 * Check if a route should have enhanced security
 */
export function isSecuritySensitiveRoute(pathname: string): boolean {
	return SECURITY_SENSITIVE_ROUTES.some(route => pathname.startsWith(route));
}

export default securityHeaders;