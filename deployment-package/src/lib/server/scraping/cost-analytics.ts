import { prisma } from '$lib/server/database-fallback';
import type { PrismaClient } from '@prisma/client';

// Define scraping session interface for type safety
interface ScrapingSessionData {
	id: string;
	sessionType?: string;
	status?: string;
	totalAccounts?: number;
	progress?: number;
	estimatedCost?: number;
	totalRequestUnits?: number;
	startedAt?: Date;
	completedAt?: Date;
	createdAt: Date;
	targetUsernames?: string[];
}

export interface CostAnalyticsData {
	totalCosts: {
		today: number;
		thisWeek: number;
		thisMonth: number;
		allTime: number;
	};
	dailyCosts: Array<{ date: string; cost: number; sessions: number; accounts: number }>;
	costBreakdown: Array<{ category: string; cost: number; percentage: number }>;
	budgetAnalysis: {
		dailyBudget: number;
		weeklyBudget: number;
		monthlyBudget: number;
		dailyUsed: number;
		weeklyUsed: number;
		monthlyUsed: number;
		dailyRemaining: number;
		weeklyRemaining: number;
		monthlyRemaining: number;
	};
	costEfficiency: {
		avgCostPerAccount: number;
		avgCostPerSession: number;
		costTrend: 'increasing' | 'decreasing' | 'stable';
		efficiencyScore: number;
	};
	predictions: {
		predictedDailyCost: number;
		predictedWeeklyCost: number;
		predictedMonthlyCost: number;
		confidence: number;
	};
}

export interface SessionCostData {
	sessionId: string;
	sessionType: string;
	totalCost: number;
	costPerAccount: number;
	accountsProcessed: number;
	duration: number;
	requestUnits: number;
	efficiency: number;
	date: string;
}

export interface TimeframeFilter {
	timeframe: '7d' | '30d' | '90d' | '1y';
}

export class CostAnalyticsManager {
	private prisma: any; // Using any type for fallback database compatibility

	constructor() {
		this.prisma = prisma;
	}

	/**
	 * Get comprehensive cost analytics for the specified timeframe
	 */
	async getCostAnalytics(filter: TimeframeFilter): Promise<{
		analytics: CostAnalyticsData;
		recentSessions: SessionCostData[];
	}> {
		try {
			const timeframeDays = this.getTimeframeDays(filter.timeframe);
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - timeframeDays);

			// Get all sessions within timeframe
			const sessions = await this.getSessions(startDate);
			
			// Calculate analytics
			const analytics = await this.calculateAnalytics(sessions);
			const recentSessions = await this.getRecentSessionCosts(10);

			return {
				analytics,
				recentSessions
			};

		} catch (error) {
			console.error('Failed to get cost analytics:', error);
			throw error;
		}
	}

	/**
	 * Get sessions within the specified date range
	 */
	private async getSessions(startDate: Date): Promise<ScrapingSessionData[]> {
		try {
			// Try to access scraping sessions, fall back to empty array if not available
			if (!this.prisma.scrapingSession) {
				console.warn('ScrapingSession table not available, returning empty data');
				return [];
			}

			const sessions = await this.prisma.scrapingSession.findMany({
				where: {
					createdAt: {
						gte: startDate
					}
				},
				select: {
					id: true,
					sessionType: true,
					status: true,
					totalAccounts: true,
					progress: true,
					estimatedCost: true,
					totalRequestUnits: true,
					startedAt: true,
					completedAt: true,
					createdAt: true,
					targetUsernames: true
				},
				orderBy: {
					createdAt: 'desc'
				}
			});

			return sessions;
		} catch (error) {
			console.error('Failed to fetch sessions:', error);
			return [];
		}
	}

	/**
	 * Calculate comprehensive analytics from session data
	 */
	private async calculateAnalytics(sessions: ScrapingSessionData[]): Promise<CostAnalyticsData> {
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const thisWeekStart = new Date(today);
		thisWeekStart.setDate(today.getDate() - today.getDay());
		const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

		// Calculate total costs
		const totalCosts = this.calculateTotalCosts(sessions, today, thisWeekStart, thisMonthStart);
		
		// Calculate daily costs
		const dailyCosts = this.calculateDailyCosts(sessions, 30);
		
		// Calculate cost breakdown by session type
		const costBreakdown = this.calculateCostBreakdown(sessions);
		
		// Calculate budget analysis
		const budgetAnalysis = this.calculateBudgetAnalysis(totalCosts);
		
		// Calculate cost efficiency
		const costEfficiency = this.calculateCostEfficiency(sessions);
		
		// Calculate predictions
		const predictions = this.calculatePredictions(dailyCosts);

		return {
			totalCosts,
			dailyCosts,
			costBreakdown,
			budgetAnalysis,
			costEfficiency,
			predictions
		};
	}

	/**
	 * Calculate total costs for different time periods
	 */
	private calculateTotalCosts(sessions: ScrapingSessionData[], today: Date, thisWeekStart: Date, thisMonthStart: Date) {
		let todayCost = 0;
		let thisWeekCost = 0;
		let thisMonthCost = 0;
		let allTimeCost = 0;

		sessions.forEach(session => {
			const cost = this.calculateSessionCost(session);
			const sessionDate = new Date(session.createdAt);

			allTimeCost += cost;

			if (sessionDate >= thisMonthStart) {
				thisMonthCost += cost;
			}

			if (sessionDate >= thisWeekStart) {
				thisWeekCost += cost;
			}

			if (sessionDate >= today) {
				todayCost += cost;
			}
		});

		return {
			today: todayCost,
			thisWeek: thisWeekCost,
			thisMonth: thisMonthCost,
			allTime: allTimeCost
		};
	}

	/**
	 * Calculate daily cost trends
	 */
	private calculateDailyCosts(sessions: ScrapingSessionData[], days: number) {
		const dailyMap = new Map<string, { cost: number; sessions: number; accounts: number }>();
		const now = new Date();

		// Initialize all days with zero values
		for (let i = 0; i < days; i++) {
			const date = new Date(now);
			date.setDate(now.getDate() - (days - 1 - i));
			const dateStr = date.toISOString().split('T')[0];
			dailyMap.set(dateStr, { cost: 0, sessions: 0, accounts: 0 });
		}

		// Aggregate session data by day
		sessions.forEach(session => {
			const sessionDate = new Date(session.createdAt);
			const dateStr = sessionDate.toISOString().split('T')[0];
			
			if (dailyMap.has(dateStr)) {
				const existing = dailyMap.get(dateStr)!;
				existing.cost += this.calculateSessionCost(session);
				existing.sessions += 1;
				existing.accounts += session.totalAccounts || 0;
			}
		});

		return Array.from(dailyMap.entries()).map(([date, data]) => ({
			date,
			cost: Math.round(data.cost * 100) / 100,
			sessions: data.sessions,
			accounts: data.accounts
		}));
	}

	/**
	 * Calculate cost breakdown by session type
	 */
	private calculateCostBreakdown(sessions: ScrapingSessionData[]) {
		const breakdownMap = new Map<string, number>();
		let totalCost = 0;

		sessions.forEach(session => {
			const cost = this.calculateSessionCost(session);
			const type = this.getSessionTypeCategory(session.sessionType || 'ACCOUNT_METRICS');
			
			breakdownMap.set(type, (breakdownMap.get(type) || 0) + cost);
			totalCost += cost;
		});

		return Array.from(breakdownMap.entries()).map(([category, cost]) => ({
			category,
			cost: Math.round(cost * 100) / 100,
			percentage: Math.round((cost / totalCost) * 100)
		})).sort((a, b) => b.cost - a.cost);
	}

	/**
	 * Calculate budget analysis
	 */
	private calculateBudgetAnalysis(totalCosts: any) {
		const budgetLimits = {
			dailyBudget: 10.0,
			weeklyBudget: 50.0,
			monthlyBudget: 200.0
		};

		return {
			...budgetLimits,
			dailyUsed: totalCosts.today,
			weeklyUsed: totalCosts.thisWeek,
			monthlyUsed: totalCosts.thisMonth,
			dailyRemaining: Math.max(0, budgetLimits.dailyBudget - totalCosts.today),
			weeklyRemaining: Math.max(0, budgetLimits.weeklyBudget - totalCosts.thisWeek),
			monthlyRemaining: Math.max(0, budgetLimits.monthlyBudget - totalCosts.thisMonth)
		};
	}

	/**
	 * Calculate cost efficiency metrics
	 */
	private calculateCostEfficiency(sessions: ScrapingSessionData[]) {
		const completedSessions = sessions.filter(s => s.status === 'COMPLETED' || s.progress === 100);
		
		if (completedSessions.length === 0) {
			return {
				avgCostPerAccount: 0.002, // Default fallback
				avgCostPerSession: 0,
				costTrend: 'stable' as const,
				efficiencyScore: 85
			};
		}

		let totalCost = 0;
		let totalAccounts = 0;
		let totalSessions = completedSessions.length;

		completedSessions.forEach(session => {
			totalCost += this.calculateSessionCost(session);
			totalAccounts += session.totalAccounts || 0;
		});

		const avgCostPerAccount = totalAccounts > 0 ? totalCost / totalAccounts : 0.002;
		const avgCostPerSession = totalSessions > 0 ? totalCost / totalSessions : 0;

		// Calculate trend (simplified - compare recent vs older sessions)
		const costTrend = this.calculateCostTrend(completedSessions);
		
		// Calculate efficiency score (based on cost per account vs target)
		const targetCostPerAccount = 0.002;
		const efficiencyScore = Math.min(100, Math.max(0, Math.round((targetCostPerAccount / Math.max(avgCostPerAccount, 0.001)) * 85)));

		return {
			avgCostPerAccount: Math.round(avgCostPerAccount * 10000) / 10000,
			avgCostPerSession: Math.round(avgCostPerSession * 100) / 100,
			costTrend,
			efficiencyScore
		};
	}

	/**
	 * Calculate cost predictions
	 */
	private calculatePredictions(dailyCosts: any[]) {
		if (dailyCosts.length < 7) {
			return {
				predictedDailyCost: 0,
				predictedWeeklyCost: 0,
				predictedMonthlyCost: 0,
				confidence: 0
			};
		}

		// Simple linear regression for trend
		const recentDays = dailyCosts.slice(-7);
		const avgDailyCost = recentDays.reduce((sum, day) => sum + day.cost, 0) / recentDays.length;

		// Calculate trend multiplier
		const trendMultiplier = this.calculateTrendMultiplier(recentDays);
		
		const predictedDailyCost = avgDailyCost * trendMultiplier;
		const predictedWeeklyCost = predictedDailyCost * 7;
		const predictedMonthlyCost = predictedDailyCost * 30;

		// Confidence based on data consistency
		const confidence = this.calculatePredictionConfidence(recentDays);

		return {
			predictedDailyCost: Math.round(predictedDailyCost * 100) / 100,
			predictedWeeklyCost: Math.round(predictedWeeklyCost * 100) / 100,
			predictedMonthlyCost: Math.round(predictedMonthlyCost * 100) / 100,
			confidence: Math.round(confidence)
		};
	}

	/**
	 * Get recent session cost data
	 */
	private async getRecentSessionCosts(limit: number): Promise<SessionCostData[]> {
		try {
			// Check if scraping session table is available
			if (!this.prisma.scrapingSession) {
				console.warn('ScrapingSession table not available, returning empty data');
				return [];
			}

			const sessions = await this.prisma.scrapingSession.findMany({
				where: {
					status: 'COMPLETED'
				},
				select: {
					id: true,
					sessionType: true,
					totalAccounts: true,
					totalRequestUnits: true,
					estimatedCost: true,
					startedAt: true,
					completedAt: true,
					createdAt: true
				},
				orderBy: {
					completedAt: 'desc'
				},
				take: limit
			});

			return sessions.map((session: ScrapingSessionData) => {
				const duration = session.completedAt && session.startedAt 
					? Math.floor((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
					: 0;

				const totalCost = this.calculateSessionCost(session);
				const costPerAccount = (session.totalAccounts ?? 0) > 0 ? totalCost / (session.totalAccounts ?? 1) : 0;
				const efficiency = this.calculateSessionEfficiency(session);

				return {
					sessionId: session.id,
					sessionType: session.sessionType || 'ACCOUNT_METRICS',
					totalCost: Math.round(totalCost * 100) / 100,
					costPerAccount: Math.round(costPerAccount * 10000) / 10000,
					accountsProcessed: session.totalAccounts || 0,
					duration,
					requestUnits: session.totalRequestUnits || 0,
					efficiency: Math.round(efficiency),
					date: session.createdAt.toISOString()
				};
			});

		} catch (error) {
			console.error('Failed to get recent session costs:', error);
			return [];
		}
	}

	/**
	 * Helper methods
	 */
	private getTimeframeDays(timeframe: string): number {
		switch (timeframe) {
			case '7d': return 7;
			case '30d': return 30;
			case '90d': return 90;
			case '1y': return 365;
			default: return 30;
		}
	}

	private calculateSessionCost(session: ScrapingSessionData): number {
		// If estimated cost is available, use it
		if (session.estimatedCost && session.estimatedCost > 0) {
			return session.estimatedCost;
		}

		// Fallback calculation based on request units
		// HikerAPI pricing: ~$0.002 per account (500 request units per account)
		const requestUnits = session.totalRequestUnits || 0;
		const costPerUnit = 0.002 / 500; // $0.002 per 500 units
		return requestUnits * costPerUnit;
	}

	private getSessionTypeCategory(sessionType: string): string {
		switch (sessionType) {
			case 'ACCOUNT_METRICS':
				return 'Account Metrics';
			case 'DETAILED_ANALYSIS':
				return 'Detailed Analysis';
			case 'FOLLOWERS_ANALYSIS':
				return 'Follower Analysis';
			case 'MEDIA_ANALYSIS':
				return 'Media Analysis';
			case 'STORIES_ANALYSIS':
				return 'Stories Analysis';
			default:
				return 'Other';
		}
	}

	private calculateCostTrend(sessions: ScrapingSessionData[]): 'increasing' | 'decreasing' | 'stable' {
		if (sessions.length < 6) return 'stable';

		const sortedSessions = sessions.sort((a, b) => 
			new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		);

		const recentSessions = sortedSessions.slice(-3);
		const olderSessions = sortedSessions.slice(-6, -3);

		const recentAvgCost = recentSessions.reduce((sum, s) => sum + this.calculateSessionCost(s), 0) / recentSessions.length;
		const olderAvgCost = olderSessions.reduce((sum, s) => sum + this.calculateSessionCost(s), 0) / olderSessions.length;

		const difference = (recentAvgCost - olderAvgCost) / olderAvgCost;

		if (difference > 0.1) return 'increasing';
		if (difference < -0.1) return 'decreasing';
		return 'stable';
	}

	private calculateTrendMultiplier(dailyCosts: any[]): number {
		if (dailyCosts.length < 3) return 1;

		// Simple linear trend calculation
		const x = dailyCosts.map((_, i) => i);
		const y = dailyCosts.map(d => d.cost);
		
		const n = x.length;
		const sumX = x.reduce((a, b) => a + b, 0);
		const sumY = y.reduce((a, b) => a + b, 0);
		const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
		const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

		const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
		
		// Convert slope to multiplier (clamped to reasonable bounds)
		return Math.max(0.5, Math.min(2.0, 1 + slope * 0.1));
	}

	private calculatePredictionConfidence(dailyCosts: any[]): number {
		if (dailyCosts.length < 3) return 50;

		// Calculate coefficient of variation (lower = more consistent = higher confidence)
		const costs = dailyCosts.map(d => d.cost);
		const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
		const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
		const stdDev = Math.sqrt(variance);
		const coeffOfVariation = mean > 0 ? stdDev / mean : 1;

		// Convert to confidence percentage (inverse relationship)
		return Math.max(60, Math.min(95, 95 - (coeffOfVariation * 100)));
	}

	private calculateSessionEfficiency(session: ScrapingSessionData): number {
		// Base efficiency on cost per account vs target
		const cost = this.calculateSessionCost(session);
		const accounts = session.totalAccounts || 1;
		const costPerAccount = cost / accounts;
		const targetCostPerAccount = 0.002;

		// Calculate efficiency percentage
		const efficiency = (targetCostPerAccount / Math.max(costPerAccount, 0.001)) * 100;
		
		// Add bonus for successful completion
		const completionBonus = session.progress === 100 ? 10 : 0;
		
		return Math.min(100, Math.max(0, efficiency + completionBonus));
	}

	/**
	 * Real-time cost update for WebSocket integration
	 */
	async updateRealTimeCost(sessionId: string, currentCost: number, requestUnits: number): Promise<void> {
		try {
			// Check if scraping session table is available
			if (!this.prisma.scrapingSession) {
				console.warn('ScrapingSession table not available, skipping cost update');
				return;
			}

			// Update session cost in database
			await this.prisma.scrapingSession.update({
				where: { id: sessionId },
				data: {
					estimatedCost: currentCost,
					totalRequestUnits: requestUnits
				}
			});

		} catch (error) {
			console.error('Failed to update real-time cost:', error);
		}
	}

	/**
	 * Get cost optimization recommendations
	 */
	async getCostOptimizationRecommendations(): Promise<string[]> {
		const recommendations: string[] = [];

		try {
			const recentSessions = await this.getRecentSessionCosts(20);
			const avgCostPerAccount = recentSessions.reduce((sum, s) => sum + s.costPerAccount, 0) / recentSessions.length;

			if (avgCostPerAccount > 0.0025) {
				recommendations.push('💡 Consider reducing the scope of data collection to lower cost per account');
			}

			if (recentSessions.some(s => s.efficiency < 70)) {
				recommendations.push('⚡ Some sessions have low efficiency - review error rates and retry mechanisms');
			}

			// Convert SessionCostData to ScrapingSessionData format for calculateDailyCosts
			const mockSessionData: ScrapingSessionData[] = recentSessions.map(session => ({
				id: session.sessionId,
				sessionType: session.sessionType,
				totalAccounts: session.accountsProcessed,
				estimatedCost: session.totalCost,
				totalRequestUnits: session.requestUnits,
				createdAt: new Date(session.date)
			}));
			const dailyCosts = this.calculateDailyCosts(mockSessionData, 7);
			const avgDailyCost = dailyCosts.reduce((sum, d) => sum + d.cost, 0) / dailyCosts.length;

			if (avgDailyCost > 8) {
				recommendations.push('📊 Daily costs are approaching budget limits - consider schedule optimization');
			}

			if (recommendations.length === 0) {
				recommendations.push('✅ Cost efficiency is optimal - great job maintaining budget control!');
			}

		} catch (error) {
			console.error('Failed to generate cost recommendations:', error);
			recommendations.push('❌ Unable to generate recommendations - check system health');
		}

		return recommendations;
	}
}

// Export singleton instance
export const costAnalyticsManager = new CostAnalyticsManager();