/**
 * Daily Scraping Scheduler Service
 * Manages automated daily scraping of client accounts with cost optimization
 */

import { 
  getClientAccountsForScraping, 
  getClientAccountStats,
  filterAccountsForScraping,
  getClientAccountSample 
} from './client-account-filter.js';
import type { ClientScrapingAccount } from './client-account-filter.js';
import { createBulkSession, updateSessionProgress } from './session-manager.js';
import { HikerAPIClient } from './hiker-api-client.js';
import * as cron from 'node-cron';

export interface DailyScrapingConfig {
  enabled: boolean;
  cronSchedule: string; // e.g., "0 9 * * *" for 9 AM daily
  maxAccountsPerDay: number;
  costLimit: number; // Maximum daily cost in USD
  testMode: boolean; // If true, only scrape sample accounts
  testAccountLimit: number;
  prioritizeOwnedAccounts: boolean;
}

export interface DailyScrapingStats {
  scheduledTime: string;
  totalEligibleAccounts: number;
  accountsToScrape: number;
  estimatedCost: number;
  estimatedDuration: number; // minutes
  lastRunDate: Date | null;
  nextRunDate: Date | null;
  isRunning: boolean;
}

// Default configuration for daily scraping
export const DEFAULT_DAILY_CONFIG: DailyScrapingConfig = {
  enabled: true,
  cronSchedule: "0 9 * * *", // 9 AM daily
  maxAccountsPerDay: 50, // Start conservative for testing
  costLimit: 0.10, // $0.10 daily limit for testing
  testMode: true, // Start in test mode
  testAccountLimit: 5,
  prioritizeOwnedAccounts: true
};

export class DailyScrapingScheduler {
  private config: DailyScrapingConfig;
  private cronJob: any | null = null;
  private isRunning: boolean = false;
  private hikerClient: HikerAPIClient;

  constructor(config: DailyScrapingConfig = DEFAULT_DAILY_CONFIG) {
    this.config = config;
    this.hikerClient = new HikerAPIClient();
  }

  /**
   * Start the daily scraping scheduler
   */
  start(): void {
    if (this.cronJob) {
      console.log('Daily scraping scheduler is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('Daily scraping scheduler is disabled');
      return;
    }

    console.log(`Starting daily scraping scheduler with cron: ${this.config.cronSchedule}`);
    
    this.cronJob = cron.schedule(this.config.cronSchedule, async () => {
      await this.executeDailyScraping();
    }, {
      timezone: "UTC"
    });

    console.log('✅ Daily scraping scheduler started');
  }

  /**
   * Stop the daily scraping scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Daily scraping scheduler stopped');
    }
  }

  /**
   * Execute daily scraping session
   */
  async executeDailyScraping(): Promise<void> {
    if (this.isRunning) {
      console.log('Daily scraping is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting daily scraping session...');

    try {
      // Get accounts to scrape based on configuration
      const accountsToScrape = await this.getAccountsForDailyScraping();
      
      if (accountsToScrape.length === 0) {
        console.log('No accounts eligible for scraping today');
        return;
      }

      // Calculate costs and verify within budget
      const estimatedCost = accountsToScrape.length * 0.002; // $0.002 per account
      if (estimatedCost > this.config.costLimit) {
        console.log(`⚠️ Estimated cost $${estimatedCost.toFixed(3)} exceeds daily limit $${this.config.costLimit}`);
        console.log(`Reducing accounts from ${accountsToScrape.length} to ${Math.floor(this.config.costLimit / 0.002)}`);
        accountsToScrape.splice(Math.floor(this.config.costLimit / 0.002));
      }

      // Create scraping session
      const sessionId = `daily-scraping-${Date.now()}`;
      const session = await createBulkSession(
        'ACCOUNT_METRICS',
        accountsToScrape.map(acc => acc.username),
        {
          costLimit: parseFloat(estimatedCost.toFixed(3)),
          triggerSource: 'SCHEDULED',
          triggeredBy: 'DailyScrapingScheduler'
        }
      );

      console.log(`📊 Daily scraping session created: ${sessionId}`);
      console.log(`Accounts to scrape: ${accountsToScrape.length}`);
      console.log(`Estimated cost: $${estimatedCost.toFixed(3)}`);

      // Execute scraping for each account
      let completedAccounts = 0;
      let failedAccounts = 0;

      for (const account of accountsToScrape) {
        try {
          console.log(`Scraping account: ${account.username}`);
          
          // Scrape account metrics using HikerAPI
          const profileData = await this.hikerClient.getUserProfile(account.username);
          
          if (profileData) {
            // Store metrics in database would happen here
            completedAccounts++;
            console.log(`✅ Successfully scraped ${account.username}`);
          } else {
            failedAccounts++;
            console.log(`❌ Failed to scrape ${account.username}`);
          }

          // Update session progress
          const progress = Math.round((completedAccounts + failedAccounts) / accountsToScrape.length * 100);
          await updateSessionProgress(sessionId, {
            completedAccounts,
            failedAccounts,
            requestUnits: completedAccounts * 2, // Estimated request units
            actualCost: completedAccounts * 0.002 // Estimated cost
          });

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

        } catch (error) {
          failedAccounts++;
          console.error(`Error scraping ${account.username}:`, error);
        }
      }

      // Final session update
      await updateSessionProgress(sessionId, {
        completedAccounts,
        failedAccounts,
        requestUnits: completedAccounts * 2,
        actualCost: completedAccounts * 0.002
      });

      console.log('✅ Daily scraping session completed');
      console.log(`Completed: ${completedAccounts}, Failed: ${failedAccounts}`);

    } catch (error) {
      console.error('❌ Daily scraping session failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get accounts for daily scraping based on configuration
   */
  private async getAccountsForDailyScraping(): Promise<ClientScrapingAccount[]> {
    try {
      let accounts: ClientScrapingAccount[];

      if (this.config.testMode) {
        // Test mode: Use sample accounts
        accounts = await getClientAccountSample(this.config.testAccountLimit);
        console.log(`📝 Test mode: Using ${accounts.length} sample accounts`);
      } else {
        // Production mode: Get all eligible client accounts
        const allAccounts = await getClientAccountsForScraping();
        accounts = filterAccountsForScraping(allAccounts);
        
        // Limit to max accounts per day
        if (accounts.length > this.config.maxAccountsPerDay) {
          accounts = accounts.slice(0, this.config.maxAccountsPerDay);
        }
        console.log(`🏭 Production mode: Using ${accounts.length} accounts`);
      }

      // Prioritize owned accounts if configured
      if (this.config.prioritizeOwnedAccounts) {
        accounts.sort((a, b) => {
          if (a.ownerId && !b.ownerId) return -1;
          if (!a.ownerId && b.ownerId) return 1;
          return 0;
        });
      }

      return accounts;

    } catch (error) {
      console.error('Error getting accounts for daily scraping:', error);
      return [];
    }
  }

  /**
   * Get current scheduler statistics
   */
  async getSchedulerStats(): Promise<DailyScrapingStats> {
    try {
      const stats = await getClientAccountStats();
      const accountsToScrape = this.config.testMode 
        ? Math.min(this.config.testAccountLimit, stats.eligibleForScraping)
        : Math.min(this.config.maxAccountsPerDay, stats.eligibleForScraping);
      
      const estimatedCost = accountsToScrape * 0.002;
      const estimatedDuration = accountsToScrape * 0.5; // 30 seconds per account

      return {
        scheduledTime: this.config.cronSchedule,
        totalEligibleAccounts: stats.eligibleForScraping,
        accountsToScrape,
        estimatedCost,
        estimatedDuration,
        lastRunDate: null, // Would be stored in database
        nextRunDate: this.getNextRunDate(),
        isRunning: this.isRunning
      };
    } catch (error) {
      console.error('Error getting scheduler stats:', error);
      throw error;
    }
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<DailyScrapingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduler with new config if it was running
    if (this.cronJob) {
      this.stop();
      this.start();
    }
    
    console.log('Daily scraping scheduler configuration updated');
  }

  /**
   * Get the next scheduled run date
   */
  private getNextRunDate(): Date | null {
    if (!this.cronJob) return null;
    
    try {
      // This is a simplified calculation - in practice you'd use a proper cron parser
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM UTC
      
      return tomorrow;
    } catch {
      return null;
    }
  }

  /**
   * Manual trigger for testing (bypasses schedule)
   */
  async triggerManualScraping(): Promise<void> {
    console.log('🔧 Manual scraping triggered');
    await this.executeDailyScraping();
  }

  /**
   * Get current configuration
   */
  getConfig(): DailyScrapingConfig {
    return { ...this.config };
  }

  /**
   * Check if scheduler is currently running a scraping session
   */
  getRunningStatus(): boolean {
    return this.isRunning;
  }
}

// Global scheduler instance
let globalScheduler: DailyScrapingScheduler | null = null;

/**
 * Get or create the global scheduler instance
 */
export function getDailyScheduler(): DailyScrapingScheduler {
  if (!globalScheduler) {
    globalScheduler = new DailyScrapingScheduler();
  }
  return globalScheduler;
}

/**
 * Initialize and start the daily scheduler (called on server startup)
 */
export function initializeDailyScheduler(config?: Partial<DailyScrapingConfig>): void {
  const scheduler = getDailyScheduler();
  
  if (config) {
    scheduler.updateConfig(config);
  }
  
  scheduler.start();
  console.log('✅ Daily scraping scheduler initialized and started');
}