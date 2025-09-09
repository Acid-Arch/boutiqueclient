import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { logger, LogLevel } from './logging/logger.js';

// Security header configurations
const SECURITY_HEADERS = {
	// Content Security Policy - very important for XSS protection
	'Content-Security-Policy': dev ? 
		// Development CSP (more permissive)
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: blob: https:",
			"media-src 'self' blob:",
			"connect-src 'self' ws: wss: https:",
			"worker-src 'self' blob:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"upgrade-insecure-requests"
		].join('; ') :
		// Production CSP (relaxed for HTTP deployment testing)
		[
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' https://fonts.gstatic.com",
			"img-src 'self' data: blob: https:",
			"media-src 'self' blob:",
			"connect-src 'self' ws: wss: https:",
			"worker-src 'self' blob:",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'"
		].join('; '),

	// Prevent clickjacking attacks
	'X-Frame-Options': 'DENY',

	// Prevent MIME type sniffing
	'X-Content-Type-Options': 'nosniff',

	// Enable XSS filtering in browsers
	'X-XSS-Protection': '1; mode=block',

	// Control referrer information
	'Referrer-Policy': 'strict-origin-when-cross-origin',

	// Prevent exposure of sensitive APIs to unauthorized origins (relaxed for HTTP testing)
	// 'Cross-Origin-Embedder-Policy': 'credentialless',
	// 'Cross-Origin-Opener-Policy': 'same-origin',
	// 'Cross-Origin-Resource-Policy': 'same-origin',

	// Control access to geolocation, camera, microphone, etc.
	'Permissions-Policy': [
		'geolocation=()',
		'microphone=()',
		'camera=()',
		'magnetometer=()',
		'gyroscope=()',
		'speaker=()',
		'vibrate=()',
		'fullscreen=(self)',
		'payment=()'
	].join(', ')
};

// HTTPS-only headers (applied only in production with HTTPS)
const HTTPS_HEADERS = {
	// HTTP Strict Transport Security
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

// Generate Content Security Policy nonce
function generateCSPNonce(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
}

// Apply security headers to response
export function applySecurityHeaders(
	response: Response,
	event: RequestEvent,
	options: {
		enableCSP?: boolean;
		enableHSTS?: boolean;
		customHeaders?: Record<string, string>;
	} = {}
): Response {
	const {
		enableCSP = true,
		enableHSTS = !dev,
		customHeaders = {}
	} = options;

	// Create new headers object
	const headers = new Headers(response.headers);
	
	// Generate CSP nonce for this request
	const nonce = generateCSPNonce();
	
	// Apply security headers
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (name === 'Content-Security-Policy' && !enableCSP) {
			continue; // Skip CSP if disabled
		}
		
		let headerValue = value;
		
		// Replace nonce placeholder in CSP
		if (name === 'Content-Security-Policy') {
			headerValue = value.replace(/\{NONCE\}/g, nonce);
		}
		
		headers.set(name, headerValue);
	}

	// Apply HTTPS-only headers in production
	if (enableHSTS && !dev) {
		for (const [name, value] of Object.entries(HTTPS_HEADERS)) {
			headers.set(name, value);
		}
	}

	// Apply custom headers
	for (const [name, value] of Object.entries(customHeaders)) {
		headers.set(name, value);
	}

	// Add security-related headers for debugging in development
	if (dev) {
		headers.set('X-Security-Headers-Applied', 'true');
		headers.set('X-CSP-Nonce', nonce);
	}

	// Store nonce in locals for use in templates
	event.locals.cspNonce = nonce;

	// Create new response with security headers
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}

// Security headers middleware
export const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	// Check if this is an API endpoint
	const isApi = event.url.pathname.startsWith('/api/');
	
	// Resolve the request
	const response = await resolve(event);
	
	// Apply security headers
	const securedResponse = applySecurityHeaders(response, event, {
		enableCSP: !isApi, // Disable CSP for API endpoints to avoid issues
		enableHSTS: !dev && event.url.protocol === 'https:',
		customHeaders: isApi ? {
			// API-specific headers
			'X-API-Version': '1.0',
			'X-Rate-Limit-Policy': 'enabled'
		} : {}
	});

	// Log security header application
	logger.logSecurity(LogLevel.DEBUG, 'Security headers applied', {
		eventType: 'security_headers_applied',
		severity: 'low',
		ip: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent'),
		details: {
			url: event.url.pathname,
			method: event.request.method,
			isApi,
			hasCSP: !isApi,
			hasHSTS: !dev,
			nonce: event.locals.cspNonce
		}
	});

	return securedResponse;
};

// Validate incoming security headers (detect potential attacks)
export function validateIncomingHeaders(event: RequestEvent): {
	valid: boolean;
	threats: string[];
	warnings: string[];
} {
	const threats: string[] = [];
	const warnings: string[] = [];
	const headers = event.request.headers;

	// Check for suspicious User-Agent patterns
	const userAgent = headers.get('user-agent') || '';
	const suspiciousUAPatterns = [
		/curl/i,
		/wget/i,
		/python/i,
		/bot/i,
		/crawler/i,
		/spider/i,
		/scraper/i
	];

	// Only flag as threats if they're accessing non-API endpoints without proper authentication
	if (!event.url.pathname.startsWith('/api/') && !event.locals.user) {
		for (const pattern of suspiciousUAPatterns) {
			if (pattern.test(userAgent)) {
				warnings.push(`Suspicious User-Agent detected: ${userAgent.substring(0, 50)}`);
				break;
			}
		}
	}

	// Check for header injection attempts
	for (const [name, value] of headers.entries()) {
		if (value.includes('\r\n') || value.includes('\n') || value.includes('\r')) {
			threats.push(`Header injection detected in ${name}`);
		}
		
		// Check for excessively long headers (potential DoS)
		if (value.length > 8192) {
			threats.push(`Excessively long header: ${name}`);
		}
	}

	// Check for suspicious referer patterns
	const referer = headers.get('referer');
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			const currentHost = event.url.hostname;
			
			// Warning for external referers on sensitive endpoints
			if (refererUrl.hostname !== currentHost && 
				(event.url.pathname.includes('/admin') || 
				 event.url.pathname.includes('/settings') ||
				 event.request.method !== 'GET')) {
				warnings.push(`External referer on sensitive endpoint: ${refererUrl.hostname}`);
			}
		} catch {
			warnings.push('Invalid referer URL format');
		}
	}

	// Check for missing expected headers on API requests
	if (event.url.pathname.startsWith('/api/') && event.request.method !== 'GET') {
		const contentType = headers.get('content-type');
		if (!contentType || !contentType.includes('application/json')) {
			warnings.push('API request missing proper Content-Type header');
		}
	}

	// Check for suspicious X-Forwarded headers
	const forwardedFor = headers.get('x-forwarded-for');
	if (forwardedFor) {
		const ips = forwardedFor.split(',').map(ip => ip.trim());
		
		// Check for too many forwarded IPs (potential header manipulation)
		if (ips.length > 10) {
			threats.push('Too many IPs in X-Forwarded-For header');
		}
		
		// Check for private IP addresses in public-facing deployments
		for (const ip of ips) {
			if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(ip)) {
				warnings.push('Private IP detected in X-Forwarded-For');
			}
		}
	}

	const valid = threats.length === 0;

	// Log security validation results
	if (threats.length > 0 || warnings.length > 0) {
		logger.logSecurity(
			threats.length > 0 ? LogLevel.WARN : LogLevel.INFO,
			`Security header validation: ${threats.length} threats, ${warnings.length} warnings`,
			{
				eventType: 'header_security_check',
				severity: threats.length > 0 ? 'high' : 'low',
				ip: event.getClientAddress(),
				userAgent,
				details: {
					url: event.url.pathname,
					method: event.request.method,
					threats,
					warnings,
					headerCount: Array.from(headers.keys()).length
				}
			}
		);
	}

	return { valid, threats, warnings };
}

// CORS configuration for API endpoints
export function getCORSHeaders(event: RequestEvent): Record<string, string> {
	const origin = event.request.headers.get('origin');
	const allowedOrigins = dev ? 
		['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'] :
		[]; // Configure production origins as needed

	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
		'Access-Control-Max-Age': '86400', // 24 hours
		'Vary': 'Origin'
	};

	// Only set CORS origin if it's in allowed list
	if (origin && allowedOrigins.includes(origin)) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Credentials'] = 'true';
	} else if (dev && !origin) {
		// In development, allow same-origin requests
		headers['Access-Control-Allow-Origin'] = event.url.origin;
		headers['Access-Control-Allow-Credentials'] = 'true';
	}

	return headers;
}

// Handle CORS preflight requests
export function handleCORSPreflight(event: RequestEvent): Response | null {
	if (event.request.method === 'OPTIONS') {
		const corsHeaders = getCORSHeaders(event);
		
		return new Response(null, {
			status: 204,
			headers: corsHeaders
		});
	}
	
	return null;
}

// Security middleware that combines header validation and security headers
export const securityMiddleware: Handle = async ({ event, resolve }) => {
	// Handle CORS preflight requests
	const corsResponse = handleCORSPreflight(event);
	if (corsResponse) {
		return corsResponse;
	}

	// Validate incoming headers
	const headerValidation = validateIncomingHeaders(event);
	
	// Block requests with security threats
	if (!headerValidation.valid) {
		logger.logSecurity(LogLevel.ERROR, 'Request blocked due to security threats', {
			eventType: 'request_blocked',
			severity: 'critical',
			ip: event.getClientAddress(),
			userAgent: event.request.headers.get('user-agent'),
			details: {
				url: event.url.pathname,
				method: event.request.method,
				threats: headerValidation.threats
			}
		});

		return new Response('Forbidden', { 
			status: 403,
			headers: {
				'Content-Type': 'text/plain',
				'X-Security-Block': 'header-threats'
			}
		});
	}

	// Continue with request processing
	const response = await resolve(event);
	
	// Apply security headers to response
	return applySecurityHeaders(response, event);
};