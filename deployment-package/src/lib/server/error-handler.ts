import { dev } from '$app/environment';
import { logger, LogLevel } from './logging/logger.js';
import type { RequestEvent } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';

// Error types for classification
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  BUSINESS_LOGIC = 'business_logic',
  EXTERNAL_API = 'external_api',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Standardized error response structure
export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  type: ErrorType;
  severity: ErrorSeverity;
  timestamp: string;
  requestId?: string;
  details?: Record<string, any>;
  stack?: string;
}

// Error classification rules
const ERROR_PATTERNS = [
  { pattern: /authentication|unauthorized|invalid credentials|login failed/i, type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.MEDIUM },
  { pattern: /forbidden|insufficient permissions|access denied/i, type: ErrorType.AUTHORIZATION, severity: ErrorSeverity.MEDIUM },
  { pattern: /validation|invalid input|bad request|missing required/i, type: ErrorType.VALIDATION, severity: ErrorSeverity.LOW },
  { pattern: /database|prisma|sql|connection|timeout/i, type: ErrorType.DATABASE, severity: ErrorSeverity.HIGH },
  { pattern: /network|fetch|request failed|timeout|econnrefused/i, type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM },
  { pattern: /hiker api|external service|api error/i, type: ErrorType.EXTERNAL_API, severity: ErrorSeverity.MEDIUM },
  { pattern: /out of memory|disk full|system|server/i, type: ErrorType.SYSTEM, severity: ErrorSeverity.CRITICAL },
];

/**
 * Classify error type and severity based on error message and context
 */
function classifyError(error: Error | string, context?: string): { type: ErrorType; severity: ErrorSeverity } {
  const errorMessage = error instanceof Error ? error.message : error;
  const fullContext = `${errorMessage} ${context || ''}`.toLowerCase();

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.pattern.test(fullContext)) {
      return { type: pattern.type, severity: pattern.severity };
    }
  }

  return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM };
}

/**
 * Generate error code based on type and timestamp
 */
function generateErrorCode(type: ErrorType): string {
  const timestamp = Date.now().toString(36);
  const typeCode = type.toUpperCase().substring(0, 3);
  return `ERR_${typeCode}_${timestamp}`;
}

/**
 * Sanitize error details for production (remove sensitive information)
 */
function sanitizeErrorDetails(error: Error, includeStack: boolean = dev): Record<string, any> {
  const details: Record<string, any> = {
    name: error.name,
    message: error.message,
  };

  // Add stack trace only in development
  if (includeStack && error.stack) {
    details.stack = error.stack;
  }

  // Remove sensitive information from error message
  if (error.message) {
    details.sanitizedMessage = error.message
      .replace(/password[=:]\s*[^\s&]*/gi, 'password=[REDACTED]')
      .replace(/token[=:]\s*[^\s&]*/gi, 'token=[REDACTED]')
      .replace(/secret[=:]\s*[^\s&]*/gi, 'secret=[REDACTED]')
      .replace(/key[=:]\s*[^\s&]*/gi, 'key=[REDACTED]');
  }

  return details;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: Error | string,
  context?: {
    code?: string;
    type?: ErrorType;
    severity?: ErrorSeverity;
    requestId?: string;
    details?: Record<string, any>;
  }
): ErrorResponse {
  const errorObj = error instanceof Error ? error : new Error(error);
  const { type, severity } = context?.type && context?.severity 
    ? { type: context.type, severity: context.severity }
    : classifyError(errorObj, JSON.stringify(context));

  const errorCode = context?.code || generateErrorCode(type);

  const errorResponse: ErrorResponse = {
    success: false,
    error: errorObj.message,
    code: errorCode,
    type,
    severity,
    timestamp: new Date().toISOString(),
    requestId: context?.requestId,
    details: {
      ...sanitizeErrorDetails(errorObj, dev),
      ...(context?.details || {})
    }
  };

  // Include stack trace only in development
  if (dev && errorObj.stack) {
    errorResponse.stack = errorObj.stack;
  }

  return errorResponse;
}

/**
 * Handle API errors with proper logging and response formatting
 */
export async function handleApiError(
  error: Error | string,
  event?: RequestEvent,
  context?: {
    operation?: string;
    userId?: string;
    additionalData?: Record<string, any>;
  }
): Promise<Response> {
  const errorObj = error instanceof Error ? error : new Error(error);
  const requestId = event?.locals.requestId || 'unknown';
  const userId = event?.locals.user?.id || context?.userId;

  // Classify error
  const { type, severity } = classifyError(errorObj, context?.operation);

  // Create error response
  const errorResponse = createErrorResponse(errorObj, {
    type,
    severity,
    requestId,
    details: {
      operation: context?.operation,
      userId,
      url: event?.url.pathname,
      method: event?.request.method,
      userAgent: event?.request.headers.get('user-agent'),
      ...context?.additionalData
    }
  });

  // Log error based on severity
  const logLevel = severity === ErrorSeverity.CRITICAL ? LogLevel.ERROR :
                   severity === ErrorSeverity.HIGH ? LogLevel.ERROR :
                   severity === ErrorSeverity.MEDIUM ? LogLevel.WARN :
                   LogLevel.INFO;

  logger.logAPI(logLevel, `API Error: ${errorObj.message}`, {
    errorCode: errorResponse.code,
    errorType: type,
    severity,
    requestId,
    userId,
    operation: context?.operation || 'unknown',
    url: event?.url.pathname || 'unknown',
    method: event?.request.method || 'unknown',
    details: errorResponse.details
  });

  // Send error notifications for critical errors
  if (severity === ErrorSeverity.CRITICAL) {
    await sendErrorNotification(errorResponse, event);
  }

  // Determine HTTP status code based on error type
  let statusCode = 500; // Default server error
  
  switch (type) {
    case ErrorType.AUTHENTICATION:
      statusCode = 401;
      break;
    case ErrorType.AUTHORIZATION:
      statusCode = 403;
      break;
    case ErrorType.VALIDATION:
      statusCode = 400;
      break;
    case ErrorType.DATABASE:
      statusCode = 503; // Service unavailable
      break;
    case ErrorType.NETWORK:
    case ErrorType.EXTERNAL_API:
      statusCode = 502; // Bad gateway
      break;
    case ErrorType.BUSINESS_LOGIC:
      statusCode = 422; // Unprocessable entity
      break;
    default:
      statusCode = 500;
  }

  return json(errorResponse, { status: statusCode });
}

/**
 * Handle database errors specifically
 */
export async function handleDatabaseError(
  error: Error,
  operation: string,
  event?: RequestEvent
): Promise<Response> {
  const isDatabaseConnectionError = 
    error.message.includes('connection') ||
    error.message.includes('timeout') ||
    error.message.includes('ECONNREFUSED') ||
    error.message.includes('ETIMEDOUT');

  const context = {
    operation: `database_${operation}`,
    additionalData: {
      isDatabaseConnectionError,
      errorName: error.name,
      prismaError: error.message.includes('PrismaClient')
    }
  };

  return handleApiError(error, event, context);
}

/**
 * Handle validation errors with field-specific details
 */
export async function handleValidationError(
  error: Error | string,
  fieldErrors?: Record<string, string[]>,
  event?: RequestEvent
): Promise<Response> {
  const errorObj = error instanceof Error ? error : new Error(error);
  
  const context = {
    operation: 'validation',
    additionalData: {
      fieldErrors: fieldErrors || {},
      validationDetails: 'Input validation failed'
    }
  };

  const errorResponse = createErrorResponse(errorObj, {
    type: ErrorType.VALIDATION,
    severity: ErrorSeverity.LOW,
    requestId: event?.locals.requestId,
    details: {
      fieldErrors,
      ...context.additionalData
    }
  });

  return json(errorResponse, { status: 400 });
}

/**
 * Handle authentication errors
 */
export async function handleAuthError(
  error: Error | string,
  event?: RequestEvent,
  details?: {
    email?: string;
    reason?: string;
    ipAddress?: string;
  }
): Promise<Response> {
  const context = {
    operation: 'authentication',
    additionalData: {
      email: details?.email ? details.email.substring(0, 3) + '***' : undefined,
      reason: details?.reason,
      ipAddress: details?.ipAddress,
      authenticationFailed: true
    }
  };

  return handleApiError(error, event, context);
}

/**
 * Handle authorization errors
 */
export async function handleAuthorizationError(
  error: Error | string,
  event?: RequestEvent,
  details?: {
    requiredRole?: string;
    userRole?: string;
    resource?: string;
  }
): Promise<Response> {
  const context = {
    operation: 'authorization',
    additionalData: {
      requiredRole: details?.requiredRole,
      userRole: details?.userRole,
      resource: details?.resource,
      accessDenied: true
    }
  };

  return handleApiError(error, event, context);
}

/**
 * Handle external API errors (like HikerAPI)
 */
export async function handleExternalApiError(
  error: Error,
  apiName: string,
  endpoint?: string,
  event?: RequestEvent
): Promise<Response> {
  const context = {
    operation: `external_api_${apiName}`,
    additionalData: {
      apiName,
      endpoint,
      externalApiError: true
    }
  };

  return handleApiError(error, event, context);
}

/**
 * Send error notifications for critical errors (implement based on your notification system)
 */
async function sendErrorNotification(
  errorResponse: ErrorResponse,
  event?: RequestEvent
): Promise<void> {
  try {
    // Implement your notification logic here
    // This could be email, Slack, PagerDuty, etc.
    
    console.error('🚨 CRITICAL ERROR NOTIFICATION:', {
      code: errorResponse.code,
      message: errorResponse.error,
      timestamp: errorResponse.timestamp,
      requestId: errorResponse.requestId,
      url: event?.url.pathname,
      method: event?.request.method
    });

    // TODO: Implement actual notification sending
    // Examples:
    // await sendSlackNotification(errorResponse);
    // await sendEmailAlert(errorResponse);
    // await sendPagerDutyAlert(errorResponse);
    
  } catch (notificationError) {
    console.error('Failed to send error notification:', notificationError);
  }
}

/**
 * Global error handler for unhandled promise rejections
 */
export function setupGlobalErrorHandlers(): void {
  if (typeof process !== 'undefined') {
    process.on('unhandledRejection', (reason, promise) => {
      logger.logSystem(LogLevel.ERROR, 'Unhandled Promise Rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        component: 'global_error_handler'
      });
    });

    process.on('uncaughtException', (error) => {
      logger.logSystem(LogLevel.ERROR, 'Uncaught Exception', {
        message: error.message,
        stack: error.stack,
        component: 'global_error_handler'
      });
      
      // Give the logger time to flush before exiting
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
  }
}

/**
 * Wrapper for async route handlers with automatic error handling
 */
export function withErrorHandler<T extends any[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      const event = args.find((arg): arg is RequestEvent => 
        arg && typeof arg === 'object' && 'request' in arg
      );
      
      return handleApiError(
        error instanceof Error ? error : new Error(String(error)),
        event,
        { operation: 'route_handler' }
      );
    }
  };
}

/**
 * Create error boundary for components (for client-side error handling)
 */
export function createErrorBoundary(componentName: string) {
  return {
    onError: (error: Error) => {
      logger.logSystem(LogLevel.ERROR, `Component Error: ${componentName}`, {
        message: error.message,
        stack: error.stack,
        component: componentName,
        timestamp: new Date().toISOString()
      });

      // In development, also log to console for easier debugging
      if (dev) {
        console.error(`Error in ${componentName}:`, error);
      }
    }
  };
}

// Convenience functions for common error types
export const createValidationError = (message: string, context?: Record<string, any>) =>
	({ message, type: 'validation', statusCode: 400, context });

export const createAuthenticationError = (message: string = 'Authentication required') =>
	({ message, type: 'authentication', statusCode: 401 });

export const createAuthorizationError = (message: string = 'Insufficient permissions') =>
	({ message, type: 'authorization', statusCode: 403 });

export const createNotFoundError = (resource: string = 'Resource') =>
	({ message: `${resource} not found`, type: 'not_found', statusCode: 404 });

export const createDatabaseError = (message: string, context?: Record<string, any>) =>
	({ message, type: 'database', statusCode: 500, context });

export const createRateLimitError = (message: string = 'Rate limit exceeded') =>
	({ message, type: 'rate_limit', statusCode: 429 });

// Export error types for use throughout the application
export type { ErrorResponse };

// Initialize global error handlers
if (typeof process !== 'undefined') {
  setupGlobalErrorHandlers();
}