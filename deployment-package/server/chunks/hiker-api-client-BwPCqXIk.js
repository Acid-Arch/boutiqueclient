class HikerAPIClient {
  config;
  rateLimitInfo;
  lastRequestTime = 0;
  requestCount = { second: 0, hour: 0, day: 0 };
  resetTimes = { second: 0, hour: 0, day: 0 };
  constructor(config) {
    this.config = {
      apiKey: process.env.HIKER_API_KEY || "",
      baseUrl: process.env.HIKER_BASE_URL || "https://hikerapi.com",
      timeout: parseInt(process.env.HIKER_TIMEOUT || "30000"),
      rateLimit: parseInt(process.env.HIKER_RATE_LIMIT_PER_SECOND || "11"),
      retryAttempts: parseInt(process.env.HIKER_RETRY_ATTEMPTS || "3"),
      retryDelay: parseInt(process.env.HIKER_RETRY_DELAY || "5000"),
      budgetLimit: parseFloat(process.env.HIKER_BUDGET_DAILY || "10.00"),
      costPerUnit: parseFloat(process.env.HIKER_COST_PER_UNIT || "0.001"),
      alertThreshold: parseFloat(process.env.HIKER_ALERT_THRESHOLD || "0.8"),
      mockMode: process.env.HIKER_API_MOCK_MODE === "true",
      ...config
    };
    this.rateLimitInfo = {
      requestsPerSecond: this.config.rateLimit,
      currentSecondUsage: 0,
      currentHourUsage: 0,
      currentDayUsage: 0,
      resetTimes: {
        nextSecond: /* @__PURE__ */ new Date(),
        nextHour: /* @__PURE__ */ new Date(),
        nextDay: /* @__PURE__ */ new Date()
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
  async getUserProfile(username, options) {
    const startTime = Date.now();
    try {
      if (this.config.mockMode) {
        return this.getMockUserProfile(username, startTime);
      }
      const response = await this.makeRequest("/a2/user", {
        username,
        force: options?.force ? "on" : void 0
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
          rateLimitHits: scrapingError.type === "RATE_LIMIT_EXCEEDED" ? 1 : 0,
          retryCount: 0
        }
      };
    }
  }
  /**
   * Get basic user information (1 request unit)
   * Uses /v1/user/by/username endpoint for basic profile data
   */
  async getBasicProfile(username) {
    const startTime = Date.now();
    try {
      if (this.config.mockMode) {
        return this.getMockBasicProfile(username, startTime);
      }
      const response = await this.makeRequest("/v1/user/by/username", { username });
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
          rateLimitHits: scrapingError.type === "RATE_LIMIT_EXCEEDED" ? 1 : 0,
          retryCount: 0
        }
      };
    }
  }
  /**
   * Get account balance and usage information
   * Uses /sys/balance endpoint (typically free)
   */
  async getBalance() {
    const startTime = Date.now();
    try {
      if (this.config.mockMode) {
        return this.getMockBalance(startTime);
      }
      const response = await this.makeRequest("/sys/balance");
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
  async makeRequest(endpoint, params, retryCount = 0) {
    await this.enforceRateLimit();
    const url = new URL(endpoint, this.config.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== void 0 && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    const requestOptions = {
      method: "GET",
      headers: {
        "x-access-key": this.config.apiKey,
        "accept": "application/json",
        "user-agent": "BoutiquePortal-Scraper/1.0"
      },
      signal: AbortSignal.timeout(this.config.timeout)
    };
    try {
      this.updateRateLimitCounters();
      const response = await fetch(url.toString(), requestOptions);
      const data = await response.json();
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "60");
        this.rateLimitInfo.isLimited = true;
        this.rateLimitInfo.retryAfter = retryAfter;
        throw new Error(`Rate limit exceeded. Retry after ${retryAfter} seconds`);
      }
      if (response.status === 402) {
        throw new Error("Insufficient balance");
      }
      if (response.status === 404) {
        throw new Error("Account not found or private");
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data?.message || "Unknown error"}`);
      }
      const requestUnits = data.request_units || this.estimateRequestUnits(endpoint);
      return {
        success: true,
        data: data.response || data,
        requestUnits,
        requestId: data.request_id || `req_${Date.now()}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (error) {
      if (retryCount < this.config.retryAttempts && this.isRetryableError(error)) {
        const delay = this.calculateRetryDelay(retryCount);
        await this.sleep(delay);
        return this.makeRequest(endpoint, params, retryCount + 1);
      }
      throw error;
    }
  }
  async enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1e3 / this.config.rateLimit;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await this.sleep(waitTime);
    }
    this.lastRequestTime = Date.now();
  }
  updateRateLimitCounters() {
    const now = Date.now();
    if (now - this.resetTimes.second >= 1e3) {
      this.requestCount.second = 0;
      this.resetTimes.second = now;
      this.rateLimitInfo.resetTimes.nextSecond = new Date(now + 1e3);
    }
    if (now - this.resetTimes.hour >= 36e5) {
      this.requestCount.hour = 0;
      this.resetTimes.hour = now;
      this.rateLimitInfo.resetTimes.nextHour = new Date(now + 36e5);
    }
    if (now - this.resetTimes.day >= 864e5) {
      this.requestCount.day = 0;
      this.resetTimes.day = now;
      this.rateLimitInfo.resetTimes.nextDay = new Date(now + 864e5);
    }
    this.requestCount.second++;
    this.requestCount.hour++;
    this.requestCount.day++;
    this.rateLimitInfo.currentSecondUsage = this.requestCount.second;
    this.rateLimitInfo.currentHourUsage = this.requestCount.hour;
    this.rateLimitInfo.currentDayUsage = this.requestCount.day;
  }
  initializeRateLimitTracking() {
    const now = Date.now();
    this.resetTimes = {
      second: now,
      hour: now,
      day: now
    };
    this.rateLimitInfo.resetTimes = {
      nextSecond: new Date(now + 1e3),
      nextHour: new Date(now + 36e5),
      nextDay: new Date(now + 864e5)
    };
  }
  handleError(error) {
    if (error.message?.includes("Rate limit exceeded")) {
      return {
        type: "RATE_LIMIT_EXCEEDED",
        message: "HikerAPI rate limit exceeded",
        isRetryable: true,
        retryAfter: this.rateLimitInfo.retryAfter || 60,
        details: { rateLimitInfo: this.rateLimitInfo }
      };
    }
    if (error.message?.includes("Insufficient balance")) {
      return {
        type: "INSUFFICIENT_BALANCE",
        message: "Insufficient HikerAPI balance",
        isRetryable: false,
        details: { needsTopUp: true }
      };
    }
    if (error.message?.includes("not found") || error.message?.includes("private")) {
      return {
        type: "ACCOUNT_NOT_FOUND",
        message: "Instagram account not found or private",
        isRetryable: false
      };
    }
    if (error.name === "TimeoutError" || error.message?.includes("timeout")) {
      return {
        type: "TIMEOUT_ERROR",
        message: "Request timeout",
        isRetryable: true,
        retryAfter: 5
      };
    }
    return {
      type: "UNKNOWN_ERROR",
      message: error.message || "Unknown error occurred",
      isRetryable: false,
      originalError: error
    };
  }
  isRetryableError(error) {
    const retryableTypes = ["RATE_LIMIT_EXCEEDED", "TIMEOUT_ERROR", "NETWORK_ERROR"];
    const scrapingError = this.handleError(error);
    return retryableTypes.includes(scrapingError.type);
  }
  calculateRetryDelay(retryCount) {
    return Math.min(1e3 * Math.pow(2, retryCount), 3e4);
  }
  estimateRequestUnits(endpoint) {
    const unitMap = {
      "/a2/user": 2,
      "/v1/user/by/id": 1,
      "/v1/user/by/username": 1,
      "/v2/user/followers": 2,
      "/v2/user/following": 2,
      "/v2/user/medias": 1,
      "/sys/balance": 0
    };
    return unitMap[endpoint] || 1;
  }
  calculateCost(requestUnits) {
    return requestUnits * this.config.costPerUnit;
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  // ===== MOCK DATA METHODS =====
  getMockUserProfile(username, startTime) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockProfile = {
          user_id: `mock_${username}`,
          username,
          full_name: `Mock User ${username}`,
          biography: `This is a mock profile for ${username}`,
          profile_pic_url: "https://example.com/profile.jpg",
          profile_pic_url_hd: "https://example.com/profile_hd.jpg",
          external_url: "https://example.com",
          is_verified: Math.random() > 0.8,
          is_private: Math.random() > 0.7,
          is_business_account: Math.random() > 0.6,
          is_professional_account: Math.random() > 0.5,
          follower_count: Math.floor(Math.random() * 1e5) + 1e3,
          following_count: Math.floor(Math.random() * 2e3) + 100,
          media_count: Math.floor(Math.random() * 500) + 50,
          category: "Mock Category",
          business_category: "Technology",
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
      }, 500 + Math.random() * 1e3);
    });
  }
  getMockBasicProfile(username, startTime) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockUser = {
          user_id: `mock_${username}`,
          username,
          full_name: `Mock User ${username}`,
          biography: `Mock biography for ${username}`,
          profile_pic_url: "https://example.com/profile.jpg",
          is_verified: Math.random() > 0.8,
          is_private: Math.random() > 0.7,
          is_business_account: Math.random() > 0.6,
          follower_count: Math.floor(Math.random() * 1e5) + 1e3,
          following_count: Math.floor(Math.random() * 2e3) + 100,
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
  getMockBalance(startTime) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockBalance = {
          balance: 95.5,
          credits_remaining: 9550,
          daily_usage: 45,
          monthly_usage: 1250,
          plan_type: "Developer",
          reset_date: new Date(Date.now() + 864e5).toISOString()
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
  getRateLimitInfo() {
    return { ...this.rateLimitInfo };
  }
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  async testConnection() {
    try {
      const result = await this.getBalance();
      return result.success;
    } catch {
      return false;
    }
  }
}

export { HikerAPIClient as H };
//# sourceMappingURL=hiker-api-client-BwPCqXIk.js.map
