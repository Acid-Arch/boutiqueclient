/**
 * Data Transformation Layer for HikerAPI to Database Integration
 * Converts HikerAPI responses to BoutiquePortal database format
 */

import type { 
  HikerAPIUser, 
  HikerAPIUserProfile, 
  HikerAPIMediaItem,
  HikerAPIAudienceInsights 
} from '$lib/types/hikerapi.types';
import type { 
  AccountMetrics, 
  ProfileTransformResult, 
  ScrapingStatus 
} from '$lib/types/scraping.types';

export class DataTransformer {
  /**
   * Transform HikerAPI profile response to AccountMetrics database format
   */
  static transformProfileData(
    profileData: HikerAPIUser | HikerAPIUserProfile,
    sessionId: string,
    accountId: number,
    previousMetrics?: AccountMetrics
  ): Omit<AccountMetrics, 'id' | 'createdAt' | 'updatedAt'> {
    // Calculate growth metrics if previous data exists
    const followerGrowth = previousMetrics 
      ? profileData.follower_count - previousMetrics.followersCount
      : undefined;
    const followingGrowth = previousMetrics
      ? profileData.following_count - previousMetrics.followingCount
      : undefined;
    const mediaGrowth = previousMetrics
      ? profileData.media_count - previousMetrics.postsCount
      : undefined;

    // Determine if this is a detailed profile (from /a2/user endpoint)
    const isDetailedProfile = 'highlight_reel_count' in profileData;
    
    return {
      accountId,
      instagramUserId: profileData.user_id,
      username: profileData.username,
      displayName: profileData.full_name || undefined,
      biography: profileData.biography || undefined,
      profilePictureUrl: profileData.profile_pic_url || undefined,
      profilePictureUrlHd: 'profile_pic_url_hd' in profileData ? profileData.profile_pic_url_hd || undefined : undefined,
      externalUrl: profileData.external_url || undefined,
      
      // Count Metrics
      followersCount: profileData.follower_count || 0,
      followingCount: profileData.following_count || 0,
      postsCount: profileData.media_count || 0,
      highlightReelCount: isDetailedProfile ? (profileData as HikerAPIUserProfile).highlight_reel_count || undefined : undefined,
      
      // Account Status
      isVerified: profileData.is_verified || false,
      isPrivate: profileData.is_private || false,
      isBusinessAccount: profileData.is_business_account || false,
      businessCategory: profileData.business_category || undefined,
      businessEmail: profileData.business_email || undefined,
      businessPhoneNumber: profileData.business_phone_number || undefined,
      
      // Engagement Metrics (to be populated by media analysis)
      averageLikes: undefined,
      averageComments: undefined,
      engagementRate: undefined,
      reachRate: undefined,
      impressions: undefined,
      profileVisits: undefined,
      
      // Content Metrics (to be populated by media analysis)
      recentPostsCount: undefined,
      storiesPosted24h: undefined,
      reelsCount: undefined,
      hasActiveStories: undefined,
      lastPostDate: undefined,
      lastActiveDate: undefined,
      
      // Quality & Performance Metrics
      dataQuality: this.calculateDataQuality(profileData),
      scrapingDuration: undefined, // To be set by caller
      requestUnits: isDetailedProfile ? 2 : 1, // /a2/user uses 2 units, /v1/user uses 1
      
      // Status & Metadata
      scrapingStatus: 'COMPLETED' as ScrapingStatus,
      errorMessage: undefined,
      scrapedAt: new Date(),
      scrapingSessionId: sessionId
    };
  }

  /**
   * Transform and analyze media items to calculate engagement metrics
   */
  static analyzeMediaEngagement(mediaItems: HikerAPIMediaItem[]): {
    averageLikes: number;
    averageComments: number;
    averageViews?: number;
    engagementRate: number;
    lastPostDate?: Date;
    recentPostsCount: number;
    contentTypes: {
      photo: number;
      video: number;
      carousel: number;
    };
    hashtagsUsed: string[];
    mentionsUsed: string[];
    reelsCount: number;
  } {
    if (mediaItems.length === 0) {
      return {
        averageLikes: 0,
        averageComments: 0,
        engagementRate: 0,
        recentPostsCount: 0,
        contentTypes: { photo: 0, video: 0, carousel: 0 },
        hashtagsUsed: [],
        mentionsUsed: [],
        reelsCount: 0
      };
    }

    // Calculate averages
    const totalLikes = mediaItems.reduce((sum, item) => sum + (item.like_count || 0), 0);
    const totalComments = mediaItems.reduce((sum, item) => sum + (item.comment_count || 0), 0);
    const totalViews = mediaItems
      .filter(item => item.view_count)
      .reduce((sum, item) => sum + (item.view_count || 0), 0);

    const averageLikes = Math.round(totalLikes / mediaItems.length);
    const averageComments = Math.round(totalComments / mediaItems.length);
    const averageViews = totalViews > 0 
      ? Math.round(totalViews / mediaItems.filter(item => item.view_count).length) 
      : undefined;

    // Calculate engagement rate (likes + comments per post)
    const totalEngagement = totalLikes + totalComments;
    const engagementRate = totalEngagement / mediaItems.length;

    // Find most recent post
    const sortedItems = mediaItems
      .filter(item => item.created_time)
      .sort((a, b) => b.created_time - a.created_time);
    
    const lastPostDate = sortedItems.length > 0 
      ? new Date(sortedItems[0].created_time * 1000) 
      : undefined;

    // Count posts in last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentPostsCount = mediaItems.filter(
      item => item.created_time && (item.created_time * 1000) > thirtyDaysAgo
    ).length;

    // Analyze content types
    const contentTypes = mediaItems.reduce(
      (acc, item) => {
        acc[item.media_type]++;
        return acc;
      },
      { photo: 0, video: 0, carousel: 0 }
    );

    // Count reels (videos that might be reels - simplified detection)
    const reelsCount = mediaItems.filter(item => 
      item.media_type === 'video' && (item.video_duration || 0) <= 90
    ).length;

    // Extract hashtags and mentions
    const hashtagSet = new Set<string>();
    const mentionSet = new Set<string>();

    mediaItems.forEach(item => {
      if (item.hashtags) {
        item.hashtags.forEach(tag => hashtagSet.add(tag));
      }
      if (item.mentions) {
        item.mentions.forEach(mention => mentionSet.add(mention));
      }
    });

    return {
      averageLikes,
      averageComments,
      averageViews,
      engagementRate,
      lastPostDate,
      recentPostsCount,
      contentTypes,
      hashtagsUsed: Array.from(hashtagSet).slice(0, 50), // Limit to top 50
      mentionsUsed: Array.from(mentionSet).slice(0, 20),  // Limit to top 20
      reelsCount
    };
  }

  /**
   * Transform audience insights data for database storage
   */
  static transformAudienceInsights(insights: HikerAPIAudienceInsights): {
    audienceCountry: any;
    audienceAge: any;
    audienceGender: any;
  } {
    return {
      audienceCountry: insights.demographics.top_countries || undefined,
      audienceAge: insights.demographics.age_groups || undefined,
      audienceGender: insights.demographics.gender_distribution || undefined
    };
  }

  /**
   * Calculate comprehensive profile transformation result
   */
  static createProfileTransformResult(
    profileData: HikerAPIUser | HikerAPIUserProfile,
    mediaItems?: HikerAPIMediaItem[],
    audienceInsights?: HikerAPIAudienceInsights,
    previousMetrics?: AccountMetrics
  ): ProfileTransformResult {
    const basicMetrics = this.transformProfileData(
      profileData,
      '', // sessionId to be set by caller
      0,  // accountId to be set by caller
      previousMetrics
    );

    let contentMetrics;
    if (mediaItems && mediaItems.length > 0) {
      const mediaAnalysis = this.analyzeMediaEngagement(mediaItems);
      contentMetrics = {
        averageLikes: mediaAnalysis.averageLikes,
        averageComments: mediaAnalysis.averageComments,
        averageViews: mediaAnalysis.averageViews,
        engagementRate: mediaAnalysis.engagementRate,
        lastPostDate: mediaAnalysis.lastPostDate,
        postsLast30Days: mediaAnalysis.recentPostsCount,
        contentTypes: mediaAnalysis.contentTypes,
        hashtagsUsed: mediaAnalysis.hashtagsUsed,
        mentionsUsed: mediaAnalysis.mentionsUsed
      };
    }

    let audienceMetrics;
    if (audienceInsights) {
      const audienceData = this.transformAudienceInsights(audienceInsights);
      audienceMetrics = {
        countryDistribution: audienceData.audienceCountry,
        ageDistribution: audienceData.audienceAge,
        genderDistribution: audienceData.audienceGender
      };
    }

    let growthMetrics;
    if (previousMetrics) {
      const followerGrowth = profileData.follower_count - previousMetrics.followersCount;
      const followingGrowth = profileData.following_count - previousMetrics.followingCount;
      const mediaGrowth = profileData.media_count - previousMetrics.postsCount;

      growthMetrics = {
        followerGrowth,
        followingGrowth,
        mediaGrowth,
        growthRates: {
          follower: previousMetrics.followersCount > 0 
            ? (followerGrowth / previousMetrics.followersCount) * 100 
            : 0,
          following: previousMetrics.followingCount > 0 
            ? (followingGrowth / previousMetrics.followingCount) * 100 
            : 0,
          media: previousMetrics.postsCount > 0 
            ? (mediaGrowth / previousMetrics.postsCount) * 100 
            : 0
        }
      };
    }

    return {
      basicMetrics,
      contentMetrics,
      audienceMetrics,
      growthMetrics,
      qualityScore: this.calculateDataQuality(profileData),
      dataPoints: this.countDataPoints(profileData),
      inconsistencies: this.detectInconsistencies(profileData, previousMetrics)
    };
  }

  // ===== PRIVATE HELPER METHODS =====

  private static countDataPoints(profileData: HikerAPIUser | HikerAPIUserProfile): number {
    let count = 0;
    
    // Count non-null profile fields
    if (profileData.username) count++;
    if (profileData.full_name) count++;
    if (profileData.biography) count++;
    if (profileData.profile_pic_url) count++;
    if (profileData.external_url) count++;
    if (typeof profileData.is_verified === 'boolean') count++;
    if (typeof profileData.is_private === 'boolean') count++;
    if (typeof profileData.follower_count === 'number') count++;
    if (typeof profileData.following_count === 'number') count++;
    if (typeof profileData.media_count === 'number') count++;
    if (profileData.category) count++;
    if (profileData.business_email) count++;
    if (profileData.business_phone_number) count++;
    
    // Additional fields for detailed profiles
    if ('highlight_reel_count' in profileData && profileData.highlight_reel_count) count++;
    if ('profile_pic_url_hd' in profileData && profileData.profile_pic_url_hd) count++;
    
    return count;
  }

  private static calculateDataQuality(profileData: HikerAPIUser | HikerAPIUserProfile): number {
    let score = 0;
    let maxScore = 0;
    
    // Username validation (required)
    maxScore += 20;
    if (profileData.username && profileData.username.length > 0) {
      score += 20;
    }
    
    // Count validation (required)
    maxScore += 30;
    if (profileData.follower_count >= 0 && 
        profileData.following_count >= 0 && 
        profileData.media_count >= 0) {
      score += 30;
    }
    
    // Profile completeness (optional but valuable)
    maxScore += 20;
    const profileFields = [
      profileData.full_name,
      profileData.biography,
      profileData.profile_pic_url
    ].filter(Boolean).length;
    
    score += (profileFields / 3) * 20;
    
    // Account type information (optional)
    maxScore += 15;
    if (typeof profileData.is_verified === 'boolean') score += 5;
    if (typeof profileData.is_private === 'boolean') score += 5;
    if (typeof profileData.is_business_account === 'boolean') score += 5;
    
    // Business information (if applicable)
    maxScore += 15;
    if (profileData.is_business_account) {
      if (profileData.business_category) score += 5;
      if (profileData.business_email) score += 5;
      if (profileData.business_phone_number) score += 5;
    } else {
      score += 15; // Full score if not a business account
    }
    
    return Math.min(score / maxScore, 1.0);
  }

  private static detectInconsistencies(
    profileData: HikerAPIUser | HikerAPIUserProfile, 
    previousMetrics?: AccountMetrics
  ): any {
    const inconsistencies: any = {};
    
    if (previousMetrics) {
      // Check for impossible follower changes
      const followerChange = profileData.follower_count - previousMetrics.followersCount;
      const timeDiff = Date.now() - previousMetrics.scrapedAt.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      // Flag if follower change is suspiciously large for time period
      const maxReasonableChangePerHour = 1000; // Adjust based on account size
      if (Math.abs(followerChange) > (hoursDiff * maxReasonableChangePerHour)) {
        inconsistencies.suspiciousFollowerChange = {
          change: followerChange,
          timePeriodHours: hoursDiff,
          maxExpectedChange: Math.floor(hoursDiff * maxReasonableChangePerHour)
        };
      }
      
      // Check for username changes
      if (previousMetrics.username !== profileData.username) {
        inconsistencies.usernameChanged = {
          previous: previousMetrics.username,
          current: profileData.username
        };
      }
    }
    
    // Check for unusual ratios
    if (profileData.following_count > 0) {
      const followerToFollowingRatio = profileData.follower_count / profileData.following_count;
      if (followerToFollowingRatio > 1000 && profileData.follower_count > 10000) {
        inconsistencies.unusualFollowRatio = {
          ratio: followerToFollowingRatio,
          followers: profileData.follower_count,
          following: profileData.following_count
        };
      }
    }
    
    // Check for business account without business information
    if (profileData.is_business_account && 
        !profileData.business_category && 
        !profileData.business_email && 
        !profileData.business_phone_number) {
      inconsistencies.incompleteBusinessInfo = {
        message: 'Business account without business details'
      };
    }
    
    return Object.keys(inconsistencies).length > 0 ? inconsistencies : undefined;
  }

  /**
   * Update existing AccountMetrics with new data
   */
  static updateAccountMetrics(
    existingMetrics: AccountMetrics,
    newData: Partial<AccountMetrics>
  ): AccountMetrics {
    return {
      ...existingMetrics,
      ...newData,
      updatedAt: new Date()
    };
  }

  /**
   * Merge multiple metrics for historical analysis
   */
  static mergeHistoricalMetrics(metrics: AccountMetrics[]): {
    timeline: Array<{
      date: Date;
      followers: number;
      following: number;
      posts: number;
      engagement?: number;
    }>;
    trends: {
      follower: 'up' | 'down' | 'stable';
      engagement: 'up' | 'down' | 'stable';
      content: 'up' | 'down' | 'stable';
    };
  } {
    const timeline = metrics.map(metric => ({
      date: metric.scrapedAt,
      followers: metric.followersCount,
      following: metric.followingCount,
      posts: metric.postsCount,
      engagement: metric.engagementRate || undefined
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // Simple trend analysis
    const trends = {
      follower: this.calculateTrend(timeline.map(t => t.followers)),
      engagement: this.calculateTrend(timeline.map(t => t.engagement).filter(Boolean) as number[]),
      content: this.calculateTrend(timeline.map(t => t.posts))
    };

    return { timeline, trends };
  }

  private static calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = (last - first) / first;
    
    if (change > 0.05) return 'up';    // More than 5% increase
    if (change < -0.05) return 'down'; // More than 5% decrease
    return 'stable';
  }
}