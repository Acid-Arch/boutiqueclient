import type { Handle, RequestEvent } from '@sveltejs/kit';
import { logger, LogLevel } from './logger.js';
import { recordResponseTime, incrementErrorCount } from '../metrics.js';

// Extract client IP address
function getClientIP(request: Request): string {
	const headers = request.headers;
	return (
		headers.get('cf-connecting-ip') ||
		headers.get('x-forwarded-for')?.split(',')[0] ||
		headers.get('x-real-ip') ||
		headers.get('x-client-ip') ||
		'unknown'
	);
}

// Extract user agent
function getUserAgent(request: Request): string {
	return request.headers.get('user-agent') || 'unknown';
}

// Check if route should be logged
function shouldLogRoute(pathname: string): boolean {
	// Skip static assets and health checks
	const skipPatterns = [
		'/favicon.ico',
		'/robots.txt',
		'/_app/',
		'/static/',
		'/assets/',
		'/__health',
		'/__status'
	];

	return !skipPatterns.some(pattern => pathname.startsWith(pattern));
}

// Determine log level based on status code
function getLogLevel(statusCode: number): LogLevel {
	if (statusCode >= 500) return LogLevel.ERROR;
	if (statusCode >= 400) return LogLevel.WARN;
	if (statusCode >= 300) return LogLevel.INFO;
	return LogLevel.DEBUG;
}

// Sanitize request body for logging
function sanitizeRequestBody(body: any): any {
	if (!body) return undefined;

	if (typeof body === 'object') {
		const sanitized: any = {};
		for (const [key, value] of Object.entries(body)) {
			const lowerKey = key.toLowerCase();
			if (lowerKey.includes('password') || 
				lowerKey.includes('secret') || 
				lowerKey.includes('token') ||
				lowerKey.includes('key')) {
				sanitized[key] = '[REDACTED]';
			} else if (typeof value === 'string' && value.length > 1000) {
				sanitized[key] = `[TRUNCATED: ${value.length} chars]`;
			} else {
				sanitized[key] = value;
			}
		}
		return sanitized;
	}

	return body;
}

// Request logging middleware
export const requestLoggingHandle: Handle = async ({ event, resolve }) => {
	const { request, url } = event;
	
	if (!shouldLogRoute(url.pathname)) {
		return resolve(event);
	}

	const startTime = Date.now();
	const requestId = logger.generateRequestId();
	const ip = getClientIP(request);
	const userAgent = getUserAgent(request);

	// Add request ID to event locals for use in other handlers
	event.locals.requestId = requestId;

	// Log incoming request
	logger.logAPI(LogLevel.DEBUG, 'Incoming request', {
		requestId,
		method: request.method,
		url: url.pathname + url.search,
		statusCode: 0,
		duration: 0,
		ip,
		userAgent,
		userId: event.locals.user?.id
	});

	let response: Response;
	let error: Error | undefined;

	try {
		response = await resolve(event);
	} catch (err) {
		error = err as Error;
		
		// Log the error
		logger.logAPI(LogLevel.ERROR, 'Request failed with error', {
			requestId,
			method: request.method,
			url: url.pathname + url.search,
			statusCode: 500,
			duration: Date.now() - startTime,
			ip,
			userAgent,
			userId: event.locals.user?.id,
			error
		});

		// Re-throw the error
		throw err;
	}

	const duration = Date.now() - startTime;
	const statusCode = response.status;

	// Record metrics
	recordResponseTime(
		url.pathname,
		request.method,
		statusCode,
		duration,
		event.locals.user?.id
	);

	// Record errors
	if (statusCode >= 400) {
		incrementErrorCount(
			statusCode >= 500 ? 'server_error' : 'client_error',
			url.pathname,
			event.locals.user?.id
		);
	}

	// Log completed request
	const logLevel = getLogLevel(statusCode);
	logger.logAPI(logLevel, 'Request completed', {
		requestId,
		method: request.method,
		url: url.pathname + url.search,
		statusCode,
		duration,
		ip,
		userAgent,
		userId: event.locals.user?.id
	});

	// Log slow requests as performance issues
	if (duration > 5000) { // 5 seconds
		logger.logPerformance(LogLevel.WARN, 'Slow request detected', {
			metric: 'response_time',
			value: duration,
			unit: 'ms',
			threshold: 5000,
			component: 'api',
			userId: event.locals.user?.id
		});
	}

	// Log authentication events
	if (url.pathname.startsWith('/api/auth/')) {
		const isSuccess = statusCode < 400;
		logger.logAuth(
			isSuccess ? LogLevel.INFO : LogLevel.WARN,
			`Authentication ${request.method} ${isSuccess ? 'succeeded' : 'failed'}`,
			{
				userId: event.locals.user?.id,
				email: event.locals.user?.email,
				ip,
				userAgent,
				action: `${request.method}_${url.pathname.split('/').pop()}`,
				success: isSuccess,
				reason: isSuccess ? undefined : `HTTP ${statusCode}`
			}
		);
	}

	// Add correlation ID to response headers for debugging
	response.headers.set('X-Request-ID', requestId);

	return response;
};

// WebSocket connection logging
export function logWebSocketConnection(
	event: 'connect' | 'disconnect' | 'error',
	context: {
		connectionId?: string;
		userId?: string;
		ip?: string;
		userAgent?: string;
		error?: Error;
		duration?: number;
	}
) {
	const level = event === 'error' ? LogLevel.ERROR : LogLevel.INFO;
	
	logger.logSystem(level, `WebSocket ${event}`, {
		component: 'websocket',
		event,
		...context
	});
}

// Business event logging helpers
export function logAccountCreated(userId: string, accountId: number, ip: string) {
	logger.logBusiness(LogLevel.INFO, 'Account created', {
		event: 'account_created',
		userId,
		accountId,
		details: { ip }
	});
}

export function logScrapingSession(
	event: 'started' | 'completed' | 'failed',
	sessionId: string,
	userId?: string,
	details?: Record<string, any>
) {
	const level = event === 'failed' ? LogLevel.ERROR : LogLevel.INFO;
	
	logger.logBusiness(level, `Scraping session ${event}`, {
		event: `scraping_${event}`,
		userId,
		details: { sessionId, ...details }
	});
}

// Security event logging helpers
export function logSecurityThreat(
	threatType: string,
	severity: 'low' | 'medium' | 'high' | 'critical',
	details: {
		ip?: string;
		userId?: string;
		userAgent?: string;
		description: string;
		evidence?: Record<string, any>;
	}
) {
	logger.logSecurity(LogLevel.ERROR, `Security threat detected: ${threatType}`, {
		eventType: threatType,
		severity,
		ip: details.ip,
		userId: details.userId,
		userAgent: details.userAgent,
		details: {
			description: details.description,
			evidence: details.evidence
		}
	});
}

export function logLoginAttempt(
	success: boolean,
	email: string,
	ip: string,
	userAgent: string,
	reason?: string
) {
	logger.logAuth(
		success ? LogLevel.INFO : LogLevel.WARN,
		`Login attempt ${success ? 'succeeded' : 'failed'}`,
		{
			email,
			ip,
			userAgent,
			action: 'login',
			success,
			reason
		}
	);
}