import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/database';
import { getAccountsFilterForUser, logUserModelAccess } from '$lib/server/model-access';
import pg from 'pg';

export const load: PageServerLoad = async ({ locals }) => {
	// Return the authenticated user data from our hooks
	if (locals.user) {
		try {
			// Get real recent activity from the database
			const recentActivity = await getRecentActivity(locals.user.id);
			
			// Get real stats from user's Instagram accounts
			const stats = await getDashboardStats(locals.user.id, locals.user);

			return {
				user: {
					id: locals.user.id,
					name: locals.user.name,
					email: locals.user.email,
					role: locals.user.role,
					company: locals.user.company,
					avatar: locals.user.avatar,
					subscription: locals.user.subscription,
					isActive: locals.user.isActive
				},
				stats,
				recentActivity
			};
		} catch (error) {
			console.error('Error loading dashboard data:', error);
			// Fallback to empty data instead of mock data
			return {
				user: {
					id: locals.user.id,
					name: locals.user.name,
					email: locals.user.email,
					role: locals.user.role,
					company: locals.user.company,
					avatar: locals.user.avatar,
					subscription: locals.user.subscription,
					isActive: locals.user.isActive
				},
				stats: {
					totalAccounts: 0,
					activeAccounts: 0,
					assignedDevices: 0,
					totalFollowers: 0
				},
				recentActivity: []
			};
		}
	}
	
	// This shouldn't happen since the route is protected, but fallback
	return {
		user: null,
		stats: {
			totalAccounts: 0,
			activeAccounts: 0,
			assignedDevices: 0,
			totalFollowers: 0
		},
		recentActivity: []
	};
};

async function getRecentActivity(userId: string) {
	try {
		// Try Prisma first, then fall back to direct SQL
		try {
			const activities = await prisma.auditLog.findMany({
				where: {
					userId: parseInt(userId),
					eventType: {
						in: ['ACCOUNT_LOGIN', 'DEVICE_ASSIGNMENT', 'SCRAPING_SESSION', 'USER_LOGIN']
					}
				},
				orderBy: { timestamp: 'desc' },
				take: 10,
				include: {
					user: {
						select: { 
							firstName: true, 
							lastName: true 
						}
					}
				}
			});

			// Transform database results to match UI format
			return activities.map((activity, index) => ({
				id: activity.id || index + 1,
				type: activity.eventType?.toLowerCase().replace('_', '') || 'unknown',
				account: activity.details?.account || `@user_${activity.userId}`,
				device: activity.details?.device || null,
				time: formatTimeAgo(activity.timestamp),
				status: activity.severity === 'ERROR' ? 'error' : 'success'
			}));
		} catch (prismaError) {
			console.log('⚠️  Prisma auditLog failed, using direct SQL for recent activity');
			return await getRecentActivityDirectSQL(userId);
		}

	} catch (error) {
		console.error('Error fetching recent activity:', error);
		// Return empty array instead of mock data when there's an error
		return [];
	}
}

async function getRecentActivityDirectSQL(userId: string) {
	const { Client } = pg;
	const client = new Client({
		connectionString: process.env.DATABASE_URL || "postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30"
	});

	try {
		await client.connect();
		
		const activityQuery = `
			SELECT 
				id, user_id, event_type, details, severity, timestamp, created_at
			FROM audit_logs 
			WHERE user_id = $1 
			AND event_type IN ('ACCOUNT_LOGIN', 'DEVICE_ASSIGNMENT', 'SCRAPING_SESSION', 'USER_LOGIN')
			ORDER BY timestamp DESC 
			LIMIT 10
		`;
		
		const result = await client.query(activityQuery, [parseInt(userId)]);
		
		// Transform database results to match UI format
		return result.rows.map((row, index) => ({
			id: row.id || index + 1,
			type: row.event_type?.toLowerCase().replace('_', '') || 'unknown',
			account: row.details?.account || `@user_${row.user_id}`,
			device: row.details?.device || null,
			time: formatTimeAgo(row.timestamp || row.created_at),
			status: row.severity === 'ERROR' ? 'error' : 'success'
		}));

	} catch (sqlError) {
		console.log('⚠️  SQL query for audit logs failed, returning empty activity');
		return [];
	} finally {
		await client.end();
	}
}

function formatTimeAgo(date: Date): string {
	if (!date) return 'Unknown time';
	
	const now = new Date();
	const diffInMs = now.getTime() - date.getTime();
	const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
	const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
	const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

	if (diffInMinutes < 1) return 'Just now';
	if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
	if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
	if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
	
	return date.toLocaleDateString();
}

async function getAccountsWithModelAccess(user: any) {
	const { Client } = pg;
	const client = new Client({
		connectionString: process.env.DATABASE_URL || "postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30"
	});

	try {
		await client.connect();
		
		// Build dynamic query based on user's model access
		let modelFilter = '';
		const queryParams = [user.id];
		
		// Add model-based access for Gmail users
		if (user.email && user.email.includes('@gmail.com')) {
			modelFilter = `OR (model = 'Dillion' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
			console.log(`🔑 SQL: Adding Dillion model access for Gmail user: ${user.email}`);
		}
		
		// Add model-based access for Hotmail/Live/Outlook users
		if (user.email && (
			user.email.includes('@hotmail.') || 
			user.email.includes('@live.') || 
			user.email.includes('@outlook.')
		)) {
			modelFilter = `OR (model = 'katie' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
			console.log(`🔑 SQL: Adding katie model access for Hotmail user: ${user.email}`);
		}
		
		const accountsQuery = `
			SELECT 
				id, instagram_username, instagram_password, email_address, email_password,
				status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
				assignment_timestamp, login_timestamp, created_at, updated_at,
				owner_id, account_type, visibility, is_shared, model
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
			model: row.model
		}));

		return { accounts, totalCount: accounts.length };

	} finally {
		await client.end();
	}
}

async function getDashboardStats(userId: string, user: any) {
	try {
		// Log user's model access for debugging
		logUserModelAccess(user);
		
		// Try Prisma first, then fall back to direct SQL with model access
		let accounts: any[] = [];
		
		try {
			// Get accounts filter based on user's model access
			const accountsFilter = getAccountsFilterForUser(user);
			
			// Query user's Instagram accounts for stats (includes both owned and model-based access)
			accounts = await prisma.igAccount.findMany({
				where: accountsFilter
			});
			
			console.log(`📊 Found ${accounts.length} accounts via Prisma for user ${user.email}`);
		} catch (prismaError) {
			console.log(`⚠️  Prisma failed, using direct SQL with model access for user ${user.email}`);
			
			// Direct SQL fallback with model access
			const { accounts: sqlAccounts } = await getAccountsWithModelAccess(user);
			accounts = sqlAccounts;
			
			console.log(`📊 Found ${accounts.length} accounts via SQL for user ${user.email}`);
		}
		
		if (accounts.length > 0) {
			console.log(`🔍 Sample accounts: ${accounts.slice(0, 3).map(a => `@${a.instagramUsername}`).join(', ')}`);
		}

		// Calculate stats from real data
		const totalAccounts = accounts.length;
		const activeAccounts = accounts.filter(account => 
			account.status && ['active', 'assigned', 'logged in'].includes(account.status.toLowerCase())
		).length;
		const assignedDevices = accounts.filter(account => 
			account.assignedDeviceId !== null
		).length;
		
		// TODO: Get follower count from metrics table when available
		const totalFollowers = 0;

		return {
			totalAccounts,
			activeAccounts,
			assignedDevices,
			totalFollowers
		};
	} catch (error) {
		console.error('Error fetching dashboard stats:', error);
		// Return zero stats on error
		return {
			totalAccounts: 0,
			activeAccounts: 0,
			assignedDevices: 0,
			totalFollowers: 0
		};
	}
}