import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { query, getDb } from '$lib/server/db-loader';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const search = url.searchParams.get('search') || '';
		const status = url.searchParams.get('status') || 'all';
		
		const offset = (page - 1) * limit;
		
		// Build query conditions
		let whereConditions = [];
		let queryParams = [];
		let paramIndex = 1;
		
		if (search.trim()) {
			whereConditions.push(`ia.instagram_username ILIKE $${paramIndex}`);
			queryParams.push(`%${search.trim()}%`);
			paramIndex++;
		}
		
		if (status !== 'all') {
			whereConditions.push(`COALESCE(latest_metrics.scraping_status, 'PENDING') = $${paramIndex}`);
			queryParams.push(status);
			paramIndex++;
		}
		
		const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
		
		// Main query to get accounts with latest scraping info
		const accountsQuery = `
			SELECT 
				ia.id,
				ia.instagram_username as username,
				ia.status,
				latest_metrics.last_scraped,
				COALESCE(latest_metrics.scraping_status, 'PENDING') as scraping_status
			FROM ig_accounts ia
			LEFT JOIN (
				SELECT 
					account_id,
					MAX(scraped_at) as last_scraped,
					scraping_status,
					ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY scraped_at DESC) as rn
				FROM account_metrics
				GROUP BY account_id, scraping_status, scraped_at
			) latest_metrics ON ia.id = latest_metrics.account_id AND latest_metrics.rn = 1
			${whereClause}
			ORDER BY 
				CASE WHEN latest_metrics.last_scraped IS NOT NULL THEN latest_metrics.last_scraped ELSE ia.created_at END DESC
			LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
		`;
		
		queryParams.push(limit, offset);
		
		// Count query for total
		const countQuery = `
			SELECT COUNT(*) as total
			FROM ig_accounts ia
			LEFT JOIN (
				SELECT 
					account_id,
					scraping_status,
					ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY scraped_at DESC) as rn
				FROM account_metrics
			) latest_metrics ON ia.id = latest_metrics.account_id AND latest_metrics.rn = 1
			${whereClause}
		`;
		
		const countParams = queryParams.slice(0, -2); // Remove limit and offset
		
		// Execute queries
		const [accountsResult, countResult] = await Promise.all([
			query(accountsQuery, queryParams),
			query(countQuery, countParams)
		]);
		
		const accounts = accountsResult?.rows || [];
		const total = parseInt(countResult?.rows?.[0]?.total || '0');
		
		return json({
			accounts: accounts.map((account: any) => ({
				id: account.id,
				username: account.username,
				status: account.status,
				lastScraped: account.last_scraped,
				scrapingStatus: account.scraping_status
			})),
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit)
		});
		
	} catch (error) {
		console.error('Accounts API error:', error);
		
		// Fallback to basic account list
		try {
			const db = await getDb();
			const fallbackAccounts = await db.getAccounts(20, 0);
			const totalCount = await db.getAccountsCount();
			
			return json({
				accounts: fallbackAccounts.map((account: any) => ({
					id: account.id,
					username: account.username,
					status: account.status,
					lastScraped: null,
					scrapingStatus: 'PENDING'
				})),
				total: totalCount,
				page: 1,
				limit: 20,
				totalPages: Math.ceil(totalCount / 20)
			});
		} catch (fallbackError) {
			console.error('Fallback accounts error:', fallbackError);
			return json(
				{ error: 'Failed to load accounts' }, 
				{ status: 500 }
			);
		}
	}
};