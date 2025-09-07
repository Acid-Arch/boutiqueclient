/**
 * Scraping System Type Definitions
 * Core interfaces for Instagram scraping ML integration and session management
 * Phase 4C Neural Network Integration
 */

// ============================================================================
// SESSION AND ACCOUNT DATA TYPES
// ============================================================================

export interface SessionData {
	id: string;
	duration: number; // Duration in seconds
	requestCount: number;
	proxyType: 'free' | 'premium' | 'residential';
	deviceType: 'mobile' | 'desktop' | 'tablet';
	geolocation: {
		risk: number; // 0-1 risk score
		country?: string;
		region?: string;
	};
	sessionType: 'LOGIN' | 'WARMUP' | 'COMBINED' | 'SCRAPING';
	startTime: Date;
	endTime?: Date;
	success: boolean;
	errorCount: number;
	targetAccounts?: string[];
	scraped_data_count?: number;
}

export interface AccountMetrics {
	username: string;
	followers: number;
	following: number;
	posts: number;
	engagementRate: number;
	verified: boolean;
	private: boolean;
	lastLoginHours: number; // Hours since last login
	profileImageUrl?: string;
	bio?: string;
	externalUrl?: string;
	businessCategory?: string;
	isBusinessAccount?: boolean;
	// Additional ML-relevant metrics
	averageLikes?: number;
	averageComments?: number;
	postFrequency?: number; // Posts per week
	storyFrequency?: number; // Stories per week
	accountAge?: number; // Days since account creation
	suspiciousActivity?: boolean;
}

export interface ErrorPattern {
	id: string;
	sessionId: string;
	accountId: string;
	errorType: 'RATE_LIMIT' | 'AUTHENTICATION' | 'NETWORK' | 'PARSING' | 'CAPTCHA' | 'BLOCK';
	severity: number; // 0-1 severity score
	frequency: number; // How often this error occurs
	resolution_time: number; // Time to resolve in seconds
	success_rate: number; // Success rate after this error pattern
	account_impact: number; // Impact on account (0-1)
	session_duration: number; // Session duration when error occurred
	request_rate: number; // Requests per minute when error occurred
	geographic_risk: number; // Geographic risk factor
	device_consistency: number; // Device consistency score
	timing_pattern: number; // Timing pattern analysis score
	proxy_stability: number; // Proxy stability score
	behavioral_score: number; // Behavioral analysis score
	timestamp: Date;
	errorMessage: string;
	stackTrace?: string;
	contextData?: Record<string, any>;
}

// ============================================================================
// SCRAPING SESSION TYPES
// ============================================================================

export interface ScrapingSession {
	id: string;
	sessionType: 'PROFILE_SCRAPING' | 'FOLLOWER_SCRAPING' | 'POST_SCRAPING' | 'STORY_SCRAPING';
	status: 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
	progress: number; // 0-100 percentage
	targetUsername: string;
	targetUserId?: string;
	scrapingObjectives: ScrapingObjective[];
	totalAccounts?: number;
	processedAccounts: number;
	errorCount: number;
	startTime: Date;
	endTime?: Date;
	estimatedCompletion?: Date;
	triggerSource: 'MANUAL' | 'SCHEDULED' | 'API' | 'BULK_OPERATION';
	configuration: ScrapingConfiguration;
	results?: ScrapingResults;
	costEstimate?: number; // HikerAPI cost estimate
	actualCost?: number; // Actual HikerAPI cost
}

export interface ScrapingObjective {
	type: 'PROFILE_INFO' | 'FOLLOWERS_LIST' | 'FOLLOWING_LIST' | 'POSTS_RECENT' | 'POSTS_ALL' | 'STORIES';
	enabled: boolean;
	parameters?: Record<string, any>;
	priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
	maxItems?: number;
	includeMetrics?: boolean;
}

export interface ScrapingConfiguration {
	requestDelay: number; // Milliseconds between requests
	maxRetries: number;
	timeoutMs: number;
	useProxy: boolean;
	respectRateLimits: boolean;
	includeStories: boolean;
	includeHighlights: boolean;
	maxFollowersToScrape?: number;
	maxPostsToScrape?: number;
	filterOptions?: {
		minFollowers?: number;
		maxFollowers?: number;
		verifiedOnly?: boolean;
		businessOnly?: boolean;
	};
}

export interface ScrapingResults {
	profileData?: InstagramProfileData;
	followers?: InstagramUserBasic[];
	following?: InstagramUserBasic[];
	posts?: InstagramPost[];
	stories?: InstagramStory[];
	totalDataPoints: number;
	scrapingDuration: number; // Seconds
	apiRequestsMade: number;
	costIncurred: number;
	qualityScore: number; // 0-1 data quality assessment
}

// ============================================================================
// INSTAGRAM DATA TYPES
// ============================================================================

export interface InstagramProfileData {
	id: string;
	username: string;
	fullName: string;
	biography: string;
	externalUrl?: string;
	followerCount: number;
	followingCount: number;
	postCount: number;
	isVerified: boolean;
	isPrivate: boolean;
	isBusinessAccount: boolean;
	businessCategory?: string;
	contactInfo?: {
		email?: string;
		phone?: string;
		address?: string;
	};
	profileImageUrl: string;
	highlights?: InstagramHighlight[];
	recentPosts?: InstagramPost[];
	scrapedAt: Date;
}

export interface InstagramUserBasic {
	id: string;
	username: string;
	fullName?: string;
	profileImageUrl: string;
	isVerified: boolean;
	isPrivate: boolean;
	followerCount?: number;
	isBusinessAccount?: boolean;
}

export interface InstagramPost {
	id: string;
	shortcode: string;
	type: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
	caption?: string;
	timestamp: Date;
	likeCount: number;
	commentCount: number;
	viewCount?: number; // For videos
	imageUrls: string[];
	videoUrl?: string;
	location?: {
		id: string;
		name: string;
		coordinates?: { lat: number; lng: number; };
	};
	hashtags: string[];
	mentions: string[];
	isSponsored: boolean;
	engagementRate?: number;
}

export interface InstagramStory {
	id: string;
	type: 'IMAGE' | 'VIDEO';
	timestamp: Date;
	expiresAt: Date;
	imageUrl?: string;
	videoUrl?: string;
	viewCount?: number;
	hasAudio?: boolean;
	duration?: number; // For videos, in seconds
}

export interface InstagramHighlight {
	id: string;
	title: string;
	coverImageUrl: string;
	storyCount: number;
	stories?: InstagramStory[];
}

// ============================================================================
// ML INTEGRATION TYPES
// ============================================================================

export interface MLFeatureVector {
	accountFeatures: number[]; // Normalized account metrics
	sessionFeatures: number[]; // Session-based features
	temporalFeatures: number[]; // Time-based pattern features
	environmentalFeatures: number[]; // External factors
	behavioralFeatures: number[]; // Behavioral patterns
}

export interface MLPredictionContext {
	sessionId: string;
	accountId: string;
	timestamp: Date;
	featureVector: MLFeatureVector;
	historicalPatterns: ErrorPattern[];
	environmentalFactors: {
		timeOfDay: number; // 0-23 hour
		dayOfWeek: number; // 0-6
		accountLoad: number; // Current system load
		proxyHealth: number; // Proxy health score
		networkLatency: number; // Network conditions
	};
}

export interface MLTrainingDataPoint {
	sessionId: string;
	context: MLPredictionContext;
	outcome: {
		success: boolean;
		errorTypes: string[];
		duration: number;
		costEfficiency: number;
		dataQuality: number;
	};
	labels: {
		errorProbability: number;
		successLikelihood: number;
		riskScore: number;
		recommendedSettings: ScrapingConfiguration;
	};
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
	timestamp: Date;
	requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		page: number;
		limit: number;
		total: number;
		hasNext: boolean;
		hasPrevious: boolean;
	};
}

export interface ScrapingApiResponse<T> extends ApiResponse<T> {
	costInfo?: {
		estimated: number;
		actual?: number;
		currency: string;
		requestUnits: number;
	};
	performanceMetrics?: {
		duration: number;
		requestCount: number;
		errorRate: number;
		dataQuality: number;
	};
}

// ============================================================================
// DATABASE ENTITY TYPES
// ============================================================================

export interface ScrapingSessionEntity {
	id: string;
	session_type: string;
	status: string;
	target_username: string;
	target_user_id?: string;
	total_accounts?: number;
	processed_accounts: number;
	progress: number;
	error_count: number;
	start_time: Date;
	end_time?: Date;
	estimated_completion?: Date;
	trigger_source: string;
	configuration: any; // JSONB
	results?: any; // JSONB
	cost_estimate?: number;
	actual_cost?: number;
	created_at: Date;
	updated_at: Date;
}

export interface AccountMetricsEntity {
	id: string;
	username: string;
	instagram_user_id?: string;
	followers: number;
	following: number;
	posts: number;
	engagement_rate: number;
	is_verified: boolean;
	is_private: boolean;
	is_business: boolean;
	business_category?: string;
	profile_data: any; // JSONB - complete profile information
	metrics_data: any; // JSONB - calculated metrics and analysis
	last_scraped: Date;
	last_updated: Date;
	data_quality_score: number;
	created_at: Date;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ScrapingSessionType = 'PROFILE_SCRAPING' | 'FOLLOWER_SCRAPING' | 'POST_SCRAPING' | 'STORY_SCRAPING';
export type ScrapingSessionStatus = 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type TriggerSource = 'MANUAL' | 'SCHEDULED' | 'API' | 'BULK_OPERATION';
export type ScrapingSource = 'HIKERAPI' | 'INTERNAL' | 'MANUAL';
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface DateRange {
	startDate: Date;
	endDate: Date;
}

export interface FilterOptions {
	status?: ScrapingSessionStatus[];
	sessionType?: ScrapingSessionType[];
	dateRange?: DateRange;
	searchQuery?: string;
	minProgress?: number;
	maxProgress?: number;
	hasErrors?: boolean;
	triggerSource?: TriggerSource[];
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

export interface WebSocketMessage {
	type: 'scraping_update' | 'session_status' | 'progress_update' | 'error' | 'completion';
	sessionId: string;
	data: any;
	timestamp: Date;
}

export interface ScrapingProgressUpdate {
	sessionId: string;
	progress: number;
	processedAccounts: number;
	currentTarget?: string;
	estimatedCompletion?: Date;
	recentErrors?: ErrorPattern[];
	performanceMetrics: {
		requestsPerMinute: number;
		successRate: number;
		averageResponseTime: number;
		costPerRequest: number;
	};
}

export interface SessionStatusUpdate {
	sessionId: string;
	status: ScrapingSessionStatus;
	message?: string;
	timestamp: Date;
	additionalData?: Record<string, any>;
}