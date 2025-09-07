import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { metrics, MetricsCollector } from '$lib/server/metrics.js';
import { logger, LogLevel } from '$lib/server/logging/logger.js';
import { rateLimitAdmin } from '$lib/server/rate-limiter-comprehensive.js';

// Metrics endpoint - should be protected and only accessible to monitoring systems
export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	
	// Apply admin rate limiting
	const rateLimitResponse = await rateLimitAdmin(event);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	// Check if user has admin access (in production, this might be API key based)
	if (!locals.user || locals.user.role !== 'ADMIN') {
		return json({
			error: 'Forbidden: Admin access required',
			timestamp: new Date().toISOString()
		}, { status: 403 });
	}

	try {
		const format = url.searchParams.get('format') || 'json';
		const since = url.searchParams.get('since');
		const sinceTimestamp = since ? parseInt(since) : undefined;

		switch (format) {
			case 'prometheus':
				const prometheusMetrics = metrics.exportPrometheusMetrics();
				
				logger.logSystem(LogLevel.DEBUG, 'Prometheus metrics exported', {
					component: 'metrics-endpoint',
					event: 'prometheus_export',
					details: {
						userId: locals.user.id,
						metricsSize: prometheusMetrics.length
					}
				});

				return new Response(prometheusMetrics, {
					status: 200,
					headers: {
						'Content-Type': 'text/plain; charset=utf-8',
						'Cache-Control': 'no-cache, no-store, must-revalidate'
					}
				});

			case 'json':
			default:
				const metricsData = metrics.getMetrics(sinceTimestamp);
				const systemMetrics = metrics.getSystemMetrics();

				logger.logSystem(LogLevel.DEBUG, 'JSON metrics exported', {
					component: 'metrics-endpoint',
					event: 'json_export',
					details: {
						userId: locals.user.id,
						metricsCount: Object.keys(metricsData.metrics).length,
						period: metricsData.period
					}
				});

				return json({
					application: metricsData,
					system: systemMetrics,
					meta: {
						format: 'json',
						version: '1.0',
						exported_at: new Date().toISOString(),
						exported_by: locals.user.email
					}
				}, {
					status: 200,
					headers: {
						'Cache-Control': 'no-cache, no-store, must-revalidate'
					}
				});
		}

	} catch (error) {
		logger.logSystem(LogLevel.ERROR, 'Metrics endpoint error', {
			component: 'metrics-endpoint',
			event: 'export_error',
			error: error instanceof Error ? error : undefined,
			details: {
				userId: locals.user?.id,
				userAgent: event.request.headers.get('user-agent')
			}
		});

		return json({
			error: 'Failed to export metrics',
			timestamp: new Date().toISOString(),
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};