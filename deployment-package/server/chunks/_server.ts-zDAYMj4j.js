import { j as json } from './index-Djsj11qr.js';
import { prisma } from './database-fallback-D0uHIhN9.js';
import 'pg';
import './db-security-logger-C-Isx1J6.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './status-BUw8K8Dp.js';

class CostAnalyticsManager {
  prisma;
  // Using any type for fallback database compatibility
  constructor() {
    this.prisma = prisma;
  }
  /**
   * Get comprehensive cost analytics for the specified timeframe
   */
  async getCostAnalytics(filter) {
    try {
      const timeframeDays = this.getTimeframeDays(filter.timeframe);
      const startDate = /* @__PURE__ */ new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);
      const sessions = await this.getSessions(startDate);
      const analytics = await this.calculateAnalytics(sessions);
      const recentSessions = await this.getRecentSessionCosts(10);
      return {
        analytics,
        recentSessions
      };
    } catch (error) {
      console.error("Failed to get cost analytics:", error);
      throw error;
    }
  }
  /**
   * Get sessions within the specified date range
   */
  async getSessions(startDate) {
    try {
      if (!this.prisma.scrapingSession) {
        console.warn("ScrapingSession table not available, returning empty data");
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
          createdAt: "desc"
        }
      });
      return sessions;
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
      return [];
    }
  }
  /**
   * Calculate comprehensive analytics from session data
   */
  async calculateAnalytics(sessions) {
    const now = /* @__PURE__ */ new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalCosts = this.calculateTotalCosts(sessions, today, thisWeekStart, thisMonthStart);
    const dailyCosts = this.calculateDailyCosts(sessions, 30);
    const costBreakdown = this.calculateCostBreakdown(sessions);
    const budgetAnalysis = this.calculateBudgetAnalysis(totalCosts);
    const costEfficiency = this.calculateCostEfficiency(sessions);
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
  calculateTotalCosts(sessions, today, thisWeekStart, thisMonthStart) {
    let todayCost = 0;
    let thisWeekCost = 0;
    let thisMonthCost = 0;
    let allTimeCost = 0;
    sessions.forEach((session) => {
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
  calculateDailyCosts(sessions, days) {
    const dailyMap = /* @__PURE__ */ new Map();
    const now = /* @__PURE__ */ new Date();
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { cost: 0, sessions: 0, accounts: 0 });
    }
    sessions.forEach((session) => {
      const sessionDate = new Date(session.createdAt);
      const dateStr = sessionDate.toISOString().split("T")[0];
      if (dailyMap.has(dateStr)) {
        const existing = dailyMap.get(dateStr);
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
  calculateCostBreakdown(sessions) {
    const breakdownMap = /* @__PURE__ */ new Map();
    let totalCost = 0;
    sessions.forEach((session) => {
      const cost = this.calculateSessionCost(session);
      const type = this.getSessionTypeCategory(session.sessionType || "ACCOUNT_METRICS");
      breakdownMap.set(type, (breakdownMap.get(type) || 0) + cost);
      totalCost += cost;
    });
    return Array.from(breakdownMap.entries()).map(([category, cost]) => ({
      category,
      cost: Math.round(cost * 100) / 100,
      percentage: Math.round(cost / totalCost * 100)
    })).sort((a, b) => b.cost - a.cost);
  }
  /**
   * Calculate budget analysis
   */
  calculateBudgetAnalysis(totalCosts) {
    const budgetLimits = {
      dailyBudget: 10,
      weeklyBudget: 50,
      monthlyBudget: 200
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
  calculateCostEfficiency(sessions) {
    const completedSessions = sessions.filter((s) => s.status === "COMPLETED" || s.progress === 100);
    if (completedSessions.length === 0) {
      return {
        avgCostPerAccount: 2e-3,
        // Default fallback
        avgCostPerSession: 0,
        costTrend: "stable",
        efficiencyScore: 85
      };
    }
    let totalCost = 0;
    let totalAccounts = 0;
    let totalSessions = completedSessions.length;
    completedSessions.forEach((session) => {
      totalCost += this.calculateSessionCost(session);
      totalAccounts += session.totalAccounts || 0;
    });
    const avgCostPerAccount = totalAccounts > 0 ? totalCost / totalAccounts : 2e-3;
    const avgCostPerSession = totalSessions > 0 ? totalCost / totalSessions : 0;
    const costTrend = this.calculateCostTrend(completedSessions);
    const targetCostPerAccount = 2e-3;
    const efficiencyScore = Math.min(100, Math.max(0, Math.round(targetCostPerAccount / Math.max(avgCostPerAccount, 1e-3) * 85)));
    return {
      avgCostPerAccount: Math.round(avgCostPerAccount * 1e4) / 1e4,
      avgCostPerSession: Math.round(avgCostPerSession * 100) / 100,
      costTrend,
      efficiencyScore
    };
  }
  /**
   * Calculate cost predictions
   */
  calculatePredictions(dailyCosts) {
    if (dailyCosts.length < 7) {
      return {
        predictedDailyCost: 0,
        predictedWeeklyCost: 0,
        predictedMonthlyCost: 0,
        confidence: 0
      };
    }
    const recentDays = dailyCosts.slice(-7);
    const avgDailyCost = recentDays.reduce((sum, day) => sum + day.cost, 0) / recentDays.length;
    const trendMultiplier = this.calculateTrendMultiplier(recentDays);
    const predictedDailyCost = avgDailyCost * trendMultiplier;
    const predictedWeeklyCost = predictedDailyCost * 7;
    const predictedMonthlyCost = predictedDailyCost * 30;
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
  async getRecentSessionCosts(limit) {
    try {
      if (!this.prisma.scrapingSession) {
        console.warn("ScrapingSession table not available, returning empty data");
        return [];
      }
      const sessions = await this.prisma.scrapingSession.findMany({
        where: {
          status: "COMPLETED"
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
          completedAt: "desc"
        },
        take: limit
      });
      return sessions.map((session) => {
        const duration = session.completedAt && session.startedAt ? Math.floor((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1e3) : 0;
        const totalCost = this.calculateSessionCost(session);
        const costPerAccount = (session.totalAccounts ?? 0) > 0 ? totalCost / (session.totalAccounts ?? 1) : 0;
        const efficiency = this.calculateSessionEfficiency(session);
        return {
          sessionId: session.id,
          sessionType: session.sessionType || "ACCOUNT_METRICS",
          totalCost: Math.round(totalCost * 100) / 100,
          costPerAccount: Math.round(costPerAccount * 1e4) / 1e4,
          accountsProcessed: session.totalAccounts || 0,
          duration,
          requestUnits: session.totalRequestUnits || 0,
          efficiency: Math.round(efficiency),
          date: session.createdAt.toISOString()
        };
      });
    } catch (error) {
      console.error("Failed to get recent session costs:", error);
      return [];
    }
  }
  /**
   * Helper methods
   */
  getTimeframeDays(timeframe) {
    switch (timeframe) {
      case "7d":
        return 7;
      case "30d":
        return 30;
      case "90d":
        return 90;
      case "1y":
        return 365;
      default:
        return 30;
    }
  }
  calculateSessionCost(session) {
    if (session.estimatedCost && session.estimatedCost > 0) {
      return session.estimatedCost;
    }
    const requestUnits = session.totalRequestUnits || 0;
    const costPerUnit = 2e-3 / 500;
    return requestUnits * costPerUnit;
  }
  getSessionTypeCategory(sessionType) {
    switch (sessionType) {
      case "ACCOUNT_METRICS":
        return "Account Metrics";
      case "DETAILED_ANALYSIS":
        return "Detailed Analysis";
      case "FOLLOWERS_ANALYSIS":
        return "Follower Analysis";
      case "MEDIA_ANALYSIS":
        return "Media Analysis";
      case "STORIES_ANALYSIS":
        return "Stories Analysis";
      default:
        return "Other";
    }
  }
  calculateCostTrend(sessions) {
    if (sessions.length < 6) return "stable";
    const sortedSessions = sessions.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const recentSessions = sortedSessions.slice(-3);
    const olderSessions = sortedSessions.slice(-6, -3);
    const recentAvgCost = recentSessions.reduce((sum, s) => sum + this.calculateSessionCost(s), 0) / recentSessions.length;
    const olderAvgCost = olderSessions.reduce((sum, s) => sum + this.calculateSessionCost(s), 0) / olderSessions.length;
    const difference = (recentAvgCost - olderAvgCost) / olderAvgCost;
    if (difference > 0.1) return "increasing";
    if (difference < -0.1) return "decreasing";
    return "stable";
  }
  calculateTrendMultiplier(dailyCosts) {
    if (dailyCosts.length < 3) return 1;
    const x = dailyCosts.map((_, i) => i);
    const y = dailyCosts.map((d) => d.cost);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return Math.max(0.5, Math.min(2, 1 + slope * 0.1));
  }
  calculatePredictionConfidence(dailyCosts) {
    if (dailyCosts.length < 3) return 50;
    const costs = dailyCosts.map((d) => d.cost);
    const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = mean > 0 ? stdDev / mean : 1;
    return Math.max(60, Math.min(95, 95 - coeffOfVariation * 100));
  }
  calculateSessionEfficiency(session) {
    const cost = this.calculateSessionCost(session);
    const accounts = session.totalAccounts || 1;
    const costPerAccount = cost / accounts;
    const targetCostPerAccount = 2e-3;
    const efficiency = targetCostPerAccount / Math.max(costPerAccount, 1e-3) * 100;
    const completionBonus = session.progress === 100 ? 10 : 0;
    return Math.min(100, Math.max(0, efficiency + completionBonus));
  }
  /**
   * Real-time cost update for WebSocket integration
   */
  async updateRealTimeCost(sessionId, currentCost, requestUnits) {
    try {
      if (!this.prisma.scrapingSession) {
        console.warn("ScrapingSession table not available, skipping cost update");
        return;
      }
      await this.prisma.scrapingSession.update({
        where: { id: sessionId },
        data: {
          estimatedCost: currentCost,
          totalRequestUnits: requestUnits
        }
      });
    } catch (error) {
      console.error("Failed to update real-time cost:", error);
    }
  }
  /**
   * Get cost optimization recommendations
   */
  async getCostOptimizationRecommendations() {
    const recommendations = [];
    try {
      const recentSessions = await this.getRecentSessionCosts(20);
      const avgCostPerAccount = recentSessions.reduce((sum, s) => sum + s.costPerAccount, 0) / recentSessions.length;
      if (avgCostPerAccount > 25e-4) {
        recommendations.push("💡 Consider reducing the scope of data collection to lower cost per account");
      }
      if (recentSessions.some((s) => s.efficiency < 70)) {
        recommendations.push("⚡ Some sessions have low efficiency - review error rates and retry mechanisms");
      }
      const mockSessionData = recentSessions.map((session) => ({
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
        recommendations.push("📊 Daily costs are approaching budget limits - consider schedule optimization");
      }
      if (recommendations.length === 0) {
        recommendations.push("✅ Cost efficiency is optimal - great job maintaining budget control!");
      }
    } catch (error) {
      console.error("Failed to generate cost recommendations:", error);
      recommendations.push("❌ Unable to generate recommendations - check system health");
    }
    return recommendations;
  }
}
const costAnalyticsManager = new CostAnalyticsManager();
const GET = async ({ url, fetch }) => {
  try {
    const timeframe = url.searchParams.get("timeframe") || "30d";
    const validTimeframes = ["7d", "30d", "90d", "1y"];
    if (!validTimeframes.includes(timeframe)) {
      return json(
        {
          error: "Invalid timeframe",
          message: "Timeframe must be one of: 7d, 30d, 90d, 1y"
        },
        { status: 400 }
      );
    }
    const analyticsData = await costAnalyticsManager.getCostAnalytics({ timeframe });
    const recommendations = await costAnalyticsManager.getCostOptimizationRecommendations();
    return json({
      success: true,
      timeframe,
      ...analyticsData,
      recommendations,
      metadata: {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        requestId: crypto.randomUUID(),
        version: "1.0"
      }
    });
  } catch (error) {
    console.error("Cost analytics API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        timeframe: url.searchParams.get("timeframe") || "30d"
      },
      { status: 500 }
    );
  }
};
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, sessionId, currentCost, requestUnits } = body;
    if (action === "update-real-time-cost") {
      if (!sessionId || currentCost === void 0 || requestUnits === void 0) {
        return json(
          {
            success: false,
            error: "Missing required fields",
            message: "sessionId, currentCost, and requestUnits are required for real-time cost updates"
          },
          { status: 400 }
        );
      }
      await costAnalyticsManager.updateRealTimeCost(sessionId, currentCost, requestUnits);
      return json({
        success: true,
        message: "Real-time cost updated successfully",
        sessionId,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return json(
      {
        success: false,
        error: "Invalid action",
        message: "Supported actions: update-real-time-cost"
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Cost analytics POST error:", error);
    return json(
      {
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      },
      { status: 500 }
    );
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-zDAYMj4j.js.map
