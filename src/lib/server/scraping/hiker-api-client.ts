/**
 * HikerAPI Client Service for SvelteKit Server
 * Integrated with BoutiquePortal database and environment configuration
 */

import type {
  HikerAPIConfig,
  HikerAPIResponse,
  HikerAPIUser,
  HikerAPIUserProfile,
  HikerAPIFollowersResponse,
  HikerAPIBalance
} from '$lib/types/hikerapi.types';

import type {
  ScrapingResult,
  ScrapingError,
  ScrapingErrorType,
  RateLimitInfo
} from '$lib/types/scraping.types';

export class HikerAPIClient {
  private config: HikerAPIConfig;
  private rateLimitInfo: RateLimitInfo;
  private lastRequestTime = 0;
  private requestCount = { second: 0, hour: 0, day: 0 };
  private resetTimes = { second: 0, hour: 0, day: 0 };

  constructor(config?: Partial<HikerAPIConfig>) {
    // Load configuration from environment variables
    this.config = {
      apiKey: process.env.HIKER_API_KEY || '',
      baseUrl: process.env.HIKER_BASE_URL || 'https://hikerapi.com',
      timeout: parseInt(process.env.HIKER_TIMEOUT || '30000'),
      rateLimit: parseInt(process.env.HIKER_RATE_LIMIT_PER_SECOND || '11'),
      retryAttempts: parseInt(process.env.HIKER_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.HIKER_RETRY_DELAY || '5000'),
      budgetLimit: parseFloat(process.env.HIKER_BUDGET_DAILY || '10.00'),
      costPerUnit: parseFloat(process.env.HIKER_COST_PER_UNIT || '0.001'),
      alertThreshold: parseFloat(process.env.HIKER_ALERT_THRESHOLD || '0.8'),
      mockMode: process.env.HIKER_API_MOCK_MODE === 'true',
      ...config
    };

    this.rateLimitInfo = {
      requestsPerSecond: this.config.rateLimit,
      currentSecondUsage: 0,
      currentHourUsage: 0,
      currentDayUsage: 0,
      resetTimes: {
        nextSecond: new Date(),
        nextHour: new Date(),
        nextDay: new Date()
      },
      isLimited: false
    };

    this.initializeRateLimitTracking();
  }

  // ===== PUBLIC API METHODS =====

  /**
   * Get user profile data with enhanced information (2 request units)
   * Uses /a2/user endpoint for comprehensive profile data
   */
  async getUserProfile(username: string, options?: { force?: boolean }): Promise<ScrapingResult<HikerAPIUserProfile>> {
    const startTime = Date.now();
    
    try {
      // Check if we're in mock mode
      if (this.config.mockMode) {
        return this.getMockUserProfile(username, startTime);
      }

      const response = await this.makeRequest<HikerAPIUserProfile>('/a2/user', {
        username,
        force: options?.force ? 'on' : undefined
      });

      return {
        success: true,
        data: response.data,
        requestUnits: 2,
        duration: Date.now() - startTime,
        metrics: {
          accountsProcessed: 1,
          accountsSuccessful: 1,
          accountsFailed: 0,
          accountsSkipped: 0,
          totalRequestUnits: 2,
          totalCost: this.calculateCost(2),
          averageProcessingTime: Date.now() - startTime,
          successRate: 100,
          errorRate: 0,
          rateLimitHits: 0,
          retryCount: 0
        }
      };
    } catch (error) {
      const scrapingError = this.handleError(error);
      
      return {
        success: false,
        error: scrapingError,
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
          rateLimitHits: scrapingError.type === 'RATE_LIMIT_EXCEEDED' ? 1 : 0,
          retryCount: 0
        }
      };
    }
  }

  /**
   * Get basic user information (1 request unit)
   * Uses /v1/user/by/username endpoint for basic profile data
   */
  async getBasicProfile(username: string): Promise<ScrapingResult<HikerAPIUser>> {
    const startTime = Date.now();
    
    try {
      if (this.config.mockMode) {
        return this.getMockBasicProfile(username, startTime);
      }

      const response = await this.makeRequest<HikerAPIUser>('/v1/user/by/username', { username });

      return {
        success: true,
        data: response.data,
        requestUnits: 1,
        duration: Date.now() - startTime,
        metrics: {
          accountsProcessed: 1,
          accountsSuccessful: 1,
          accountsFailed: 0,
          accountsSkipped: 0,
          totalRequestUnits: 1,
          totalCost: this.calculateCost(1),
          averageProcessingTime: Date.now() - startTime,
          successRate: 100,
          errorRate: 0,
          rateLimitHits: 0,
          retryCount: 0
        }
      };
    } catch (error) {
      const scrapingError = this.handleError(error);
      
      return {
        success: false,
        error: scrapingError,
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
          rateLimitHits: scrapingError.type === 'RATE_LIMIT_EXCEEDED' ? 1 : 0,
          retryCount: 0
        }
      };
    }
  }

  /**
   * Get account balance and usage information
   * Uses /sys/balance endpoint (typically free)
   */
  async getBalance(): Promise<ScrapingResult<HikerAPIBalance>> {
    const startTime = Date.now();
    
    try {
      if (this.config.mockMode) {
        return this.getMockBalance(startTime);
      }

      const response = await this.makeRequest<HikerAPIBalance>('/sys/balance');
      
      return {
        success: true,
        data: response.data,
        requestUnits: 0,
        duration: Date.now() - startTime,
        metrics: {
          accountsProcessed: 0,
          accountsSuccessful: 0,
          accountsFailed: 0,
          accountsSkipped: 0,
          totalRequestUnits: 0,
          totalCost: 0,
          averageProcessingTime: Date.now() - startTime,
          successRate: 100,
          errorRate: 0,
          rateLimitHits: 0,
          retryCount: 0
        }
      };
    } catch (error) {
      const scrapingError = this.handleError(error);
      
      return {
        success: false,
        error: scrapingError,
        requestUnits: 0,
        duration: Date.now() - startTime,
        metrics: {
          accountsProcessed: 0,
          accountsSuccessful: 0,
          accountsFailed: 0,
          accountsSkipped: 1,
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

  // ===== PRIVATE HELPER METHODS =====

  private async makeRequest<T>(
    endpoint: string, 
    params?: Record<string, any>, 
    retryCount = 0
  ): Promise<HikerAPIResponse<T>> {
    // Wait for rate limit if necessary
    await this.enforceRateLimit();
    
    const url = new URL(endpoint, this.config.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const requestOptions: RequestInit = {
      method: 'GET',
      headers: {
        'x-access-key': this.config.apiKey,
        'accept': 'application/json',
        'user-agent': 'BoutiquePortal-Scraper/1.0'
      },
      signal: AbortSignal.timeout(this.config.timeout)
    };

    try {
      this.updateRateLimitCounters();
      
      const response = await fetch(url.toString(), requestOptions);
      const data = await response.json();

      // Handle different response scenarios
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60');
        this.rateLimitInfo.isLimited = true;
        this.rateLimitInfo.retryAfter = retryAfter;
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
      }

      if (response.status === 402) {
        throw new Error('Insufficient balance');
      }

      if (response.status === 404) {
        throw new Error('Account not found or private');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data?.message || 'Unknown error'}`);
      }

      // Extract request units from response
      const requestUnits = data.request_units || this.estimateRequestUnits(endpoint);

      return {
        success: true,
        data: data.response || data,
        requestUnits,
        requestId: data.request_id || `req_${Date.now()}`,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      // Retry logic
      if (retryCount < this.config.retryAttempts && this.isRetryableError(error)) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.makeRequest<T>(endpoint, params, retryCount + 1);
      }

      throw error;
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.config.rateLimit; // milliseconds between requests

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  private updateRateLimitCounters(): void {
    const now = Date.now();
    
    // Reset counters based on time windows
    if (now - this.resetTimes.second >= 1000) {
      this.requestCount.second = 0;
      this.resetTimes.second = now;
      this.rateLimitInfo.resetTimes.nextSecond = new Date(now + 1000);
    }
    
    if (now - this.resetTimes.hour >= 3600000) {
      this.requestCount.hour = 0;
      this.resetTimes.hour = now;
      this.rateLimitInfo.resetTimes.nextHour = new Date(now + 3600000);
    }
    
    if (now - this.resetTimes.day >= 86400000) {
      this.requestCount.day = 0;
      this.resetTimes.day = now;
      this.rateLimitInfo.resetTimes.nextDay = new Date(now + 86400000);
    }

    // Increment counters
    this.requestCount.second++;
    this.requestCount.hour++;
    this.requestCount.day++;

    // Update rate limit info
    this.rateLimitInfo.currentSecondUsage = this.requestCount.second;
    this.rateLimitInfo.currentHourUsage = this.requestCount.hour;
    this.rateLimitInfo.currentDayUsage = this.requestCount.day;
  }

  private initializeRateLimitTracking(): void {
    const now = Date.now();
    this.resetTimes = {
      second: now,
      hour: now,
      day: now
    };
    
    this.rateLimitInfo.resetTimes = {
      nextSecond: new Date(now + 1000),
      nextHour: new Date(now + 3600000),
      nextDay: new Date(now + 86400000)
    };
  }

  private handleError(error: any): ScrapingError {
    if (error.message?.includes('Rate limit exceeded')) {
      return {
        type: 'RATE_LIMIT_EXCEEDED',
        message: 'HikerAPI rate limit exceeded',
        isRetryable: true,
        retryAfter: this.rateLimitInfo.retryAfter || 60,
        details: { rateLimitInfo: this.rateLimitInfo }
      };
    }

    if (error.message?.includes('Insufficient balance')) {
      return {
        type: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient HikerAPI balance',
        isRetryable: false,
        details: { needsTopUp: true }
      };
    }

    if (error.message?.includes('not found') || error.message?.includes('private')) {
      return {
        type: 'ACCOUNT_NOT_FOUND',
        message: 'Instagram account not found or private',
        isRetryable: false
      };
    }

    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return {
        type: 'TIMEOUT_ERROR',
        message: 'Request timeout',
        isRetryable: true,
        retryAfter: 5
      };
    }

    return {
      type: 'UNKNOWN_ERROR',
      message: error.message || 'Unknown error occurred',
      isRetryable: false,
      originalError: error
    };
  }

  private isRetryableError(error: any): boolean {
    const retryableTypes = ['RATE_LIMIT_EXCEEDED', 'TIMEOUT_ERROR', 'NETWORK_ERROR'];
    const scrapingError = this.handleError(error);
    return retryableTypes.includes(scrapingError.type);
  }

  private calculateRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
  }

  private estimateRequestUnits(endpoint: string): number {
    const unitMap: Record<string, number> = {
      '/a2/user': 2,
      '/v1/user/by/id': 1,
      '/v1/user/by/username': 1,
      '/v2/user/followers': 2,
      '/v2/user/following': 2,
      '/v2/user/medias': 1,
      '/sys/balance': 0
    };

    return unitMap[endpoint] || 1;
  }

  private calculateCost(requestUnits: number): number {
    return requestUnits * this.config.costPerUnit;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== MOCK DATA METHODS =====

  private getMockUserProfile(username: string, startTime: number): Promise<ScrapingResult<HikerAPIUserProfile>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockProfile: HikerAPIUserProfile = {
          user_id: `mock_${username}`,
          username,
          full_name: `Mock User ${username}`,
          biography: `This is a mock profile for ${username}`,
          profile_pic_url: 'https://example.com/profile.jpg',
          profile_pic_url_hd: 'https://example.com/profile_hd.jpg',
          external_url: 'https://example.com',
          is_verified: Math.random() > 0.8,
          is_private: Math.random() > 0.7,
          is_business_account: Math.random() > 0.6,
          is_professional_account: Math.random() > 0.5,
          follower_count: Math.floor(Math.random() * 100000) + 1000,
          following_count: Math.floor(Math.random() * 2000) + 100,
          media_count: Math.floor(Math.random() * 500) + 50,
          category: 'Mock Category',
          business_category: 'Technology',
          highlight_reel_count: Math.floor(Math.random() * 10)
        };

        resolve({
          success: true,
          data: mockProfile,
          requestUnits: 2,
          duration: Date.now() - startTime,
          metrics: {
            accountsProcessed: 1,
            accountsSuccessful: 1,
            accountsFailed: 0,
            accountsSkipped: 0,
            totalRequestUnits: 2,
            totalCost: this.calculateCost(2),
            averageProcessingTime: Date.now() - startTime,
            successRate: 100,
            errorRate: 0,
            rateLimitHits: 0,
            retryCount: 0
          }
        });
      }, 500 + Math.random() * 1000); // Random delay 500-1500ms
    });
  }

  private getMockBasicProfile(username: string, startTime: number): Promise<ScrapingResult<HikerAPIUser>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUser: HikerAPIUser = {
          user_id: `mock_${username}`,
          username,
          full_name: `Mock User ${username}`,
          biography: `Mock biography for ${username}`,
          profile_pic_url: 'https://example.com/profile.jpg',
          is_verified: Math.random() > 0.8,
          is_private: Math.random() > 0.7,
          is_business_account: Math.random() > 0.6,
          follower_count: Math.floor(Math.random() * 100000) + 1000,
          following_count: Math.floor(Math.random() * 2000) + 100,
          media_count: Math.floor(Math.random() * 500) + 50
        };

        resolve({
          success: true,
          data: mockUser,
          requestUnits: 1,
          duration: Date.now() - startTime,
          metrics: {
            accountsProcessed: 1,
            accountsSuccessful: 1,
            accountsFailed: 0,
            accountsSkipped: 0,
            totalRequestUnits: 1,
            totalCost: this.calculateCost(1),
            averageProcessingTime: Date.now() - startTime,
            successRate: 100,
            errorRate: 0,
            rateLimitHits: 0,
            retryCount: 0
          }
        });
      }, 300 + Math.random() * 500);
    });
  }

  private getMockBalance(startTime: number): Promise<ScrapingResult<HikerAPIBalance>> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockBalance: HikerAPIBalance = {
          balance: 95.50,
          credits_remaining: 9550,
          daily_usage: 45,
          monthly_usage: 1250,
          plan_type: 'Developer',
          reset_date: new Date(Date.now() + 86400000).toISOString()
        };

        resolve({
          success: true,
          data: mockBalance,
          requestUnits: 0,
          duration: Date.now() - startTime,
          metrics: {
            accountsProcessed: 0,
            accountsSuccessful: 0,
            accountsFailed: 0,
            accountsSkipped: 0,
            totalRequestUnits: 0,
            totalCost: 0,
            averageProcessingTime: Date.now() - startTime,
            successRate: 100,
            errorRate: 0,
            rateLimitHits: 0,
            retryCount: 0
          }
        });
      }, 200);
    });
  }

  // ===== PUBLIC UTILITY METHODS =====

  public getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  public updateConfig(newConfig: Partial<HikerAPIConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.getBalance();
      return result.success;
    } catch {
      return false;
    }
  }
}