import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { logger, LogLevel } from '$lib/server/logging/logger.js';
import { handleApiError, createErrorResponse, ErrorType, ErrorSeverity } from '$lib/server/error-handler.js';
import { rateLimitErrorReport } from '$lib/server/rate-limiter-comprehensive.js';

interface ErrorReport {
	errorId: string;
	message: string;
	stack?: string;
	url: string;
	userAgent: string;
	timestamp: string;
	userId?: string;
	context?: Record<string, any>;
}

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	
	// Apply rate limiting
	const rateLimitResponse = await rateLimitErrorReport(event);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	try {
		const reportData: ErrorReport = await request.json();

		// Validate required fields
		if (!reportData.errorId || !reportData.message || !reportData.url) {
			return json(
				createErrorResponse('Missing required error report fields', {
					type: ErrorType.VALIDATION,
					severity: ErrorSeverity.LOW,
					requestId: locals.requestId
				}),
				{ status: 400 }
			);
		}

		// Sanitize and validate error data
		const sanitizedReport = {
			errorId: reportData.errorId.substring(0, 100), // Limit length
			message: reportData.message.substring(0, 1000),
			url: reportData.url.substring(0, 500),
			userAgent: reportData.userAgent?.substring(0, 500) || 'Unknown',
			timestamp: reportData.timestamp,
			userId: locals.user?.id || reportData.userId,
			stack: reportData.stack ? reportData.stack.substring(0, 5000) : undefined,
			context: reportData.context || {}
		};

		// Log the client-side error report
		logger.logSystem(LogLevel.ERROR, `Client-side error reported: ${sanitizedReport.message}`, {
			component: 'client-error-reporter',
			event: 'client_error_reported',
			details: {
				errorId: sanitizedReport.errorId,
				url: sanitizedReport.url,
				userAgent: sanitizedReport.userAgent,
				userId: sanitizedReport.userId,
				timestamp: sanitizedReport.timestamp,
				hasStack: !!sanitizedReport.stack,
				context: sanitizedReport.context
			},
			error: sanitizedReport.stack ? {
				name: 'ClientError',
				message: sanitizedReport.message,
				stack: sanitizedReport.stack
			} : undefined
		});

		// If it's a critical client error, also log as security event
		if (sanitizedReport.message.toLowerCase().includes('security') ||
			sanitizedReport.message.toLowerCase().includes('unauthorized') ||
			sanitizedReport.message.toLowerCase().includes('csrf') ||
			sanitizedReport.message.toLowerCase().includes('xss')) {
			
			logger.logSecurity(LogLevel.WARN, `Potential security-related client error: ${sanitizedReport.message}`, {
				eventType: 'client_security_error',
				severity: 'medium',
				userId: sanitizedReport.userId,
				ip: request.headers.get('cf-connecting-ip') || 
					request.headers.get('x-forwarded-for') ||
					request.headers.get('x-real-ip'),
				userAgent: sanitizedReport.userAgent,
				details: {
					errorId: sanitizedReport.errorId,
					url: sanitizedReport.url,
					context: sanitizedReport.context
				}
			});
		}

		// Store error in database for future analysis (optional)
		// TODO: Implement error storage if needed
		// await storeErrorReport(sanitizedReport);

		return json({
			success: true,
			message: 'Error report received',
			errorId: sanitizedReport.errorId
		});

	} catch (error) {
		return handleApiError(error instanceof Error ? error : new Error('Failed to process error report'), {
			locals,
			url: { pathname: '/api/errors/report' },
			request
		} as any, {
			operation: 'error_report_processing'
		});
	}
};

// Rate limiting configuration for error reporting (prevent spam)
// This is handled by the rateLimitErrorReport function above