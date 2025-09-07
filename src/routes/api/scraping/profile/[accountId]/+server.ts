import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db-loader';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const accountId = parseInt(params.accountId);
		
		if (isNaN(accountId)) {
			throw error(400, 'Invalid account ID');
		}
		
		// Get complete profile data
		const profileData = await getCompleteProfileData(accountId);
		
		if (!profileData.profile) {
			throw error(404, 'Profile not found');
		}
		
		return json({
			success: true,
			profile: profileData.profile,
			recentMedia: profileData.recentMedia || [],
			scrapingHistory: profileData.scrapingHistory || [],
			growthData: profileData.growthData || [],
			metadata: {
				loadedAt: new Date().toISOString(),
				dataPoints: {
					profile: 1,
					mediaItems: profileData.recentMedia?.length || 0,
					historyEntries: profileData.scrapingHistory?.length || 0,
					growthPoints: profileData.growthData?.length || 0
				}
			}
		});
		
	} catch (err) {
		console.error('Profile API error:', err);
		
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		
		return json(
			{ 
				success: false,
				error: 'Failed to load profile data'
			}, 
			{ status: 500 }
		);
	}
};

async function getCompleteProfileData(accountId: number) {
	try {
		// Get the account basic info and latest metrics
		const profileQuery = `
			SELECT 
				ia.id,
				ia.instagram_username as username,
				ia.status as account_status,
				
				-- Latest metrics from AccountMetrics
				am.id as metrics_id,
				am.instagram_user_id,
				am.display_name,
				am.biography,
				am.profile_picture_url,
				am.profile_picture_url_hd,
				am.external_url,
				
				-- Count metrics
				am.followers_count,
				am.following_count,
				am.posts_count,
				am.highlight_reel_count,
				
				-- Account status flags
				am.is_verified,
				am.is_private,
				am.is_business_account,
				am.business_category,
				am.business_email,
				am.business_phone_number,
				
				-- Engagement metrics
				am.average_likes,
				am.average_comments,
				am.engagement_rate,
				am.reach_rate,
				am.impressions,
				am.profile_visits,
				
				-- Content metrics
				am.recent_posts_count,
				am.stories_posted_24h,
				am.reels_count,
				am.has_active_stories,
				am.last_post_date,
				am.last_active_date,
				
				-- Quality metrics
				am.data_quality,
				am.scraping_duration,
				am.request_units,
				
				-- Status and timestamps
				am.scraping_status,
				am.error_message,
				am.scraped_at,
				am.created_at,
				am.updated_at,
				am.scraping_session_id
				
			FROM ig_accounts ia
			LEFT JOIN (
				SELECT *,
				ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY scraped_at DESC) as rn
				FROM account_metrics
			) am ON ia.id = am.account_id AND am.rn = 1
			
			WHERE ia.id = $1
		`;
		
		const profileResult = await query(profileQuery, [accountId]);
		
		if (!profileResult?.rows || profileResult.rows.length === 0) {
			return { profile: null };
		}
		
		const profile = profileResult.rows[0];
		
		// Get scraping history for this account
		const historyQuery = `
			SELECT 
				ss.id as session_id,
				ss.session_type,
				ss.status,
				ss.progress,
				ss.start_time,
				ss.end_time,
				ss.total_request_units,
				ss.estimated_cost,
				ss.error_count,
				am.scraped_at,
				am.scraping_duration,
				am.data_quality,
				am.request_units,
				am.scraping_status,
				am.error_message
			FROM account_metrics am
			LEFT JOIN scraping_sessions ss ON am.scraping_session_id = ss.id
			WHERE am.account_id = $1
			ORDER BY am.scraped_at DESC
			LIMIT 20
		`;
		
		const historyResult = await query(historyQuery, [accountId]);
		const scrapingHistory = (historyResult?.rows || []).map((row: any) => ({
			...row,
			// Convert PostgreSQL DECIMAL strings to numbers
			data_quality: row.data_quality ? parseFloat(row.data_quality) : 0,
			estimated_cost: row.estimated_cost ? parseFloat(row.estimated_cost) : 0,
			request_units: row.request_units ? parseInt(row.request_units) : 0,
			scraping_duration: row.scraping_duration ? parseInt(row.scraping_duration) : undefined
		}));
		
		// Get growth data (last 30 data points)
		const growthQuery = `
			SELECT 
				scraped_at as date,
				followers_count as followers,
				following_count as following,
				posts_count as posts,
				engagement_rate,
				average_likes,
				average_comments,
				data_quality
			FROM account_metrics
			WHERE account_id = $1
			AND scraped_at IS NOT NULL
			ORDER BY scraped_at DESC
			LIMIT 30
		`;
		
		const growthResult = await query(growthQuery, [accountId]);
		const growthData = (growthResult?.rows || [])
			.map((row: any) => ({
				...row,
				// Convert PostgreSQL DECIMAL strings to numbers
				engagement_rate: row.engagement_rate ? parseFloat(row.engagement_rate) : 0,
				data_quality: row.data_quality ? parseFloat(row.data_quality) : 0,
				average_likes: row.average_likes ? parseFloat(row.average_likes) : undefined,
				average_comments: row.average_comments ? parseFloat(row.average_comments) : undefined
			}))
			.reverse(); // Reverse for chronological order
		
		// TODO: In a real implementation, this would fetch actual media from Instagram
		// For now, return empty array - will be populated when media fetching is implemented
		const recentMedia: any[] = [];
		
		return {
			profile: {
				// Map database fields to our interface
				id: profile.metrics_id,
				accountId: profile.id,
				instagramUserId: profile.instagram_user_id,
				username: profile.username,
				displayName: profile.display_name,
				biography: profile.biography,
				profilePictureUrl: profile.profile_picture_url,
				profilePictureUrlHd: profile.profile_picture_url_hd,
				externalUrl: profile.external_url,
				
				// Counts
				followersCount: profile.followers_count || 0,
				followingCount: profile.following_count || 0,
				postsCount: profile.posts_count || 0,
				highlightReelCount: profile.highlight_reel_count,
				
				// Status flags
				isVerified: profile.is_verified || false,
				isPrivate: profile.is_private || false,
				isBusinessAccount: profile.is_business_account || false,
				businessCategory: profile.business_category,
				businessEmail: profile.business_email,
				businessPhoneNumber: profile.business_phone_number,
				
				// Engagement (convert PostgreSQL DECIMAL strings to numbers)
				averageLikes: profile.average_likes ? parseFloat(profile.average_likes) : undefined,
				averageComments: profile.average_comments ? parseFloat(profile.average_comments) : undefined,
				engagementRate: profile.engagement_rate ? parseFloat(profile.engagement_rate) : 0,
				reachRate: profile.reach_rate ? parseFloat(profile.reach_rate) : undefined,
				impressions: profile.impressions ? parseInt(profile.impressions) : undefined,
				profileVisits: profile.profile_visits ? parseInt(profile.profile_visits) : undefined,
				
				// Content
				recentPostsCount: profile.recent_posts_count,
				storiesPosted24h: profile.stories_posted_24h,
				reelsCount: profile.reels_count,
				hasActiveStories: profile.has_active_stories,
				lastPostDate: profile.last_post_date,
				lastActiveDate: profile.last_active_date,
				
				// Quality (convert PostgreSQL DECIMAL strings to numbers)
				dataQuality: profile.data_quality ? parseFloat(profile.data_quality) : 0,
				scrapingDuration: profile.scraping_duration ? parseInt(profile.scraping_duration) : undefined,
				requestUnits: profile.request_units ? parseInt(profile.request_units) : 0,
				
				// Status
				scrapingStatus: profile.scraping_status || 'PENDING',
				errorMessage: profile.error_message,
				scrapedAt: profile.scraped_at,
				createdAt: profile.created_at,
				updatedAt: profile.updated_at,
				scrapingSessionId: profile.scraping_session_id
			},
			recentMedia,
			scrapingHistory,
			growthData
		};
		
	} catch (error) {
		console.error('Error fetching complete profile data:', error);
		throw new Error('Failed to fetch profile data');
	}
}

