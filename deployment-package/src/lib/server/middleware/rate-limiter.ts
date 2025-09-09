import { json, type RequestEvent } from '@sveltejs/kit';
import { logger, LogLevel } from '../logging/logger.js';

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
	windowMs: number; // Time window in milliseconds
	requests: number; // Max requests per window
	skipSuccessfulRequests?: boolean;
	skipFailedRequests?: boolean;
	keyGenerator?: (event: RequestEvent) => string;
	onLimitReached?: (event: RequestEvent, resetTime: number) => void;
}

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
	requests: number;
	resetTime: number;
}

/**
 * In-memory rate limit store
 * In production, consider using Redis for distributed rate limiting
 */
class MemoryRateLimitStore {
	private store = new Map<string, RateLimitEntry>();
	private cleanupInterval: NodeJS.Timeout;

	constructor() {
		// Clean up expired entries every minute
		this.cleanupInterval = setInterval(() => {
			this.cleanup();
		}, 60 * 1000);
	}

	get(key: string): RateLimitEntry | undefined {
		const entry = this.store.get(key);
		if (entry && Date.now() > entry.resetTime) {
			this.store.delete(key);
			return undefined;
		}
		return entry;
	}

	set(key: string, entry: RateLimitEntry): void {
		this.store.set(key, entry);
	}

	increment(key: string, windowMs: number): RateLimitEntry {
		const now = Date.now();
		const existing = this.get(key);

		if (!existing || now > existing.resetTime) {
			const newEntry = {
				requests: 1,
				resetTime: now + windowMs
			};
			this.set(key, newEntry);
			return newEntry;
		}

		existing.requests++;
		this.set(key, existing);
		return existing;
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.store.entries()) {
			if (now > entry.resetTime) {
				this.store.delete(key);
			}
		}
	}

	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
		this.store.clear();
	}
}

const defaultStore = new MemoryRateLimitStore();

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(event: RequestEvent): string {
	const forwarded = event.request.headers.get('x-forwarded-for');
	const ip = forwarded?.split(',')[0] || 
	         event.request.headers.get('x-real-ip') ||
	         event.getClientAddress();
	return `ip:${ip}`;
}

/**
 * Rate limiting middleware
 */
export function createRateLimit(config: RateLimitConfig) {
	const {
		windowMs,
		requests: maxRequests,
		skipSuccessfulRequests = false,
		skipFailedRequests = false,
		keyGenerator = defaultKeyGenerator,
		onLimitReached
	} = config;

	return async (event: RequestEvent): Promise<Response | null> => {
		const key = keyGenerator(event);
		const entry = defaultStore.increment(key, windowMs);

		// Add rate limit headers
		const resetTimeSeconds = Math.ceil(entry.resetTime / 1000);
		const remainingRequests = Math.max(0, maxRequests - entry.requests);

		// Check if limit exceeded
		if (entry.requests > maxRequests) {
			// Log rate limit violation
			logger.logSecurity(LogLevel.WARN, 'Rate limit exceeded', {
				component: 'rate_limiter',
				event: 'limit_exceeded',
				details: {
					key,
					requests: entry.requests,
					maxRequests,
					windowMs,
					ip: event.getClientAddress(),
					userAgent: event.request.headers.get('user-agent'),
					path: event.url.pathname,
					method: event.request.method
				}
			});

			// Call custom handler if provided
			if (onLimitReached) {
				onLimitReached(event, entry.resetTime);
			}

			return json(
				{
					error: 'Too many requests',
					message: 'Rate limit exceeded. Please try again later.',
					retryAfter: Math.ceil((entry.resetTime - Date.now()) / 1000)
				},
				{
					status: 429,
					headers: {
						'X-RateLimit-Limit': maxRequests.toString(),
						'X-RateLimit-Remaining': '0',
						'X-RateLimit-Reset': resetTimeSeconds.toString(),
						'Retry-After': Math.ceil((entry.resetTime - Date.now()) / 1000).toString()
					}
				}
			);
		}

		// Set rate limit headers on response
		event.setHeaders({
			'X-RateLimit-Limit': maxRequests.toString(),
			'X-RateLimit-Remaining': remainingRequests.toString(),
			'X-RateLimit-Reset': resetTimeSeconds.toString()
		});

		return null; // Continue processing
	};
}

/**
 * Predefined rate limiters for common use cases
 */
export const RateLimiters = {
	// General API endpoints
	api: createRateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		requests: 100 // 100 requests per 15 minutes
	}),

	// Authentication endpoints (stricter)
	auth: createRateLimit({
		windowMs: 15 * 60 * 1000, // 15 minutes
		requests: 10, // 10 attempts per 15 minutes
		onLimitReached: (event, resetTime) => {
			logger.logSecurity(LogLevel.ERROR, 'Authentication rate limit exceeded', {
				component: 'auth_rate_limiter',
				event: 'auth_limit_exceeded',
				details: {
					ip: event.getClientAddress(),
					userAgent: event.request.headers.get('user-agent'),
					path: event.url.pathname,
					resetTime: new Date(resetTime).toISOString()
				}
			});
		}
	}),

	// File upload endpoints
	upload: createRateLimit({
		windowMs: 10 * 60 * 1000, // 10 minutes
		requests: 5 // 5 uploads per 10 minutes
	}),

	// Admin endpoints (more lenient for authenticated users)
	admin: createRateLimit({
		windowMs: 5 * 60 * 1000, // 5 minutes
		requests: 50 // 50 requests per 5 minutes
	}),

	// Health check endpoint (very lenient)
	health: createRateLimit({
		windowMs: 60 * 1000, // 1 minute
		requests: 60 // 60 requests per minute
	}),

	// WebSocket connections
	websocket: createRateLimit({
		windowMs: 60 * 1000, // 1 minute
		requests: 10 // 10 connection attempts per minute
	})
};

/**
 * User-based rate limiter (for authenticated requests)
 */
export function createUserRateLimit(config: RateLimitConfig) {
	return createRateLimit({
		...config,
		keyGenerator: (event) => {
			const userId = event.locals.user?.id;
			if (userId) {
				return `user:${userId}`;
			}
			// Fall back to IP-based limiting for unauthenticated requests
			return defaultKeyGenerator(event);
		}
	});
}

/**
 * Path-based rate limiter
 */
export function createPathRateLimit(path: string, config: RateLimitConfig) {
	return createRateLimit({
		...config,
		keyGenerator: (event) => {
			const baseKey = defaultKeyGenerator(event);
			return `${baseKey}:${path}`;
		}
	});
}

/**
 * Clean up resources
 */
export function destroyRateLimiters(): void {
	defaultStore.destroy();
}