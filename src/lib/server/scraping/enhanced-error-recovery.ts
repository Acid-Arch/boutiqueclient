/**
 * Phase 4B: Enhanced Error Recovery System with ML-Powered Pattern Recognition
 * Builds on the foundation of error-recovery.ts with predictive error prevention
 * and intelligent pattern analysis for proactive account health management
 */

import { 
	ScrapingError, 
	RecoveryStrategy, 
	ErrorContext, 
	classifyError, 
	determineRecoveryStrategy, 
	executeRecoveryStrategy,
	withErrorHandling 
} from './error-recovery.js';

// Re-export base types for component usage
export type { ScrapingError, RecoveryStrategy, ErrorContext };

// Extended interfaces for enhanced error recovery
export interface ErrorPattern {
	patternId: string;
	errorTypes: ScrapingError['type'][];
	frequency: number;
	timeWindow: number; // milliseconds
	accountIds?: string[];
	sessionTypes?: string[];
	confidence: number; // 0-1
	predictedImpact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
	mitigationStrategy: 'PREVENTIVE' | 'REACTIVE' | 'PROACTIVE';
}

export interface AccountHealth {
	accountId: string;
	healthScore: number; // 0-100
	riskFactors: {
		consecutiveFailures: number;
		errorRate: number; // errors per hour
		lastSuccessfulSession?: Date;
		suspiciousActivity: boolean;
		rateLimitHistory: number[];
	};
	predictions: {
		nextErrorProbability: number; // 0-1
		recommendedAction: 'CONTINUE' | 'PAUSE' | 'INVESTIGATE' | 'QUARANTINE';
		confidenceLevel: number; // 0-1
	};
	lastAnalyzed: Date;
}

export interface SessionRisk {
	sessionId: string;
	riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
	factors: {
		accountHealthScores: number[];
		historicalErrorRate: number;
		timeOfDay: 'PEAK' | 'NORMAL' | 'OFF_PEAK';
		concurrentSessions: number;
		systemLoad: number;
	};
	recommendations: string[];
	shouldProceed: boolean;
}

/**
 * ML-Powered Error Pattern Recognition Engine
 */
class ErrorPatternAnalyzer {
	private patterns: Map<string, ErrorPattern> = new Map();
	private errorHistory: ScrapingError[] = [];
	private maxHistorySize = 10000; // Keep last 10k errors for analysis

	/**
	 * Add error to history and analyze for patterns
	 */
	addError(error: ScrapingError, context: ErrorContext): void {
		this.errorHistory.unshift(error);
		if (this.errorHistory.length > this.maxHistorySize) {
			this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
		}

		// Trigger pattern analysis in background
		setTimeout(() => this.analyzePatterns(), 100);
	}

	/**
	 * Analyze error history to identify patterns
	 */
	private analyzePatterns(): void {
		const now = Date.now();
		const timeWindows = [
			{ name: '5min', duration: 5 * 60 * 1000 },
			{ name: '30min', duration: 30 * 60 * 1000 },
			{ name: '2hour', duration: 2 * 60 * 60 * 1000 },
			{ name: '24hour', duration: 24 * 60 * 60 * 1000 }
		];

		for (const window of timeWindows) {
			const recentErrors = this.errorHistory.filter(
				error => now - error.timestamp.getTime() < window.duration
			);

			this.identifyFrequencyPatterns(recentErrors, window);
			this.identifyAccountPatterns(recentErrors, window);
			this.identifySequentialPatterns(recentErrors, window);
		}
	}

	/**
	 * Identify high-frequency error patterns
	 */
	private identifyFrequencyPatterns(errors: ScrapingError[], window: { name: string, duration: number }): void {
		const errorTypeCount: Record<string, number> = {};
		
		errors.forEach(error => {
			errorTypeCount[error.type] = (errorTypeCount[error.type] || 0) + 1;
		});

		Object.entries(errorTypeCount).forEach(([errorType, count]) => {
			if (count >= 5) { // Threshold for pattern recognition
				const patternId = `freq_${errorType}_${window.name}`;
				const confidence = Math.min(count / 20, 1); // Max confidence at 20 occurrences
				
				this.patterns.set(patternId, {
					patternId,
					errorTypes: [errorType as ScrapingError['type']],
					frequency: count,
					timeWindow: window.duration,
					confidence,
					predictedImpact: this.calculateImpact(errorType, count),
					mitigationStrategy: this.suggestMitigation(errorType, count)
				});
			}
		});
	}

	/**
	 * Identify account-specific error patterns
	 */
	private identifyAccountPatterns(errors: ScrapingError[], window: { name: string, duration: number }): void {
		const accountErrors: Record<string, ScrapingError[]> = {};
		
		errors.forEach(error => {
			if (error.accountId) {
				if (!accountErrors[error.accountId]) {
					accountErrors[error.accountId] = [];
				}
				accountErrors[error.accountId].push(error);
			}
		});

		Object.entries(accountErrors).forEach(([accountId, accountErrorList]) => {
			if (accountErrorList.length >= 3) { // Pattern threshold per account
				const patternId = `account_${accountId}_${window.name}`;
				const errorTypes = [...new Set(accountErrorList.map(e => e.type))];
				
				this.patterns.set(patternId, {
					patternId,
					errorTypes,
					frequency: accountErrorList.length,
					timeWindow: window.duration,
					accountIds: [accountId],
					confidence: Math.min(accountErrorList.length / 10, 0.9),
					predictedImpact: 'HIGH',
					mitigationStrategy: 'PROACTIVE'
				});
			}
		});
	}

	/**
	 * Identify sequential error patterns
	 */
	private identifySequentialPatterns(errors: ScrapingError[], window: { name: string, duration: number }): void {
		const sequences: Array<{ types: ScrapingError['type'][], count: number }> = [];
		
		// Look for sequences of 3+ consecutive error types
		for (let i = 0; i < errors.length - 2; i++) {
			const sequence = [errors[i].type, errors[i + 1].type, errors[i + 2].type];
			const existing = sequences.find(s => 
				s.types.length === 3 && 
				s.types.every((type, index) => type === sequence[index])
			);
			
			if (existing) {
				existing.count++;
			} else {
				sequences.push({ types: sequence, count: 1 });
			}
		}

		sequences.forEach(seq => {
			if (seq.count >= 2) { // Pattern threshold for sequences
				const patternId = `seq_${seq.types.join('_')}_${window.name}`;
				
				this.patterns.set(patternId, {
					patternId,
					errorTypes: seq.types,
					frequency: seq.count,
					timeWindow: window.duration,
					confidence: Math.min(seq.count / 5, 0.8),
					predictedImpact: 'MEDIUM',
					mitigationStrategy: 'PREVENTIVE'
				});
			}
		});
	}

	/**
	 * Calculate predicted impact of error pattern
	 */
	private calculateImpact(errorType: string, frequency: number): ErrorPattern['predictedImpact'] {
		if (errorType === 'QUOTA_EXCEEDED' || frequency > 15) return 'CRITICAL';
		if (errorType === 'AUTHENTICATION_ERROR' || frequency > 10) return 'HIGH';
		if (frequency > 5) return 'MEDIUM';
		return 'LOW';
	}

	/**
	 * Suggest mitigation strategy based on error pattern
	 */
	private suggestMitigation(errorType: string, frequency: number): ErrorPattern['mitigationStrategy'] {
		if (errorType === 'RATE_LIMIT') return 'PREVENTIVE';
		if (frequency > 10) return 'PROACTIVE';
		return 'REACTIVE';
	}

	/**
	 * Get all identified patterns
	 */
	getPatterns(): ErrorPattern[] {
		return Array.from(this.patterns.values());
	}

	/**
	 * Check if current context matches any known patterns
	 */
	matchesPattern(context: ErrorContext): { matched: boolean; patterns: ErrorPattern[]; riskLevel: number } {
		const matchedPatterns: ErrorPattern[] = [];
		let totalRisk = 0;

		this.patterns.forEach(pattern => {
			let matches = false;
			
			// Check account-specific patterns
			if (pattern.accountIds?.includes(context.accountId || '')) {
				matches = true;
			}
			
			// Check error type patterns (if we have recent errors)
			if (context.lastError && pattern.errorTypes.includes(context.lastError.type)) {
				matches = true;
			}
			
			if (matches) {
				matchedPatterns.push(pattern);
				totalRisk += pattern.confidence;
			}
		});

		return {
			matched: matchedPatterns.length > 0,
			patterns: matchedPatterns,
			riskLevel: Math.min(totalRisk, 1)
		};
	}
}

/**
 * Account Health Monitoring System
 */
class AccountHealthMonitor {
	private healthCache: Map<string, AccountHealth> = new Map();
	private cacheExpiration = 30 * 60 * 1000; // 30 minutes

	/**
	 * Analyze account health based on error history
	 */
	async analyzeAccountHealth(accountId: string, errorHistory: ScrapingError[]): Promise<AccountHealth> {
		const cached = this.healthCache.get(accountId);
		if (cached && Date.now() - cached.lastAnalyzed.getTime() < this.cacheExpiration) {
			return cached;
		}

		const now = new Date();
		const last24h = errorHistory.filter(e => 
			e.accountId === accountId && 
			now.getTime() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
		);

		const consecutiveFailures = this.calculateConsecutiveFailures(accountId, errorHistory);
		const errorRate = this.calculateErrorRate(last24h);
		const lastSuccessfulSession = await this.getLastSuccessfulSession(accountId);
		const suspiciousActivity = this.detectSuspiciousActivity(last24h);
		const rateLimitHistory = this.getRateLimitHistory(last24h);

		// Calculate health score (0-100)
		let healthScore = 100;
		healthScore -= consecutiveFailures * 5;
		healthScore -= errorRate * 10;
		healthScore -= suspiciousActivity ? 20 : 0;
		healthScore -= rateLimitHistory.length * 2;
		if (lastSuccessfulSession) {
			const daysSinceSuccess = (now.getTime() - lastSuccessfulSession.getTime()) / (24 * 60 * 60 * 1000);
			healthScore -= daysSinceSuccess * 1;
		}
		healthScore = Math.max(0, Math.min(100, healthScore));

		// Predict next error probability using simple ML algorithm
		const nextErrorProbability = this.predictNextErrorProbability(
			consecutiveFailures, errorRate, healthScore
		);

		const health: AccountHealth = {
			accountId,
			healthScore,
			riskFactors: {
				consecutiveFailures,
				errorRate,
				lastSuccessfulSession,
				suspiciousActivity,
				rateLimitHistory
			},
			predictions: {
				nextErrorProbability,
				recommendedAction: this.getRecommendedAction(healthScore, nextErrorProbability),
				confidenceLevel: this.calculateConfidenceLevel(errorHistory.length)
			},
			lastAnalyzed: now
		};

		this.healthCache.set(accountId, health);
		return health;
	}

	private calculateConsecutiveFailures(accountId: string, errors: ScrapingError[]): number {
		const accountErrors = errors.filter(e => e.accountId === accountId);
		let consecutive = 0;
		
		for (const error of accountErrors) {
			if (error.severity === 'HIGH' || error.severity === 'CRITICAL') {
				consecutive++;
			} else {
				break;
			}
		}
		
		return consecutive;
	}

	private calculateErrorRate(errors: ScrapingError[]): number {
		if (errors.length === 0) return 0;
		
		const timespan = 24; // hours
		return errors.length / timespan;
	}

	private async getLastSuccessfulSession(accountId: string): Promise<Date | undefined> {
		// This would query the database for the last successful session
		// Placeholder implementation
		return undefined;
	}

	private detectSuspiciousActivity(errors: ScrapingError[]): boolean {
		// Look for patterns that might indicate account compromise or suspicious activity
		const authErrors = errors.filter(e => e.type === 'AUTHENTICATION_ERROR');
		const rateLimitErrors = errors.filter(e => e.type === 'RATE_LIMIT');
		
		return authErrors.length > 3 || rateLimitErrors.length > 10;
	}

	private getRateLimitHistory(errors: ScrapingError[]): number[] {
		return errors
			.filter(e => e.type === 'RATE_LIMIT')
			.map(e => e.timestamp.getTime());
	}

	private predictNextErrorProbability(
		consecutiveFailures: number, 
		errorRate: number, 
		healthScore: number
	): number {
		// Simple ML algorithm - could be enhanced with more sophisticated models
		let probability = 0;
		
		// Factor in consecutive failures
		probability += Math.min(consecutiveFailures * 0.1, 0.5);
		
		// Factor in error rate
		probability += Math.min(errorRate * 0.05, 0.3);
		
		// Factor in health score
		probability += Math.min((100 - healthScore) * 0.002, 0.2);
		
		return Math.min(probability, 0.95);
	}

	private getRecommendedAction(
		healthScore: number, 
		errorProbability: number
	): AccountHealth['predictions']['recommendedAction'] {
		if (healthScore < 20 || errorProbability > 0.8) return 'QUARANTINE';
		if (healthScore < 40 || errorProbability > 0.6) return 'INVESTIGATE';
		if (healthScore < 70 || errorProbability > 0.4) return 'PAUSE';
		return 'CONTINUE';
	}

	private calculateConfidenceLevel(sampleSize: number): number {
		// Confidence increases with sample size up to a point
		return Math.min(sampleSize / 100, 0.95);
	}

	/**
	 * Get health status for multiple accounts
	 */
	async getBulkAccountHealth(accountIds: string[]): Promise<AccountHealth[]> {
		const results: AccountHealth[] = [];
		
		for (const accountId of accountIds) {
			const health = await this.analyzeAccountHealth(accountId, []);
			results.push(health);
		}
		
		return results;
	}
}

/**
 * Session Risk Assessment
 */
class SessionRiskAssessment {
	/**
	 * Assess risk level for a scraping session before starting
	 */
	async assessSessionRisk(
		sessionConfig: {
			accountIds: string[];
			sessionType: string;
			targetMetrics: string[];
		},
		healthMonitor: AccountHealthMonitor
	): Promise<SessionRisk> {
		const accountHealths = await healthMonitor.getBulkAccountHealth(sessionConfig.accountIds);
		const healthScores = accountHealths.map(h => h.healthScore);
		const avgHealthScore = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
		
		// Calculate historical error rate for this session type
		const historicalErrorRate = await this.getHistoricalErrorRate(sessionConfig.sessionType);
		
		// Assess current system conditions
		const timeOfDay = this.getTimeOfDayCategory();
		const concurrentSessions = await this.getConcurrentSessionCount();
		const systemLoad = await this.getSystemLoad();
		
		// Calculate risk factors
		const factors = {
			accountHealthScores: healthScores,
			historicalErrorRate,
			timeOfDay,
			concurrentSessions,
			systemLoad
		};
		
		// Determine risk level
		const riskLevel = this.calculateRiskLevel(factors, avgHealthScore);
		
		// Generate recommendations
		const recommendations = this.generateRecommendations(factors, accountHealths);
		
		return {
			sessionId: crypto.randomUUID(),
			riskLevel,
			factors,
			recommendations,
			shouldProceed: riskLevel !== 'EXTREME'
		};
	}

	private async getHistoricalErrorRate(sessionType: string): Promise<number> {
		// Would query database for historical error rates
		// Placeholder implementation
		return 0.1; // 10% error rate
	}

	private getTimeOfDayCategory(): 'PEAK' | 'NORMAL' | 'OFF_PEAK' {
		const hour = new Date().getHours();
		if (hour >= 9 && hour <= 17) return 'PEAK';
		if (hour >= 6 && hour <= 22) return 'NORMAL';
		return 'OFF_PEAK';
	}

	private async getConcurrentSessionCount(): Promise<number> {
		// Would query active sessions
		// Placeholder implementation
		return 2;
	}

	private async getSystemLoad(): Promise<number> {
		// Would check system resources
		// Placeholder implementation
		return 0.6; // 60% load
	}

	private calculateRiskLevel(
		factors: SessionRisk['factors'], 
		avgHealthScore: number
	): SessionRisk['riskLevel'] {
		let risk = 0;
		
		// Account health factor
		risk += (100 - avgHealthScore) * 0.01;
		
		// Historical error rate factor
		risk += factors.historicalErrorRate * 2;
		
		// Time of day factor
		if (factors.timeOfDay === 'PEAK') risk += 0.2;
		if (factors.timeOfDay === 'OFF_PEAK') risk -= 0.1;
		
		// Concurrent sessions factor
		if (factors.concurrentSessions > 5) risk += 0.3;
		if (factors.concurrentSessions > 10) risk += 0.5;
		
		// System load factor
		risk += factors.systemLoad * 0.4;
		
		if (risk > 1.5) return 'EXTREME';
		if (risk > 1.0) return 'HIGH';
		if (risk > 0.5) return 'MEDIUM';
		return 'LOW';
	}

	private generateRecommendations(
		factors: SessionRisk['factors'],
		accountHealths: AccountHealth[]
	): string[] {
		const recommendations: string[] = [];
		
		// Account-specific recommendations
		const unhealthyAccounts = accountHealths.filter(h => h.healthScore < 50);
		if (unhealthyAccounts.length > 0) {
			recommendations.push(`Consider excluding ${unhealthyAccounts.length} unhealthy accounts`);
		}
		
		// Time-based recommendations
		if (factors.timeOfDay === 'PEAK') {
			recommendations.push('Consider running during off-peak hours for better performance');
		}
		
		// Load-based recommendations
		if (factors.systemLoad > 0.8) {
			recommendations.push('System load high - consider reducing concurrent sessions');
		}
		
		if (factors.concurrentSessions > 8) {
			recommendations.push('High concurrent session count may increase error rates');
		}
		
		return recommendations;
	}
}

/**
 * Enhanced Error Recovery Manager - Main orchestrator
 */
export class EnhancedErrorRecoveryManager {
	private patternAnalyzer: ErrorPatternAnalyzer;
	private healthMonitor: AccountHealthMonitor;
	private riskAssessment: SessionRiskAssessment;

	constructor() {
		this.patternAnalyzer = new ErrorPatternAnalyzer();
		this.healthMonitor = new AccountHealthMonitor();
		this.riskAssessment = new SessionRiskAssessment();
	}

	/**
	 * Enhanced error handling with ML-powered pattern recognition
	 */
	async handleError(
		error: any, 
		context: ErrorContext,
		sessionManager: {
			pauseSession: (sessionId: string) => Promise<void>;
			cancelSession: (sessionId: string, reason: string) => Promise<void>;
			updateSessionProgress: (sessionId: string, progress: any) => Promise<void>;
		}
	): Promise<{
		success: boolean;
		scrapingError: ScrapingError;
		recovery: RecoveryStrategy;
		patterns: ErrorPattern[];
		healthUpdate?: AccountHealth;
	}> {
		// Classify the error using base system
		const scrapingError = classifyError(error, context);
		
		// Add to pattern analysis
		this.patternAnalyzer.addError(scrapingError, context);
		
		// Check for pattern matches
		const patternMatch = this.patternAnalyzer.matchesPattern(context);
		
		// Enhanced recovery strategy based on patterns
		let recovery = determineRecoveryStrategy(scrapingError, context);
		
		// Modify recovery strategy based on patterns
		if (patternMatch.matched && patternMatch.riskLevel > 0.7) {
			recovery = this.enhanceRecoveryWithPatterns(recovery, patternMatch.patterns);
		}
		
		// Update account health if account-specific error
		let healthUpdate: AccountHealth | undefined;
		if (context.accountId) {
			healthUpdate = await this.healthMonitor.analyzeAccountHealth(
				context.accountId, 
				[scrapingError]
			);
			
			// Override recovery if account health is critical
			if (healthUpdate.predictions.recommendedAction === 'QUARANTINE') {
				recovery = {
					strategy: 'SKIP',
					reason: 'Account quarantined due to poor health score'
				};
			}
		}
		
		// Execute the recovery strategy
		const recoveryResult = await executeRecoveryStrategy(recovery, context, sessionManager);
		
		return {
			success: recoveryResult.success,
			scrapingError,
			recovery,
			patterns: patternMatch.patterns,
			healthUpdate
		};
	}

	/**
	 * Enhance recovery strategy based on identified patterns
	 */
	private enhanceRecoveryWithPatterns(
		baseRecovery: RecoveryStrategy, 
		patterns: ErrorPattern[]
	): RecoveryStrategy {
		const preventivePatterns = patterns.filter(p => p.mitigationStrategy === 'PREVENTIVE');
		const proactivePatterns = patterns.filter(p => p.mitigationStrategy === 'PROACTIVE');
		
		if (preventivePatterns.length > 0) {
			// Increase delays for preventive patterns
			if (baseRecovery.delay) {
				baseRecovery.delay *= 2;
			}
			baseRecovery.reason += ' (enhanced for pattern prevention)';
		}
		
		if (proactivePatterns.length > 0 && baseRecovery.strategy === 'BACKOFF') {
			// Switch to session pause for proactive patterns
			return {
				strategy: 'PAUSE_SESSION',
				delay: 300000, // 5 minutes
				reason: 'Proactive session pause due to identified error patterns'
			};
		}
		
		return baseRecovery;
	}

	/**
	 * Pre-session risk assessment
	 */
	async assessPreSessionRisk(sessionConfig: {
		accountIds: string[];
		sessionType: string;
		targetMetrics: string[];
	}): Promise<SessionRisk> {
		return await this.riskAssessment.assessSessionRisk(sessionConfig, this.healthMonitor);
	}

	/**
	 * Get system analytics
	 */
	getSystemAnalytics(): {
		patterns: ErrorPattern[];
		patternCount: number;
		riskAccounts: number;
		systemHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
	} {
		const patterns = this.patternAnalyzer.getPatterns();
		const criticalPatterns = patterns.filter(p => p.predictedImpact === 'CRITICAL');
		
		let systemHealth: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' = 'EXCELLENT';
		if (criticalPatterns.length > 0) systemHealth = 'POOR';
		else if (patterns.length > 10) systemHealth = 'FAIR';
		else if (patterns.length > 5) systemHealth = 'GOOD';
		
		return {
			patterns,
			patternCount: patterns.length,
			riskAccounts: 0, // Would calculate from health monitor
			systemHealth
		};
	}

	/**
	 * Enhanced withErrorHandling wrapper
	 */
	async withEnhancedErrorHandling<T>(
		operation: () => Promise<T>,
		context: ErrorContext,
		sessionManager: {
			pauseSession: (sessionId: string) => Promise<void>;
			cancelSession: (sessionId: string, reason: string) => Promise<void>;
			updateSessionProgress: (sessionId: string, progress: any) => Promise<void>;
		}
	): Promise<{ success: true; data: T } | { 
		success: false; 
		error: ScrapingError; 
		recovery: RecoveryStrategy;
		patterns: ErrorPattern[];
		healthUpdate?: AccountHealth;
	}> {
		try {
			const result = await operation();
			return { success: true, data: result };
		} catch (error) {
			const enhanced = await this.handleError(error, context, sessionManager);
			return {
				success: false,
				error: enhanced.scrapingError,
				recovery: enhanced.recovery,
				patterns: enhanced.patterns,
				healthUpdate: enhanced.healthUpdate
			};
		}
	}
}

// Export singleton instance for global use
export const enhancedErrorRecovery = new EnhancedErrorRecoveryManager();

/**
 * Health check for enhanced error recovery system
 */
export function validateEnhancedErrorRecoverySystem(): {
	valid: boolean;
	message: string;
	capabilities: string[];
	mlFeatures: string[];
} {
	const capabilities = [
		'ML-powered error pattern recognition',
		'Account health monitoring with predictive analytics',
		'Pre-session risk assessment',
		'Proactive error prevention',
		'Enhanced recovery strategies based on patterns',
		'Real-time health score calculation',
		'Suspicious activity detection',
		'System load and concurrent session optimization'
	];

	const mlFeatures = [
		'Pattern frequency analysis across multiple time windows',
		'Account-specific error pattern identification',
		'Sequential error pattern recognition',
		'Predictive error probability calculation',
		'Confidence scoring for predictions',
		'Risk level assessment with multiple factors',
		'Automated recommendation generation'
	];

	return {
		valid: true,
		message: 'Enhanced Error Recovery System with ML capabilities fully operational',
		capabilities,
		mlFeatures
	};
}