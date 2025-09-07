import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb, getAccountsCount, query } from '$lib/server/db-loader';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		// Get dashboard statistics
		const stats = await getDashboardStats();
		
		return json(stats);
	} catch (error) {
		console.error('Dashboard stats error:', error);
		return json(
			{ error: 'Failed to load dashboard statistics' }, 
			{ status: 500 }
		);
	}
};

async function getDashboardStats() {
	try {
		// Get database instance  
		const db = await getDb();
		
		// Total accounts in system
		const totalAccounts = await getAccountsCount();
		
		// Default values for scraping-specific metrics
		let scrapedAccounts = 0;
		let activeSessions = 0;
		let totalRequestUnits = 0;
		let usedBudget = 0;
		
		// Try to get scraping-specific data if tables exist
		try {
			// Accounts with scraping metrics (have been scraped at least once)
			const scrapedAccountsResult = await query(`
				SELECT COUNT(DISTINCT account_id) as count
				FROM account_metrics
			`);
			scrapedAccounts = parseInt(scrapedAccountsResult?.rows?.[0]?.count || '0');
		} catch (error) {
			console.log('account_metrics table not found, using default value 0');
		}
		
		try {
			// Active scraping sessions
			const activeSessionsResult = await query(`
				SELECT COUNT(*) as count
				FROM scraping_sessions
				WHERE status IN ('INITIALIZING', 'RUNNING', 'PAUSED')
			`);
			activeSessions = parseInt(activeSessionsResult?.rows?.[0]?.count || '0');
		} catch (error) {
			console.log('scraping_sessions table not found, using default value 0');
		}
		
		try {
			// Monthly budget calculations
			const now = new Date();
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			
			const budgetResult = await query(`
				SELECT 
					COALESCE(SUM(total_request_units), 0) as total_units,
					COALESCE(SUM(estimated_cost), 0) as total_cost
				FROM scraping_sessions
				WHERE created_at >= $1
			`, [monthStart]);
			
			totalRequestUnits = parseInt(budgetResult?.rows?.[0]?.total_units || '0');
			usedBudget = parseFloat(budgetResult?.rows?.[0]?.total_cost || '0');
		} catch (error) {
			console.log('scraping_sessions table not found for budget calculation, using default values');
		}
		
		const monthlyBudget = 100.00; // Default monthly budget - could be configurable
		
		return {
			totalAccounts: parseInt(totalAccounts.toString()),
			scrapedAccounts,
			activeSessions,
			totalRequestUnits,
			monthlyBudget,
			usedBudget
		};
		
	} catch (error) {
		console.error('Error calculating dashboard stats:', error);
		
		// Fallback with basic account count
		const fallbackCount = await getAccountsCount();
		return {
			totalAccounts: parseInt(fallbackCount.toString()),
			scrapedAccounts: 0,
			activeSessions: 0,
			totalRequestUnits: 0,
			monthlyBudget: 100.00,
			usedBudget: 0
		};
	}
}