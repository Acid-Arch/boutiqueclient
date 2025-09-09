import { j as json } from './index-Djsj11qr.js';
import { g as getClientAccountStats } from './client-account-filter-B5FMm-xH.js';
import './database-CKYbeswu.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './status-BUw8K8Dp.js';

const COST_OPTIMIZATION_PRESETS = {
  // Ultra conservative for testing
  TEST_MODE: {
    dailyBudgetLimit: 0.01,
    monthlyBudgetLimit: 0.3,
    costPerAccount: 2e-3,
    requestsPerMinute: 5,
    requestsPerHour: 100,
    delayBetweenRequests: 3e3,
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
  },
  // Moderate budget for small clients
  SMALL_SCALE: {
    dailyBudgetLimit: 0.05,
    monthlyBudgetLimit: 1.5,
    costPerAccount: 2e-3,
    requestsPerMinute: 10,
    requestsPerHour: 300,
    delayBetweenRequests: 2e3,
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
  },
  // Higher budget for production use
  PRODUCTION: {
    dailyBudgetLimit: 0.2,
    monthlyBudgetLimit: 6,
    costPerAccount: 2e-3,
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
  },
  // Maximum scale for enterprise
  ENTERPRISE: {
    dailyBudgetLimit: 1,
    monthlyBudgetLimit: 30,
    costPerAccount: 2e-3,
    requestsPerMinute: 30,
    requestsPerHour: 1500,
    delayBetweenRequests: 1e3,
    prioritizeOwnedAccounts: false,
    // Scrape all eligible accounts
    maxAccountsPerSession: 200,
    maxDailyAccounts: 500,
    skipRecentlyScraped: true,
    minimumHoursBetweenScrapes: 6,
    retryFailedAccounts: true,
    maxRetryAttempts: 5,
    useBasicProfile: false,
    skipDetailedMetrics: false,
    batchRequestsWhenPossible: true
  }
};
class CostOptimizer {
  config;
  requestHistory = [];
  constructor(preset = "TEST_MODE") {
    this.config = { ...COST_OPTIMIZATION_PRESETS[preset] };
  }
  /**
   * Analyze cost implications for a set of accounts
   */
  analyzeCosts(totalAccounts) {
    const accountsWithinDailyBudget = Math.floor(this.config.dailyBudgetLimit / this.config.costPerAccount);
    const accountsToScrape = Math.min(
      totalAccounts,
      accountsWithinDailyBudget,
      this.config.maxDailyAccounts
    );
    const estimatedDailyCost = accountsToScrape * this.config.costPerAccount;
    const estimatedMonthlyCost = estimatedDailyCost * 30;
    const budgetUtilization = estimatedDailyCost / this.config.dailyBudgetLimit * 100;
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
  checkRateLimit() {
    const now = /* @__PURE__ */ new Date();
    const oneMinuteAgo = new Date(now.getTime() - 6e4);
    const oneHourAgo = new Date(now.getTime() - 36e5);
    this.requestHistory = this.requestHistory.filter((date) => date > oneHourAgo);
    const requestsInLastMinute = this.requestHistory.filter((date) => date > oneMinuteAgo).length;
    const requestsInLastHour = this.requestHistory.length;
    const isMinuteLimitExceeded = requestsInLastMinute >= this.config.requestsPerMinute;
    const isHourLimitExceeded = requestsInLastHour >= this.config.requestsPerHour;
    const isRateLimited = isMinuteLimitExceeded || isHourLimitExceeded;
    let suggestedDelay = this.config.delayBetweenRequests;
    let nextAllowedRequest = new Date(now.getTime() + suggestedDelay);
    if (isMinuteLimitExceeded) {
      suggestedDelay = 6e4;
      nextAllowedRequest = new Date(now.getTime() + suggestedDelay);
    } else if (isHourLimitExceeded) {
      suggestedDelay = 36e5;
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
  recordRequest() {
    this.requestHistory.push(/* @__PURE__ */ new Date());
  }
  /**
   * Get optimal scraping parameters for a session
   */
  getOptimalScrapingParams(totalAccounts) {
    const analysis = this.analyzeCosts(totalAccounts);
    const accountsToScrape = analysis.accountsWithinBudget;
    const delayBetweenRequests = this.config.delayBetweenRequests;
    const processingTimePerAccount = 5e3;
    const totalTimePerAccount = delayBetweenRequests + processingTimePerAccount;
    const estimatedDuration = accountsToScrape * totalTimePerAccount / 6e4;
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
  shouldSkipAccount(lastScrapedTime) {
    if (!this.config.skipRecentlyScraped || !lastScrapedTime) {
      return false;
    }
    const now = /* @__PURE__ */ new Date();
    const hoursSinceLastScrape = (now.getTime() - lastScrapedTime.getTime()) / (1e3 * 60 * 60);
    return hoursSinceLastScrape < this.config.minimumHoursBetweenScrapes;
  }
  /**
   * Get cost savings recommendations
   */
  getCostSavingsRecommendations(currentSpending) {
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
    if (this.config.delayBetweenRequests < 2e3) {
      recommendations.push("Increase delay between requests to improve success rate and reduce retries");
    }
    return recommendations;
  }
  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Apply a preset configuration
   */
  applyPreset(preset) {
    this.config = { ...COST_OPTIMIZATION_PRESETS[preset] };
  }
  /**
   * Validate configuration for common issues
   */
  validateConfig() {
    const warnings = [];
    const errors = [];
    if (this.config.dailyBudgetLimit <= 0) {
      errors.push("Daily budget limit must be greater than 0");
    }
    if (this.config.monthlyBudgetLimit < this.config.dailyBudgetLimit * 30) {
      warnings.push("Monthly budget may be insufficient for daily budget limit");
    }
    if (this.config.requestsPerMinute > this.config.requestsPerHour / 60) {
      errors.push("Requests per minute cannot exceed hourly rate divided by 60");
    }
    if (this.config.delayBetweenRequests < 1e3) {
      warnings.push("Very short delays may cause rate limiting issues");
    }
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
let globalOptimizer = null;
function getCostOptimizer() {
  if (!globalOptimizer) {
    globalOptimizer = new CostOptimizer("TEST_MODE");
  }
  return globalOptimizer;
}
const GET = async ({ url }) => {
  try {
    const action = url.searchParams.get("action") || "analyze";
    const optimizer = getCostOptimizer();
    switch (action) {
      case "analyze":
        const accountStats = await getClientAccountStats();
        const costAnalysis = optimizer.analyzeCosts(accountStats.eligibleForScraping);
        return json({
          success: true,
          data: {
            accountStats,
            costAnalysis,
            currentConfig: optimizer.getConfig(),
            optimalParams: optimizer.getOptimalScrapingParams(accountStats.eligibleForScraping)
          }
        });
      case "rate-limit":
        const rateLimitStatus = optimizer.checkRateLimit();
        return json({
          success: true,
          data: {
            rateLimitStatus,
            canProceed: !rateLimitStatus.isRateLimited,
            recommendedDelay: rateLimitStatus.suggestedDelay
          }
        });
      case "presets":
        const presets = Object.keys(COST_OPTIMIZATION_PRESETS).map((key) => ({
          name: key,
          config: COST_OPTIMIZATION_PRESETS[key],
          description: getPresetDescription(key)
        }));
        return json({
          success: true,
          data: { presets }
        });
      case "recommendations":
        const currentSpending = parseFloat(url.searchParams.get("spending") || "0");
        const recommendations = optimizer.getCostSavingsRecommendations(currentSpending);
        return json({
          success: true,
          data: {
            currentSpending,
            recommendations,
            configValidation: optimizer.validateConfig()
          }
        });
      case "validate":
        const validation = optimizer.validateConfig();
        return json({
          success: true,
          data: {
            validation,
            currentConfig: optimizer.getConfig()
          }
        });
      default:
        return json({
          success: false,
          error: "Invalid action. Valid actions: analyze, rate-limit, presets, recommendations, validate"
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Cost optimizer API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
const POST = async ({ request }) => {
  try {
    const { action, preset, config } = await request.json();
    const optimizer = getCostOptimizer();
    switch (action) {
      case "apply-preset":
        if (!preset || !COST_OPTIMIZATION_PRESETS[preset]) {
          return json({
            success: false,
            error: "Invalid preset. Valid presets: " + Object.keys(COST_OPTIMIZATION_PRESETS).join(", ")
          }, { status: 400 });
        }
        optimizer.applyPreset(preset);
        return json({
          success: true,
          message: `Applied preset: ${preset}`,
          data: {
            newConfig: optimizer.getConfig(),
            validation: optimizer.validateConfig()
          }
        });
      case "update-config":
        if (!config) {
          return json({
            success: false,
            error: "Configuration object is required"
          }, { status: 400 });
        }
        optimizer.updateConfig(config);
        const validation = optimizer.validateConfig();
        return json({
          success: true,
          message: "Configuration updated",
          data: {
            updatedConfig: optimizer.getConfig(),
            validation
          }
        });
      case "record-request":
        optimizer.recordRequest();
        const newRateLimit = optimizer.checkRateLimit();
        return json({
          success: true,
          message: "Request recorded",
          data: {
            rateLimitStatus: newRateLimit
          }
        });
      case "test-scenarios":
        const scenarios = await generateTestScenarios(optimizer);
        return json({
          success: true,
          data: { scenarios }
        });
      default:
        return json({
          success: false,
          error: "Invalid action. Valid actions: apply-preset, update-config, record-request, test-scenarios"
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Cost optimizer API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
function getPresetDescription(presetKey) {
  const descriptions = {
    TEST_MODE: "Ultra conservative settings for testing with minimal cost ($0.01/day)",
    SMALL_SCALE: "Moderate budget for small clients with careful cost control ($0.05/day)",
    PRODUCTION: "Higher budget for regular production use ($0.20/day)",
    ENTERPRISE: "Maximum scale for enterprise with full account coverage ($1.00/day)"
  };
  return descriptions[presetKey] || "Custom configuration";
}
async function generateTestScenarios(optimizer) {
  const accountStats = await getClientAccountStats();
  const scenarios = [];
  const currentAnalysis = optimizer.analyzeCosts(accountStats.eligibleForScraping);
  scenarios.push({
    name: "Current Configuration",
    config: optimizer.getConfig(),
    analysis: currentAnalysis,
    optimalParams: optimizer.getOptimalScrapingParams(accountStats.eligibleForScraping)
  });
  for (const [presetName, presetConfig] of Object.entries(COST_OPTIMIZATION_PRESETS)) {
    const testOptimizer = new CostOptimizer();
    testOptimizer.updateConfig(presetConfig);
    scenarios.push({
      name: `${presetName} Preset`,
      config: presetConfig,
      analysis: testOptimizer.analyzeCosts(accountStats.eligibleForScraping),
      optimalParams: testOptimizer.getOptimalScrapingParams(accountStats.eligibleForScraping)
    });
  }
  return scenarios;
}

export { GET, POST };
//# sourceMappingURL=_server.ts-zJVV5oMz.js.map
