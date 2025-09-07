import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

// Lightweight health check for load balancers
// This endpoint should be fast and not perform heavy operations
export const GET: RequestHandler = async () => {
	try {
		// Very basic check - just ensure the server is responding
		const timestamp = new Date().toISOString();
		const uptime = process.uptime();
		
		return json({
			status: 'ok',
			timestamp,
			uptime: Math.floor(uptime)
		}, {
			status: 200,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Content-Type': 'application/json'
			}
		});
		
	} catch (error) {
		return json({
			status: 'error',
			timestamp: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Unknown error'
		}, {
			status: 503,
			headers: {
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Content-Type': 'application/json'
			}
		});
	}
};