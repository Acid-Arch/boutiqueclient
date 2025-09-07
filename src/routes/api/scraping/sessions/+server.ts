import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	getSessions, 
	createBulkSession, 
	startSession, 
	pauseSession, 
	cancelSession,
	updateSessionProgress,
	getSessionStats
} from '$lib/server/scraping/session-manager';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		const action = url.searchParams.get('action');
		
		// Handle stats request
		if (action === 'stats') {
			const stats = await getSessionStats();
			return json({
				success: true,
				stats
			});
		}
		
		// Handle regular sessions listing
		const status = url.searchParams.get('status') || 'all';
		const limit = parseInt(url.searchParams.get('limit') || '20');
		const page = parseInt(url.searchParams.get('page') || '1');
		
		const result = await getSessions({
			status,
			limit,
			page
		});
		
		return json({
			success: true,
			...result
		});
		
	} catch (error) {
		console.error('Sessions API error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		
		const fallbackPage = parseInt(url.searchParams.get('page') || '1');
		const fallbackLimit = parseInt(url.searchParams.get('limit') || '20');
		
		return json(
			{ 
				success: false,
				error: 'Failed to load sessions',
				details: errorMessage,
				sessions: [],
				total: 0,
				page: fallbackPage,
				limit: fallbackLimit,
				totalPages: 0
			}, 
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const data = await request.json();
		const { action, sessionId, sessionType, targetAccounts, options } = data;
		
		switch (action) {
			case 'create':
				if (!sessionType || !targetAccounts || !Array.isArray(targetAccounts)) {
					return json(
						{ success: false, error: 'Missing required fields: sessionType, targetAccounts' },
						{ status: 400 }
					);
				}
				
				const newSessionId = await createBulkSession(sessionType, targetAccounts, options || {});
				return json({
					success: true,
					sessionId: newSessionId,
					message: 'Bulk scraping session created successfully'
				});
			
			case 'start':
				if (!sessionId) {
					return json(
						{ success: false, error: 'Missing required field: sessionId' },
						{ status: 400 }
					);
				}
				
				await startSession(sessionId);
				return json({
					success: true,
					message: 'Session started successfully'
				});
			
			case 'pause':
				if (!sessionId) {
					return json(
						{ success: false, error: 'Missing required field: sessionId' },
						{ status: 400 }
					);
				}
				
				await pauseSession(sessionId);
				return json({
					success: true,
					message: 'Session paused successfully'
				});
			
			case 'cancel':
				if (!sessionId) {
					return json(
						{ success: false, error: 'Missing required field: sessionId' },
						{ status: 400 }
					);
				}
				
				const { reason } = data;
				await cancelSession(sessionId, reason);
				return json({
					success: true,
					message: 'Session cancelled successfully'
				});
			
			case 'updateProgress':
				if (!sessionId) {
					return json(
						{ success: false, error: 'Missing required field: sessionId' },
						{ status: 400 }
					);
				}
				
				const { progress } = data;
				await updateSessionProgress(sessionId, progress);
				return json({
					success: true,
					message: 'Session progress updated successfully'
				});
			
			default:
				return json(
					{ success: false, error: 'Invalid action specified' },
					{ status: 400 }
				);
		}
		
	} catch (error) {
		console.error('Sessions POST API error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		
		return json(
			{ 
				success: false,
				error: 'Failed to process session request',
				details: errorMessage
			}, 
			{ status: 500 }
		);
	}
};