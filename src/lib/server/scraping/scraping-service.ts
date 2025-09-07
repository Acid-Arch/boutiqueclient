/**
 * Main Scraping Service
 * Orchestrates HikerAPI client, data transformation, and database integration
 */

import { HikerAPIClient } from './hiker-api-client';
import { DataTransformer } from './data-transformer';
import { prisma } from '../database-fallback';
import type {
  ScrapingConfig,
  ScrapingSessionRequest,
  ScrapingResult,
  AccountMetrics,
  ScrapingSessionInfo,
  DashboardStats
} from '$lib/types/scraping.types';
import type { HikerAPIUserProfile, HikerAPIUser } from '$lib/types/hikerapi.types';

export class ScrapingService {
  private hikerClient: HikerAPIClient;
  private db: any;

  constructor() {
    this.hikerClient = new HikerAPIClient();
    this.initializeDatabase();
  }

  private async initializeDatabase() {
    // Use prisma client from database fallback system
    this.db = prisma;
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Scrape a single account and store the results
   */
  async scrapeAccount(
    accountId: number, 
    config: Partial<ScrapingConfig> = {},
    sessionId?: string
  ): Promise<ScrapingResult<AccountMetrics>> {
    const startTime = Date.now();
    
    try {
      if (!this.db) await this.initializeDatabase();

      // Get account information from database
      const accountInfo = await this.getAccountInfo(accountId);
      if (!accountInfo) {
        throw new Error(`Account not found: ${accountId}`);
      }

      // Get previous metrics for growth calculations
      const previousMetrics = await this.getLatestAccountMetrics(accountId);

      // Scrape profile data from HikerAPI
      const profileResult = config.includeDetailedProfile !== false
        ? await this.hikerClient.getUserProfile(accountInfo.username)
        : await this.hikerClient.getBasicProfile(accountInfo.username);

      if (!profileResult.success || !profileResult.data) {
        return {
          success: false,
          error: profileResult.error || { 
            type: 'UNKNOWN_ERROR', 
            message: 'Failed to fetch profile data',
            isRetryable: false
          },
          requestUnits: profileResult.requestUnits,
          duration: Date.now() - startTime,
          metrics: profileResult.metrics
        };
      }

      // Transform HikerAPI data to database format
      const transformedData = DataTransformer.transformProfileData(
        profileResult.data,
        sessionId || `single_${Date.now()}`,
        accountId,
        previousMetrics || undefined  // Convert null to undefined
      );

      // Add scraping duration
      transformedData.scrapingDuration = Date.now() - startTime;
      transformedData.requestUnits = profileResult.requestUnits;

      // Store in database
      const accountMetrics = await this.storeAccountMetrics(transformedData);

      // Log successful scraping
      if (sessionId) {
        await this.logScrapingEvent(sessionId, accountId, 'INFO', 
          `Successfully scraped account ${accountInfo.username}`, {
            requestUnits: profileResult.requestUnits,
            duration: Date.now() - startTime,
            followersCount: profileResult.data.follower_count,
            postsCount: profileResult.data.media_count
          });
      }

      return {
        success: true,
        data: accountMetrics,
        requestUnits: profileResult.requestUnits,
        duration: Date.now() - startTime,
        metrics: {
          accountsProcessed: 1,
          accountsSuccessful: 1,
          accountsFailed: 0,
          accountsSkipped: 0,
          totalRequestUnits: profileResult.requestUnits,
          totalCost: profileResult.requestUnits * 0.001,
          averageProcessingTime: Date.now() - startTime,
          successRate: 100,
          errorRate: 0,
          rateLimitHits: 0,
          retryCount: 0
        }
      };
    } catch (error: any) {
      // Log error
      if (sessionId) {
        await this.logScrapingEvent(sessionId, accountId, 'ERROR', 
          `Failed to scrape account: ${error.message}`, { error: error.message });
      }

      return {
        success: false,
        error: {
          type: 'UNKNOWN_ERROR',
          message: error.message || 'Unknown scraping error',
          isRetryable: false,
          originalError: error
        },
        requestUnits: 0,
        duration: Date.now() - startTime,
        metrics: {
          accountsProcessed: 1,
          accountsSuccessful: 0,
          accountsFailed: 1,
          accountsSkipped: 0,
          totalRequestUnits: 0,
          totalCost: 0,
          averageProcessingTime: Date.now() - startTime,
          successRate: 0,
          errorRate: 100,
          rateLimitHits: 0,
          retryCount: 0
        }
      };
    }
  }

  /**
   * Start a bulk scraping session
   */
  async startScrapingSession(request: ScrapingSessionRequest): Promise<{ sessionId: string; message: string }> {
    try {
      if (!this.db) await this.initializeDatabase();

      // Create session record
      const sessionId = await this.createScrapingSession(request);

      // Log session start
      await this.logScrapingEvent(sessionId, null, 'INFO', 
        `Starting scraping session for ${request.accountIds.length} accounts`, {
          sessionType: request.sessionType,
          accountCount: request.accountIds.length,
          config: request.config
        });

      // Start processing accounts in background
      this.processScrapingSession(sessionId, request).catch(error => {
        console.error(`Background session processing error:`, error);
        this.logScrapingEvent(sessionId, null, 'ERROR', 
          `Session processing failed: ${error.message}`, { error: error.message });
      });

      return {
        sessionId,
        message: `Scraping session started for ${request.accountIds.length} accounts`
      };
    } catch (error: any) {
      throw new Error(`Failed to start scraping session: ${error.message}`);
    }
  }

  /**
   * Get scraping session information
   */
  async getScrapingSession(sessionId: string): Promise<ScrapingSessionInfo | null> {
    try {
      if (!this.db) await this.initializeDatabase();

      const result = await this.db.query(`
        SELECT 
          id, session_type, status, total_accounts, completed_accounts,
          failed_accounts, skipped_accounts, progress, start_time, end_time,
          estimated_completion, total_request_units, estimated_cost,
          error_count, rate_limit_count, last_error, triggered_by,
          trigger_source, created_at, updated_at
        FROM scraping_sessions
        WHERE id = $1
      `, [sessionId]);

      if (!result?.rows?.[0]) {
        return null;
      }

      const session = result.rows[0];
      return {
        id: session.id,
        sessionType: session.session_type,
        status: session.status,
        totalAccounts: session.total_accounts,
        completedAccounts: session.completed_accounts,
        failedAccounts: session.failed_accounts,
        skippedAccounts: session.skipped_accounts,
        progress: session.progress,
        startTime: session.start_time,
        endTime: session.end_time,
        estimatedCompletion: session.estimated_completion,
        totalRequestUnits: session.total_request_units,
        estimatedCost: parseFloat(session.estimated_cost || '0'),
        errorCount: session.error_count,
        rateLimitCount: session.rate_limit_count,
        lastError: session.last_error,
        triggeredBy: session.triggered_by,
        triggerSource: session.trigger_source,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      };
    } catch (error) {
      console.error('Error getting scraping session:', error);
      return null;
    }
  }

  /**
   * Test HikerAPI connection and balance
   */
  async testConnection(): Promise<{ success: boolean; balance?: any; error?: string }> {
    try {
      const balanceResult = await this.hikerClient.getBalance();
      
      if (balanceResult.success && balanceResult.data) {
        return {
          success: true,
          balance: balanceResult.data
        };
      } else {
        return {
          success: false,
          error: balanceResult.error?.message || 'Connection test failed'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getAccountInfo(accountId: number): Promise<{ id: number; username: string; status: string } | null> {
    try {
      const result = await this.db.query(`
        SELECT id, instagram_username as username, status
        FROM ig_accounts
        WHERE id = $1
      `, [accountId]);

      return result?.rows?.[0] || null;
    } catch (error) {
      console.error('Error getting account info:', error);
      return null;
    }
  }

  private async getLatestAccountMetrics(accountId: number): Promise<AccountMetrics | null> {
    try {
      const result = await this.db.query(`
        SELECT * FROM account_metrics
        WHERE account_id = $1
        ORDER BY scraped_at DESC
        LIMIT 1
      `, [accountId]);

      return result?.rows?.[0] || null;
    } catch (error) {
      console.error('Error getting latest account metrics:', error);
      return null;
    }
  }

  private async storeAccountMetrics(data: Omit<AccountMetrics, 'id' | 'createdAt' | 'updatedAt'>): Promise<AccountMetrics> {
    const query = `
      INSERT INTO account_metrics (
        account_id, instagram_user_id, username, display_name, biography,
        profile_picture_url, profile_picture_url_hd, external_url,
        followers_count, following_count, posts_count, highlight_reel_count,
        is_verified, is_private, is_business_account, business_category,
        business_email, business_phone_number, average_likes, average_comments,
        engagement_rate, reach_rate, impressions, profile_visits,
        recent_posts_count, stories_posted_24h, reels_count, has_active_stories,
        last_post_date, last_active_date, data_quality, scraping_duration,
        request_units, scraping_status, error_message, scraped_at,
        scraping_session_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38, $38
      ) RETURNING *
    `;

    const values = [
      data.accountId, data.instagramUserId, data.username, data.displayName, data.biography,
      data.profilePictureUrl, data.profilePictureUrlHd, data.externalUrl,
      data.followersCount, data.followingCount, data.postsCount, data.highlightReelCount,
      data.isVerified, data.isPrivate, data.isBusinessAccount, data.businessCategory,
      data.businessEmail, data.businessPhoneNumber, data.averageLikes, data.averageComments,
      data.engagementRate, data.reachRate, data.impressions, data.profileVisits,
      data.recentPostsCount, data.storiesPosted24h, data.reelsCount, data.hasActiveStories,
      data.lastPostDate, data.lastActiveDate, data.dataQuality, data.scrapingDuration,
      data.requestUnits, data.scrapingStatus, data.errorMessage, data.scrapedAt,
      data.scrapingSessionId, new Date()
    ];

    const result = await this.db.query(query, values);
    return result.rows[0];
  }

  private async createScrapingSession(request: ScrapingSessionRequest): Promise<string> {
    const sessionId = crypto.randomUUID();
    const now = new Date();

    const query = `
      INSERT INTO scraping_sessions (
        id, session_type, status, total_accounts, completed_accounts,
        failed_accounts, skipped_accounts, progress, estimated_completion,
        total_request_units, estimated_cost, error_count, triggered_by,
        trigger_source, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15
      )
    `;

    // Rough cost estimation
    const estimatedUnitsPerAccount = 2; // Basic profile scraping
    const totalEstimatedUnits = estimatedUnitsPerAccount * request.accountIds.length;
    const estimatedCost = totalEstimatedUnits * 0.001;

    // Estimate completion time (10 seconds per account)
    const estimatedDuration = request.accountIds.length * 10000;
    const estimatedCompletion = new Date(now.getTime() + estimatedDuration);

    const values = [
      sessionId,
      request.sessionType,
      'PENDING',
      request.accountIds.length,
      0, // completed_accounts
      0, // failed_accounts
      0, // skipped_accounts
      0, // progress
      estimatedCompletion,
      0, // total_request_units (updated as scraping progresses)
      estimatedCost,
      0, // error_count
      'system', // triggered_by
      'API', // trigger_source
      now
    ];

    await this.db.query(query, values);
    return sessionId;
  }

  private async processScrapingSession(sessionId: string, request: ScrapingSessionRequest): Promise<void> {
    try {
      // Update session status to RUNNING
      await this.updateSessionStatus(sessionId, 'RUNNING', { start_time: new Date() });

      let completedCount = 0;
      let failedCount = 0;
      let totalRequestUnits = 0;
      let totalCost = 0;

      for (let i = 0; i < request.accountIds.length; i++) {
        const accountId = request.accountIds[i];
        
        try {
          // Scrape individual account
          const result = await this.scrapeAccount(accountId, request.config, sessionId);
          
          if (result.success) {
            completedCount++;
          } else {
            failedCount++;
          }
          
          totalRequestUnits += result.requestUnits;
          totalCost += result.requestUnits * 0.001;

          // Update session progress
          const progress = Math.round(((i + 1) / request.accountIds.length) * 100);
          await this.updateSessionProgress(sessionId, {
            progress,
            completed_accounts: completedCount,
            failed_accounts: failedCount,
            total_request_units: totalRequestUnits,
            estimated_cost: totalCost
          });

          // Small delay between requests for rate limiting
          if (i < request.accountIds.length - 1) {
            await this.sleep(1000);
          }
        } catch (error: any) {
          console.error(`Error scraping account ${accountId}:`, error);
          failedCount++;
          await this.logScrapingEvent(sessionId, accountId, 'ERROR', 
            `Account scraping failed: ${error.message}`, { error: error.message });
        }
      }

      // Complete session
      await this.updateSessionStatus(sessionId, 'COMPLETED', {
        end_time: new Date(),
        progress: 100,
        completed_accounts: completedCount,
        failed_accounts: failedCount,
        total_request_units: totalRequestUnits,
        estimated_cost: totalCost
      });

      await this.logScrapingEvent(sessionId, null, 'SUCCESS', 
        `Session completed: ${completedCount} successful, ${failedCount} failed`, {
          totalAccounts: request.accountIds.length,
          completedCount,
          failedCount,
          totalRequestUnits,
          totalCost
        });

    } catch (error: any) {
      console.error('Session processing error:', error);
      await this.updateSessionStatus(sessionId, 'FAILED', {
        end_time: new Date(),
        last_error: error.message
      });
    }
  }

  private async updateSessionStatus(sessionId: string, status: string, updates: any = {}): Promise<void> {
    const setFields = Object.keys(updates).map((key, index) => `${key} = $${index + 3}`).join(', ');
    const query = `
      UPDATE scraping_sessions 
      SET status = $1, updated_at = $2${setFields ? ', ' + setFields : ''}
      WHERE id = $1
    `;
    
    const values = [sessionId, new Date(), ...Object.values(updates)];
    await this.db.query(query, values);
  }

  private async updateSessionProgress(sessionId: string, progress: any): Promise<void> {
    const query = `
      UPDATE scraping_sessions
      SET progress = $2, completed_accounts = $3, failed_accounts = $4,
          total_request_units = $5, estimated_cost = $6, updated_at = $7
      WHERE id = $1
    `;
    
    await this.db.query(query, [
      sessionId,
      progress.progress,
      progress.completed_accounts,
      progress.failed_accounts,
      progress.total_request_units,
      progress.estimated_cost,
      new Date()
    ]);
  }

  private async logScrapingEvent(
    sessionId: string, 
    accountId: number | null, 
    level: string, 
    message: string, 
    details: any = {}
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO scraping_logs (
          id, session_id, account_id, timestamp, level, message, source,
          details, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $3
        )
      `;
      
      await this.db.query(query, [
        sessionId,
        accountId,
        new Date(),
        level,
        message,
        'SESSION_MANAGER',
        JSON.stringify(details)
      ]);
    } catch (error) {
      // Don't throw on logging errors
      console.error('Error logging scraping event:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== PUBLIC UTILITY METHODS =====

  public async getDashboardStats(): Promise<DashboardStats> {
    if (!this.db) await this.initializeDatabase();

    try {
      // Get total accounts count
      const totalAccountsResult = await this.db.query('SELECT COUNT(*) as count FROM ig_accounts');
      const totalAccounts = parseInt(totalAccountsResult?.rows?.[0]?.count || '0');

      // Get scraped accounts count
      const scrapedAccountsResult = await this.db.query(
        'SELECT COUNT(DISTINCT account_id) as count FROM account_metrics'
      );
      const scrapedAccounts = parseInt(scrapedAccountsResult?.rows?.[0]?.count || '0');

      // Get active sessions count
      const activeSessionsResult = await this.db.query(`
        SELECT COUNT(*) as count FROM scraping_sessions 
        WHERE status IN ('PENDING', 'INITIALIZING', 'RUNNING')
      `);
      const activeSessions = parseInt(activeSessionsResult?.rows?.[0]?.count || '0');

      // Get monthly usage stats
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const budgetResult = await this.db.query(`
        SELECT 
          COALESCE(SUM(total_request_units), 0) as total_units,
          COALESCE(SUM(estimated_cost), 0) as total_cost
        FROM scraping_sessions
        WHERE created_at >= $1
      `, [monthStart]);

      const totalRequestUnits = parseInt(budgetResult?.rows?.[0]?.total_units || '0');
      const usedBudget = parseFloat(budgetResult?.rows?.[0]?.total_cost || '0');
      const monthlyBudget = 100.00; // Configurable

      return {
        totalAccounts,
        scrapedAccounts,
        activeSessions,
        totalRequestUnits,
        monthlyBudget,
        usedBudget
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        totalAccounts: 0,
        scrapedAccounts: 0,
        activeSessions: 0,
        totalRequestUnits: 0,
        monthlyBudget: 100.00,
        usedBudget: 0
      };
    }
  }

  public getHikerClient(): HikerAPIClient {
    return this.hikerClient;
  }
}