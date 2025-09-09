import { j as json } from './index-Djsj11qr.js';
import { a as getClientAccountSample, g as getClientAccountStats, b as getClientAccountsForScraping, f as filterAccountsForScraping } from './client-account-filter-B5FMm-xH.js';
import { a as createBulkSession, u as updateSessionProgress } from './session-manager-6fwnccII.js';
import { H as HikerAPIClient } from './hiker-api-client-BwPCqXIk.js';
import * as cron from 'node-cron';
import './database-CKYbeswu.js';
import './index-Dn7PghUK.js';
import './false-B2gHlHjM.js';
import './status-BUw8K8Dp.js';
import './db-loader-D8HPWY1t.js';

const DEFAULT_DAILY_CONFIG = {
  enabled: true,
  cronSchedule: "0 9 * * *",
  // 9 AM daily
  maxAccountsPerDay: 50,
  // Start conservative for testing
  costLimit: 0.1,
  // $0.10 daily limit for testing
  testMode: true,
  // Start in test mode
  testAccountLimit: 5,
  prioritizeOwnedAccounts: true
};
class DailyScrapingScheduler {
  config;
  cronJob = null;
  isRunning = false;
  hikerClient;
  constructor(config = DEFAULT_DAILY_CONFIG) {
    this.config = config;
    this.hikerClient = new HikerAPIClient();
  }
  /**
   * Start the daily scraping scheduler
   */
  start() {
    if (this.cronJob) {
      console.log("Daily scraping scheduler is already running");
      return;
    }
    if (!this.config.enabled) {
      console.log("Daily scraping scheduler is disabled");
      return;
    }
    console.log(`Starting daily scraping scheduler with cron: ${this.config.cronSchedule}`);
    this.cronJob = cron.schedule(this.config.cronSchedule, async () => {
      await this.executeDailyScraping();
    }, {
      timezone: "UTC"
    });
    console.log("✅ Daily scraping scheduler started");
  }
  /**
   * Stop the daily scraping scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log("Daily scraping scheduler stopped");
    }
  }
  /**
   * Execute daily scraping session
   */
  async executeDailyScraping() {
    if (this.isRunning) {
      console.log("Daily scraping is already running, skipping this execution");
      return;
    }
    this.isRunning = true;
    console.log("🚀 Starting daily scraping session...");
    try {
      const accountsToScrape = await this.getAccountsForDailyScraping();
      if (accountsToScrape.length === 0) {
        console.log("No accounts eligible for scraping today");
        return;
      }
      const estimatedCost = accountsToScrape.length * 2e-3;
      if (estimatedCost > this.config.costLimit) {
        console.log(`⚠️ Estimated cost $${estimatedCost.toFixed(3)} exceeds daily limit $${this.config.costLimit}`);
        console.log(`Reducing accounts from ${accountsToScrape.length} to ${Math.floor(this.config.costLimit / 2e-3)}`);
        accountsToScrape.splice(Math.floor(this.config.costLimit / 2e-3));
      }
      const sessionId = `daily-scraping-${Date.now()}`;
      const session = await createBulkSession(
        "ACCOUNT_METRICS",
        accountsToScrape.map((acc) => acc.username),
        {
          costLimit: parseFloat(estimatedCost.toFixed(3)),
          triggerSource: "SCHEDULED",
          triggeredBy: "DailyScrapingScheduler"
        }
      );
      console.log(`📊 Daily scraping session created: ${sessionId}`);
      console.log(`Accounts to scrape: ${accountsToScrape.length}`);
      console.log(`Estimated cost: $${estimatedCost.toFixed(3)}`);
      let completedAccounts = 0;
      let failedAccounts = 0;
      for (const account of accountsToScrape) {
        try {
          console.log(`Scraping account: ${account.username}`);
          const profileData = await this.hikerClient.getUserProfile(account.username);
          if (profileData) {
            completedAccounts++;
            console.log(`✅ Successfully scraped ${account.username}`);
          } else {
            failedAccounts++;
            console.log(`❌ Failed to scrape ${account.username}`);
          }
          const progress = Math.round((completedAccounts + failedAccounts) / accountsToScrape.length * 100);
          await updateSessionProgress(sessionId, {
            completedAccounts,
            failedAccounts,
            requestUnits: completedAccounts * 2,
            // Estimated request units
            actualCost: completedAccounts * 2e-3
            // Estimated cost
          });
          await new Promise((resolve) => setTimeout(resolve, 2e3));
        } catch (error) {
          failedAccounts++;
          console.error(`Error scraping ${account.username}:`, error);
        }
      }
      await updateSessionProgress(sessionId, {
        completedAccounts,
        failedAccounts,
        requestUnits: completedAccounts * 2,
        actualCost: completedAccounts * 2e-3
      });
      console.log("✅ Daily scraping session completed");
      console.log(`Completed: ${completedAccounts}, Failed: ${failedAccounts}`);
    } catch (error) {
      console.error("❌ Daily scraping session failed:", error);
    } finally {
      this.isRunning = false;
    }
  }
  /**
   * Get accounts for daily scraping based on configuration
   */
  async getAccountsForDailyScraping() {
    try {
      let accounts;
      if (this.config.testMode) {
        accounts = await getClientAccountSample(this.config.testAccountLimit);
        console.log(`📝 Test mode: Using ${accounts.length} sample accounts`);
      } else {
        const allAccounts = await getClientAccountsForScraping();
        accounts = filterAccountsForScraping(allAccounts);
        if (accounts.length > this.config.maxAccountsPerDay) {
          accounts = accounts.slice(0, this.config.maxAccountsPerDay);
        }
        console.log(`🏭 Production mode: Using ${accounts.length} accounts`);
      }
      if (this.config.prioritizeOwnedAccounts) {
        accounts.sort((a, b) => {
          if (a.ownerId && !b.ownerId) return -1;
          if (!a.ownerId && b.ownerId) return 1;
          return 0;
        });
      }
      return accounts;
    } catch (error) {
      console.error("Error getting accounts for daily scraping:", error);
      return [];
    }
  }
  /**
   * Get current scheduler statistics
   */
  async getSchedulerStats() {
    try {
      const stats = await getClientAccountStats();
      const accountsToScrape = this.config.testMode ? Math.min(this.config.testAccountLimit, stats.eligibleForScraping) : Math.min(this.config.maxAccountsPerDay, stats.eligibleForScraping);
      const estimatedCost = accountsToScrape * 2e-3;
      const estimatedDuration = accountsToScrape * 0.5;
      return {
        scheduledTime: this.config.cronSchedule,
        totalEligibleAccounts: stats.eligibleForScraping,
        accountsToScrape,
        estimatedCost,
        estimatedDuration,
        lastRunDate: null,
        // Would be stored in database
        nextRunDate: this.getNextRunDate(),
        isRunning: this.isRunning
      };
    } catch (error) {
      console.error("Error getting scheduler stats:", error);
      throw error;
    }
  }
  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (this.cronJob) {
      this.stop();
      this.start();
    }
    console.log("Daily scraping scheduler configuration updated");
  }
  /**
   * Get the next scheduled run date
   */
  getNextRunDate() {
    if (!this.cronJob) return null;
    try {
      const now = /* @__PURE__ */ new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    } catch {
      return null;
    }
  }
  /**
   * Manual trigger for testing (bypasses schedule)
   */
  async triggerManualScraping() {
    console.log("🔧 Manual scraping triggered");
    await this.executeDailyScraping();
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Check if scheduler is currently running a scraping session
   */
  getRunningStatus() {
    return this.isRunning;
  }
}
let globalScheduler = null;
function getDailyScheduler() {
  if (!globalScheduler) {
    globalScheduler = new DailyScrapingScheduler();
  }
  return globalScheduler;
}
const GET = async ({ url }) => {
  try {
    const action = url.searchParams.get("action") || "status";
    const scheduler = getDailyScheduler();
    switch (action) {
      case "status":
        const stats = await scheduler.getSchedulerStats();
        const config = scheduler.getConfig();
        const clientStats = await getClientAccountStats();
        return json({
          success: true,
          data: {
            scheduler: {
              enabled: config.enabled,
              testMode: config.testMode,
              cronSchedule: config.cronSchedule,
              maxAccountsPerDay: config.maxAccountsPerDay,
              costLimit: config.costLimit,
              isRunning: scheduler.getRunningStatus()
            },
            stats,
            clientAccounts: clientStats
          }
        });
      case "test-accounts":
        const limit = parseInt(url.searchParams.get("limit") || "5");
        const sampleAccounts = await getClientAccountSample(limit);
        return json({
          success: true,
          data: {
            sampleAccounts: sampleAccounts.map((account) => ({
              id: account.id,
              username: account.username,
              email: account.email,
              ownerId: account.ownerId,
              accountType: account.accountType,
              currentStatus: account.currentStatus,
              isCompanyAccount: account.email?.includes("@op.pl") || false
            })),
            totalSampled: sampleAccounts.length
          }
        });
      case "config":
        return json({
          success: true,
          data: {
            config: scheduler.getConfig()
          }
        });
      default:
        return json({
          success: false,
          error: "Invalid action. Valid actions: status, test-accounts, config"
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Daily scheduler API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};
const POST = async ({ request }) => {
  try {
    const { action, config } = await request.json();
    const scheduler = getDailyScheduler();
    switch (action) {
      case "start":
        scheduler.start();
        return json({
          success: true,
          message: "Daily scheduler started"
        });
      case "stop":
        scheduler.stop();
        return json({
          success: true,
          message: "Daily scheduler stopped"
        });
      case "trigger":
        if (scheduler.getRunningStatus()) {
          return json({
            success: false,
            error: "Scraping session is already running"
          }, { status: 409 });
        }
        scheduler.triggerManualScraping().catch(console.error);
        return json({
          success: true,
          message: "Manual scraping session triggered"
        });
      case "update-config":
        if (!config) {
          return json({
            success: false,
            error: "Configuration object is required"
          }, { status: 400 });
        }
        scheduler.updateConfig(config);
        return json({
          success: true,
          message: "Configuration updated",
          data: {
            updatedConfig: scheduler.getConfig()
          }
        });
      case "test-setup":
        const testConfig = {
          enabled: true,
          testMode: true,
          testAccountLimit: 3,
          costLimit: 0.01,
          // $0.01 for testing
          maxAccountsPerDay: 5,
          cronSchedule: "*/5 * * * *"
          // Every 5 minutes for testing
        };
        scheduler.updateConfig(testConfig);
        return json({
          success: true,
          message: "Test configuration applied",
          data: {
            testConfig
          }
        });
      case "production-setup":
        const prodConfig = {
          enabled: true,
          testMode: false,
          maxAccountsPerDay: 100,
          costLimit: 0.2,
          // $0.20 daily
          cronSchedule: "0 9 * * *",
          // 9 AM daily
          prioritizeOwnedAccounts: true
        };
        scheduler.updateConfig(prodConfig);
        return json({
          success: true,
          message: "Production configuration applied",
          data: {
            productionConfig: prodConfig
          }
        });
      default:
        return json({
          success: false,
          error: "Invalid action. Valid actions: start, stop, trigger, update-config, test-setup, production-setup"
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Daily scheduler API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-cybq5PcF.js.map
