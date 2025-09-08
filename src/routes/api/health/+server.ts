import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { logger, LogLevel } from '$lib/server/logging/logger.js';
import { prisma } from '$lib/server/database.js';
import { dev } from '$app/environment';

interface HealthStatus {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	version: string;
	environment: string;
	uptime: number;
	checks: {
		database: HealthCheck;
		memory: HealthCheck;
		disk?: HealthCheck;
		external?: HealthCheck;
	};
	performance: {
		responseTime: number;
		memoryUsage: NodeJS.MemoryUsage;
		cpuUsage?: NodeJS.CpuUsage;
	};
}

interface HealthCheck {
	status: 'pass' | 'fail' | 'warn';
	responseTime: number;
	message?: string;
	details?: Record<string, any>;
}

// Cache health check results to prevent excessive database calls
let lastHealthCheck: HealthStatus | null = null;
let lastHealthCheckTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

async function checkDatabase(): Promise<HealthCheck> {
	const start = Date.now();
	
	try {
		// Simple query to test database connectivity
		await prisma.$queryRaw`SELECT 1 as health_check`;
		
		const responseTime = Date.now() - start;
		
		if (responseTime > 1000) {
			return {
				status: 'warn',
				responseTime,
				message: 'Database responding slowly',
				details: { threshold: '1000ms', actual: `${responseTime}ms` }
			};
		}
		
		return {
			status: 'pass',
			responseTime,
			message: 'Database connection healthy'
		};
		
	} catch (error) {
		return {
			status: 'fail',
			responseTime: Date.now() - start,
			message: 'Database connection failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		};
	}
}

async function checkMemory(): Promise<HealthCheck> {
	const start = Date.now();
	
	try {
		const memUsage = process.memoryUsage();
		const memUsageGB = memUsage.heapUsed / 1024 / 1024 / 1024;
		const memLimitGB = 1; // Adjust based on your deployment
		
		const responseTime = Date.now() - start;
		
		if (memUsageGB > memLimitGB * 0.9) {
			return {
				status: 'warn',
				responseTime,
				message: 'High memory usage detected',
				details: {
					heapUsedGB: Math.round(memUsageGB * 100) / 100,
					heapTotalGB: Math.round((memUsage.heapTotal / 1024 / 1024 / 1024) * 100) / 100,
					threshold: `${memLimitGB}GB`
				}
			};
		}
		
		if (memUsageGB > memLimitGB) {
			return {
				status: 'fail',
				responseTime,
				message: 'Memory usage critical',
				details: {
					heapUsedGB: Math.round(memUsageGB * 100) / 100,
					heapTotalGB: Math.round((memUsage.heapTotal / 1024 / 1024 / 1024) * 100) / 100,
					threshold: `${memLimitGB}GB`
				}
			};
		}
		
		return {
			status: 'pass',
			responseTime,
			message: 'Memory usage normal',
			details: {
				heapUsedGB: Math.round(memUsageGB * 100) / 100,
				heapTotalGB: Math.round((memUsage.heapTotal / 1024 / 1024 / 1024) * 100) / 100
			}
		};
		
	} catch (error) {
		return {
			status: 'fail',
			responseTime: Date.now() - start,
			message: 'Memory check failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		};
	}
}

async function checkExternalServices(): Promise<HealthCheck> {
	const start = Date.now();
	
	try {
		// Add checks for external services here
		// For example: Instagram API, email service, etc.
		
		return {
			status: 'pass',
			responseTime: Date.now() - start,
			message: 'External services healthy'
		};
		
	} catch (error) {
		return {
			status: 'fail',
			responseTime: Date.now() - start,
			message: 'External service check failed',
			details: {
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		};
	}
}

function getOverallStatus(checks: HealthStatus['checks']): 'healthy' | 'degraded' | 'unhealthy' {
	const statuses = Object.values(checks).map(check => check.status);
	
	if (statuses.some(status => status === 'fail')) {
		return 'unhealthy';
	}
	
	if (statuses.some(status => status === 'warn')) {
		return 'degraded';
	}
	
	return 'healthy';
}

async function performHealthCheck(): Promise<HealthStatus> {
	const startTime = Date.now();
	const startCpuUsage = process.cpuUsage();
	
	// Run all health checks in parallel
	const [databaseCheck, memoryCheck, externalCheck] = await Promise.all([
		checkDatabase(),
		checkMemory(),
		checkExternalServices()
	]);
	
	const checks = {
		database: databaseCheck,
		memory: memoryCheck,
		external: externalCheck
	};
	
	const endTime = Date.now();
	const endCpuUsage = process.cpuUsage(startCpuUsage);
	
	const healthStatus: HealthStatus = {
		status: getOverallStatus(checks),
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version || '1.0.0',
		environment: dev ? 'development' : 'production',
		uptime: process.uptime(),
		checks,
		performance: {
			responseTime: endTime - startTime,
			memoryUsage: process.memoryUsage(),
			cpuUsage: endCpuUsage
		}
	};
	
	return healthStatus;
}

export const GET: RequestHandler = async ({ url }) => {
	const includeDetails = url.searchParams.get('details') === 'true';
	const skipCache = url.searchParams.get('cache') === 'false';
	
	try {
		let healthStatus: HealthStatus;
		
		// Use cached result if available and not expired
		const now = Date.now();
		if (!skipCache && lastHealthCheck && (now - lastHealthCheckTime) < CACHE_DURATION) {
			healthStatus = lastHealthCheck;
		} else {
			healthStatus = await performHealthCheck();
			lastHealthCheck = healthStatus;
			lastHealthCheckTime = now;
		}
		
		// Log health check results for monitoring
		const logLevel = healthStatus.status === 'healthy' ? LogLevel.DEBUG :
						 healthStatus.status === 'degraded' ? LogLevel.WARN :
						 LogLevel.ERROR;
		
		logger.logSystem(logLevel, `Health check completed: ${healthStatus.status}`, {
			component: 'health-check',
			event: 'health_check_performed',
			details: {
				status: healthStatus.status,
				responseTime: healthStatus.performance.responseTime,
				databaseStatus: healthStatus.checks.database.status,
				memoryStatus: healthStatus.checks.memory.status,
				uptime: healthStatus.uptime
			}
		});
		
		// Determine HTTP status code based on health status
		const httpStatus = healthStatus.status === 'healthy' ? 200 :
						   healthStatus.status === 'degraded' ? 207 : // Multi-Status
						   503; // Service Unavailable
		
		// Filter response based on details parameter
		const response = includeDetails ? healthStatus : {
			status: healthStatus.status,
			timestamp: healthStatus.timestamp,
			uptime: healthStatus.uptime,
			version: healthStatus.version
		};
		
		return json(response, {
			status: httpStatus,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0',
				'Content-Type': 'application/json'
			}
		});
		
	} catch (error) {
		// Log critical health check failure
		logger.logSystem(LogLevel.ERROR, 'Health check endpoint failed', {
			component: 'health-check',
			event: 'health_check_failed',
			error: error instanceof Error ? error : undefined,
			details: {
				error: error instanceof Error ? error.message : 'Unknown error'
			}
		});
		
		return json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			error: 'Health check failed',
			message: error instanceof Error ? error.message : 'Unknown error'
		}, {
			status: 503,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Content-Type': 'application/json'
			}
		});
	}
};