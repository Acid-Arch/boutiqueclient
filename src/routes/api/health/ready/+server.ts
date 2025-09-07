import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/prisma.js';
import { logger, LogLevel } from '$lib/server/logging/logger.js';

// Readiness probe - checks if the application is ready to serve traffic
// This is used by Kubernetes/orchestrators to determine when to start routing traffic
export const GET: RequestHandler = async () => {
	try {
		// Check critical dependencies that must be available for the app to work
		const checks = await Promise.allSettled([
			// Database connectivity
			prisma.$queryRaw`SELECT 1 as readiness_check`,
			
			// Check if essential environment variables are set
			checkEnvironmentVariables(),
			
			// Check if auth system is initialized
			checkAuthSystem()
		]);
		
		const results = checks.map((result, index) => ({
			check: ['database', 'environment', 'auth'][index],
			status: result.status === 'fulfilled' ? 'ready' : 'not_ready',
			reason: result.status === 'rejected' ? result.reason?.message || 'Unknown error' : undefined
		}));
		
		const allReady = results.every(result => result.status === 'ready');
		
		if (allReady) {
			return json({
				status: 'ready',
				timestamp: new Date().toISOString(),
				checks: results
			}, {
				status: 200,
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Content-Type': 'application/json'
				}
			});
		} else {
			// Log readiness failures
			logger.logSystem(LogLevel.WARN, 'Readiness check failed', {
				component: 'readiness-check',
				event: 'readiness_failed',
				details: {
					failedChecks: results.filter(r => r.status === 'not_ready')
				}
			});
			
			return json({
				status: 'not_ready',
				timestamp: new Date().toISOString(),
				checks: results
			}, {
				status: 503,
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Content-Type': 'application/json'
				}
			});
		}
		
	} catch (error) {
		logger.logSystem(LogLevel.ERROR, 'Readiness check endpoint failed', {
			component: 'readiness-check',
			event: 'readiness_check_error',
			error: error instanceof Error ? error : undefined
		});
		
		return json({
			status: 'not_ready',
			timestamp: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Unknown error'
		}, {
			status: 503,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Content-Type': 'application/json'
			}
		});
	}
};

async function checkEnvironmentVariables(): Promise<void> {
	const required = [
		'DATABASE_URL',
		'AUTH_SECRET'
	];
	
	const missing = required.filter(env => !process.env[env]);
	
	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
	}
}

async function checkAuthSystem(): Promise<void> {
	// Basic check to ensure auth system is available
	// You could add more specific checks here
	if (!process.env.AUTH_SECRET) {
		throw new Error('Auth system not properly configured');
	}
}