/**
 * Cost-Optimized Scraping Configuration
 * Manages scraping costs, rate limits, and budget optimization
 */

export interface CostOptimizationConfig {
  // Budget Controls
  dailyBudgetLimit: number;
  monthlyBudgetLimit: number;
  costPerAccount: number;
  
  // Rate Limiting
  requestsPerMinute: number;
  requestsPerHour: number;
  delayBetweenRequests: number; // milliseconds
  
  // Account Prioritization
  prioritizeOwnedAccounts: boolean;
  maxAccountsPerSession: number;
  maxDailyAccounts: number;
  
  // Quality Controls
  skipRecentlyScraped: boolean;
  minimumHoursBetweenScrapes: number;
  retryFailedAccounts: boolean;
  maxRetryAttempts: number;
  
  // HikerAPI Specific
  useBasicProfile: boolean; // Use cheaper basic profile endpoint
  skipDetailedMetrics: boolean;
  batchRequestsWhenPossible: boolean;
}

export interface CostAnalysis {
  totalEligibleAccounts: number;
  accountsWithinBudget: number;
  estimatedDailyCost: number;
  estimatedMonthlyCost: number;
  budgetUtilization: number; // percentage
  recommendedAccountLimit: number;
  costSavingsOpportunities: string[];
}

export interface ScrapingRateLimit {
  requestsInLastMinute: number;
  requestsInLastHour: number;
  nextAllowedRequest: Date;
  isRateLimited: boolean;
  suggestedDelay: number; // milliseconds
}

// Cost-optimized configuration presets
export const COST_OPTIMIZATION_PRESETS = {
  // Ultra conservative for testing
  TEST_MODE: {
    dailyBudgetLimit: 0.01,
    monthlyBudgetLimit: 0.30,
    costPerAccount: 0.002,
    requestsPerMinute: 5,
    requestsPerHour: 100,
    delayBetweenRequests: 3000,
    prioritizeOwnedAccounts: true,
    maxAccountsPerSession: 3,
    maxDailyAccounts: 5,
    skipRecentlyScraped: true,
    minimumHoursBetweenScrapes: 24,
    retryFailedAccounts: true,
    maxRetryAttempts: 2,
    useBasicProfile: true,
    skipDetailedMetrics: false,
    batchRequestsWhenPossible: true
  } as CostOptimizationConfig,

  // Moderate budget for small clients
  SMALL_SCALE: {
    dailyBudgetLimit: 0.05,
    monthlyBudgetLimit: 1.50,
    costPerAccount: 0.002,
    requestsPerMinute: 10,
    requestsPerHour: 300,
    delayBetweenRequests: 2000,
    prioritizeOwnedAccounts: true,
    maxAccountsPerSession: 15,
    maxDailyAccounts: 25,
    skipRecentlyScraped: true,
    minimumHoursBetweenScrapes: 12,
    retryFailedAccounts: true,
    maxRetryAttempts: 3,
    useBasicProfile: false,
    skipDetailedMetrics: false,
    batchRequestsWhenPossible: true
  } as CostOptimizationConfig,

  // Higher budget for production use
  PRODUCTION: {
    dailyBudgetLimit: 0.20,
    monthlyBudgetLimit: 6.00,
    costPerAccount: 0.002,
    requestsPerMinute: 20,
    requestsPerHour: 800,
    delayBetweenRequests: 1500,
    prioritizeOwnedAccounts: true,
    maxAccountsPerSession: 50,
    maxDailyAccounts: 100,
    skipRecentlyScraped: true,
    minimumHoursBetweenScrapes: 8,
    retryFailedAccounts: true,
    maxRetryAttempts: 3,
    useBasicProfile: false,
    skipDetailedMetrics: false,
    batchRequestsWhenPossible: true
  } as CostOptimizationConfig,

  // Maximum scale for enterprise
  ENTERPRISE: {
    dailyBudgetLimit: 1.00,
    monthlyBudgetLimit: 30.00,
    costPerAccount: 0.002,
    requestsPerMinute: 30,
    requestsPerHour: 1500,
    delayBetweenRequests: 1000,
    prioritizeOwnedAccounts: false, // Scrape all eligible accounts
    maxAccountsPerSession: 200,
    maxDailyAccounts: 500,
    skipRecentlyScraped: true,
    minimumHoursBetweenScrapes: 6,
    retryFailedAccounts: true,
    maxRetryAttempts: 5,
    useBasicProfile: false,
    skipDetailedMetrics: false,
    batchRequestsWhenPossible: true
  } as CostOptimizationConfig
};

export class CostOptimizer {
  private config: CostOptimizationConfig;
  private requestHistory: Date[] = [];

  constructor(preset: keyof typeof COST_OPTIMIZATION_PRESETS = 'TEST_MODE') {
    this.config = { ...COST_OPTIMIZATION_PRESETS[preset] };
  }

  /**
   * Analyze cost implications for a set of accounts
   */
  analyzeCosts(totalAccounts: number): CostAnalysis {
    const accountsWithinDailyBudget = Math.floor(this.config.dailyBudgetLimit / this.config.costPerAccount);
    const accountsToScrape = Math.min(
      totalAccounts,
      accountsWithinDailyBudget,
      this.config.maxDailyAccounts
    );

    const estimatedDailyCost = accountsToScrape * this.config.costPerAccount;
    const estimatedMonthlyCost = estimatedDailyCost * 30;
    const budgetUtilization = (estimatedDailyCost / this.config.dailyBudgetLimit) * 100;

    const costSavingsOpportunities = [];
    if (this.config.useBasicProfile) {
      costSavingsOpportunities.push("Using basic profile endpoint for reduced costs");
    }
    if (this.config.batchRequestsWhenPossible) {
      costSavingsOpportunities.push("Batching requests when possible for efficiency");
    }
    if (this.config.skipRecentlyScraped) {
      costSavingsOpportunities.push("Skipping recently scraped accounts to avoid duplicate costs");
    }

    return {
      totalEligibleAccounts: totalAccounts,
      accountsWithinBudget: accountsToScrape,
      estimatedDailyCost,
      estimatedMonthlyCost,
      budgetUtilization,
      recommendedAccountLimit: accountsWithinDailyBudget,
      costSavingsOpportunities
    };
  }

  /**
   * Check current rate limiting status
   */
  checkRateLimit(): ScrapingRateLimit {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const oneHourAgo = new Date(now.getTime() - 3600000);

    // Clean old requests from history
    this.requestHistory = this.requestHistory.filter(date => date > oneHourAgo);

    const requestsInLastMinute = this.requestHistory.filter(date => date > oneMinuteAgo).length;
    const requestsInLastHour = this.requestHistory.length;

    const isMinuteLimitExceeded = requestsInLastMinute >= this.config.requestsPerMinute;
    const isHourLimitExceeded = requestsInLastHour >= this.config.requestsPerHour;
    const isRateLimited = isMinuteLimitExceeded || isHourLimitExceeded;

    let suggestedDelay = this.config.delayBetweenRequests;
    let nextAllowedRequest = new Date(now.getTime() + suggestedDelay);

    if (isMinuteLimitExceeded) {
      // Wait until next minute
      suggestedDelay = 60000;
      nextAllowedRequest = new Date(now.getTime() + suggestedDelay);
    } else if (isHourLimitExceeded) {
      // Wait until next hour
      suggestedDelay = 3600000;
      nextAllowedRequest = new Date(now.getTime() + suggestedDelay);
    }

    return {
      requestsInLastMinute,
      requestsInLastHour,
      nextAllowedRequest,
      isRateLimited,
      suggestedDelay
    };
  }

  /**
   * Record a request in the rate limiting system
   */
  recordRequest(): void {
    this.requestHistory.push(new Date());
  }

  /**
   * Get optimal scraping parameters for a session
   */
  getOptimalScrapingParams(totalAccounts: number): {
    accountsToScrape: number;
    delayBetweenRequests: number;
    estimatedDuration: number; // minutes
    estimatedCost: number;
    useBasicProfile: boolean;
  } {
    const analysis = this.analyzeCosts(totalAccounts);
    const accountsToScrape = analysis.accountsWithinBudget;
    const delayBetweenRequests = this.config.delayBetweenRequests;
    
    // Estimate duration: (accounts * delay) + (accounts * average_processing_time)
    const processingTimePerAccount = 5000; // 5 seconds processing per account
    const totalTimePerAccount = delayBetweenRequests + processingTimePerAccount;
    const estimatedDuration = (accountsToScrape * totalTimePerAccount) / 60000; // Convert to minutes

    return {
      accountsToScrape,
      delayBetweenRequests,
      estimatedDuration,
      estimatedCost: analysis.estimatedDailyCost,
      useBasicProfile: this.config.useBasicProfile
    };
  }

  /**
   * Check if an account should be skipped based on recent scraping history
   */
  shouldSkipAccount(lastScrapedTime: Date | null): boolean {
    if (!this.config.skipRecentlyScraped || !lastScrapedTime) {
      return false;
    }

    const now = new Date();
    const hoursSinceLastScrape = (now.getTime() - lastScrapedTime.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastScrape < this.config.minimumHoursBetweenScrapes;
  }

  /**
   * Get cost savings recommendations
   */
  getCostSavingsRecommendations(currentSpending: number): string[] {
    const recommendations = [];

    if (currentSpending > this.config.dailyBudgetLimit * 0.8) {
      recommendations.push("Consider reducing daily account limit to stay within budget");
      recommendations.push("Enable basic profile mode to reduce costs per account");
      recommendations.push("Increase minimum hours between scrapes to reduce frequency");
    }

    if (!this.config.useBasicProfile && currentSpending > this.config.dailyBudgetLimit * 0.5) {
      recommendations.push("Switch to basic profile endpoint for 30-50% cost reduction");
    }

    if (!this.config.skipRecentlyScraped) {
      recommendations.push("Enable 'skip recently scraped' to avoid duplicate costs");
    }

    if (this.config.delayBetweenRequests < 2000) {
      recommendations.push("Increase delay between requests to improve success rate and reduce retries");
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CostOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): CostOptimizationConfig {
    return { ...this.config };
  }

  /**
   * Apply a preset configuration
   */
  applyPreset(preset: keyof typeof COST_OPTIMIZATION_PRESETS): void {
    this.config = { ...COST_OPTIMIZATION_PRESETS[preset] };
  }

  /**
   * Validate configuration for common issues
   */
  validateConfig(): { isValid: boolean; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Budget validation
    if (this.config.dailyBudgetLimit <= 0) {
      errors.push("Daily budget limit must be greater than 0");
    }

    if (this.config.monthlyBudgetLimit < this.config.dailyBudgetLimit * 30) {
      warnings.push("Monthly budget may be insufficient for daily budget limit");
    }

    // Rate limiting validation
    if (this.config.requestsPerMinute > this.config.requestsPerHour / 60) {
      errors.push("Requests per minute cannot exceed hourly rate divided by 60");
    }

    if (this.config.delayBetweenRequests < 1000) {
      warnings.push("Very short delays may cause rate limiting issues");
    }

    // Account limits validation
    if (this.config.maxDailyAccounts > this.config.dailyBudgetLimit / this.config.costPerAccount) {
      warnings.push("Daily account limit exceeds what daily budget allows");
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }
}