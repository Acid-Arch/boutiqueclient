import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { alertManager } from '$lib/server/alerts.js';
import { logger, LogLevel } from '$lib/server/logging/logger.js';
import { rateLimitAdmin } from '$lib/server/rate-limiter-comprehensive.js';

export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	
	// Apply admin rate limiting
	const rateLimitResponse = await rateLimitAdmin(event);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// Check admin access
	if (!locals.user || locals.user.role !== 'ADMIN') {
		return json({
			error: 'Forbidden: Admin access required',
			timestamp: new Date().toISOString()
		}, { status: 403 });
	}

	try {
		const action = url.searchParams.get('action') || 'active';
		const limit = parseInt(url.searchParams.get('limit') || '100');

		let response;
		
		switch (action) {
			case 'active':
				response = {
					alerts: alertManager.getActiveAlerts(),
					count: alertManager.getActiveAlerts().length,
					timestamp: new Date().toISOString()
				};
				break;
				
			case 'history':
				response = {
					alerts: alertManager.getAlertHistory(limit),
					timestamp: new Date().toISOString()
				};
				break;
				
			case 'stats':
				response = {
					stats: alertManager.getAlertStats(),
					timestamp: new Date().toISOString()
				};
				break;
				
			default:
				return json({
					error: 'Invalid action. Use: active, history, or stats',
					timestamp: new Date().toISOString()
				}, { status: 400 });
		}

		logger.logSystem(LogLevel.DEBUG, `Alerts API accessed: ${action}`, {
			component: 'alerts-api',
			event: 'alerts_accessed',
			details: {
				userId: locals.user.id,
				action,
				resultCount: Array.isArray(response.alerts) ? response.alerts.length : 0
			}
		});

		return json(response, {
			status: 200,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate'
			}
		});

	} catch (error) {
		logger.logSystem(LogLevel.ERROR, 'Alerts API error', {
			component: 'alerts-api',
			event: 'api_error',
			error: error instanceof Error ? error : undefined,
			details: {
				userId: locals.user?.id
			}
		});

		return json({
			error: 'Failed to retrieve alerts',
			timestamp: new Date().toISOString(),
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	
	// Apply admin rate limiting
	const rateLimitResponse = await rateLimitAdmin(event);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// Check admin access
	if (!locals.user || locals.user.role !== 'ADMIN') {
		return json({
			error: 'Forbidden: Admin access required',
			timestamp: new Date().toISOString()
		}, { status: 403 });
	}

	try {
		const body = await request.json();
		const { action, alertId } = body;

		if (action === 'resolve' && alertId) {
			const resolved = alertManager.resolveAlert(alertId);
			
			if (resolved) {
				logger.logSystem(LogLevel.INFO, `Alert resolved via API: ${alertId}`, {
					component: 'alerts-api',
					event: 'alert_resolved',
					details: {
						userId: locals.user.id,
						alertId
					}
				});

				return json({
					success: true,
					message: 'Alert resolved successfully',
					alertId,
					timestamp: new Date().toISOString()
				});
			} else {
				return json({
					error: 'Alert not found or already resolved',
					alertId,
					timestamp: new Date().toISOString()
				}, { status: 404 });
			}
		}

		return json({
			error: 'Invalid action or missing parameters',
			timestamp: new Date().toISOString()
		}, { status: 400 });

	} catch (error) {
		logger.logSystem(LogLevel.ERROR, 'Alerts API POST error', {
			component: 'alerts-api',
			event: 'api_post_error',
			error: error instanceof Error ? error : undefined,
			details: {
				userId: locals.user?.id
			}
		});

		return json({
			error: 'Failed to process alert action',
			timestamp: new Date().toISOString(),
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};