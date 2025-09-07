import { logger, LogLevel } from '../logging/logger.js';

// Metrics collection interface
export interface MetricData {
	name: string;
	value: number;
	unit: string;
	timestamp: number;
	tags?: Record<string, string>;
}

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
	API_RESPONSE_TIME: 5000, // 5 seconds
	DB_QUERY_TIME: 3000, // 3 seconds
	WEBSOCKET_CONNECTION_TIME: 1000, // 1 second
	MEMORY_USAGE_MB: 1024, // 1GB
	CPU_USAGE_PERCENT: 80
};

class MetricsCollector {
	private metrics: Map<string, MetricData[]> = new Map();
	private readonly maxDataPoints = 1000; // Keep last 1000 data points per metric

	/**
	 * Record a metric value
	 */
	record(metric: MetricData): void {
		const key = metric.name;
		
		if (!this.metrics.has(key)) {
			this.metrics.set(key, []);
		}

		const dataPoints = this.metrics.get(key)!;
		dataPoints.push(metric);

		// Rotate old data points
		if (dataPoints.length > this.maxDataPoints) {
			dataPoints.splice(0, dataPoints.length - this.maxDataPoints);
		}

		// Check against thresholds and log performance issues
		this.checkThresholds(metric);
	}

	/**
	 * Get metric statistics
	 */
	getStats(metricName: string, timeWindowMs: number = 60000): {
		count: number;
		avg: number;
		min: number;
		max: number;
		p95: number;
		p99: number;
	} | null {
		const dataPoints = this.metrics.get(metricName);
		if (!dataPoints) return null;

		const cutoff = Date.now() - timeWindowMs;
		const recentPoints = dataPoints.filter(point => point.timestamp > cutoff);
		
		if (recentPoints.length === 0) return null;

		const values = recentPoints.map(point => point.value).sort((a, b) => a - b);
		const sum = values.reduce((a, b) => a + b, 0);

		return {
			count: values.length,
			avg: sum / values.length,
			min: values[0],
			max: values[values.length - 1],
			p95: values[Math.floor(values.length * 0.95)] || values[values.length - 1],
			p99: values[Math.floor(values.length * 0.99)] || values[values.length - 1]
		};
	}

	/**
	 * Get all metrics for monitoring dashboard
	 */
	getAllMetrics(): Record<string, any> {
		const result: Record<string, any> = {};

		for (const [name, dataPoints] of this.metrics) {
			const stats = this.getStats(name);
			if (stats) {
				result[name] = {
					...stats,
					lastValue: dataPoints[dataPoints.length - 1]?.value,
					lastTimestamp: dataPoints[dataPoints.length - 1]?.timestamp
				};
			}
		}

		return result;
	}

	/**
	 * Record API request metrics
	 */
	recordAPIRequest(method: string, path: string, duration: number, status: number): void {
		this.record({
			name: 'api_request_duration',
			value: duration,
			unit: 'ms',
			timestamp: Date.now(),
			tags: { method, path, status: status.toString() }
		});

		this.record({
			name: 'api_request_count',
			value: 1,
			unit: 'count',
			timestamp: Date.now(),
			tags: { method, path, status: status.toString() }
		});
	}

	/**
	 * Record authentication events
	 */
	recordAuthEvent(event: 'login' | 'logout' | 'failed_login' | 'registration', userId?: string): void {
		this.record({
			name: 'auth_events',
			value: 1,
			unit: 'count',
			timestamp: Date.now(),
			tags: { event, userId: userId || 'unknown' }
		});
	}

	/**
	 * Record rate limiting events
	 */
	recordRateLimit(endpoint: string, ip: string): void {
		this.record({
			name: 'rate_limit_violations',
			value: 1,
			unit: 'count',
			timestamp: Date.now(),
			tags: { endpoint, ip }
		});
	}

	/**
	 * Record error events
	 */
	recordError(type: string, message: string, stack?: string): void {
		this.record({
			name: 'application_errors',
			value: 1,
			unit: 'count',
			timestamp: Date.now(),
			tags: { type, message: message.substring(0, 100) }
		});
	}

	/**
	 * Check metric against performance thresholds
	 */
	private checkThresholds(metric: MetricData): void {
		let threshold: number | undefined;
		let thresholdType = 'performance';

		switch (metric.name) {
			case 'api_response_time':
				threshold = PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME;
				break;
			case 'db_query_time':
				threshold = PERFORMANCE_THRESHOLDS.DB_QUERY_TIME;
				break;
			case 'websocket_connection_time':
				threshold = PERFORMANCE_THRESHOLDS.WEBSOCKET_CONNECTION_TIME;
				break;
			case 'memory_usage_mb':
				threshold = PERFORMANCE_THRESHOLDS.MEMORY_USAGE_MB;
				thresholdType = 'resource';
				break;
			case 'cpu_usage_percent':
				threshold = PERFORMANCE_THRESHOLDS.CPU_USAGE_PERCENT;
				thresholdType = 'resource';
				break;
		}

		if (threshold && metric.value > threshold) {
			logger.logPerformance(LogLevel.WARN, `Performance threshold exceeded: ${metric.name}`, {
				metric: metric.name,
				value: metric.value,
				unit: metric.unit,
				threshold,
				component: thresholdType
			});
		}
	}

	/**
	 * Clear old metrics data
	 */
	cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): void { // 24 hours default
		const cutoff = Date.now() - olderThanMs;
		
		for (const [name, dataPoints] of this.metrics) {
			const filteredPoints = dataPoints.filter(point => point.timestamp > cutoff);
			this.metrics.set(name, filteredPoints);
		}
	}
}

// Singleton metrics collector
export const metrics = new MetricsCollector();

// Convenience functions for common metrics
export function recordAPIResponseTime(
	method: string, 
	endpoint: string, 
	statusCode: number, 
	durationMs: number,
	userId?: string
): void {
	metrics.record({
		name: 'api_response_time',
		value: durationMs,
		unit: 'ms',
		timestamp: Date.now(),
		tags: { method, endpoint, status_code: statusCode.toString(), user_id: userId }
	});
}

export function recordDatabaseQueryTime(
	operation: string,
	table: string,
	durationMs: number,
	rowsAffected?: number
): void {
	metrics.record({
		name: 'db_query_time',
		value: durationMs,
		unit: 'ms',
		timestamp: Date.now(),
		tags: { operation, table, rows_affected: rowsAffected?.toString() }
	});
}

export function recordWebSocketMetrics(
	event: 'connection' | 'message' | 'error',
	durationMs: number,
	connectionCount?: number
): void {
	metrics.record({
		name: `websocket_${event}_time`,
		value: durationMs,
		unit: 'ms',
		timestamp: Date.now(),
		tags: { event, connection_count: connectionCount?.toString() }
	});
}

export function recordMemoryUsage(): void {
	const memUsage = process.memoryUsage();
	
	metrics.record({
		name: 'memory_usage_mb',
		value: Math.round(memUsage.rss / 1024 / 1024),
		unit: 'MB',
		timestamp: Date.now(),
		tags: { type: 'rss' }
	});

	metrics.record({
		name: 'memory_heap_mb',
		value: Math.round(memUsage.heapUsed / 1024 / 1024),
		unit: 'MB',
		timestamp: Date.now(),
		tags: { type: 'heap' }
	});
}

export function recordBusinessMetric(
	eventType: string,
	value: number,
	unit: string,
	userId?: string,
	additionalTags?: Record<string, string>
): void {
	metrics.record({
		name: `business_${eventType}`,
		value,
		unit,
		timestamp: Date.now(),
		tags: { user_id: userId, ...additionalTags }
	});
}

// Start periodic memory monitoring
setInterval(recordMemoryUsage, 60000); // Every minute

// Start periodic cleanup
setInterval(() => {
	metrics.cleanup();
}, 60 * 60 * 1000); // Every hour

// Export for external monitoring systems
export function getPrometheusMetrics(): string {
	const allMetrics = metrics.getAllMetrics();
	let output = '';

	for (const [name, data] of Object.entries(allMetrics)) {
		output += `# HELP ${name} Application metric\n`;
		output += `# TYPE ${name} gauge\n`;
		output += `${name} ${data.lastValue} ${data.lastTimestamp}\n`;
		output += `${name}_avg ${data.avg}\n`;
		output += `${name}_p95 ${data.p95}\n`;
		output += `${name}_p99 ${data.p99}\n\n`;
	}

	return output;
}