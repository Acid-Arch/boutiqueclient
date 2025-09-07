import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionById } from '$lib/server/scraping/session-manager.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const sessionId = params.sessionId;
		
		if (!sessionId) {
			throw error(400, 'Session ID is required');
		}
		
		// Use standardized session manager
		const sessionData = await getSessionById(sessionId);
		
		if (!sessionData) {
			throw error(404, 'Session not found');
		}
		
		return json({
			success: true,
			data: sessionData
		});
		
	} catch (err) {
		console.error('Session API error:', err);
		
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		
		const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
		
		return json(
			{ 
				success: false,
				error: 'Failed to load session',
				details: errorMessage,
				data: null
			}, 
			{ status: 500 }
		);
	}
};

