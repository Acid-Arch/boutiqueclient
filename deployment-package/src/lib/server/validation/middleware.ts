import { json, type RequestEvent } from '@sveltejs/kit';
import { z, type ZodSchema, type ZodError } from 'zod';
import { DatabaseSecurityLogger } from '../db-security-logger.js';
import { RateLimiters, type createRateLimit } from '../middleware/rate-limiter.js';

/**
 * Validation error response format
 */
export interface ValidationErrorResponse {
	success: false;
	error: string;
	details?: {
		field: string;
		message: string;
	}[];
	code: 'VALIDATION_ERROR';
}

/**
 * Extract client IP address from request
 */
function getClientIP(request: Request): string {
	// Check various headers for the real IP
	const headers = request.headers;
	return (
		headers.get('cf-connecting-ip') || // Cloudflare
		headers.get('x-forwarded-for')?.split(',')[0] || // Load balancer/proxy
		headers.get('x-real-ip') || // Nginx
		headers.get('x-client-ip') || // Apache
		'unknown'
	);
}

/**
 * Extract user agent from request
 */
function getUserAgent(request: Request): string {
	return request.headers.get('user-agent') || 'unknown';
}

/**
 * Format Zod validation errors for API response
 */
function formatValidationErrors(error: ZodError): ValidationErrorResponse['details'] {
	return (error.errors || []).map(err => ({
		field: (err.path || []).join('.'),
		message: err.message || 'Validation error'
	}));
}

/**
 * Validate request body against a Zod schema
 */
export async function validateRequestBody<T>(
	request: Request,
	schema: ZodSchema<T>,
	options: {
		logValidation?: boolean;
		userId?: string;
	} = {}
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
	try {
		const body = await request.json();
		const validatedData = schema.parse(body);

		// Log successful validation for sensitive operations
		if (options.logValidation) {
			DatabaseSecurityLogger.logQuery(
				`API_VALIDATION_SUCCESS: ${schema.constructor.name}`,
				[JSON.stringify(body)],
				0,
				{
					userId: options.userId,
					ip: getClientIP(request),
					userAgent: getUserAgent(request)
				}
			);
		}

		return { success: true, data: validatedData };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const validationError: ValidationErrorResponse = {
				success: false,
				error: 'Validation failed',
				details: formatValidationErrors(error),
				code: 'VALIDATION_ERROR'
			};

			// Log validation failures for security monitoring
			DatabaseSecurityLogger.logQuery(
				`API_VALIDATION_FAILED: ${schema.constructor.name}`,
				[JSON.stringify(error.errors)],
				0,
				{
					userId: options.userId,
					ip: getClientIP(request),
					userAgent: getUserAgent(request),
					error: 'Validation failed'
				}
			);

			return {
				success: false,
				response: json(validationError, { status: 400 })
			};
		}

		// Handle JSON parsing errors
		const parseError: ValidationErrorResponse = {
			success: false,
			error: 'Invalid JSON in request body',
			code: 'VALIDATION_ERROR'
		};

		DatabaseSecurityLogger.logQuery(
			'API_JSON_PARSE_ERROR',
			[],
			0,
			{
				userId: options.userId,
				ip: getClientIP(request),
				userAgent: getUserAgent(request),
				error: 'JSON parse failed'
			}
		);

		return {
			success: false,
			response: json(parseError, { status: 400 })
		};
	}
}

/**
 * Validate URL search parameters against a Zod schema
 */
export function validateSearchParams<T>(
	url: URL,
	schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: Response } {
	try {
		// Convert URLSearchParams to regular object
		const params: Record<string, string> = {};
		for (const [key, value] of url.searchParams.entries()) {
			params[key] = value;
		}

		const validatedData = schema.parse(params);
		return { success: true, data: validatedData };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const validationError: ValidationErrorResponse = {
				success: false,
				error: 'Invalid query parameters',
				details: formatValidationErrors(error),
				code: 'VALIDATION_ERROR'
			};

			return {
				success: false,
				response: json(validationError, { status: 400 })
			};
		}

		return {
			success: false,
			response: json(
				{
					success: false,
					error: 'Parameter validation failed',
					code: 'VALIDATION_ERROR'
				} as ValidationErrorResponse,
				{ status: 400 }
			)
		};
	}
}

/**
 * Rate limiting validation for API endpoints
 */
export async function validateRateLimit(
	request: Request,
	endpoint: string,
	limits: {
		requests: number;
		windowMs: number;
	}
): Promise<{ allowed: true } | { allowed: false; response: Response }> {
	const clientIP = getClientIP(request);
	const key = `rate_limit:${endpoint}:${clientIP}`;

	// This would typically use Redis, but for now we'll use a simple in-memory store
	// In production, replace this with Redis-based rate limiting
	const now = Date.now();
	const windowStart = now - limits.windowMs;

	// For this demo, we'll allow the request but log it for monitoring
	DatabaseSecurityLogger.logQuery(
		`RATE_LIMIT_CHECK: ${endpoint}`,
		[clientIP, limits.requests.toString(), limits.windowMs.toString()],
		0,
		{
			ip: clientIP,
			userAgent: getUserAgent(request)
		}
	);

	return { allowed: true };
}

/**
 * Comprehensive API request validation wrapper
 */
export async function validateAPIRequest<TBody, TParams>(
	event: RequestEvent,
	options: {
		bodySchema?: ZodSchema<TBody>;
		paramsSchema?: ZodSchema<TParams>;
		requireAuth?: boolean;
		rateLimit?: {
			requests: number;
			windowMs: number;
		};
		logRequest?: boolean;
	} = {}
): Promise<
	| {
			success: true;
			body?: TBody;
			params?: TParams;
			userId?: string;
	  }
	| {
			success: false;
			response: Response;
	  }
> {
	const { request, url, locals } = event;

	try {
		// Check authentication if required
		if (options.requireAuth && !locals.user) {
			return {
				success: false,
				response: json(
					{
						success: false,
						error: 'Authentication required',
						code: 'AUTH_REQUIRED'
					},
					{ status: 401 }
				)
			};
		}

		// Rate limiting check
		if (options.rateLimit) {
			const rateLimitResult = await validateRateLimit(
				request,
				url.pathname,
				options.rateLimit
			);
			if (!rateLimitResult.allowed) {
				return { success: false, response: rateLimitResult.response };
			}
		}

		// Validate request body if schema provided
		let bodyData: TBody | undefined;
		if (options.bodySchema) {
			const bodyValidation = await validateRequestBody(request, options.bodySchema, {
				logValidation: options.logRequest,
				userId: locals.user?.id
			});

			if (!bodyValidation.success) {
				return { success: false, response: bodyValidation.response };
			}

			bodyData = bodyValidation.data;
		}

		// Validate URL parameters if schema provided
		let paramsData: TParams | undefined;
		if (options.paramsSchema) {
			const paramsValidation = validateSearchParams(url, options.paramsSchema);

			if (!paramsValidation.success) {
				return { success: false, response: paramsValidation.response };
			}

			paramsData = paramsValidation.data;
		}

		return {
			success: true,
			body: bodyData,
			params: paramsData,
			userId: locals.user?.id
		};
	} catch (error) {
		// Log unexpected validation errors
		DatabaseSecurityLogger.logQuery(
			'API_VALIDATION_UNEXPECTED_ERROR',
			[],
			0,
			{
				userId: locals.user?.id,
				ip: getClientIP(request),
				userAgent: getUserAgent(request),
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		);

		return {
			success: false,
			response: json(
				{
					success: false,
					error: 'Request validation failed',
					code: 'VALIDATION_ERROR'
				} as ValidationErrorResponse,
				{ status: 500 }
			)
		};
	}
}

/**
 * Sanitize file uploads for security
 */
export function validateFileUpload(file: File): {
	valid: boolean;
	error?: string;
	sanitizedName?: string;
} {
	// Check file size (10MB limit)
	if (file.size > 10 * 1024 * 1024) {
		return { valid: false, error: 'File too large (max 10MB)' };
	}

	// Check file type
	const allowedTypes = ['text/csv', 'application/json', 'text/plain'];
	if (!allowedTypes.includes(file.type)) {
		return { valid: false, error: 'Invalid file type' };
	}

	// Sanitize filename
	const sanitizedName = file.name
		.replace(/[^a-zA-Z0-9._-]/g, '_')
		.replace(/\.\./g, '_')
		.substring(0, 255);

	// Check for suspicious filenames (only check original name, not sanitized)
	const suspiciousPatterns = ['.exe', '.bat', '.sh', '.php', '.js'];
	for (const pattern of suspiciousPatterns) {
		if (file.name.toLowerCase().includes(pattern)) {
			return { valid: false, error: 'Potentially dangerous file name' };
		}
	}

	return { valid: true, sanitizedName };
}

/**
 * Comprehensive API request validation with rate limiting and security checks
 */
export interface APIValidationOptions {
	requireAuth?: boolean;
	allowedRoles?: string[];
	rateLimit?: {
		requests: number;
		windowMs: number;
		keyGenerator?: (event: RequestEvent) => string;
	};
	bodySchema?: ZodSchema;
	querySchema?: ZodSchema;
	logAttempts?: boolean;
}

export interface APIValidationResult {
	success: boolean;
	response?: Response;
	user?: any;
	body?: any;
	query?: any;
}

export async function validateAPIRequestComprehensive(
	event: RequestEvent,
	options: APIValidationOptions = {}
): Promise<APIValidationResult> {
	const {
		requireAuth = false,
		allowedRoles = [],
		rateLimit,
		bodySchema,
		querySchema,
		logAttempts = false
	} = options;

	// Step 1: Rate limiting
	if (rateLimit) {
		const { createRateLimit } = await import('../middleware/rate-limiter.js');
		const rateLimiter = createRateLimit({
			windowMs: rateLimit.windowMs,
			requests: rateLimit.requests,
			keyGenerator: rateLimit.keyGenerator
		});

		const limitResponse = await rateLimiter(event);
		if (limitResponse) {
			return { success: false, response: limitResponse };
		}
	}

	// Step 2: Authentication check
	if (requireAuth) {
		const user = event.locals.user;
		if (!user) {
			if (logAttempts) {
				DatabaseSecurityLogger.logQuery(
					'UNAUTHORIZED_API_ACCESS_ATTEMPT',
					[],
					0,
					{
						ip: event.getClientAddress(),
						userAgent: event.request.headers.get('user-agent'),
						error: 'Authentication required'
					}
				);
			}

			return {
				success: false,
				response: json(
					{
						error: 'Authentication required',
						code: 'AUTH_REQUIRED'
					},
					{ status: 401 }
				)
			};
		}

		// Step 3: Role-based authorization
		if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
			if (logAttempts) {
				DatabaseSecurityLogger.logQuery(
					'INSUFFICIENT_PERMISSIONS',
					[],
					0,
					{
						userId: user.id,
						ip: event.getClientAddress(),
						userAgent: event.request.headers.get('user-agent'),
						error: `Role ${user.role} not in allowed roles: ${allowedRoles.join(', ')}`
					}
				);
			}

			return {
				success: false,
				response: json(
					{
						error: 'Insufficient permissions',
						code: 'INSUFFICIENT_PERMISSIONS'
					},
					{ status: 403 }
				)
			};
		}
	}

	let validatedBody: any;
	let validatedQuery: any;

	// Step 4: Request body validation
	if (bodySchema && (event.request.method === 'POST' || event.request.method === 'PUT' || event.request.method === 'PATCH')) {
		const bodyResult = await validateRequestBody(event.request, bodySchema, {
			logValidation: logAttempts,
			userId: event.locals.user?.id
		});

		if (!bodyResult.success) {
			return { success: false, response: bodyResult.response };
		}

		validatedBody = bodyResult.data;
	}

	// Step 5: Query parameters validation
	if (querySchema) {
		const queryResult = validateSearchParams(event.url, querySchema);

		if (!queryResult.success) {
			return { success: false, response: queryResult.response };
		}

		validatedQuery = queryResult.data;
	}

	// Success - return validated data
	return {
		success: true,
		user: event.locals.user,
		body: validatedBody,
		query: validatedQuery
	};
}