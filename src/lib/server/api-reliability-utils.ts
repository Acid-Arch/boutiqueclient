/**
 * API Reliability Utilities
 * 
 * Comprehensive error handling, timeout management, and graceful degradation
 * for automation API endpoints with consistent response format.
 */

import { json } from '@sveltejs/kit';

// Standard error response interface
export interface ApiErrorResponse {
	success: false;
	error: string;
	code: string;
	timestamp: string;
	requestId?: string;
	responseTime?: number;
	retryAfter?: number;
	fallback?: any;
	details?: string;
}

// Standard success response interface
export interface ApiSuccessResponse<T = any> {
	success: true;
	data: T;
	timestamp: string;
	requestId?: string;
	responseTime?: number;
	cached?: boolean;
	dataSource?: 'database' | 'fallback' | 'cache';
}

// Error codes and their HTTP status mappings
export const ERROR_CODES = {
	// Client Errors (4xx)
	INVALID_REQUEST: 400,
	MISSING_PARAMETER: 400,
	INVALID_PARAMETER: 400,
	INVALID_JSON: 400,
	VALIDATION_ERROR: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	METHOD_NOT_ALLOWED: 405,
	CONFLICT: 409,
	RATE_LIMITED: 429,

	// Server Errors (5xx)
	INTERNAL_ERROR: 500,
	DATABASE_ERROR: 503,
	DATABASE_UNAVAILABLE: 503,
	TIMEOUT: 504,
	OPERATION_TIMEOUT: 504,
	SERVICE_UNAVAILABLE: 503,
	PRISMA_ERROR: 503,
	AUTOMATION_ERROR: 500,
	EXTERNAL_SERVICE_ERROR: 502
} as const;

// Request timeout configurations
export const TIMEOUT_CONFIG = {
	FAST_QUERY: 5000,     // 5 seconds for quick queries
	STANDARD_QUERY: 10000, // 10 seconds for normal operations
	SLOW_QUERY: 15000,    // 15 seconds for complex operations
	BULK_OPERATION: 30000, // 30 seconds for bulk operations
	HEALTH_CHECK: 3000    // 3 seconds for health checks
} as const;

// Retry configuration with exponential backoff
export interface RetryConfig {
	maxAttempts: number;
	baseDelay: number;
	maxDelay: number;
	backoffFactor: number;
	retryOnCodes: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	baseDelay: 1000,
	maxDelay: 8000,
	backoffFactor: 2,
	retryOnCodes: ['TIMEOUT', 'DATABASE_UNAVAILABLE', 'SERVICE_UNAVAILABLE']
};

// Request tracking for monitoring
const requestTracker = new Map<string, { startTime: number; endpoint: string }>();

/**
 * Generate unique request ID for tracking
 */
export function generateRequestId(): string {
	return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start request tracking
 */
export function startRequestTracking(endpoint: string): string {
	const requestId = generateRequestId();
	requestTracker.set(requestId, {
		startTime: Date.now(),
		endpoint
	});
	return requestId;
}

/**
 * Get request duration and cleanup tracking
 */
export function getRequestDuration(requestId: string): number {
	const tracking = requestTracker.get(requestId);
	if (!tracking) return 0;
	
	const duration = Date.now() - tracking.startTime;
	requestTracker.delete(requestId);
	return duration;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
	code: keyof typeof ERROR_CODES,
	error: string,
	requestId?: string,
	responseTime?: number,
	fallback?: any,
	details?: string
): Response {
	const errorResponse: ApiErrorResponse = {
		success: false,
		error,
		code,
		timestamp: new Date().toISOString(),
		...(requestId && { requestId }),
		...(responseTime && { responseTime }),
		...(fallback && { fallback }),
		...(details && process.env.NODE_ENV === 'development' && { details })
	};

	// Add retry-after header for certain errors
	if (['DATABASE_UNAVAILABLE', 'RATE_LIMITED', 'SERVICE_UNAVAILABLE'].includes(code)) {
		errorResponse.retryAfter = getRetryAfter(code);
	}

	const statusCode = ERROR_CODES[code] || 500;
	
	// Log error for monitoring
	console.error(`[API Error] ${code} (${statusCode}): ${error}`, {
		requestId,
		responseTime,
		endpoint: requestTracker.get(requestId || '')?.endpoint
	});

	return json(errorResponse, { status: statusCode });
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
	data: T,
	requestId?: string,
	responseTime?: number,
	cached = false,
	dataSource: 'database' | 'fallback' | 'cache' = 'database'
): Response {
	const successResponse: ApiSuccessResponse<T> = {
		success: true,
		data,
		timestamp: new Date().toISOString(),
		...(requestId && { requestId }),
		...(responseTime && { responseTime }),
		cached,
		dataSource
	};

	// Log successful response for monitoring
	if (responseTime && responseTime > 5000) {
		console.warn(`[API Slow] Request took ${responseTime}ms`, { requestId, dataSource });
	}

	return json(successResponse);
}

/**
 * Get retry-after value in seconds based on error code
 */
function getRetryAfter(code: string): number {
	switch (code) {
		case 'RATE_LIMITED': return 60;
		case 'DATABASE_UNAVAILABLE': return 30;
		case 'SERVICE_UNAVAILABLE': return 15;
		default: return 10;
	}
}

/**
 * Timeout wrapper for promises with automatic error handling
 */
export async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	operation: string
): Promise<T> {
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			reject(new Error(`${operation} operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	try {
		return await Promise.race([promise, timeoutPromise]);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes('timed out')) {
			throw new Error(`TIMEOUT: ${errorMessage}`);
		}
		throw error;
	}
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: Partial<RetryConfig> = {},
	operation: string
): Promise<T> {
	const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
	let lastError: Error;
	
	for (let attempt = 1; attempt <= fullConfig.maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			const errorMessage = lastError.message;
			
			// Check if error is retryable
			const isRetryable = fullConfig.retryOnCodes.some(code => 
				errorMessage.includes(code) || errorMessage.toUpperCase().includes(code)
			);
			
			if (!isRetryable || attempt === fullConfig.maxAttempts) {
				throw lastError;
			}
			
			// Calculate delay with exponential backoff
			const delay = Math.min(
				fullConfig.baseDelay * Math.pow(fullConfig.backoffFactor, attempt - 1),
				fullConfig.maxDelay
			);
			
			console.warn(`[API Retry] ${operation} failed (attempt ${attempt}/${fullConfig.maxAttempts}), retrying in ${delay}ms:`, errorMessage);
			
			// Wait before retrying
			await new Promise(resolve => setTimeout(resolve, delay));
		}
	}
	
	throw lastError!;
}

/**
 * Database query wrapper with timeout and error handling
 */
export async function withDatabaseTimeout<T>(
	query: () => Promise<T>,
	timeoutMs = TIMEOUT_CONFIG.STANDARD_QUERY,
	operation = 'Database query'
): Promise<{ success: true; data: T } | { success: false; error: string; code: string }> {
	try {
		const result = await withTimeout(query(), timeoutMs, operation);
		return { success: true, data: result };
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		
		// Classify error type
		if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
			return { success: false, error: `${operation} timed out`, code: 'TIMEOUT' };
		}
		
		if (errorMessage.includes('Prisma') || errorMessage.includes('PrismaClient')) {
			return { success: false, error: 'Database connection error', code: 'PRISMA_ERROR' };
		}
		
		if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
			return { success: false, error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' };
		}
		
		return { success: false, error: errorMessage, code: 'DATABASE_ERROR' };
	}
}

/**
 * Fallback data providers for different API endpoints
 */
export const FALLBACK_DATA = {
	overview: {
		overview: {
			totalAccounts: 0,
			loggedInAccounts: 0,
			assignedAccounts: 0,
			successRate: 0
		},
		devices: {
			totalDevices: 0,
			activeDevices: 0,
			totalClones: 0,
			usedClones: 0,
			utilizationRate: 0
		},
		recentActivity: [],
		performance: {
			responseTime: 0,
			dataSource: 'fallback',
			cacheUsed: false,
			queryCount: 0
		}
	},
	
	analytics: {
		overview: {
			totalOperations: 0,
			successRate: 0,
			averageDuration: 0,
			throughput: 0,
			activeOperations: 0,
			errorRate: 0,
			uptime: 100
		},
		trends: {
			successRateTrend: [],
			throughputTrend: [],
			errorRateTrend: [],
			durationTrend: []
		},
		devices: [],
		errorPatterns: [],
		timePatterns: [],
		recommendations: []
	},
	
	bulkStatus: {
		summary: {
			totalSessions: 0,
			byStatus: {
				IDLE: 0,
				STARTING: 0,
				RUNNING: 0,
				STOPPING: 0,
				COMPLETED: 0,
				FAILED: 0,
				CANCELLED: 0
			},
			byType: {},
			activeOperations: 0,
			completedOperations: 0,
			failedOperations: 0,
			avgProgress: 0
		},
		sessions: [],
		pagination: {
			total: 0,
			limit: 50,
			offset: 0,
			hasMore: false
		}
	},
	
	logs: {
		logs: [],
		pagination: {
			offset: 0,
			limit: 100,
			total: 0,
			hasMore: false
		},
		activeSessions: []
	}
} as const;

/**
 * Get fallback data for specific endpoint
 */
export function getFallbackData(endpoint: keyof typeof FALLBACK_DATA): any {
	return structuredClone(FALLBACK_DATA[endpoint]);
}

/**
 * Validate request parameters with comprehensive error handling
 */
export function validateRequestParams(
	params: Record<string, any>,
	rules: Record<string, {
		required?: boolean;
		type?: 'string' | 'number' | 'boolean' | 'array';
		min?: number;
		max?: number;
		values?: any[];
		pattern?: RegExp;
	}>
): { valid: true } | { valid: false; error: string; code: string } {
	for (const [paramName, rule] of Object.entries(rules)) {
		const value = params[paramName];
		
		// Check required
		if (rule.required && (value === undefined || value === null || value === '')) {
			return {
				valid: false,
				error: `Missing required parameter: ${paramName}`,
				code: 'MISSING_PARAMETER'
			};
		}
		
		// Skip validation if not required and empty
		if (!rule.required && (value === undefined || value === null || value === '')) {
			continue;
		}
		
		// Type validation
		if (rule.type) {
			const actualType = Array.isArray(value) ? 'array' : typeof value;
			if (actualType !== rule.type) {
				return {
					valid: false,
					error: `Parameter ${paramName} must be of type ${rule.type}, got ${actualType}`,
					code: 'INVALID_PARAMETER'
				};
			}
		}
		
		// Numeric range validation
		if (rule.type === 'number' && typeof value === 'number') {
			if (rule.min !== undefined && value < rule.min) {
				return {
					valid: false,
					error: `Parameter ${paramName} must be at least ${rule.min}`,
					code: 'INVALID_PARAMETER'
				};
			}
			if (rule.max !== undefined && value > rule.max) {
				return {
					valid: false,
					error: `Parameter ${paramName} must be at most ${rule.max}`,
					code: 'INVALID_PARAMETER'
				};
			}
		}
		
		// Array length validation
		if (rule.type === 'array' && Array.isArray(value)) {
			if (rule.min !== undefined && value.length < rule.min) {
				return {
					valid: false,
					error: `Parameter ${paramName} must have at least ${rule.min} items`,
					code: 'INVALID_PARAMETER'
				};
			}
			if (rule.max !== undefined && value.length > rule.max) {
				return {
					valid: false,
					error: `Parameter ${paramName} must have at most ${rule.max} items`,
					code: 'INVALID_PARAMETER'
				};
			}
		}
		
		// Values validation (enum-like)
		if (rule.values && !rule.values.includes(value)) {
			return {
				valid: false,
				error: `Parameter ${paramName} must be one of: ${rule.values.join(', ')}`,
				code: 'INVALID_PARAMETER'
			};
		}
		
		// Pattern validation
		if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
			return {
				valid: false,
				error: `Parameter ${paramName} format is invalid`,
				code: 'INVALID_PARAMETER'
			};
		}
	}
	
	return { valid: true };
}

/**
 * Clean up old request tracking entries (run periodically)
 */
export function cleanupRequestTracking(): void {
	const cutoff = Date.now() - 300000; // 5 minutes ago
	for (const [id, tracking] of requestTracker.entries()) {
		if (tracking.startTime < cutoff) {
			requestTracker.delete(id);
		}
	}
}

// Cleanup task - run every 5 minutes
setInterval(cleanupRequestTracking, 300000);

/**
 * Health check utility for API endpoints
 */
export async function performHealthCheck(
	checks: Record<string, () => Promise<boolean>>,
	timeout = TIMEOUT_CONFIG.HEALTH_CHECK
): Promise<{ healthy: boolean; checks: Record<string, boolean>; details: Record<string, string> }> {
	const results: Record<string, boolean> = {};
	const details: Record<string, string> = {};
	
	await Promise.all(
		Object.entries(checks).map(async ([name, check]) => {
			try {
				const result = await withTimeout(check(), timeout, `Health check: ${name}`);
				results[name] = result;
				details[name] = result ? 'OK' : 'Failed';
			} catch (error) {
				results[name] = false;
				details[name] = error instanceof Error ? error.message : 'Unknown error';
			}
		})
	);
	
	const healthy = Object.values(results).every(result => result);
	
	return { healthy, checks: results, details };
}

export default {
	createErrorResponse,
	createSuccessResponse,
	withTimeout,
	withRetry,
	withDatabaseTimeout,
	validateRequestParams,
	getFallbackData,
	performHealthCheck,
	startRequestTracking,
	getRequestDuration,
	TIMEOUT_CONFIG,
	ERROR_CODES,
	FALLBACK_DATA
};