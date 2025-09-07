// Scraping System TypeScript type definitions
// Integrated with BoutiquePortal Instagram management system

// Core Scraping Result Types
export interface ScrapingResult<T> {
  success: boolean;
  data?: T;
  error?: ScrapingError;
  requestUnits: number;
  duration: number;
  metrics: ScrapingMetrics;
}

export interface ScrapingError {
  type: ScrapingErrorType;
  message: string;
  isRetryable: boolean;
  retryAfter?: number;
  details?: any;
  originalError?: any;
}

export interface ScrapingMetrics {
  accountsProcessed: number;
  accountsSuccessful: number;
  accountsFailed: number;
  accountsSkipped: number;
  totalRequestUnits: number;
  totalCost: number;
  averageProcessingTime: number;
  successRate: number;
  errorRate: number;
  rateLimitHits: number;
  retryCount: number;
}

// Rate Limiting Types
export interface RateLimitInfo {
  requestsPerSecond: number;
  currentSecondUsage: number;
  currentHourUsage: number;
  currentDayUsage: number;
  resetTimes: {
    nextSecond: Date;
    nextHour: Date;
    nextDay: Date;
  };
  isLimited: boolean;
  retryAfter?: number;
}

// Configuration Types
export interface ScrapingConfig {
  // Profile Settings
  includeBasicProfile: boolean;
  includeDetailedProfile: boolean;
  includeBusinessInfo: boolean;
  
  // Content Settings
  includeRecentMedia: boolean;
  maxMediaToFetch: number;
  recentMediaDays: number;
  includeStories: boolean;
  includeHighlights: boolean;
  
  // Social Network Settings
  includeFollowers: boolean;
  maxFollowersToFetch: number;
  includeFollowing: boolean;
  maxFollowingToFetch: number;
  
  // Audience Analysis
  includeAudienceInsights: boolean;
  includeEngagementMetrics: boolean;
  calculateGrowthMetrics: boolean;
  
  // Performance Settings
  batchSize: number;
  delayBetweenRequests: number;
  maxConcurrentRequests: number;
  
  // Quality Control
  validateData: boolean;
  skipInvalidAccounts: boolean;
  retryFailedAccounts: boolean;
  maxRetryAttempts: number;
  
  // Cost Control
  budgetLimitPerSession: number;
  maxRequestUnitsPerAccount: number;
  priorityLevel: 'LOW' | 'NORMAL' | 'HIGH';
}

// Session Management Types
export interface ScrapingSessionRequest {
  accountIds: number[];
  sessionType: ScrapingSessionType;
  config: ScrapingConfig;
  scheduledFor?: Date;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  tags?: string[];
  notes?: string;
  budgetLimit?: number;
}

export interface ScrapingSessionInfo {
  id: string;
  sessionType: ScrapingSessionType;
  status: ScrapingSessionStatus;
  totalAccounts: number;
  completedAccounts: number;
  failedAccounts: number;
  skippedAccounts: number;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
  totalRequestUnits: number;
  estimatedCost: number;
  errorCount: number;
  rateLimitCount: number;
  lastError?: string;
  triggeredBy?: string;
  triggerSource: TriggerSource;
  createdAt: Date;
  updatedAt: Date;
}

// Account Metrics Types (Database Model)
export interface AccountMetrics {
  id: number;
  accountId: number;
  instagramUserId?: string;
  username: string;
  displayName?: string;
  biography?: string;
  profilePictureUrl?: string;
  profilePictureUrlHd?: string;
  externalUrl?: string;
  
  // Count Metrics
  followersCount: number;
  followingCount: number;
  postsCount: number;
  highlightReelCount?: number;
  
  // Account Status
  isVerified: boolean;
  isPrivate: boolean;
  isBusinessAccount: boolean;
  businessCategory?: string;
  businessEmail?: string;
  businessPhoneNumber?: string;
  
  // Engagement Metrics
  averageLikes?: number;
  averageComments?: number;
  engagementRate?: number;
  reachRate?: number;
  impressions?: number;
  profileVisits?: number;
  
  // Content Metrics
  recentPostsCount?: number;
  storiesPosted24h?: number;
  reelsCount?: number;
  hasActiveStories?: boolean;
  lastPostDate?: Date;
  lastActiveDate?: Date;
  
  // Quality & Performance
  dataQuality: number;
  scrapingDuration?: number;
  requestUnits: number;
  
  // Status & Metadata
  scrapingStatus: ScrapingStatus;
  errorMessage?: string;
  scrapedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  scrapingSessionId?: string;
}

// Data Transformation Types
export interface ProfileTransformResult {
  basicMetrics: Partial<AccountMetrics>;
  contentMetrics?: {
    averageLikes: number;
    averageComments: number;
    averageViews?: number;
    engagementRate: number;
    lastPostDate?: Date;
    postsLast30Days: number;
    contentTypes: {
      photo: number;
      video: number;
      carousel: number;
    };
    hashtagsUsed: string[];
    mentionsUsed: string[];
  };
  audienceMetrics?: {
    countryDistribution: any;
    ageDistribution: any;
    genderDistribution: any;
  };
  growthMetrics?: {
    followerGrowth: number;
    followingGrowth: number;
    mediaGrowth: number;
    growthRates: {
      follower: number;
      following: number;
      media: number;
    };
  };
  qualityScore: number;
  dataPoints: number;
  inconsistencies?: any;
}

// Cost Monitoring Types
export interface CostDecision {
  canProcess: boolean;
  estimatedCost: number;
  reason?: string;
  suggestedDelay?: number;
  alternativeStrategy?: string;
}

export interface CostStats {
  dailySpend: number;
  budgetRemaining: number;
  budgetUsedPercent: number;
  averageCostPerRequest: number;
  requestsToday: number;
  projectedDailySpend: number;
  costByPriority: {
    HIGH: number;
    NORMAL: number;
    LOW: number;
  };
}

// Enums (matching database schema)
export type ScrapingStatus = 
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'RATE_LIMITED'
  | 'ACCOUNT_PRIVATE'
  | 'ACCOUNT_NOT_FOUND'
  | 'INSUFFICIENT_BALANCE'
  | 'CANCELLED';

export type ScrapingSessionType = 
  | 'ACCOUNT_METRICS'
  | 'FOLLOWER_ANALYSIS'
  | 'CONTENT_ANALYSIS'
  | 'COMPETITOR_ANALYSIS'
  | 'HASHTAG_RESEARCH'
  | 'TREND_ANALYSIS'
  | 'BULK_UPDATE'
  | 'HEALTH_CHECK';

export type ScrapingSessionStatus = 
  | 'PENDING'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RATE_LIMITED';

export type ScrapingSource = 
  | 'HIKER_API_CLIENT'
  | 'ACCOUNT_SCRAPER'
  | 'FOLLOWER_SCRAPER'
  | 'CONTENT_SCRAPER'
  | 'RATE_LIMITER'
  | 'SESSION_MANAGER'
  | 'DATA_VALIDATOR'
  | 'COST_MONITOR';

export type ScrapingStep = 
  | 'INIT_SESSION'
  | 'VALIDATE_ACCOUNT'
  | 'FETCH_PROFILE'
  | 'FETCH_FOLLOWERS'
  | 'FETCH_FOLLOWING'
  | 'FETCH_MEDIA'
  | 'FETCH_STORIES'
  | 'FETCH_HIGHLIGHTS'
  | 'CALCULATE_METRICS'
  | 'VALIDATE_DATA'
  | 'STORE_RESULTS'
  | 'CLEANUP';

export type ScrapingErrorType = 
  | 'RATE_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_BALANCE'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_PRIVATE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'DATA_VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

export type TriggerSource = 
  | 'MANUAL'
  | 'SCHEDULED'
  | 'API'
  | 'WEBHOOK';

// Utility Types for API Responses
export interface DashboardStats {
  totalAccounts: number;
  scrapedAccounts: number;
  activeSessions: number;
  totalRequestUnits: number;
  monthlyBudget: number;
  usedBudget: number;
}

export interface AccountInfo {
  id: number;
  username: string;
  status: string;
  lastScraped: Date | null;
  scrapingStatus: ScrapingStatus;
}

export interface SessionInfo {
  id: string;
  sessionType: string;
  status: string;
  progress: number;
  accountCount: number;
  startTime?: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
  totalRequestUnits: number;
  estimatedCost: number;
  errorCount: number;
}

// Growth Analytics Types
export interface GrowthMetrics {
  accountId: number;
  username: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  followerGrowth: {
    absolute: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  engagementGrowth: {
    absolute: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  contentGrowth: {
    postsAdded: number;
    averageEngagement: number;
    topPerformingPost?: {
      mediaId: string;
      likes: number;
      comments: number;
      date: Date;
    };
  };
  dataPoints: Array<{
    date: Date;
    followers: number;
    following: number;
    posts: number;
    engagement: number;
  }>;
}