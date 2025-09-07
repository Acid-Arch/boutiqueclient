import { json } from '@sveltejs/kit';
import { costAnalyticsManager } from '$lib/server/scraping/cost-analytics';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	try {
		// Get timeframe from query parameters
		const timeframe = (url.searchParams.get('timeframe') as '7d' | '30d' | '90d' | '1y') || '30d';
		
		// Validate timeframe
		const validTimeframes = ['7d', '30d', '90d', '1y'];
		if (!validTimeframes.includes(timeframe)) {
			return json(
				{ 
					error: 'Invalid timeframe', 
					message: 'Timeframe must be one of: 7d, 30d, 90d, 1y' 
				}, 
				{ status: 400 }
			);
		}

		// Get cost analytics data
		const analyticsData = await costAnalyticsManager.getCostAnalytics({ timeframe });
		
		// Get cost optimization recommendations
		const recommendations = await costAnalyticsManager.getCostOptimizationRecommendations();

		return json({
			success: true,
			timeframe,
			...analyticsData,
			recommendations,
			metadata: {
				generatedAt: new Date().toISOString(),
				requestId: crypto.randomUUID(),
				version: '1.0'
			}
		});

	} catch (error) {
		console.error('Cost analytics API error:', error);
		
		return json(
			{ 
				success: false,
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error occurred',
				timeframe: url.searchParams.get('timeframe') || '30d'
			}, 
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action, sessionId, currentCost, requestUnits } = body;

		if (action === 'update-real-time-cost') {
			// Validate required fields
			if (!sessionId || currentCost === undefined || requestUnits === undefined) {
				return json(
					{ 
						success: false,
						error: 'Missing required fields',
						message: 'sessionId, currentCost, and requestUnits are required for real-time cost updates'
					},
					{ status: 400 }
				);
			}

			// Update real-time cost
			await costAnalyticsManager.updateRealTimeCost(sessionId, currentCost, requestUnits);

			return json({
				success: true,
				message: 'Real-time cost updated successfully',
				sessionId,
				updatedAt: new Date().toISOString()
			});
		}

		return json(
			{
				success: false,
				error: 'Invalid action',
				message: 'Supported actions: update-real-time-cost'
			},
			{ status: 400 }
		);

	} catch (error) {
		console.error('Cost analytics POST error:', error);
		
		return json(
			{
				success: false,
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};