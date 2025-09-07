import { dev } from '$app/environment';
import winston from 'winston';
import pino from 'pino';

// Log levels for different types of events
export enum LogLevel {
	ERROR = 'error',
	WARN = 'warn',
	INFO = 'info',
	DEBUG = 'debug'
}

// Structured log entry interface
export interface LogEntry {
	level: LogLevel;
	message: string;
	timestamp: string;
	service: string;
	userId?: string;
	sessionId?: string;
	requestId?: string;
	ip?: string;
	userAgent?: string;
	method?: string;
	url?: string;
	statusCode?: number;
	duration?: number;
	error?: {
		name: string;
		message: string;
		stack?: string;
		code?: string;
	};
	context?: Record<string, any>;
	tags?: string[];
}

// Application contexts for categorizing logs
export enum LogContext {
	AUTH = 'auth',
	API = 'api',
	DATABASE = 'database',
	SECURITY = 'security',
	BUSINESS = 'business',
	PERFORMANCE = 'performance',
	SYSTEM = 'system',
	WEBSOCKET = 'websocket',
	SCRAPING = 'scraping'
}

// Pino logger configuration for high performance
const pinoLogger = pino({
	level: dev ? 'debug' : 'info',
	transport: dev ? {
		target: 'pino-pretty',
		options: {
			colorize: true,
			translateTime: 'yyyy-mm-dd HH:MM:ss.l',
			ignore: 'pid,hostname'
		}
	} : undefined,
	formatters: {
		level: (label) => ({ level: label }),
		log: (object) => {
			// Remove undefined values
			const cleaned = Object.fromEntries(
				Object.entries(object).filter(([_, value]) => value !== undefined)
			);
			return cleaned;
		}
	},
	serializers: {
		error: (error: Error) => ({
			name: error.name,
			message: error.message,
			stack: dev ? error.stack : undefined,
			code: (error as any).code
		})
	},
	redact: {
		paths: [
			'password',
			'token',
			'secret',
			'authorization',
			'cookie',
			'*.password',
			'*.token',
			'*.secret'
		],
		censor: '[REDACTED]'
	}
});

// Winston logger for structured file logging in production
const winstonLogger = winston.createLogger({
	level: dev ? 'debug' : 'info',
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json(),
		winston.format.printf((info) => {
			// Redact sensitive information
			const sanitized = JSON.stringify(info, (key, value) => {
				if (typeof key === 'string' && 
					(key.toLowerCase().includes('password') ||
					 key.toLowerCase().includes('secret') ||
					 key.toLowerCase().includes('token'))) {
					return '[REDACTED]';
				}
				return value;
			});
			return sanitized;
		})
	),
	transports: dev ? [
		new winston.transports.Console({
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.simple()
			)
		})
	] : [
		new winston.transports.File({ 
			filename: 'logs/error.log', 
			level: 'error',
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 5,
			tailable: true
		}),
		new winston.transports.File({ 
			filename: 'logs/combined.log',
			maxsize: 10 * 1024 * 1024, // 10MB
			maxFiles: 10,
			tailable: true
		}),
		new winston.transports.Console({
			format: winston.format.simple()
		})
	]
});

class ApplicationLogger {
	private requestCounter = 0;

	/**
	 * Generate unique request ID
	 */
	generateRequestId(): string {
		this.requestCounter = (this.requestCounter + 1) % 10000;
		return `req_${Date.now()}_${this.requestCounter}`;
	}

	/**
	 * Log authentication events
	 */
	logAuth(
		level: LogLevel,
		message: string,
		context: {
			userId?: string;
			email?: string;
			ip?: string;
			userAgent?: string;
			action: string;
			success: boolean;
			reason?: string;
		}
	): void {
		this.log(level, message, {
			...context,
			context: LogContext.AUTH,
			tags: ['auth', context.action, context.success ? 'success' : 'failure']
		});
	}

	/**
	 * Log API requests and responses
	 */
	logAPI(
		level: LogLevel,
		message: string,
		context: {
			requestId?: string;
			method: string;
			url: string;
			statusCode: number;
			duration: number;
			userId?: string;
			ip?: string;
			userAgent?: string;
			body?: any;
			query?: any;
			error?: Error;
		}
	): void {
		this.log(level, message, {
			...context,
			context: LogContext.API,
			tags: ['api', context.method.toLowerCase(), `status_${context.statusCode}`]
		});
	}

	/**
	 * Log database operations
	 */
	logDatabase(
		level: LogLevel,
		message: string,
		context: {
			operation: string;
			table?: string;
			duration: number;
			rowsAffected?: number;
			userId?: string;
			error?: Error;
		}
	): void {
		this.log(level, message, {
			...context,
			context: LogContext.DATABASE,
			tags: ['database', context.operation, context.table].filter(Boolean)
		});
	}

	/**
	 * Log security events
	 */
	logSecurity(
		level: LogLevel,
		message: string,
		context: {
			eventType: string;
			severity: 'low' | 'medium' | 'high' | 'critical';
			ip?: string;
			userId?: string;
			userAgent?: string;
			details?: Record<string, any>;
		}
	): void {
		this.log(level, message, {
			...context,
			context: LogContext.SECURITY,
			tags: ['security', context.eventType, `severity_${context.severity}`]
		});
	}

	/**
	 * Log business events
	 */
	logBusiness(
		level: LogLevel,
		message: string,
		context: {
			event: string;
			userId?: string;
			accountId?: number;
			value?: number;
			currency?: string;
			details?: Record<string, any>;
		}
	): void {
		this.log(level, message, {
			...context,
			context: LogContext.BUSINESS,
			tags: ['business', context.event]
		});
	}

	/**
	 * Log performance metrics
	 */
	logPerformance(
		level: LogLevel,
		message: string,
		context: {
			metric: string;
			value: number;
			unit: string;
			threshold?: number;
			component: string;
			userId?: string;
		}
	): void {
		const isSlowPerformance = context.threshold && context.value > context.threshold;
		
		this.log(level, message, {
			...context,
			context: LogContext.PERFORMANCE,
			tags: [
				'performance', 
				context.metric, 
				context.component,
				...(isSlowPerformance ? ['slow'] : [])
			]
		});
	}

	/**
	 * Log system events
	 */
	logSystem(
		level: LogLevel,
		message: string,
		context: {
			component: string;
			event: string;
			details?: Record<string, any>;
			error?: Error;
		}
	): void {
		this.log(level, message, {
			...context,
			context: LogContext.SYSTEM,
			tags: ['system', context.component, context.event]
		});
	}

	/**
	 * Core logging method
	 */
	private log(
		level: LogLevel,
		message: string,
		context: Record<string, any> = {}
	): void {
		const logEntry: LogEntry = {
			level,
			message,
			timestamp: new Date().toISOString(),
			service: 'boutique-client-portal',
			...context
		};

		// Use Pino for high-performance logging
		pinoLogger[level](logEntry);

		// Also log to Winston for file persistence in production
		if (!dev) {
			winstonLogger[level](logEntry);
		}

		// Log critical security events to console immediately
		if (context.context === LogContext.SECURITY && 
			context.severity === 'critical') {
			console.error('🚨 CRITICAL SECURITY EVENT:', logEntry);
		}
	}

	/**
	 * Create child logger with context
	 */
	child(context: Record<string, any>) {
		const childPino = pinoLogger.child(context);
		
		return {
			error: (message: string, extra?: Record<string, any>) => 
				childPino.error({ ...extra }, message),
			warn: (message: string, extra?: Record<string, any>) => 
				childPino.warn({ ...extra }, message),
			info: (message: string, extra?: Record<string, any>) => 
				childPino.info({ ...extra }, message),
			debug: (message: string, extra?: Record<string, any>) => 
				childPino.debug({ ...extra }, message)
		};
	}

	/**
	 * Get current log stats (for monitoring)
	 */
	getStats() {
		return {
			logsToday: 0, // TODO: Implement actual counting
			errorsToday: 0,
			warningsToday: 0,
			criticalEvents: 0,
			avgResponseTime: 0 // TODO: Track this
		};
	}
}

// Export singleton instance
export const logger = new ApplicationLogger();

// Export convenience functions
export const logAuth = logger.logAuth.bind(logger);
export const logAPI = logger.logAPI.bind(logger);
export const logDatabase = logger.logDatabase.bind(logger);
export const logSecurity = logger.logSecurity.bind(logger);
export const logBusiness = logger.logBusiness.bind(logger);
export const logPerformance = logger.logPerformance.bind(logger);
export const logSystem = logger.logSystem.bind(logger);