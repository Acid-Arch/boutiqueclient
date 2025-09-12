import type { PageServerLoad } from './$types';
import { logUserModelAccess } from '$lib/server/model-access';
import pg from 'pg';

async function getAccountsWithModelAccess(user: any) {
	const { Client } = pg;
	const client = new Client({
		connectionString: process.env.DATABASE_URL
	});

	try {
		await client.connect();
		
		// Build dynamic query based on user's model access
		let modelFilter = '';
		const queryParams = [user.id];
		
		// Use centralized model access logic instead of email-based rules
		const { getUserModelAccess } = await import("$lib/server/model-access");
		const userModels = getUserModelAccess(user);
		
		console.log(`🔑 Analytics SQL: User ${user.email} has access to models: [${userModels.join(", ")}]`);
		
		if (userModels.length > 0) {
			const modelPlaceholders = userModels.map((_, index) => `$${index + 2}`).join(", ");
			modelFilter = `OR (model IN (${modelPlaceholders}) AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
			queryParams.push(...userModels);
			console.log(`🔑 Analytics SQL: Adding model access filter for models: [${userModels.join(", ")}]`);
		}
		
		const accountsQuery = `
			SELECT 
				id, instagram_username, instagram_password, email_address, email_password,
				status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
				assignment_timestamp, login_timestamp, created_at, updated_at,
				owner_id, account_type, visibility, is_shared, model,
				follower_count, following_count, post_count, total_engagement, engagement_rate,
				follower_growth_30d, engagement_growth_30d, last_scraped_at
			FROM ig_accounts 
			WHERE (
				(owner_id = $1 AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				OR 
				(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				${modelFilter}
			)
			ORDER BY created_at DESC 
			LIMIT 1000
		`;
		
		const result = await client.query(accountsQuery, queryParams);
		
		const accounts = result.rows.map(row => ({
			id: row.id,
			recordId: row.record_id,
			instagramUsername: row.instagram_username,
			instagramPassword: row.instagram_password,
			emailAddress: row.email_address,
			emailPassword: row.email_password,
			status: row.status,
			imapStatus: row.imap_status,
			assignedDeviceId: row.assigned_device_id,
			assignedCloneNumber: row.assigned_clone_number,
			assignedPackageName: row.assigned_package_name,
			assignmentTimestamp: row.assignment_timestamp,
			loginTimestamp: row.login_timestamp,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			ownerId: row.owner_id,
			accountType: row.account_type,
			visibility: row.visibility,
			isShared: row.is_shared,
			model: row.model,
			followerCount: row.follower_count,
			followingCount: row.following_count,
			postCount: row.post_count,
			totalEngagement: row.total_engagement,
			engagementRate: parseFloat(row.engagement_rate || 0),
			followerGrowth30d: row.follower_growth_30d,
			engagementGrowth30d: parseFloat(row.engagement_growth_30d || 0),
			lastScrapedAt: row.last_scraped_at
		}));

		return { accounts, totalCount: accounts.length };

	} finally {
		await client.end();
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return {
			analytics: {
				totalFollowers: 0,
				totalEngagement: 0,
				avgEngagementRate: 0,
				totalPosts: 0,
				followerGrowth: 0,
				engagementGrowth: 0,
				accounts: []
			}
		};
	}

	try {
		// Log user's model access for debugging
		logUserModelAccess(locals.user);
		
		// Get accounts with model access (same logic as dashboard)
		const { accounts } = await getAccountsWithModelAccess(locals.user);
		
		console.log(`📊 Analytics: Found ${accounts.length} accounts for user ${locals.user.email}`);
		
		// Calculate real analytics from account data
		const analytics = {
			totalFollowers: calculateTotalFollowers(accounts),
			totalEngagement: calculateTotalEngagement(accounts),
			avgEngagementRate: calculateEngagementRate(accounts),
			totalPosts: calculateTotalPosts(accounts),
			followerGrowth: calculateFollowerGrowth(accounts),
			engagementGrowth: calculateEngagementGrowth(accounts),
			accounts: accounts.slice(0, 20) // Limit for analytics display
		};

		console.log(`📈 Analytics stats: ${analytics.totalFollowers} followers, ${analytics.totalPosts} posts, ${analytics.avgEngagementRate}% engagement`);

		return { analytics };
		
	} catch (error) {
		console.error('Error loading analytics data:', error);
		return {
			analytics: {
				totalFollowers: 0,
				totalEngagement: 0,
				avgEngagementRate: 0,
				totalPosts: 0,
				followerGrowth: 0,
				engagementGrowth: 0,
				accounts: []
			}
		};
	}
};

function calculateTotalFollowers(accounts: any[]): number {
	// Sum real follower data from database
	return accounts.reduce((total, acc) => {
		return total + (acc.followerCount || 0);
	}, 0);
}

function calculateTotalEngagement(accounts: any[]): number {
	// Sum real engagement data from database
	return accounts.reduce((total, acc) => {
		return total + (acc.totalEngagement || 0);
	}, 0);
}

function calculateEngagementRate(accounts: any[]): number {
	if (accounts.length === 0) return 0;
	
	// Calculate average engagement rate from real data
	const accountsWithData = accounts.filter(acc => acc.engagementRate && acc.engagementRate > 0);
	
	if (accountsWithData.length === 0) return 0;
	
	const totalRate = accountsWithData.reduce((sum, acc) => sum + acc.engagementRate, 0);
	return Math.round((totalRate / accountsWithData.length) * 100) / 100;
}

function calculateTotalPosts(accounts: any[]): number {
	// Sum real post count data from database
	return accounts.reduce((total, acc) => {
		return total + (acc.postCount || 0);
	}, 0);
}

function calculateFollowerGrowth(accounts: any[]): number {
	if (accounts.length === 0) return 0;
	
	// Calculate average follower growth from real data
	const accountsWithGrowthData = accounts.filter(acc => 
		typeof acc.followerGrowth30d === 'number'
	);
	
	if (accountsWithGrowthData.length === 0) return 0;
	
	const totalGrowth = accountsWithGrowthData.reduce((sum, acc) => sum + acc.followerGrowth30d, 0);
	const totalFollowers = accountsWithGrowthData.reduce((sum, acc) => sum + (acc.followerCount || 1), 0);
	
	// Calculate growth percentage
	return Math.round((totalGrowth / totalFollowers * 100) * 10) / 10;
}

function calculateEngagementGrowth(accounts: any[]): number {
	if (accounts.length === 0) return 0;
	
	// Calculate average engagement growth from real data
	const accountsWithEngagementGrowth = accounts.filter(acc => 
		typeof acc.engagementGrowth30d === 'number'
	);
	
	if (accountsWithEngagementGrowth.length === 0) return 0;
	
	const totalGrowth = accountsWithEngagementGrowth.reduce((sum, acc) => sum + acc.engagementGrowth30d, 0);
	return Math.round((totalGrowth / accountsWithEngagementGrowth.length) * 100) / 100;
}