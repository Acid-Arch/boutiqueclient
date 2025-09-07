/**
 * Loading State Utilities
 * 
 * Comprehensive utilities for managing loading states, timeouts, error handling,
 * and performance monitoring across automation components.
 */

import { writable, derived, type Readable } from 'svelte/store';

// Type definitions
export interface LoadingState {
	isLoading: boolean;
	error: string | Error | null;
	hasTimedOut: boolean;
	startTime: number;
	loadDuration: number;
	retryCount: number;
	lastUpdated: Date;
}

export interface LoadingConfig {
	timeout?: number;
	maxRetries?: number;
	enablePerformanceMonitoring?: boolean;
	enableProgressiveLoading?: boolean;
	skeletonVariant?: string;
	loadingMessage?: string;
}

export interface PerformanceMetrics {
	loadTime: number;
	renderTime: number;
	connectionType: string;
	isSlowConnection: boolean;
	timeToInteractive: number;
	retryAttempts: number;
	errorCount: number;
}

export interface LoadingStateManager {
	state: Readable<LoadingState>;
	startLoading: (message?: string) => void;
	stopLoading: () => void;
	setError: (error: string | Error) => void;
	clearError: () => void;
	retry: () => Promise<void>;
	reset: () => void;
	getPerformanceMetrics: () => PerformanceMetrics;
}

/**
 * Create a loading state manager with comprehensive features
 */
export function createLoadingStateManager(
	initialConfig: LoadingConfig = {},
	loadFunction?: () => Promise<void>
): LoadingStateManager {
	const config = {
		timeout: 15000,
		maxRetries: 3,
		enablePerformanceMonitoring: true,
		enableProgressiveLoading: true,
		skeletonVariant: 'card',
		loadingMessage: 'Loading...',
		...initialConfig
	};

	// Internal state
	const internalState = writable<LoadingState>({
		isLoading: false,
		error: null,
		hasTimedOut: false,
		startTime: 0,
		loadDuration: 0,
		retryCount: 0,
		lastUpdated: new Date()
	});

	// Performance metrics
	let performanceMetrics: PerformanceMetrics = {
		loadTime: 0,
		renderTime: 0,
		connectionType: 'unknown',
		isSlowConnection: false,
		timeToInteractive: 0,
		retryAttempts: 0,
		errorCount: 0
	};

	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let performanceObserver: PerformanceObserver | null = null;

	// Initialize performance monitoring
	if (config.enablePerformanceMonitoring && typeof PerformanceObserver !== 'undefined') {
		try {
			performanceObserver = new PerformanceObserver((list) => {
				const entries = list.getEntries();
				entries.forEach((entry) => {
					if (entry.entryType === 'navigation') {
						const navEntry = entry as PerformanceNavigationTiming;
						performanceMetrics.timeToInteractive = navEntry.domInteractive - (navEntry.startTime || 0);
					}
				});
			});
			performanceObserver.observe({ entryTypes: ['navigation', 'measure'] });
		} catch (error) {
			console.warn('[LoadingStateManager] Performance monitoring not supported:', error);
		}
	}

	// Monitor connection speed
	if (typeof navigator !== 'undefined' && 'connection' in navigator) {
		const connection = (navigator as any).connection;
		if (connection?.effectiveType) {
			performanceMetrics.connectionType = connection.effectiveType;
			performanceMetrics.isSlowConnection = ['slow-2g', '2g', '3g'].includes(connection.effectiveType);
		}
	}

	function startLoading(message?: string) {
		const startTime = performance.now();
		
		internalState.update(state => ({
			...state,
			isLoading: true,
			error: null,
			hasTimedOut: false,
			startTime,
			loadDuration: 0,
			lastUpdated: new Date()
		}));

		// Start performance measurement
		if (config.enablePerformanceMonitoring && typeof performance !== 'undefined') {
			try {
				performance.mark('loading-start');
			} catch (error) {
				console.warn('[LoadingStateManager] Performance marking failed:', error);
			}
		}

		// Set timeout
		if (config.timeout && config.timeout > 0) {
			timeoutId = setTimeout(() => {
				internalState.update(state => ({
					...state,
					hasTimedOut: true,
					error: new Error(`Loading timed out after ${config.timeout}ms`),
					lastUpdated: new Date()
				}));
			}, config.timeout);
		}
	}

	function stopLoading() {
		const endTime = performance.now();
		
		// Clear timeout
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}

		// Update performance metrics
		if (config.enablePerformanceMonitoring) {
			internalState.subscribe(state => {
				if (state.startTime > 0) {
					performanceMetrics.loadTime = endTime - state.startTime;
				}
			})();

			// End performance measurement
			if (typeof performance !== 'undefined') {
				try {
					performance.mark('loading-end');
					performance.measure('loading-duration', 'loading-start', 'loading-end');
					
					const measures = performance.getEntriesByName('loading-duration');
					if (measures.length > 0) {
						performanceMetrics.renderTime = measures[0].duration;
					}
				} catch (error) {
					console.warn('[LoadingStateManager] Performance measurement failed:', error);
				}
			}
		}

		internalState.update(state => ({
			...state,
			isLoading: false,
			loadDuration: state.startTime > 0 ? endTime - state.startTime : 0,
			hasTimedOut: false,
			lastUpdated: new Date()
		}));
	}

	function setError(error: string | Error) {
		performanceMetrics.errorCount++;
		
		internalState.update(state => ({
			...state,
			isLoading: false,
			error,
			lastUpdated: new Date()
		}));

		// Clear timeout
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}
	}

	function clearError() {
		internalState.update(state => ({
			...state,
			error: null,
			hasTimedOut: false,
			lastUpdated: new Date()
		}));
	}

	async function retry(): Promise<void> {
		if (!loadFunction) {
			throw new Error('No load function provided for retry');
		}

		internalState.update(state => {
			if (state.retryCount >= config.maxRetries!) {
				throw new Error(`Maximum retry attempts (${config.maxRetries}) reached`);
			}
			return {
				...state,
				retryCount: state.retryCount + 1
			};
		});

		performanceMetrics.retryAttempts++;
		clearError();
		
		try {
			startLoading(`Retrying... (${performanceMetrics.retryAttempts}/${config.maxRetries})`);
			await loadFunction();
			stopLoading();
		} catch (error) {
			setError(error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}

	function reset() {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
		}

		internalState.set({
			isLoading: false,
			error: null,
			hasTimedOut: false,
			startTime: 0,
			loadDuration: 0,
			retryCount: 0,
			lastUpdated: new Date()
		});

		performanceMetrics = {
			loadTime: 0,
			renderTime: 0,
			connectionType: performanceMetrics.connectionType,
			isSlowConnection: performanceMetrics.isSlowConnection,
			timeToInteractive: 0,
			retryAttempts: 0,
			errorCount: 0
		};
	}

	function getPerformanceMetrics(): PerformanceMetrics {
		return { ...performanceMetrics };
	}

	// Cleanup function
	function cleanup() {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		if (performanceObserver) {
			performanceObserver.disconnect();
		}
	}

	// Expose cleanup for external use
	(globalThis as any).addEventListener?.('beforeunload', cleanup);

	return {
		state: { subscribe: internalState.subscribe },
		startLoading,
		stopLoading,
		setError,
		clearError,
		retry,
		reset,
		getPerformanceMetrics
	};
}

/**
 * Loading state patterns and utilities
 */
export const loadingPatterns = {
	/**
	 * Progressive loading pattern - show cached data while loading updates
	 */
	progressive: {
		timeout: 10000,
		enableProgressiveLoading: true,
		skeletonVariant: 'card'
	},

	/**
	 * Skeleton-first loading pattern - show skeleton immediately
	 */
	skeletonFirst: {
		timeout: 15000,
		enableProgressiveLoading: false,
		skeletonVariant: 'dashboard'
	},

	/**
	 * Fast loading pattern - shorter timeout for simple operations
	 */
	fast: {
		timeout: 5000,
		maxRetries: 2,
		enableProgressiveLoading: false
	},

	/**
	 * Slow loading pattern - longer timeout for complex operations
	 */
	slow: {
		timeout: 30000,
		maxRetries: 5,
		enableProgressiveLoading: true
	}
};

/**
 * Get appropriate loading pattern based on operation type
 */
export function getLoadingPattern(operationType: 'fast' | 'normal' | 'slow' | 'complex'): LoadingConfig {
	switch (operationType) {
		case 'fast':
			return loadingPatterns.fast;
		case 'slow':
		case 'complex':
			return loadingPatterns.slow;
		case 'normal':
		default:
			return loadingPatterns.progressive;
	}
}

/**
 * Smart loading pattern selection based on connection and content type
 */
export function getSmartLoadingPattern(
	contentType: 'dashboard' | 'analytics' | 'form' | 'list',
	connectionSpeed: 'slow' | 'fast' | 'unknown' = 'unknown'
): LoadingConfig {
	const basePattern = contentType === 'analytics' ? loadingPatterns.slow : loadingPatterns.progressive;
	
	// Adjust based on connection speed
	if (connectionSpeed === 'slow') {
		return {
			...basePattern,
			timeout: basePattern.timeout! * 2,
			enableProgressiveLoading: true
		};
	}

	if (connectionSpeed === 'fast') {
		return {
			...basePattern,
			timeout: Math.max(basePattern.timeout! * 0.7, 5000)
		};
	}

	return basePattern;
}

/**
 * Loading state debugging utilities
 */
export const loadingDebug = {
	/**
	 * Log loading performance metrics
	 */
	logPerformance: (componentName: string, metrics: PerformanceMetrics) => {
		if (import.meta.env.DEV) {
			console.group(`[LoadingDebug] ${componentName} Performance`);
			console.log('Load Time:', `${metrics.loadTime.toFixed(2)}ms`);
			console.log('Render Time:', `${metrics.renderTime.toFixed(2)}ms`);
			console.log('Connection:', metrics.connectionType);
			console.log('Slow Connection:', metrics.isSlowConnection);
			console.log('Retry Attempts:', metrics.retryAttempts);
			console.log('Error Count:', metrics.errorCount);
			console.groupEnd();
		}
	},

	/**
	 * Monitor loading state changes
	 */
	monitorLoadingState: (componentName: string, stateManager: LoadingStateManager) => {
		if (import.meta.env.DEV) {
			stateManager.state.subscribe(state => {
				console.log(`[LoadingDebug] ${componentName} State:`, {
					isLoading: state.isLoading,
					hasError: !!state.error,
					hasTimedOut: state.hasTimedOut,
					duration: state.loadDuration,
					retryCount: state.retryCount
				});
			});
		}
	}
};

/**
 * Timeout management utilities
 */
export const timeoutUtils = {
	/**
	 * Create a timeout promise that rejects after specified time
	 */
	createTimeout: (ms: number, message = 'Operation timed out') =>
		new Promise((_, reject) =>
			setTimeout(() => reject(new Error(message)), ms)
		),

	/**
	 * Race a promise against a timeout
	 */
	withTimeout: async <T>(
		promise: Promise<T>,
		timeoutMs: number,
		timeoutMessage = 'Operation timed out'
	): Promise<T> => {
		const timeoutPromise = timeoutUtils.createTimeout(timeoutMs, timeoutMessage);
		return Promise.race([promise, timeoutPromise]) as Promise<T>;
	},

	/**
	 * Get recommended timeout based on operation complexity
	 */
	getRecommendedTimeout: (complexity: 'simple' | 'medium' | 'complex'): number => {
		switch (complexity) {
			case 'simple': return 5000;
			case 'medium': return 15000;
			case 'complex': return 30000;
			default: return 15000;
		}
	}
};

/**
 * Error boundary utilities for loading states
 */
export const errorBoundaryUtils = {
	/**
	 * Check if error is recoverable (can retry)
	 */
	isRecoverableError: (error: Error | string): boolean => {
		if (typeof error === 'string') {
			return !error.toLowerCase().includes('not found');
		}
		
		const message = error.message.toLowerCase();
		return (
			message.includes('timeout') ||
			message.includes('network') ||
			message.includes('connection') ||
			message.includes('fetch')
		);
	},

	/**
	 * Get user-friendly error message
	 */
	getUserFriendlyError: (error: Error | string): string => {
		if (typeof error === 'string') return error;

		const message = error.message.toLowerCase();
		
		if (message.includes('timeout')) {
			return 'The request timed out. Please check your connection and try again.';
		}
		
		if (message.includes('network') || message.includes('fetch')) {
			return 'Network error occurred. Please check your connection.';
		}
		
		if (message.includes('not found')) {
			return 'The requested resource was not found.';
		}
		
		return error.message || 'An unexpected error occurred.';
	},

	/**
	 * Get error severity level
	 */
	getErrorSeverity: (error: Error | string): 'low' | 'medium' | 'high' | 'critical' => {
		if (typeof error === 'string') {
			return error.toLowerCase().includes('critical') ? 'critical' : 'medium';
		}

		const message = error.message.toLowerCase();
		
		if (message.includes('critical') || message.includes('fatal')) {
			return 'critical';
		}
		
		if (message.includes('timeout') || message.includes('network')) {
			return 'medium';
		}
		
		if (message.includes('not found') || message.includes('invalid')) {
			return 'high';
		}
		
		return 'low';
	}
};

export default {
	createLoadingStateManager,
	loadingPatterns,
	getLoadingPattern,
	getSmartLoadingPattern,
	loadingDebug,
	timeoutUtils,
	errorBoundaryUtils
};