import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logger, LogLevel } from '$lib/server/logging/logger.js';
import { DatabaseSecurityLogger } from '$lib/server/db-security-logger.js';
import { validateAPIRequestComprehensive } from '$lib/server/validation/middleware.js';
import { query } from '$lib/server/db-loader.js';
import { metrics } from '$lib/server/monitoring/metrics.js';

interface HealthStatus {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	uptime: number;
	version: string;
	checks: {
		database: HealthCheck;
		logging: HealthCheck;
		security: HealthCheck;
		memory: HealthCheck;
		disk: HealthCheck;
	};
	metrics: {
		requests: {
			total: number;
			errors: number;
			avgResponseTime: number;
		};
		security: {
			threats: number;
			suspiciousActivities: number;
		};
		performance: {
			slowQueries: number;
			avgQueryTime: number;
		};
	};
}

interface HealthCheck {
	status: 'ok' | 'warning' | 'error';
	message: string;
	responseTime?: number;
	details?: Record<string, any>;
}

// GET /api/admin/health - System health check (admin only)
export const GET: RequestHandler = async (event) => {
	const validation = await validateAPIRequestComprehensive(event, {
		requireAuth: true,
		rateLimit: {
			requests: 10,
			windowMs: 60 * 1000 // 10 requests per minute
		}
	});

	if (!validation.success) {
		return validation.response;
	}

	// Check if user is admin (allow some health info for non-admins)
	const isAdmin = event.locals.user?.role === 'ADMIN';

	try {
		const startTime = Date.now();

		// Database health check
		const dbCheck = await checkDatabase();
		
		// Logging system health
		const loggingCheck = checkLogging();
		
		// Security metrics
		const securityCheck = checkSecurity();
		
		// System metrics
		const memoryCheck = checkMemory();
		const diskCheck = checkDisk();

		// Calculate overall status
		const checks = { database: dbCheck, logging: loggingCheck, security: securityCheck, memory: memoryCheck, disk: diskCheck };
		const overallStatus = calculateOverallStatus(checks);

		const healthStatus: HealthStatus = {
			status: overallStatus,
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			version: process.env.npm_package_version || '1.0.0',
			checks,
			metrics: {
				requests: {
					total: metrics.getStats('api_request_count')?.count || 0,
					errors: metrics.getStats('application_errors')?.count || 0,
					avgResponseTime: metrics.getStats('api_request_duration')?.avg || 0
				},
				security: {
					threats: DatabaseSecurityLogger.getSecurityStats().suspiciousQueries,
					suspiciousActivities: DatabaseSecurityLogger.getSuspiciousActivities(10).length
				},
				performance: {
					slowQueries: DatabaseSecurityLogger.getSecurityStats().slowQueries,
					avgQueryTime: metrics.getStats('db_query_time')?.avg || 0
				}
			}
		};

		// Log health check access
		logger.logSystem(LogLevel.INFO, 'Health check accessed', {
			component: 'health',
			event: 'check_accessed',
			details: {
				userId: event.locals.user?.id,
				isAdmin,
				status: overallStatus,
				responseTime: Date.now() - startTime
			}
		});

		// Return limited info for non-admins
		if (!isAdmin) {
			return json({
				status: overallStatus,
				timestamp: healthStatus.timestamp,
				uptime: healthStatus.uptime,
				message: overallStatus === 'healthy' ? 'System operational' : 'System issues detected'
			});
		}

		return json(healthStatus);

	} catch (error) {
		logger.logSystem(LogLevel.ERROR, 'Health check failed', {
			component: 'health',
			event: 'check_failed',
			error: error as Error
		});

		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				error: 'Health check failed'
			},
			{ status: 500 }
		);
	}
};

async function checkDatabase(): Promise<HealthCheck> {
	const startTime = Date.now();
	
	try {
		// Simple connectivity test
		await query('SELECT 1 as health_check');
		const responseTime = Date.now() - startTime;

		if (responseTime > 5000) {
			return {
				status: 'warning',
				message: 'Database responding slowly',
				responseTime,
				details: { threshold: 5000 }
			};
		}

		return {
			status: 'ok',
			message: 'Database connection healthy',
			responseTime
		};
	} catch (error) {
		return {
			status: 'error',
			message: 'Database connection failed',
			responseTime: Date.now() - startTime,
			details: { error: (error as Error).message }
		};
	}
}

function checkLogging(): HealthCheck {
	try {
		// Test logging system
		logger.logSystem(LogLevel.DEBUG, 'Health check logging test', {
			component: 'health',
			event: 'logging_test'
		});

		return {
			status: 'ok',
			message: 'Logging system operational'
		};
	} catch (error) {
		return {
			status: 'error',
			message: 'Logging system failed',
			details: { error: (error as Error).message }
		};
	}
}

function checkSecurity(): HealthCheck {
	const stats = DatabaseSecurityLogger.getSecurityStats();
	
	if (stats.suspiciousQueries > 10) {
		return {
			status: 'warning',
			message: 'High number of suspicious activities detected',
			details: { suspiciousQueries: stats.suspiciousQueries }
		};
	}

	if (stats.errorQueries > 50) {
		return {
			status: 'warning',
			message: 'High number of database errors',
			details: { errorQueries: stats.errorQueries }
		};
	}

	return {
		status: 'ok',
		message: 'Security monitoring active',
		details: stats
	};
}

function checkMemory(): HealthCheck {
	const memUsage = process.memoryUsage();
	const totalMB = Math.round(memUsage.rss / 1024 / 1024);
	const heapMB = Math.round(memUsage.heapUsed / 1024 / 1024);
	
	// Warning if using more than 1GB
	if (totalMB > 1024) {
		return {
			status: 'warning',
			message: 'High memory usage detected',
			details: { totalMB, heapMB, threshold: 1024 }
		};
	}

	return {
		status: 'ok',
		message: 'Memory usage normal',
		details: { totalMB, heapMB }
	};
}

function checkDisk(): HealthCheck {
	// Simple disk space check would require additional dependencies
	// For now, return OK status
	return {
		status: 'ok',
		message: 'Disk space check not implemented',
		details: { note: 'Requires fs-extra or similar for disk space monitoring' }
	};
}

function calculateOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'degraded' | 'unhealthy' {
	const statuses = Object.values(checks).map(check => check.status);
	
	if (statuses.some(status => status === 'error')) {
		return 'unhealthy';
	}
	
	if (statuses.some(status => status === 'warning')) {
		return 'degraded';
	}
	
	return 'healthy';
}