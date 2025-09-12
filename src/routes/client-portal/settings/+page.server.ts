import type { PageServerLoad } from './$types';
import { prisma } from '$lib/server/database';
import { logUserModelAccess } from '$lib/server/model-access';
import pg from 'pg';
import { createHash } from 'crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		// This shouldn't happen since the route is protected, but fallback
		return {
			userSettings: {
				profile: {
					name: '',
					email: '',
					company: '',
					role: '',
					avatar: ''
				},
				notifications: {
					emailAlerts: true,
					pushNotifications: true,
					weeklyReports: true,
					securityAlerts: true
				},
				security: {
					twoFactorEnabled: false,
					lastPasswordChange: '',
					activeSessions: 0
				},
				api: {
					apiKey: 'sk_live_' + Math.random().toString(36).substring(2, 24),
					webhookUrl: 'https://yourapp.com/webhooks',
					rateLimitRemaining: 5000
				},
				subscription: {
					plan: 'Basic',
					accountLimit: 10,
					currentAccounts: 0,
					billingCycle: 'Monthly',
					nextBilling: ''
				}
			}
		};
	}

	try {
		// Log user's model access for debugging
		logUserModelAccess(locals.user);
		
		// Get detailed user information from database
		const userDetails = await getUserDetailsFromDatabase(locals.user);
		
		// Get user's account count for subscription display
		const accountCount = await getUserAccountCount(locals.user);
		
		console.log(`⚙️  Settings page: Loading data for user ${locals.user.email}`);
		
		return {
			userSettings: {
				profile: {
					name: userDetails.name || locals.user.name || locals.user.email,
					email: userDetails.email || locals.user.email,
					company: userDetails.company || locals.user.company || '',
					role: userDetails.role || locals.user.role || 'CLIENT',
					avatar: userDetails.avatar || locals.user.avatar || `/api/avatar/${locals.user.email}`
				},
				notifications: {
					emailAlerts: userDetails.emailAlerts ?? true,
					pushNotifications: userDetails.pushNotifications ?? true,
					weeklyReports: userDetails.weeklyReports ?? true,
					securityAlerts: userDetails.securityAlerts ?? true
				},
				security: {
					twoFactorEnabled: userDetails.twoFactorEnabled || locals.user.isTwoFactorEnabled || false,
					lastPasswordChange: userDetails.lastPasswordChange || formatDate(locals.user.lastLoginAt) || '',
					activeSessions: 1 // Current session
				},
				api: {
					apiKey: generateApiKey(locals.user.id),
					webhookUrl: userDetails.webhookUrl || 'https://yourapp.com/webhooks',
					rateLimitRemaining: 5000
				},
				subscription: {
					plan: locals.user.subscription || userDetails.subscription || 'Professional',
					accountLimit: 10,
					currentAccounts: accountCount,
					billingCycle: 'Monthly',
					nextBilling: getNextBillingDate()
				}
			}
		};
	} catch (error) {
		console.error('Error loading settings data:', error);
		// Fallback to basic data from locals.user
		return {
			userSettings: {
				profile: {
					name: locals.user.name || locals.user.email,
					email: locals.user.email,
					company: locals.user.company || '',
					role: locals.user.role || 'CLIENT',
					avatar: locals.user.avatar || `/api/avatar/${locals.user.email}`
				},
				notifications: {
					emailAlerts: true,
					pushNotifications: true,
					weeklyReports: true,
					securityAlerts: true
				},
				security: {
					twoFactorEnabled: locals.user.isTwoFactorEnabled || false,
					lastPasswordChange: formatDate(locals.user.lastLoginAt) || '',
					activeSessions: 1
				},
				api: {
					apiKey: generateApiKey(locals.user.id),
					webhookUrl: 'https://yourapp.com/webhooks',
					rateLimitRemaining: 5000
				},
				subscription: {
					plan: locals.user.subscription || 'Professional',
					accountLimit: 10,
					currentAccounts: 0,
					billingCycle: 'Monthly',
					nextBilling: getNextBillingDate()
				}
			}
		};
	}
};

async function getUserDetailsFromDatabase(user: any) {
	// Try Prisma first, then fall back to direct SQL
	try {
		// This will fail on NixOS, but we'll catch it and use SQL
		const userDetails = await prisma.user.findUnique({
			where: { id: parseInt(user.id) }
		});
		
		return userDetails || {};
	} catch (error) {
		console.log('⚠️  Prisma failed, using direct SQL for settings user data');
		return await getUserDetailsDirectSQL(user);
	}
}

async function getUserDetailsDirectSQL(user: any) {
	const { Client } = pg;
	const client = new Client({
		connectionString: process.env.DATABASE_URL || "postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30"
	});

	try {
		await client.connect();
		
		const userQuery = `
			SELECT 
				id, email, name, company, role,
				active, is_two_factor_enabled, avatar, subscription,
				created_at, updated_at, last_login_at
			FROM users 
			WHERE id = $1 OR email = $2
			LIMIT 1
		`;
		
		const result = await client.query(userQuery, [user.id, user.email]);
		
		if (result.rows.length > 0) {
			const row = result.rows[0];
			return {
				id: row.id,
				email: row.email,
				name: row.name || row.email,
				company: row.company,
				role: row.role,
				isActive: row.active,
				twoFactorEnabled: row.is_two_factor_enabled,
				avatar: row.avatar,
				subscription: row.subscription,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
				lastLoginAt: row.last_login_at,
				emailAlerts: true, // Default values since these columns may not exist
				pushNotifications: true,
				weeklyReports: true,
				securityAlerts: true,
				webhookUrl: 'https://yourapp.com/webhooks',
				lastPasswordChange: formatDate(row.updated_at)
			};
		}
		
		return {};

	} catch (sqlError) {
		console.error('Direct SQL query failed for user settings:', sqlError);
		return {};
	} finally {
		await client.end();
	}
}

async function getUserAccountCount(user: any): Promise<number> {
	// Try Prisma first, then fall back to direct SQL
	try {
		const count = await prisma.igAccount.count({
			where: {
				OR: [
					{ ownerId: parseInt(user.id) },
					...(user.email.includes('@gmail.com') ? [{ model: 'Dillion' }] : []),
					...(user.email.includes('@hotmail.') || user.email.includes('@live.') || user.email.includes('@outlook.') ? [{ model: 'katie' }] : [])
				]
			}
		});
		
		return count;
	} catch (error) {
		console.log('⚠️  Using direct SQL for account count');
		return await getUserAccountCountDirectSQL(user);
	}
}

async function getUserAccountCountDirectSQL(user: any): Promise<number> {
	const { Client } = pg;
	const client = new Client({
		connectionString: process.env.DATABASE_URL || "postgresql://iglogin:boutiquepassword123@5.78.151.248:5432/igloginagent?sslmode=disable&connect_timeout=30"
	});

	try {
		await client.connect();
		
		// Build dynamic query based on user's model access
		let modelFilter = '';
		
		// Add model-based access for Gmail users
		if (user.email && user.email.includes('@gmail.com')) {
			modelFilter = `OR (model = 'Dillion' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
		}
		
		// Add model-based access for Hotmail/Live/Outlook users
		if (user.email && (
			user.email.includes('@hotmail.') || 
			user.email.includes('@live.') || 
			user.email.includes('@outlook.')
		)) {
			modelFilter = `OR (model = 'katie' AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))`;
		}
		
		const countQuery = `
			SELECT COUNT(*) as count
			FROM ig_accounts 
			WHERE (
				(owner_id = $1 AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				OR 
				(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND (account_type != 'ML_TREND_FINDER' OR account_type IS NULL))
				${modelFilter}
			)
		`;
		
		const result = await client.query(countQuery, [user.id]);
		return parseInt(result.rows[0].count) || 0;

	} finally {
		await client.end();
	}
}

function generateApiKey(userId: string): string {
	// Generate a consistent API key based on user ID
	const hash = createHash('md5').update(`api_key_${userId}_boutique`).digest('hex');
	return `sk_live_${hash.substring(0, 20)}`;
}

function formatDate(date: Date | string | null): string {
	if (!date) return '';
	
	try {
		const d = new Date(date);
		return d.toISOString().split('T')[0]; // YYYY-MM-DD format
	} catch {
		return '';
	}
}

function getNextBillingDate(): string {
	// Calculate next billing date (next month)
	const nextMonth = new Date();
	nextMonth.setMonth(nextMonth.getMonth() + 1);
	return formatDate(nextMonth);
}