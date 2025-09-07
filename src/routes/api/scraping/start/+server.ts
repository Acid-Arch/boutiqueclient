import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query } from '$lib/server/db-loader';

interface ScrapingRequest {
	accountIds: number[];
	sessionType?: string;
	config?: {
		includeFollowers?: boolean;
		includeFollowing?: boolean;
		includeRecentMedia?: boolean;
		includeStories?: boolean;
		includeHighlights?: boolean;
		maxFollowersToFetch?: number;
		maxFollowingToFetch?: number;
		maxMediaToFetch?: number;
		recentMediaDays?: number;
	};
	priority?: 'LOW' | 'NORMAL' | 'HIGH';
	scheduledFor?: Date;
	tags?: string[];
	notes?: string;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		console.log('🔄 Starting scraping session API request...');
		const requestData: ScrapingRequest = await request.json();
		console.log('📋 Request data received:', JSON.stringify(requestData, null, 2));
		
		// Validate request
		if (!requestData.accountIds || !Array.isArray(requestData.accountIds) || requestData.accountIds.length === 0) {
			throw error(400, 'Account IDs are required');
		}
		
		// Validate account IDs
		for (const accountId of requestData.accountIds) {
			if (!Number.isInteger(accountId) || accountId <= 0) {
				throw error(400, `Invalid account ID: ${accountId}`);
			}
		}
		console.log('✅ Account IDs validated');
		
		// Check if accounts exist
		console.log('🔍 Validating accounts exist...');
		const existingAccounts = await validateAccounts(requestData.accountIds);
		console.log('📊 Found accounts:', existingAccounts);
		
		if (existingAccounts.length !== requestData.accountIds.length) {
			const missingIds = requestData.accountIds.filter(id => !existingAccounts.some((acc: any) => acc.id === id));
			throw error(400, `Accounts not found: ${missingIds.join(', ')}`);
		}
		
		// Create scraping session
		console.log('🏗️ Creating scraping session...');
		const sessionId = await createScrapingSession(requestData, existingAccounts);
		console.log('✅ Session created successfully:', sessionId);
		
		// TODO: In a real implementation, this would trigger the actual scraping process
		// For now, we'll just create the session record
		
		return json({
			success: true,
			sessionId,
			message: 'Scraping session created successfully',
			accountCount: requestData.accountIds.length,
			sessionType: requestData.sessionType || 'ACCOUNT_METRICS'
		});
		
	} catch (err) {
		console.error('Start scraping error:', err);
		
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		
		return json(
			{ error: 'Failed to start scraping session' }, 
			{ status: 500 }
		);
	}
};

async function validateAccounts(accountIds: number[]) {
	try {
		const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(', ');
		const validateQuery = `
			SELECT id, instagram_username as username, status
			FROM ig_accounts
			WHERE id IN (${placeholders})
		`;
		
		const result = await query(validateQuery, accountIds);
		return result?.rows || [];
		
	} catch (error) {
		console.error('Error validating accounts:', error);
		throw new Error('Failed to validate accounts');
	}
}

async function createScrapingSession(requestData: ScrapingRequest, accounts: any[]): Promise<string> {
	try {
		console.log('🔧 Creating scraping session function called');
		// Generate session ID
		const sessionId = crypto.randomUUID();
		console.log('🆔 Generated session ID:', sessionId);
		
		// Prepare session data
		const now = new Date();
		const sessionType = requestData.sessionType || 'ACCOUNT_METRICS';
		const totalAccounts = accounts.length;
		console.log('📊 Session preparation - Type:', sessionType, 'Total accounts:', totalAccounts);
		
		// Estimate cost (rough calculation - would be more accurate with HikerAPI pricing)
		const baseUnitsPerAccount = 10; // Base units for profile scraping
		const mediaUnits = requestData.config?.includeRecentMedia ? 5 : 0;
		const followerUnits = requestData.config?.includeFollowers ? 20 : 0;
		
		const estimatedUnitsPerAccount = baseUnitsPerAccount + mediaUnits + followerUnits;
		const totalEstimatedUnits = estimatedUnitsPerAccount * totalAccounts;
		const estimatedCost = totalEstimatedUnits * 0.001; // $0.001 per unit (example pricing)
		
		// Create session record with proper schema matching
		const sessionQuery = `
			INSERT INTO scraping_sessions (
				id,
				session_type,
				status,
				account_ids,
				scraping_config,
				total_accounts,
				completed_accounts,
				failed_accounts,
				skipped_accounts,
				progress,
				estimated_completion,
				total_request_units,
				estimated_cost,
				error_count,
				triggered_by,
				trigger_source
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
			)
		`;
		
		// Estimate completion time (rough calculation)
		const estimatedDuration = totalAccounts * 10000; // 10 seconds per account
		const estimatedCompletion = new Date(now.getTime() + estimatedDuration);
		
		// Prepare account IDs and config as JSON
		const accountIds = JSON.stringify(requestData.accountIds);
		const scrapingConfig = JSON.stringify(requestData.config || {});
		console.log('🔄 Prepared JSON data - AccountIds:', accountIds, 'Config:', scrapingConfig);
		
		const sessionParams = [
			sessionId,                  // $1: id
			sessionType,               // $2: session_type 
			'PENDING',                 // $3: status
			accountIds,                // $4: account_ids (jsonb)
			scrapingConfig,            // $5: scraping_config (jsonb)
			totalAccounts,             // $6: total_accounts
			0,                         // $7: completed_accounts
			0,                         // $8: failed_accounts
			0,                         // $9: skipped_accounts
			0,                         // $10: progress
			estimatedCompletion,       // $11: estimated_completion
			0,                         // $12: total_request_units
			estimatedCost,             // $13: estimated_cost
			0,                         // $14: error_count
			'system',                  // $15: triggered_by
			'API'                      // $16: trigger_source
		];
		
		console.log('💾 About to execute query with params:', sessionParams);
		console.log('📝 Query:', sessionQuery);
		
		await query(sessionQuery, sessionParams);
		console.log('✅ Session inserted successfully');
		
		// Log session creation
		await logSessionEvent(sessionId, 'INFO', `Scraping session created for ${totalAccounts} accounts`, {
			accountIds: requestData.accountIds,
			sessionType,
			estimatedCost,
			config: requestData.config
		});
		
		return sessionId;
		
	} catch (error) {
		console.error('Error creating scraping session:', error);
		throw new Error('Failed to create scraping session');
	}
}

async function logSessionEvent(sessionId: string, level: string, message: string, details: any = {}) {
	try {
		const logQuery = `
			INSERT INTO scraping_logs (
				id, session_id, level, message, source, details
			) VALUES (
				gen_random_uuid(), $1, $2, $3, $4, $5
			)
		`;
		
		await query(logQuery, [
			sessionId,           // $1: session_id
			level,               // $2: level 
			message,             // $3: message
			'SESSION_MANAGER',   // $4: source (valid ScrapingSource enum value)
			JSON.stringify(details)  // $5: details (jsonb)
		]);
		
	} catch (error) {
		// Don't throw on logging errors
		console.error('Error logging session event:', error);
	}
}