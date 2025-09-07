// HikerAPI TypeScript type definitions
// Based on HikerAPI documentation and integration guide

export interface HikerAPIConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  rateLimit: number;
  retryAttempts: number;
  retryDelay: number;
  budgetLimit: number;
  costPerUnit: number;
  alertThreshold: number;
  mockMode?: boolean;
}

export interface HikerAPIResponse<T> {
  success: boolean;
  data: T;
  requestUnits: number;
  requestId: string;
  timestamp: string;
}

export interface HikerAPIError {
  success: false;
  error: string;
  errorCode?: string;
  details?: any;
}

// User Profile Data Types
export interface HikerAPIUser {
  user_id: string;
  username: string;
  full_name?: string;
  biography?: string;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  external_url?: string;
  is_verified: boolean;
  is_private: boolean;
  is_business_account: boolean;
  is_professional_account?: boolean;
  follower_count: number;
  following_count: number;
  media_count: number;
  category?: string;
  business_category?: string;
  business_email?: string;
  business_phone_number?: string;
  has_channel?: boolean;
  has_guides?: boolean;
  has_ar_effects?: boolean;
}

export interface HikerAPIUserProfile extends HikerAPIUser {
  // Additional profile data from /a2/user endpoint
  highlight_reel_count?: number;
  recent_media?: HikerAPIMediaItem[];
  business_address?: {
    street_address: string;
    zip_code: string;
    city_name: string;
    region_name: string;
    country_code: string;
  };
}

// Media Data Types
export interface HikerAPIMediaItem {
  media_id: string;
  media_type: 'photo' | 'video' | 'carousel';
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  like_count: number;
  comment_count: number;
  view_count?: number;
  created_time: number; // Unix timestamp
  location?: {
    name: string;
    lat: number;
    lng: number;
  };
  hashtags?: string[];
  mentions?: string[];
  is_video: boolean;
  video_duration?: number;
}

// Followers/Following Data Types
export interface HikerAPIFollowersResponse {
  users: HikerAPIFollowerUser[];
  page_info: {
    has_next_page: boolean;
    end_cursor?: string;
  };
  next_page_id?: string;
}

export interface HikerAPIFollowerUser {
  user_id: string;
  username: string;
  full_name?: string;
  profile_pic_url: string;
  is_verified: boolean;
  is_private: boolean;
  follower_count?: number;
  following_count?: number;
}

// Balance and Usage Types
export interface HikerAPIBalance {
  balance: number;
  credits_remaining: number;
  daily_usage: number;
  monthly_usage: number;
  plan_type: string;
  reset_date: string;
}

export interface HikerAPIRateLimit {
  requests_per_second: number;
  requests_remaining_second: number;
  requests_remaining_hour: number;
  requests_remaining_day: number;
  reset_time_second: number;
  reset_time_hour: number;
  reset_time_day: number;
}

// Batch Request Types
export interface HikerAPIBatchRequest {
  requests: Array<{
    endpoint: string;
    params: Record<string, any>;
    id?: string;
  }>;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  timeout?: number;
}

export interface HikerAPIBatchResponse {
  success_count: number;
  error_count: number;
  total_request_units: number;
  execution_time_ms: number;
  results: Array<{
    id?: string;
    success: boolean;
    data?: any;
    error?: string;
    request_units: number;
  }>;
}

// Audience Insights Types
export interface HikerAPIAudienceInsights {
  demographics: {
    age_groups: Array<{
      age_range: string;
      percentage: number;
    }>;
    gender_distribution: {
      male: number;
      female: number;
      other: number;
    };
    top_countries: Array<{
      country_code: string;
      country_name: string;
      percentage: number;
    }>;
    top_cities: Array<{
      city_name: string;
      country_name: string;
      percentage: number;
    }>;
  };
  activity: {
    most_active_hours: number[];
    most_active_days: string[];
    timezone_distribution: Array<{
      timezone: string;
      percentage: number;
    }>;
  };
}

// Configuration Validation Types
export interface ValidatedHikerConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimit: number;
  budgetLimit: number;
  costPerUnit: number;
  alertThreshold: number;
  mockMode: boolean;
}

// Error Types
export type HikerAPIErrorType = 
  | 'RATE_LIMIT_EXCEEDED'
  | 'INSUFFICIENT_BALANCE'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_PRIVATE'
  | 'AUTHENTICATION_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export interface HikerAPIErrorDetails {
  type: HikerAPIErrorType;
  message: string;
  code?: string;
  retryAfter?: number;
  details?: any;
}