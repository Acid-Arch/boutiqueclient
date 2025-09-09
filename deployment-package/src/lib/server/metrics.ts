import { dev } from '$app/environment';
import { logger, LogLevel } from './logging/logger.js';

// Performance metrics collection and aggregation
export class MetricsCollector {
	private static instance: MetricsCollector;
	private metrics: Map<string, MetricValue[]> = new Map();
	private timers: Map<string, number> = new Map();
	private counters: Map<string, number> = new Map();
	private gauges: Map<string, number> = new Map();

	static getInstance(): MetricsCollector {
		if (!MetricsCollector.instance) {
			MetricsCollector.instance = new MetricsCollector();
		}
		return MetricsCollector.instance;
	}

	// Record a timer metric (for response times, etc.)
	startTimer(name: string): string {
		const timerId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		this.timers.set(timerId, Date.now());
		return timerId;
	}

	endTimer(timerId: string, labels: Record<string, string> = {}): number | null {
		const startTime = this.timers.get(timerId);
		if (!startTime) return null;

		const duration = Date.now() - startTime;
		this.timers.delete(timerId);

		const metricName = timerId.split('_')[0];
		this.recordMetric(metricName, duration, 'timer', labels);
		
		return duration;
	}

	// Record a simple timer (start and end in one call)
	recordTimer(name: string, duration: number, labels: Record<string, string> = {}): void {
		this.recordMetric(name, duration, 'timer', labels);
	}

	// Increment a counter
	incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
		const key = this.getMetricKey(name, labels);
		this.counters.set(key, (this.counters.get(key) || 0) + value);
		this.recordMetric(name, this.counters.get(key)!, 'counter', labels);
	}

	// Set a gauge value
	setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
		const key = this.getMetricKey(name, labels);
		this.gauges.set(key, value);
		this.recordMetric(name, value, 'gauge', labels);
	}

	// Record histogram metric
	recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
		this.recordMetric(name, value, 'histogram', labels);
	}

	private recordMetric(name: string, value: number, type: MetricType, labels: Record<string, string> = {}): void {
		const metric: MetricValue = {
			name,
			value,
			type,
			timestamp: Date.now(),
			labels
		};

		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}

		const metricsList = this.metrics.get(name)!;
		metricsList.push(metric);

		// Keep only last 1000 metrics per name to prevent memory issues
		if (metricsList.length > 1000) {
			metricsList.splice(0, metricsList.length - 1000);
		}

		// Log high-level metrics
		if (this.shouldLogMetric(name, value, type)) {
			logger.logPerformance(LogLevel.DEBUG, `Metric recorded: ${name}`, {
				metric: name,
				value,
				unit: this.getMetricUnit(type),
				threshold: this.getThreshold(name, type),
				component: 'metrics-collector',
				userId: labels.userId
			});
		}
	}

	private getMetricKey(name: string, labels: Record<string, string>): string {
		const labelStr = Object.entries(labels)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => `${k}:${v}`)
			.join(',');
		return labelStr ? `${name}{${labelStr}}` : name;
	}

	private shouldLogMetric(name: string, value: number, type: MetricType): boolean {
		// Log performance-critical metrics
		if (name.includes('response_time') && value > 1000) return true; // > 1s
		if (name.includes('error') && type === 'counter') return true;
		if (name.includes('memory') && type === 'gauge') return true;
		
		return false;
	}

	private getMetricUnit(type: MetricType): string {
		switch (type) {
			case 'timer': return 'ms';
			case 'counter': return 'count';
			case 'gauge': return 'value';
			case 'histogram': return 'distribution';
			default: return 'unknown';
		}
	}

	private getThreshold(name: string, type: MetricType): number | undefined {
		if (type === 'timer' && name.includes('response_time')) return 500; // 500ms
		if (name.includes('memory')) return 1024; // 1GB
		return undefined;
	}

	// Get current metrics summary
	getMetrics(since?: number): MetricsSummary {
		const sinceTime = since || Date.now() - 300000; // Last 5 minutes by default
		const summary: MetricsSummary = {
			timestamp: Date.now(),
			period: { start: sinceTime, end: Date.now() },
			metrics: {}
		};

		for (const [name, values] of this.metrics.entries()) {
			const relevantMetrics = values.filter(m => m.timestamp >= sinceTime);
			if (relevantMetrics.length === 0) continue;

			const metricType = relevantMetrics[0].type;
			
			summary.metrics[name] = {
				type: metricType,
				count: relevantMetrics.length,
				...this.calculateStats(relevantMetrics, metricType)
			};
		}

		return summary;
	}

	private calculateStats(metrics: MetricValue[], type: MetricType): Record<string, any> {
		const values = metrics.map(m => m.value);
		
		switch (type) {
			case 'timer':
			case 'histogram':
				return {
					min: Math.min(...values),
					max: Math.max(...values),
					avg: values.reduce((a, b) => a + b, 0) / values.length,
					p50: this.percentile(values, 0.5),
					p95: this.percentile(values, 0.95),
					p99: this.percentile(values, 0.99)
				};
			case 'counter':
				return {
					total: values[values.length - 1], // Latest value
					rate: values.length / ((metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 1000)
				};
			case 'gauge':
				return {
					current: values[values.length - 1],
					min: Math.min(...values),
					max: Math.max(...values),
					avg: values.reduce((a, b) => a + b, 0) / values.length
				};
			default:
				return {};
		}
	}

	private percentile(values: number[], p: number): number {
		const sorted = [...values].sort((a, b) => a - b);
		const index = Math.ceil(sorted.length * p) - 1;
		return sorted[index];
	}

	// Clear old metrics to prevent memory leaks
	clearOldMetrics(olderThan: number = 3600000): void { // Default 1 hour
		const cutoff = Date.now() - olderThan;
		
		for (const [name, values] of this.metrics.entries()) {
			const filteredValues = values.filter(m => m.timestamp >= cutoff);
			this.metrics.set(name, filteredValues);
		}

		// Also clear old timers (shouldn't happen, but safety measure)
		this.timers.clear();
	}

	// Get system metrics
	getSystemMetrics(): SystemMetrics {
		const memUsage = process.memoryUsage();
		const cpuUsage = process.cpuUsage();
		
		return {
			timestamp: Date.now(),
			uptime: process.uptime(),
			memory: {
				heapUsed: memUsage.heapUsed,
				heapTotal: memUsage.heapTotal,
				external: memUsage.external,
				rss: memUsage.rss
			},
			cpu: {
				user: cpuUsage.user,
				system: cpuUsage.system
			},
			eventLoop: {
				// Would need additional libraries for event loop lag
				// For now, just timestamp
				lag: 0 // Placeholder
			}
		};
	}

	// Export metrics for external monitoring systems (Prometheus format)
	exportPrometheusMetrics(): string {
		const metrics = this.getMetrics();
		let output = '';

		for (const [name, data] of Object.entries(metrics.metrics)) {
			const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_');
			
			switch (data.type) {
				case 'counter':
					output += `# TYPE ${sanitizedName} counter\n`;
					output += `${sanitizedName} ${data.total || 0}\n`;
					break;
				case 'gauge':
					output += `# TYPE ${sanitizedName} gauge\n`;
					output += `${sanitizedName} ${data.current || 0}\n`;
					break;
				case 'timer':
				case 'histogram':
					output += `# TYPE ${sanitizedName} histogram\n`;
					output += `${sanitizedName}_sum ${(data.avg || 0) * data.count}\n`;
					output += `${sanitizedName}_count ${data.count}\n`;
					if (data.p50) output += `${sanitizedName}{quantile="0.5"} ${data.p50}\n`;
					if (data.p95) output += `${sanitizedName}{quantile="0.95"} ${data.p95}\n`;
					if (data.p99) output += `${sanitizedName}{quantile="0.99"} ${data.p99}\n`;
					break;
			}
			output += '\n';
		}

		return output;
	}
}

// Interfaces
type MetricType = 'counter' | 'gauge' | 'timer' | 'histogram';

interface MetricValue {
	name: string;
	value: number;
	type: MetricType;
	timestamp: number;
	labels: Record<string, string>;
}

interface MetricsSummary {
	timestamp: number;
	period: { start: number; end: number };
	metrics: Record<string, {
		type: MetricType;
		count: number;
		[key: string]: any;
	}>;
}

interface SystemMetrics {
	timestamp: number;
	uptime: number;
	memory: {
		heapUsed: number;
		heapTotal: number;
		external: number;
		rss: number;
	};
	cpu: {
		user: number;
		system: number;
	};
	eventLoop: {
		lag: number;
	};
}

// Convenience functions for common metrics
export const metrics = MetricsCollector.getInstance();

// Common metric helpers
export const recordResponseTime = (endpoint: string, method: string, statusCode: number, duration: number, userId?: string) => {
	metrics.recordTimer('http_request_duration_ms', duration, {
		endpoint,
		method,
		status: statusCode.toString(),
		...(userId && { userId })
	});
};

export const recordDatabaseQuery = (operation: string, table: string, duration: number, userId?: string) => {
	metrics.recordTimer('db_query_duration_ms', duration, {
		operation,
		table,
		...(userId && { userId })
	});
};

export const incrementErrorCount = (type: string, endpoint?: string, userId?: string) => {
	metrics.incrementCounter('errors_total', 1, {
		error_type: type,
		...(endpoint && { endpoint }),
		...(userId && { userId })
	});
};

export const recordUserAction = (action: string, userId?: string) => {
	metrics.incrementCounter('user_actions_total', 1, {
		action,
		...(userId && { userId })
	});
};

export const setActiveUsers = (count: number) => {
	metrics.setGauge('active_users', count);
};

export const setMemoryUsage = () => {
	const memUsage = process.memoryUsage();
	metrics.setGauge('memory_heap_used_bytes', memUsage.heapUsed);
	metrics.setGauge('memory_heap_total_bytes', memUsage.heapTotal);
	metrics.setGauge('memory_rss_bytes', memUsage.rss);
};

// Auto-collect system metrics every 30 seconds
if (!dev) {
	setInterval(() => {
		setMemoryUsage();
		metrics.clearOldMetrics(); // Clean up old metrics
	}, 30000);
}