/**
 * Performance monitoring utilities for automation dashboard
 * Tracks loading times, error rates, and user experience metrics
 */

export interface PerformanceMetric {
	name: string;
	startTime: number;
	endTime?: number;
	duration?: number;
	success: boolean;
	error?: string;
	metadata?: Record<string, any>;
}

export interface TabPerformanceReport {
	tabId: string;
	loadTime: number;
	renderTime: number;
	interactionTime: number;
	errorCount: number;
	successRate: number;
	cacheHitRate: number;
	componentCount: number;
	bundleSize?: number;
}

export class PerformanceMonitor {
	private metrics: PerformanceMetric[] = [];
	private observers: PerformanceObserver[] = [];
	private isEnabled = true;

	constructor(private maxMetrics = 1000) {
		if (typeof performance !== 'undefined' && 'PerformanceObserver' in window) {
			this.setupObservers();
		}
	}

	private setupObservers() {
		try {
			// Navigation timing observer
			const navObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.entryType === 'navigation') {
						const navEntry = entry as PerformanceNavigationTiming;
						this.recordMetric({
							name: 'page_load',
							startTime: navEntry.loadEventStart,
							endTime: navEntry.loadEventEnd,
							duration: navEntry.loadEventEnd - navEntry.loadEventStart,
							success: true,
							metadata: {
								domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
								responseTime: navEntry.responseEnd - navEntry.requestStart,
								domInteractive: navEntry.domInteractive - (navEntry as any).navigationStart
							}
						});
					}
				}
			});
			navObserver.observe({ entryTypes: ['navigation'] });
			this.observers.push(navObserver);

			// Resource timing observer
			const resourceObserver = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (entry.name.includes('/api/automation/')) {
						this.recordMetric({
							name: 'api_request',
							startTime: entry.startTime,
							duration: entry.duration,
							success: (entry as any).responseStatus < 400,
							metadata: {
								url: entry.name,
								transferSize: (entry as any).transferSize,
								encodedBodySize: (entry as any).encodedBodySize
							}
						});
					}
				}
			});
			resourceObserver.observe({ entryTypes: ['resource'] });
			this.observers.push(resourceObserver);

		} catch (error) {
			console.warn('Performance observers not supported:', error);
		}
	}

	/**
	 * Start measuring a performance metric
	 */
	startMeasurement(name: string, metadata?: Record<string, any>): string {
		if (!this.isEnabled) return '';

		const measurementId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		try {
			performance.mark(`${measurementId}_start`);
		} catch (error) {
			console.warn('Performance.mark not supported:', error);
		}

		this.recordMetric({
			name,
			startTime: performance.now(),
			success: false, // Will be updated when finished
			metadata: { ...metadata, measurementId }
		});

		return measurementId;
	}

	/**
	 * Finish measuring a performance metric
	 */
	finishMeasurement(measurementId: string, success: boolean = true, error?: string) {
		if (!this.isEnabled || !measurementId) return;

		const endTime = performance.now();
		const metric = this.metrics.find(m => 
			m.metadata?.measurementId === measurementId && m.endTime === undefined
		);

		if (metric) {
			metric.endTime = endTime;
			metric.duration = endTime - metric.startTime;
			metric.success = success;
			if (error) metric.error = error;

			try {
				performance.mark(`${measurementId}_end`);
				performance.measure(measurementId, `${measurementId}_start`, `${measurementId}_end`);
			} catch (error) {
				console.warn('Performance.measure not supported:', error);
			}
		}
	}

	/**
	 * Record a complete performance metric
	 */
	recordMetric(metric: Omit<PerformanceMetric, 'duration'> & { duration?: number }) {
		if (!this.isEnabled) return;

		const fullMetric: PerformanceMetric = {
			...metric,
			duration: metric.duration || (metric.endTime ? metric.endTime - metric.startTime : undefined)
		};

		this.metrics.push(fullMetric);

		// Keep metrics list manageable
		if (this.metrics.length > this.maxMetrics) {
			this.metrics = this.metrics.slice(-Math.floor(this.maxMetrics * 0.8));
		}
	}

	/**
	 * Measure tab switching performance
	 */
	async measureTabSwitch(fromTab: string, toTab: string, switchFunction: () => Promise<void>): Promise<number> {
		const measurementId = this.startMeasurement('tab_switch', { fromTab, toTab });
		
		try {
			await switchFunction();
			this.finishMeasurement(measurementId, true);
			
			const metric = this.metrics.find(m => m.metadata?.measurementId === measurementId);
			return metric?.duration || 0;
		} catch (error) {
			this.finishMeasurement(measurementId, false, error instanceof Error ? error.message : 'Unknown error');
			throw error;
		}
	}

	/**
	 * Measure component loading performance
	 */
	async measureComponentLoad(componentName: string, loadFunction: () => Promise<void>): Promise<number> {
		const measurementId = this.startMeasurement('component_load', { componentName });
		
		try {
			await loadFunction();
			this.finishMeasurement(measurementId, true);
			
			const metric = this.metrics.find(m => m.metadata?.measurementId === measurementId);
			return metric?.duration || 0;
		} catch (error) {
			this.finishMeasurement(measurementId, false, error instanceof Error ? error.message : 'Unknown error');
			throw error;
		}
	}

	/**
	 * Generate performance report for a specific tab
	 */
	generateTabReport(tabId: string): TabPerformanceReport {
		const tabMetrics = this.metrics.filter(m => 
			m.name === 'tab_switch' && (
				m.metadata?.toTab === tabId || 
				m.metadata?.fromTab === tabId
			)
		);

		const componentMetrics = this.metrics.filter(m => 
			m.name === 'component_load' && m.metadata?.tab === tabId
		);

		const apiMetrics = this.metrics.filter(m => 
			m.name === 'api_request' && m.metadata?.url?.includes(`tab=${tabId}`)
		);

		const loadTimes = tabMetrics
			.filter(m => m.metadata?.toTab === tabId && m.duration)
			.map(m => m.duration!);
		
		const renderTimes = componentMetrics
			.filter(m => m.duration)
			.map(m => m.duration!);

		const errorCount = [...tabMetrics, ...componentMetrics, ...apiMetrics]
			.filter(m => !m.success).length;

		const totalRequests = [...tabMetrics, ...componentMetrics, ...apiMetrics].length;

		return {
			tabId,
			loadTime: loadTimes.length > 0 ? loadTimes.reduce((a, b) => a + b) / loadTimes.length : 0,
			renderTime: renderTimes.length > 0 ? renderTimes.reduce((a, b) => a + b) / renderTimes.length : 0,
			interactionTime: 0, // TODO: Add interaction timing
			errorCount,
			successRate: totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests) * 100 : 100,
			cacheHitRate: 0, // TODO: Add cache metrics
			componentCount: componentMetrics.length,
			bundleSize: this.estimateBundleSize(tabId)
		};
	}

	/**
	 * Get overall dashboard performance metrics
	 */
	getDashboardMetrics() {
		const allMetrics = this.metrics;
		const recentMetrics = allMetrics.filter(m => 
			Date.now() - m.startTime < 5 * 60 * 1000 // Last 5 minutes
		);

		return {
			totalMetrics: allMetrics.length,
			recentMetrics: recentMetrics.length,
			averageLoadTime: this.getAverageLoadTime(),
			errorRate: this.getErrorRate(),
			apiRequestCount: allMetrics.filter(m => m.name === 'api_request').length,
			tabSwitchCount: allMetrics.filter(m => m.name === 'tab_switch').length,
			cachePerformance: this.getCachePerformance()
		};
	}

	private getAverageLoadTime(): number {
		const loadMetrics = this.metrics.filter(m => 
			(m.name === 'tab_switch' || m.name === 'component_load') && m.duration
		);
		
		if (loadMetrics.length === 0) return 0;
		
		const totalTime = loadMetrics.reduce((sum, metric) => sum + (metric.duration || 0), 0);
		return totalTime / loadMetrics.length;
	}

	private getErrorRate(): number {
		if (this.metrics.length === 0) return 0;
		
		const errorCount = this.metrics.filter(m => !m.success).length;
		return (errorCount / this.metrics.length) * 100;
	}

	private getCachePerformance() {
		// TODO: Implement cache hit/miss tracking
		return {
			hitRate: 0,
			missRate: 0,
			avgCacheLoadTime: 0,
			avgApiLoadTime: 0
		};
	}

	private estimateBundleSize(tabId: string): number {
		// TODO: Implement bundle size estimation
		return 0;
	}

	/**
	 * Clear all metrics
	 */
	clear() {
		this.metrics = [];
	}

	/**
	 * Enable/disable performance monitoring
	 */
	setEnabled(enabled: boolean) {
		this.isEnabled = enabled;
	}

	/**
	 * Export metrics for analysis
	 */
	exportMetrics() {
		return {
			metrics: [...this.metrics],
			dashboardMetrics: this.getDashboardMetrics(),
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Clean up observers
	 */
	destroy() {
		this.observers.forEach(observer => observer.disconnect());
		this.observers = [];
	}
}

// Extend Array prototype for convenience
declare global {
	interface Array<T> {
		average(this: number[]): number;
	}
}

Array.prototype.average = function(this: number[]): number {
	return this.length > 0 ? this.reduce((a, b) => a + b, 0) / this.length : 0;
};

// Global performance monitor instance
export const dashboardPerformanceMonitor = new PerformanceMonitor();

// Utility functions
export function measureAsync<T>(
	name: string, 
	asyncFunction: () => Promise<T>,
	metadata?: Record<string, any>
): Promise<T> {
	return dashboardPerformanceMonitor.measureComponentLoad(name, async () => {
		await asyncFunction();
	}).then(() => asyncFunction());
}

export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
	name: string,
	originalFunction: T,
	metadata?: Record<string, any>
): T {
	return (async (...args: Parameters<T>) => {
		const measurementId = dashboardPerformanceMonitor.startMeasurement(name, metadata);
		
		try {
			const result = await originalFunction(...args);
			dashboardPerformanceMonitor.finishMeasurement(measurementId, true);
			return result;
		} catch (error) {
			dashboardPerformanceMonitor.finishMeasurement(measurementId, false, 
				error instanceof Error ? error.message : 'Unknown error');
			throw error;
		}
	}) as T;
}