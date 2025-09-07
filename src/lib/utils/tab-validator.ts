/**
 * Comprehensive tab validation and testing utilities
 * Tests all automation dashboard tabs for reliability and performance
 */

import { dashboardPerformanceMonitor } from './performance-monitor';

export interface TabValidationResult {
	tabId: string;
	tabName: string;
	success: boolean;
	loadTime: number;
	renderTime: number;
	errorCount: number;
	componentCount: number;
	interactionTests: InteractionTestResult[];
	accessibilityScore: number;
	performanceScore: number;
	overallScore: number;
	issues: string[];
	recommendations: string[];
}

export interface InteractionTestResult {
	testName: string;
	success: boolean;
	duration: number;
	error?: string;
}

export interface DashboardValidationReport {
	timestamp: string;
	overallScore: number;
	totalLoadTime: number;
	errorRate: number;
	tabResults: TabValidationResult[];
	performanceMetrics: any;
	criticalIssues: string[];
	recommendations: string[];
}

export class AutomationTabValidator {
	private currentTab: string = 'overview';
	private testResults: TabValidationResult[] = [];

	constructor(private timeoutMs = 10000) {}

	/**
	 * Validate all automation tabs comprehensively
	 */
	async validateAllTabs(): Promise<DashboardValidationReport> {
		console.log('[TabValidator] Starting comprehensive tab validation...');
		
		const startTime = performance.now();
		const tabIds = ['overview', 'analytics', 'smart', 'logs', 'settings'];
		this.testResults = [];

		for (const tabId of tabIds) {
			try {
				console.log(`[TabValidator] Testing tab: ${tabId}`);
				const result = await this.validateTab(tabId);
				this.testResults.push(result);
			} catch (error) {
				console.error(`[TabValidator] Failed to test tab ${tabId}:`, error);
				this.testResults.push({
					tabId,
					tabName: this.getTabName(tabId),
					success: false,
					loadTime: 0,
					renderTime: 0,
					errorCount: 1,
					componentCount: 0,
					interactionTests: [],
					accessibilityScore: 0,
					performanceScore: 0,
					overallScore: 0,
					issues: [error instanceof Error ? error.message : 'Unknown error'],
					recommendations: ['Fix critical error before proceeding']
				});
			}
		}

		const totalTime = performance.now() - startTime;

		return this.generateReport(totalTime);
	}

	/**
	 * Validate a specific tab
	 */
	async validateTab(tabId: string): Promise<TabValidationResult> {
		const tabName = this.getTabName(tabId);
		const startTime = performance.now();
		const issues: string[] = [];
		const recommendations: string[] = [];
		let loadTime = 0;
		let renderTime = 0;
		let componentCount = 0;
		let errorCount = 0;

		try {
			// 1. Navigation Performance Test
			console.log(`[TabValidator] Testing navigation to ${tabId}...`);
			loadTime = await this.testTabNavigation(tabId);
			
			// 2. Content Loading Test
			console.log(`[TabValidator] Testing content loading for ${tabId}...`);
			renderTime = await this.testContentLoading(tabId);
			
			// 3. Component Count Test
			componentCount = await this.countComponents(tabId);
			
			// 4. Error Detection Test
			errorCount = await this.detectErrors(tabId);
			
			// 5. Interaction Tests
			console.log(`[TabValidator] Testing interactions for ${tabId}...`);
			const interactionTests = await this.runInteractionTests(tabId);
			
			// 6. Accessibility Testing
			console.log(`[TabValidator] Testing accessibility for ${tabId}...`);
			const accessibilityScore = await this.testAccessibility(tabId);
			
			// 7. Performance Analysis
			const performanceScore = this.calculatePerformanceScore(loadTime, renderTime, errorCount);
			
			// 8. Generate Issues and Recommendations
			if (loadTime > 2000) {
				issues.push(`Slow load time: ${loadTime}ms (target: <2000ms)`);
				recommendations.push('Optimize component loading and API calls');
			}
			
			if (renderTime > 1000) {
				issues.push(`Slow render time: ${renderTime}ms (target: <1000ms)`);
				recommendations.push('Implement progressive loading or skeleton screens');
			}
			
			if (errorCount > 0) {
				issues.push(`${errorCount} error(s) detected during testing`);
				recommendations.push('Review error handling and fallback mechanisms');
			}
			
			if (accessibilityScore < 90) {
				issues.push(`Low accessibility score: ${accessibilityScore}% (target: >90%)`);
				recommendations.push('Improve ARIA labels and keyboard navigation');
			}

			const overallScore = this.calculateOverallScore(performanceScore, accessibilityScore, errorCount);

			return {
				tabId,
				tabName,
				success: errorCount === 0 && loadTime < this.timeoutMs,
				loadTime,
				renderTime,
				errorCount,
				componentCount,
				interactionTests,
				accessibilityScore,
				performanceScore,
				overallScore,
				issues,
				recommendations
			};

		} catch (error) {
			console.error(`[TabValidator] Error validating tab ${tabId}:`, error);
			
			return {
				tabId,
				tabName,
				success: false,
				loadTime: performance.now() - startTime,
				renderTime: 0,
				errorCount: 1,
				componentCount: 0,
				interactionTests: [],
				accessibilityScore: 0,
				performanceScore: 0,
				overallScore: 0,
				issues: [error instanceof Error ? error.message : 'Validation failed'],
				recommendations: ['Debug and fix validation error']
			};
		}
	}

	/**
	 * Test tab navigation performance
	 */
	private async testTabNavigation(tabId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const startTime = performance.now();
			const timeout = setTimeout(() => {
				reject(new Error(`Tab navigation timeout for ${tabId}`));
			}, this.timeoutMs);

			try {
				// Simulate tab click and measure time to complete
				const tabButton = document.querySelector(`button[aria-controls="tab-panel-${tabId}"]`) as HTMLElement;
				
				if (tabButton) {
					const measurementId = dashboardPerformanceMonitor.startMeasurement('tab_navigation', { tabId });
					
					tabButton.click();
					
					// Wait for tab content to be visible
					const checkTabContent = () => {
						const tabPanel = document.querySelector(`#tab-panel-${tabId}`) as HTMLElement;
						if (tabPanel && tabPanel.style.display !== 'none') {
							clearTimeout(timeout);
							const duration = performance.now() - startTime;
							dashboardPerformanceMonitor.finishMeasurement(measurementId, true);
							resolve(duration);
						} else {
							setTimeout(checkTabContent, 50);
						}
					};
					
					checkTabContent();
				} else {
					clearTimeout(timeout);
					reject(new Error(`Tab button not found for ${tabId}`));
				}
			} catch (error) {
				clearTimeout(timeout);
				reject(error);
			}
		});
	}

	/**
	 * Test content loading performance
	 */
	private async testContentLoading(tabId: string): Promise<number> {
		return new Promise((resolve) => {
			const startTime = performance.now();
			
			// Wait for all async content to load
			const checkContentLoaded = () => {
				const tabPanel = document.querySelector(`#tab-panel-${tabId}`) as HTMLElement;
				const loadingElements = tabPanel?.querySelectorAll('.loading, [aria-busy="true"]');
				
				if (!loadingElements || loadingElements.length === 0) {
					resolve(performance.now() - startTime);
				} else {
					setTimeout(checkContentLoaded, 100);
				}
			};
			
			setTimeout(checkContentLoaded, 100);
		});
	}

	/**
	 * Count components in the tab
	 */
	private async countComponents(tabId: string): Promise<number> {
		const tabPanel = document.querySelector(`#tab-panel-${tabId}`) as HTMLElement;
		if (!tabPanel) return 0;
		
		// Count various component types
		const buttons = tabPanel.querySelectorAll('button').length;
		const inputs = tabPanel.querySelectorAll('input, select, textarea').length;
		const cards = tabPanel.querySelectorAll('.card, [class*="card"]').length;
		const sections = tabPanel.querySelectorAll('section, [role="region"]').length;
		
		return buttons + inputs + cards + sections;
	}

	/**
	 * Detect errors in the tab
	 */
	private async detectErrors(tabId: string): Promise<number> {
		let errorCount = 0;
		const tabPanel = document.querySelector(`#tab-panel-${tabId}`) as HTMLElement;
		
		if (!tabPanel) {
			return 1; // Tab panel not found is an error
		}
		
		// Check for error messages
		const errorElements = tabPanel.querySelectorAll('.error, [role="alert"], .alert-error');
		errorCount += errorElements.length;
		
		// Check for broken images
		const images = tabPanel.querySelectorAll('img');
		images.forEach(img => {
			if (!img.complete || img.naturalHeight === 0) {
				errorCount++;
			}
		});
		
		// Check for missing required elements
		if (tabId === 'overview' && !tabPanel.querySelector('[class*="automation"]')) {
			errorCount++;
		}
		
		return errorCount;
	}

	/**
	 * Run interaction tests for the tab
	 */
	private async runInteractionTests(tabId: string): Promise<InteractionTestResult[]> {
		const tests: InteractionTestResult[] = [];
		const tabPanel = document.querySelector(`#tab-panel-${tabId}`) as HTMLElement;
		
		if (!tabPanel) {
			return [{
				testName: 'Tab Panel Existence',
				success: false,
				duration: 0,
				error: 'Tab panel not found'
			}];
		}

		// Test button interactions
		const buttons = tabPanel.querySelectorAll('button:not([disabled])');
		if (buttons.length > 0) {
			const testButton = buttons[0] as HTMLButtonElement;
			const startTime = performance.now();
			
			try {
				testButton.focus();
				testButton.blur();
				
				tests.push({
					testName: 'Button Focus/Blur',
					success: true,
					duration: performance.now() - startTime
				});
			} catch (error) {
				tests.push({
					testName: 'Button Focus/Blur',
					success: false,
					duration: performance.now() - startTime,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		// Test form interactions if present
		const inputs = tabPanel.querySelectorAll('input, select');
		if (inputs.length > 0) {
			const testInput = inputs[0] as HTMLInputElement;
			const startTime = performance.now();
			
			try {
				testInput.focus();
				const originalValue = testInput.value;
				testInput.value = 'test';
				testInput.value = originalValue;
				testInput.blur();
				
				tests.push({
					testName: 'Form Input Interaction',
					success: true,
					duration: performance.now() - startTime
				});
			} catch (error) {
				tests.push({
					testName: 'Form Input Interaction',
					success: false,
					duration: performance.now() - startTime,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}

		return tests;
	}

	/**
	 * Test accessibility features
	 */
	private async testAccessibility(tabId: string): Promise<number> {
		let score = 100;
		const tabPanel = document.querySelector(`#tab-panel-${tabId}`) as HTMLElement;
		
		if (!tabPanel) return 0;

		// Check for ARIA labels
		const interactiveElements = tabPanel.querySelectorAll('button, input, select, textarea, [role="button"]');
		let unlabeledElements = 0;
		
		interactiveElements.forEach(element => {
			if (!element.getAttribute('aria-label') && 
				!element.getAttribute('aria-labelledby') && 
				!element.querySelector('label') &&
				!element.textContent?.trim()) {
				unlabeledElements++;
			}
		});

		if (unlabeledElements > 0) {
			score -= (unlabeledElements / interactiveElements.length) * 30;
		}

		// Check for keyboard navigation
		const focusableElements = tabPanel.querySelectorAll('button, input, select, textarea, a, [tabindex]:not([tabindex="-1"])');
		if (focusableElements.length === 0 && interactiveElements.length > 0) {
			score -= 20;
		}

		// Check for proper heading structure
		const headings = tabPanel.querySelectorAll('h1, h2, h3, h4, h5, h6');
		if (headings.length === 0) {
			score -= 10;
		}

		// Check for skip links or landmark roles
		const landmarks = tabPanel.querySelectorAll('[role="main"], [role="region"], [role="navigation"], main, nav, section');
		if (landmarks.length === 0) {
			score -= 10;
		}

		return Math.max(0, score);
	}

	/**
	 * Calculate performance score
	 */
	private calculatePerformanceScore(loadTime: number, renderTime: number, errorCount: number): number {
		let score = 100;
		
		// Load time penalties
		if (loadTime > 3000) score -= 40;
		else if (loadTime > 2000) score -= 20;
		else if (loadTime > 1000) score -= 10;
		
		// Render time penalties
		if (renderTime > 1500) score -= 30;
		else if (renderTime > 1000) score -= 15;
		else if (renderTime > 500) score -= 5;
		
		// Error penalties
		score -= errorCount * 15;
		
		return Math.max(0, score);
	}

	/**
	 * Calculate overall score
	 */
	private calculateOverallScore(performanceScore: number, accessibilityScore: number, errorCount: number): number {
		if (errorCount > 0) {
			// Critical errors significantly impact overall score
			return Math.min(50, (performanceScore + accessibilityScore) / 2 - errorCount * 10);
		}
		
		return (performanceScore * 0.6 + accessibilityScore * 0.4);
	}

	/**
	 * Generate comprehensive report
	 */
	private generateReport(totalTime: number): DashboardValidationReport {
		const overallScore = this.testResults.reduce((sum, result) => sum + result.overallScore, 0) / this.testResults.length;
		const totalLoadTime = this.testResults.reduce((sum, result) => sum + result.loadTime, 0);
		const totalErrors = this.testResults.reduce((sum, result) => sum + result.errorCount, 0);
		const errorRate = (totalErrors / this.testResults.length) * 100;

		const criticalIssues: string[] = [];
		const recommendations: string[] = [];

		this.testResults.forEach(result => {
			if (result.overallScore < 50) {
				criticalIssues.push(`${result.tabName} tab has critical issues (score: ${result.overallScore})`);
			}
			result.issues.forEach(issue => {
				if (!criticalIssues.includes(issue)) {
					criticalIssues.push(issue);
				}
			});
			result.recommendations.forEach(rec => {
				if (!recommendations.includes(rec)) {
					recommendations.push(rec);
				}
			});
		});

		return {
			timestamp: new Date().toISOString(),
			overallScore,
			totalLoadTime,
			errorRate,
			tabResults: this.testResults,
			performanceMetrics: dashboardPerformanceMonitor.getDashboardMetrics(),
			criticalIssues,
			recommendations
		};
	}

	/**
	 * Get human-readable tab name
	 */
	private getTabName(tabId: string): string {
		const names = {
			'overview': 'Overview',
			'analytics': 'Analytics',
			'smart': 'Smart Manager',
			'logs': 'Logs',
			'settings': 'Settings'
		};
		return names[tabId as keyof typeof names] || tabId;
	}
}

// Export singleton instance
export const tabValidator = new AutomationTabValidator();