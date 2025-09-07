import { RateLimiterMemory, IRateLimiterOptions } from 'rate-limiter-flexible';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { logger, LogLevel } from './logging/logger.js';
import { createRateLimitError } from './error-handler.js';

// Rate limiter configurations for different endpoints
export const RATE_LIMITS = {
	// Authentication endpoints (stricter limits)
	AUTH: {
		points: 5, // 5 attempts
		duration: 300, // per 5 minutes
		blockDuration: 900, // block for 15 minutes after limit exceeded
	},
	// Login endpoint (very strict)
	LOGIN: {
		points: 3, // 3 attempts
		duration: 300, // per 5 minutes
		blockDuration: 1800, // block for 30 minutes
	},
	// Password reset (strict)
	PASSWORD_RESET: {
		points: 3, // 3 attempts
		duration: 3600, // per hour
		blockDuration: 3600, // block for 1 hour
	},
	// Registration (moderate)
	REGISTER: {
		points: 3, // 3 attempts
		duration: 3600, // per hour
		blockDuration: 1800, // block for 30 minutes
	},
	// API endpoints (standard)
	API: {
		points: 100, // 100 requests
		duration: 300, // per 5 minutes
		blockDuration: 300, // block for 5 minutes
	},
	// Data modification endpoints (stricter)
	API_WRITE: {
		points: 30, // 30 requests
		duration: 300, // per 5 minutes
		blockDuration: 600, // block for 10 minutes
	},
	// File upload endpoints (very strict)
	UPLOAD: {
		points: 5, // 5 uploads
		duration: 3600, // per hour
		blockDuration: 3600, // block for 1 hour
	},
	// Admin endpoints (moderate but logged)
	ADMIN: {
		points: 200, // 200 requests
		duration: 300, // per 5 minutes
		blockDuration: 300, // block for 5 minutes
	},
	// Public/static content (generous)
	PUBLIC: {
		points: 1000, // 1000 requests
		duration: 3600, // per hour
		blockDuration: 300, // block for 5 minutes
	},
	// WebSocket connections (very strict)
	WEBSOCKET: {
		points: 10, // 10 connections
		duration: 300, // per 5 minutes
		blockDuration: 900, // block for 15 minutes
	},
	// Error reporting (prevent spam)
	ERROR_REPORT: {
		points: 10, // 10 error reports
		duration: 60, // per minute
		blockDuration: 300, // block for 5 minutes
	}
} as const;

// Rate limiter instances
const rateLimiters = new Map<string, RateLimiterMemory>();

// Initialize rate limiters
function createRateLimiter(key: string, options: IRateLimiterOptions): RateLimiterMemory {
	if (rateLimiters.has(key)) {
		return rateLimiters.get(key)!;
	}

	const limiter = new RateLimiterMemory({
		...options,
		keyPrefix: `rl_${key}`,
	});

	rateLimiters.set(key, limiter);
	return limiter;
}

// Get client identifier (IP + optional user ID for better tracking)
function getClientKey(event: RequestEvent, prefix: string = ''): string {
	const ip = getClientIP(event);
	const userId = event.locals.user?.id;
	
	// Use user ID if available for more accurate tracking
	const identifier = userId ? `user_${userId}` : `ip_${ip}`;
	
	return prefix ? `${prefix}_${identifier}` : identifier;
}

// Extract client IP from various headers
function getClientIP(event: RequestEvent): string {
	const headers = event.request.headers;
	
	// Check CloudFlare header first
	let ip = headers.get('cf-connecting-ip');
	
	// Check X-Forwarded-For (take first IP)
	if (!ip) {
		const forwarded = headers.get('x-forwarded-for');
		ip = forwarded?.split(',')[0]?.trim();
	}
	
	// Check X-Real-IP
	if (!ip) {
		ip = headers.get('x-real-ip');
	}
	
	// Fallback to SvelteKit's method
	if (!ip) {
		ip = event.getClientAddress();
	}
	
	return ip || 'unknown';
}

// Create rate limit response
function createRateLimitResponse(
	rateLimiterRes: { totalHits: number; remainingPoints?: number; msBeforeNext?: number },
	limit: IRateLimiterOptions,
	operation: string
): Response {
	const resetTime = new Date(Date.now() + (rateLimiterRes.msBeforeNext || 0));
	
	const error = createRateLimitError(
		`Rate limit exceeded for ${operation}. Try again in ${Math.ceil((rateLimiterRes.msBeforeNext || 0) / 1000)} seconds.`
	);

	const response = json({
		error: {
			id: error.id,
			type: error.type,
			message: error.userMessage,
			statusCode: error.statusCode,
			timestamp: error.timestamp?.toISOString()
		},
		success: false
	}, { 
		status: 429,
		headers: {
			'X-RateLimit-Limit': limit.points?.toString() || '0',
			'X-RateLimit-Remaining': (rateLimiterRes.remainingPoints || 0).toString(),
			'X-RateLimit-Reset': resetTime.toISOString(),
			'Retry-After': Math.ceil((rateLimiterRes.msBeforeNext || 0) / 1000).toString()
		}
	});

	return response;
}

// Main rate limiting function
export async function rateLimit(
	event: RequestEvent,
	limitConfig: keyof typeof RATE_LIMITS,
	customKey?: string
): Promise<Response | null> {
	try {
		const config = RATE_LIMITS[limitConfig];
		const rateLimiterKey = customKey || limitConfig.toLowerCase();
		const clientKey = getClientKey(event, rateLimiterKey);
		
		// Create or get rate limiter
		const rateLimiter = createRateLimiter(rateLimiterKey, config);
		
		// Check rate limit
		const rateLimiterRes = await rateLimiter.consume(clientKey);
		
		return null; // No rate limit exceeded
		
	} catch (rateLimiterRes) {
		// Rate limit exceeded
		const ip = getClientIP(event);
		const userId = event.locals.user?.id;
		const userAgent = event.request.headers.get('user-agent');
		
		// Log rate limit violation
		logger.logSecurity(LogLevel.WARN, `Rate limit exceeded: ${limitConfig}`, {
			eventType: 'rate_limit_exceeded',
			severity: 'medium',
			ip,
			userId,
			userAgent,
			details: {
				limitType: limitConfig,
				url: event.url.pathname,
				method: event.request.method,
				totalHits: (rateLimiterRes as any).totalHits,
				msBeforeNext: (rateLimiterRes as any).msBeforeNext
			}
		});

		// Create and return rate limit error response
		const config = RATE_LIMITS[limitConfig];
		return createRateLimitResponse(
			rateLimiterRes as any,
			config,
			limitConfig.toLowerCase().replace('_', ' ')
		);
	}
}

// Convenience functions for common rate limit checks
export const rateLimitAuth = (event: RequestEvent) => rateLimit(event, 'AUTH');
export const rateLimitLogin = (event: RequestEvent) => rateLimit(event, 'LOGIN');
export const rateLimitRegister = (event: RequestEvent) => rateLimit(event, 'REGISTER');
export const rateLimitPasswordReset = (event: RequestEvent) => rateLimit(event, 'PASSWORD_RESET');
export const rateLimitAPI = (event: RequestEvent) => rateLimit(event, 'API');
export const rateLimitAPIWrite = (event: RequestEvent) => rateLimit(event, 'API_WRITE');
export const rateLimitUpload = (event: RequestEvent) => rateLimit(event, 'UPLOAD');
export const rateLimitAdmin = (event: RequestEvent) => rateLimit(event, 'ADMIN');
export const rateLimitPublic = (event: RequestEvent) => rateLimit(event, 'PUBLIC');
export const rateLimitWebSocket = (event: RequestEvent) => rateLimit(event, 'WEBSOCKET');
export const rateLimitErrorReport = (event: RequestEvent) => rateLimit(event, 'ERROR_REPORT');

// Middleware function that can be used in hooks
export async function rateLimitMiddleware(event: RequestEvent): Promise<Response | null> {
	const { url, request } = event;
	const path = url.pathname;
	const method = request.method;

	// Skip rate limiting for static assets in development
	if (dev && (path.startsWith('/_app/') || path.startsWith('/static/'))) {
		return null;
	}

	// Apply appropriate rate limits based on path and method
	try {
		// Authentication endpoints
		if (path.includes('/login')) {
			return await rateLimitLogin(event);
		}
		
		if (path.includes('/register')) {
			return await rateLimitRegister(event);
		}
		
		if (path.includes('/forgot-password') || path.includes('/reset-password')) {
			return await rateLimitPasswordReset(event);
		}
		
		if (path.startsWith('/api/auth/')) {
			return await rateLimitAuth(event);
		}

		// Error reporting
		if (path === '/api/errors/report') {
			return await rateLimitErrorReport(event);
		}

		// File uploads
		if (path.includes('/upload') || method === 'POST' && 
			(path.includes('/files') || path.includes('/images'))) {
			return await rateLimitUpload(event);
		}

		// Admin endpoints
		if (path.startsWith('/admin') || path.includes('/api/admin/')) {
			return await rateLimitAdmin(event);
		}

		// API endpoints (write operations)
		if (path.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
			return await rateLimitAPIWrite(event);
		}

		// API endpoints (read operations)
		if (path.startsWith('/api/')) {
			return await rateLimitAPI(event);
		}

		// WebSocket connections
		if (path.includes('/ws') || path.includes('/websocket')) {
			return await rateLimitWebSocket(event);
		}

		// Default public rate limit for everything else
		return await rateLimitPublic(event);
		
	} catch (error) {
		// Log rate limiting errors but don't block requests
		logger.logSystem(LogLevel.ERROR, 'Rate limiting error', {
			component: 'rate-limiter',
			event: 'rate_limit_error',
			details: {
				path,
				method,
				error: error instanceof Error ? error.message : String(error)
			},
			error: error instanceof Error ? error : undefined
		});
		
		// Allow request to continue if rate limiting fails
		return null;
	}
}