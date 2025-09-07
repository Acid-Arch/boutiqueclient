import { dev } from '$app/environment';

export interface DatabaseQueryLog {
	query: string;
	params?: any[];
	duration: number;
	timestamp: Date;
	userId?: string;
	ip?: string;
	userAgent?: string;
	error?: string;
	queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
}

// Security-sensitive queries that should always be logged
const SENSITIVE_QUERIES = [
	'users', 'login_attempts', 'sessions', 'oauth_accounts', 
	'audit_logs', 'password', 'secret', 'token'
];

// Suspicious query patterns
const SUSPICIOUS_PATTERNS = [
	/UNION.*SELECT/i,
	/OR.*1.*=.*1/i,
	/WHERE.*1.*=.*1/i,
	/DROP.*TABLE/i,
	/DELETE.*FROM.*users/i,
	/UPDATE.*users.*SET.*password/i,
	/INSERT.*INTO.*users/i,
	/'.*OR.*/i,
	/;.*--/i,
	/\/\*.*\*\//i
];

export class DatabaseSecurityLogger {
	private static logs: DatabaseQueryLog[] = [];
	private static readonly MAX_LOGS = 1000;

	/**
	 * Log a database query for security monitoring
	 */
	static logQuery(
		query: string,
		params: any[] = [],
		duration: number,
		context?: {
			userId?: string;
			ip?: string;
			userAgent?: string;
			error?: string;
		}
	): void {
		const queryType = this.getQueryType(query);
		const isSensitive = this.isSensitiveQuery(query);
		const isSuspicious = this.isSuspiciousQuery(query, params);

		// Always log sensitive or suspicious queries
		if (isSensitive || isSuspicious || context?.error || dev) {
			const logEntry: DatabaseQueryLog = {
				query: this.sanitizeQuery(query),
				params: this.sanitizeParams(params),
				duration,
				timestamp: new Date(),
				userId: context?.userId,
				ip: context?.ip,
				userAgent: context?.userAgent,
				error: context?.error,
				queryType
			};

			this.addLog(logEntry);

			// Log suspicious queries immediately
			if (isSuspicious) {
				console.warn('🚨 SUSPICIOUS DATABASE QUERY DETECTED:', {
					query: logEntry.query,
					params: logEntry.params,
					context
				});
			}

			// Log slow queries
			if (duration > 5000) { // 5 seconds
				console.warn('🐌 SLOW DATABASE QUERY:', {
					query: logEntry.query,
					duration: `${duration}ms`,
					context
				});
			}
		}
	}

	/**
	 * Get query type from SQL string
	 */
	private static getQueryType(query: string): DatabaseQueryLog['queryType'] {
		const normalizedQuery = query.trim().toUpperCase();
		if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
		if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
		if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
		if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
		return 'OTHER';
	}

	/**
	 * Check if query involves sensitive data
	 */
	private static isSensitiveQuery(query: string): boolean {
		const lowerQuery = query.toLowerCase();
		return SENSITIVE_QUERIES.some(table => lowerQuery.includes(table));
	}

	/**
	 * Check if query contains suspicious patterns
	 */
	private static isSuspiciousQuery(query: string, params: any[] = []): boolean {
		// Check query patterns
		if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(query))) {
			return true;
		}

		// Check parameters for SQL injection patterns
		const allParams = params.map(p => String(p)).join(' ');
		if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(allParams))) {
			return true;
		}

		return false;
	}

	/**
	 * Sanitize query for logging (remove sensitive data)
	 */
	private static sanitizeQuery(query: string): string {
		// Replace password values with [REDACTED]
		return query.replace(
			/(password|secret|token|key)\s*=\s*[$]?\d+/gi,
			'$1 = [REDACTED]'
		);
	}

	/**
	 * Sanitize parameters for logging
	 */
	private static sanitizeParams(params: any[]): any[] {
		return params.map((param, index) => {
			if (typeof param === 'string' && param.length > 50) {
				// Truncate long strings that might be passwords or tokens
				return `${param.substring(0, 50)}... [TRUNCATED]`;
			}
			if (typeof param === 'string' && /password|secret|token/i.test(param)) {
				return '[REDACTED]';
			}
			return param;
		});
	}

	/**
	 * Add log entry with rotation
	 */
	private static addLog(logEntry: DatabaseQueryLog): void {
		this.logs.push(logEntry);
		
		// Rotate logs to prevent memory leaks
		if (this.logs.length > this.MAX_LOGS) {
			this.logs.splice(0, this.logs.length - this.MAX_LOGS);
		}
	}

	/**
	 * Get recent suspicious activities
	 */
	static getSuspiciousActivities(limit = 50): DatabaseQueryLog[] {
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

		return this.logs
			.filter(log => 
				log.timestamp > oneHourAgo && 
				(this.isSuspiciousQuery(log.query, log.params) || log.error)
			)
			.slice(-limit);
	}

	/**
	 * Get security statistics
	 */
	static getSecurityStats(): {
		totalQueries: number;
		suspiciousQueries: number;
		errorQueries: number;
		slowQueries: number;
		lastActivity: Date | null;
	} {
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
		const recentLogs = this.logs.filter(log => log.timestamp > oneHourAgo);

		return {
			totalQueries: recentLogs.length,
			suspiciousQueries: recentLogs.filter(log => 
				this.isSuspiciousQuery(log.query, log.params)
			).length,
			errorQueries: recentLogs.filter(log => log.error).length,
			slowQueries: recentLogs.filter(log => log.duration > 5000).length,
			lastActivity: this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : null
		};
	}

	/**
	 * Clear logs (for testing or privacy)
	 */
	static clearLogs(): void {
		this.logs.length = 0;
	}
}

/**
 * Wrapper function to monitor database queries
 */
export async function monitoredQuery<T>(
	queryFn: () => Promise<T>,
	query: string,
	params: any[] = [],
	context?: {
		userId?: string;
		ip?: string;
		userAgent?: string;
	}
): Promise<T> {
	const startTime = Date.now();
	let error: string | undefined;

	try {
		const result = await queryFn();
		const duration = Date.now() - startTime;
		
		DatabaseSecurityLogger.logQuery(query, params, duration, context);
		
		return result;
	} catch (err) {
		const duration = Date.now() - startTime;
		error = err instanceof Error ? err.message : String(err);
		
		DatabaseSecurityLogger.logQuery(query, params, duration, {
			...context,
			error
		});
		
		throw err;
	}
}