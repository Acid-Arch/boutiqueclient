import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Use the smart database loader that handles Prisma/fallback automatically
		const { getAccountStats } = await import('$lib/server/db-loader.js');
		const stats = await getAccountStats();
		
		// Generate trend data (simulated for now - in a real app this would come from historical data)
		const generateTrendData = (current: number) => {
			// Simulate some realistic variance (±5-15%)
			const variance = 0.05 + Math.random() * 0.10;
			const direction = Math.random() > 0.6 ? 1 : -1; // 60% chance of positive trend
			return Math.max(0, Math.round(current * (1 + (direction * variance))));
		};

		const availableCount = stats.byStatus['Unused'] || 0;
		const issueCount = (stats.byStatus['Login Error'] || 0) + 
						  (stats.byStatus['Password Error'] || 0) + 
						  (stats.byStatus['Critical Error'] || 0);
		const inProgressCount = stats.byStatus['Login In Progress'] || 0;

		const trendData = {
			total: {
				current: stats.total,
				previous: generateTrendData(stats.total)
			},
			available: {
				current: availableCount,
				previous: generateTrendData(availableCount)
			},
			issues: {
				current: issueCount,
				previous: generateTrendData(issueCount)
			},
			inProgress: {
				current: inProgressCount,
				previous: generateTrendData(inProgressCount)
			}
		};

		// Add some additional metadata for the API response
		const responseData = {
			stats,
			trendData,
			metadata: {
				timestamp: new Date().toISOString(),
				version: '1.0.0',
				cached: false // Could be used for caching optimization later
			}
		};

		// Add appropriate cache headers for optimal refresh behavior
		const headers = new Headers({
			'Cache-Control': 'no-cache, no-store, must-revalidate',
			'Pragma': 'no-cache',
			'Expires': '0'
		});

		return json({
			success: true,
			data: responseData
		}, { 
			status: 200,
			headers
		});

	} catch (error) {
		console.error('Failed to load dashboard data:', error);
		
		// Return error response with appropriate status
		return json({
			success: false,
			error: 'Failed to retrieve dashboard data',
			details: error instanceof Error ? error.message : 'Unknown error'
		}, { 
			status: 500,
			headers: {
				'Cache-Control': 'no-cache'
			}
		});
	}
};