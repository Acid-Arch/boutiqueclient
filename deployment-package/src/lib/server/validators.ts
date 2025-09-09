import { z } from 'zod';
import validator from 'validator';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createValidationError, handleValidationError } from './error-handler.js';
import { logger, LogLevel } from './logging/logger.js';

// Custom validation utilities
export const ValidationUtils = {
	/**
	 * Validate email using multiple methods for extra security
	 */
	isValidEmail(email: string): boolean {
		return validator.isEmail(email) && 
			   email.length <= 254 && // RFC limit
			   !email.includes('..') && // No consecutive dots
			   email.split('@').length === 2; // Exactly one @
	},

	/**
	 * Validate password strength
	 */
	isStrongPassword(password: string): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		
		if (password.length < 8) errors.push('Password must be at least 8 characters long');
		if (password.length > 128) errors.push('Password must be less than 128 characters');
		if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
		if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
		if (!/\d/.test(password)) errors.push('Password must contain at least one number');
		if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
			errors.push('Password must contain at least one special character');
		}
		if (/(.)\1{2,}/.test(password)) errors.push('Password cannot contain repeated characters');
		
		// Check for common patterns
		const commonPatterns = [
			'password', 'admin', 'user', '123456', 'qwerty', 'abc123',
			'password123', '12345678', 'welcome', 'login'
		];
		
		for (const pattern of commonPatterns) {
			if (password.toLowerCase().includes(pattern)) {
				errors.push('Password cannot contain common patterns');
				break;
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	},

	/**
	 * Validate phone number
	 */
	isValidPhone(phone: string): boolean {
		return validator.isMobilePhone(phone, 'any', { strictMode: false });
	},

	/**
	 * Validate URL
	 */
	isValidUrl(url: string): boolean {
		return validator.isURL(url, {
			protocols: ['http', 'https'],
			require_tld: true,
			require_protocol: true,
			allow_underscores: false,
			allow_trailing_dot: false
		});
	},

	/**
	 * Sanitize HTML to prevent XSS
	 */
	sanitizeHtml(input: string): string {
		return validator.escape(input);
	},

	/**
	 * Validate file upload
	 */
	validateFile(file: File, options: {
		maxSize?: number;
		allowedTypes?: string[];
		allowedExtensions?: string[];
	} = {}): { valid: boolean; errors: string[] } {
		const errors: string[] = [];
		const { maxSize = 5 * 1024 * 1024, allowedTypes = [], allowedExtensions = [] } = options;

		if (file.size > maxSize) {
			errors.push(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
		}

		if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
			errors.push(`File type ${file.type} is not allowed`);
		}

		if (allowedExtensions.length > 0) {
			const extension = file.name.split('.').pop()?.toLowerCase();
			if (!extension || !allowedExtensions.includes(extension)) {
				errors.push(`File extension is not allowed`);
			}
		}

		// Check for potentially dangerous filenames
		if (/[<>:"/\\|?*]/.test(file.name) || file.name.startsWith('.')) {
			errors.push('Invalid filename');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
};

// Zod schemas for common validation patterns
export const CommonSchemas = {
	email: z.string()
		.min(1, 'Email is required')
		.max(254, 'Email is too long')
		.refine(ValidationUtils.isValidEmail, 'Invalid email format'),

	password: z.string()
		.min(1, 'Password is required')
		.refine(
			(password) => ValidationUtils.isStrongPassword(password).valid,
			(password) => ({
				message: ValidationUtils.isStrongPassword(password).errors[0] || 'Invalid password'
			})
		),

	name: z.string()
		.min(1, 'Name is required')
		.max(100, 'Name is too long')
		.regex(/^[a-zA-Z\s\-'\.]+$/, 'Name contains invalid characters'),

	phone: z.string()
		.optional()
		.refine(
			(phone) => !phone || ValidationUtils.isValidPhone(phone),
			'Invalid phone number'
		),

	url: z.string()
		.optional()
		.refine(
			(url) => !url || ValidationUtils.isValidUrl(url),
			'Invalid URL format'
		),

	id: z.number()
		.int('ID must be an integer')
		.positive('ID must be positive'),

	uuid: z.string()
		.uuid('Invalid UUID format'),

	slug: z.string()
		.min(1, 'Slug is required')
		.max(100, 'Slug is too long')
		.regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),

	ipAddress: z.string()
		.refine(
			(ip) => validator.isIP(ip),
			'Invalid IP address'
		),

	dateString: z.string()
		.refine(
			(date) => validator.isISO8601(date),
			'Invalid date format'
		),

	positiveNumber: z.number()
		.positive('Must be a positive number')
		.finite('Must be a finite number'),

	nonEmptyString: z.string()
		.min(1, 'This field is required')
		.transform((str) => str.trim()),

	safeString: z.string()
		.transform((str) => ValidationUtils.sanitizeHtml(str.trim())),

	htmlContent: z.string()
		.max(50000, 'Content is too long')
		.transform((str) => ValidationUtils.sanitizeHtml(str))
};

// API-specific validation schemas
export const APISchemas = {
	// User registration
	userRegistration: z.object({
		email: CommonSchemas.email,
		password: CommonSchemas.password,
		name: CommonSchemas.name,
		phone: CommonSchemas.phone,
		company: z.string().max(100).optional(),
		acceptTerms: z.boolean().refine((val) => val === true, 'Must accept terms and conditions')
	}),

	// User login
	userLogin: z.object({
		email: CommonSchemas.email,
		password: z.string().min(1, 'Password is required'),
		rememberMe: z.boolean().optional().default(false),
		captcha: z.string().optional()
	}),

	// Password reset request
	passwordResetRequest: z.object({
		email: CommonSchemas.email
	}),

	// Password reset
	passwordReset: z.object({
		token: z.string().min(1, 'Reset token is required'),
		password: CommonSchemas.password
	}),

	// User profile update
	userProfileUpdate: z.object({
		name: CommonSchemas.name.optional(),
		phone: CommonSchemas.phone,
		company: z.string().max(100).optional(),
		avatar: z.string().url().optional()
	}),

	// Instagram account
	instagramAccount: z.object({
		username: z.string()
			.min(1, 'Username is required')
			.max(30, 'Username is too long')
			.regex(/^[a-zA-Z0-9._]+$/, 'Invalid Instagram username format'),
		password: z.string().min(1, 'Password is required'),
		email: CommonSchemas.email.optional(),
		phone: CommonSchemas.phone,
		proxyId: z.number().int().positive().optional(),
		notes: z.string().max(1000).optional()
	}),

	// Error report
	errorReport: z.object({
		errorId: z.string().min(1, 'Error ID is required').max(100),
		message: z.string().min(1, 'Error message is required').max(1000),
		stack: z.string().max(5000).optional(),
		url: z.string().min(1, 'URL is required').max(500),
		userAgent: z.string().max(500).optional(),
		timestamp: z.string().refine(
			(date) => validator.isISO8601(date),
			'Invalid timestamp format'
		),
		context: z.record(z.any()).optional()
	}),

	// File upload
	fileUpload: z.object({
		filename: z.string().min(1, 'Filename is required').max(255),
		contentType: z.string().min(1, 'Content type is required'),
		size: z.number().int().positive().max(10 * 1024 * 1024) // 10MB limit
	}),

	// Search query
	searchQuery: z.object({
		query: z.string().min(1, 'Search query is required').max(100),
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(100).default(20),
		sortBy: z.enum(['created', 'updated', 'name', 'relevance']).default('relevance'),
		sortOrder: z.enum(['asc', 'desc']).default('desc')
	}),

	// Pagination
	paginationQuery: z.object({
		page: z.number().int().min(1).default(1),
		limit: z.number().int().min(1).max(100).default(20)
	})
};

// Validation middleware for API endpoints
export async function validateRequestBody<T>(
	event: RequestEvent,
	schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; response: Response }> {
	try {
		const body = await event.request.json();
		const validatedData = schema.parse(body);
		
		return { success: true, data: validatedData };
		
	} catch (error) {
		let errorMessage = 'Invalid request data';
		let fieldErrors: Record<string, string[]> = {};

		if (error instanceof z.ZodError) {
			errorMessage = 'Validation failed';
			fieldErrors = {};
			
			for (const issue of error.issues) {
				const field = issue.path.join('.');
				if (!fieldErrors[field]) {
					fieldErrors[field] = [];
				}
				fieldErrors[field].push(issue.message);
			}
		}

		// Log validation error
		logger.logAPI(LogLevel.WARN, 'Request validation failed', {
			requestId: event.locals.requestId || 'unknown',
			method: event.request.method,
			url: event.url.pathname,
			statusCode: 400,
			duration: 0,
			userId: event.locals.user?.id,
			ip: event.getClientAddress(),
			userAgent: event.request.headers.get('user-agent'),
			body: {
				validationErrors: fieldErrors,
				errorMessage
			}
		});

		const response = await handleValidationError(errorMessage, fieldErrors, event);
		return { success: false, response };
	}
}

// Validate query parameters
export function validateQueryParams<T>(
	event: RequestEvent,
	schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
	try {
		const params = Object.fromEntries(event.url.searchParams);
		
		// Convert string numbers to numbers for validation
		const processedParams: Record<string, any> = {};
		for (const [key, value] of Object.entries(params)) {
			if (value === 'true') processedParams[key] = true;
			else if (value === 'false') processedParams[key] = false;
			else if (!isNaN(Number(value)) && value !== '') processedParams[key] = Number(value);
			else processedParams[key] = value;
		}
		
		const validatedData = schema.parse(processedParams);
		return { success: true, data: validatedData };
		
	} catch (error) {
		const errorMessage = error instanceof z.ZodError 
			? error.issues[0]?.message || 'Invalid query parameters'
			: 'Invalid query parameters';
			
		return { success: false, error: errorMessage };
	}
}

// Validate file uploads
export function validateFileUpload(
	file: File,
	options: {
		maxSize?: number;
		allowedTypes?: string[];
		allowedExtensions?: string[];
	} = {}
): { success: true } | { success: false; errors: string[] } {
	const result = ValidationUtils.validateFile(file, options);
	
	if (result.valid) {
		return { success: true };
	} else {
		return { success: false, errors: result.errors };
	}
}

// Security validation middleware
export function validateSecurityHeaders(event: RequestEvent): boolean {
	const headers = event.request.headers;
	
	// Check for required security headers in production
	if (process.env.NODE_ENV === 'production') {
		const requiredHeaders = ['user-agent', 'accept'];
		
		for (const header of requiredHeaders) {
			if (!headers.get(header)) {
				logger.logSecurity(LogLevel.WARN, `Missing required header: ${header}`, {
					eventType: 'missing_security_header',
					severity: 'low',
					ip: event.getClientAddress(),
					userAgent: headers.get('user-agent'),
					details: {
						missingHeader: header,
						url: event.url.pathname,
						method: event.request.method
					}
				});
				return false;
			}
		}
	}
	
	// Check for suspicious headers
	const suspiciousHeaders = [
		'x-requested-with', // Often used in CSRF attacks
		'x-forwarded-host', // Can be manipulated
		'x-original-host'   // Can be manipulated
	];
	
	for (const header of suspiciousHeaders) {
		const value = headers.get(header);
		if (value && value.length > 100) {
			logger.logSecurity(LogLevel.WARN, `Suspicious header value: ${header}`, {
				eventType: 'suspicious_header',
				severity: 'medium',
				ip: event.getClientAddress(),
				userAgent: headers.get('user-agent'),
				details: {
					header,
					value: value.substring(0, 100) + '...',
					url: event.url.pathname
				}
			});
			return false;
		}
	}
	
	return true;
}

// Validation error response helper
export function createValidationErrorResponse(
	message: string,
	fieldErrors?: Record<string, string[]>,
	event?: RequestEvent
): Response {
	const errorData = {
		success: false,
		error: {
			type: 'validation_error',
			message,
			timestamp: new Date().toISOString(),
			fieldErrors: fieldErrors || {},
			requestId: event?.locals.requestId
		}
	};

	return json(errorData, { status: 400 });
}

// Export commonly used validation functions
export {
	z,
	validator
};