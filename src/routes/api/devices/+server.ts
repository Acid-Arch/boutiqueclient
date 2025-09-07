import { json } from '@sveltejs/kit';
import { 
	getDeviceSummaries, 
	getDeviceStats,
	updateCloneStatus 
} from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// GET /api/devices - Get all devices with summaries
export const GET: RequestHandler = async ({ url }) => {
	try {
		const includeStats = url.searchParams.get('includeStats') === 'true';
		
		const devices = await getDeviceSummaries();
		
		if (includeStats) {
			const stats = await getDeviceStats();
			return json({ devices, stats });
		}
		
		return json(devices);
	} catch (error) {
		console.error('Failed to fetch devices:', error);
		return json(
			{ error: 'Failed to fetch devices' },
			{ status: 500 }
		);
	}
};

// PUT /api/devices - Update device or clone status
export const PUT: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { deviceId, cloneNumber, status } = body;

		if (!deviceId || cloneNumber === undefined || !status) {
			return json(
				{ error: 'Missing required fields: deviceId, cloneNumber, status' },
				{ status: 400 }
			);
		}

		const success = await updateCloneStatus(deviceId, cloneNumber, status);
		
		if (success) {
			return json({ message: 'Clone status updated successfully' });
		} else {
			return json(
				{ error: 'Failed to update clone status' },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error('Failed to update clone status:', error);
		return json(
			{ error: 'Failed to update clone status' },
			{ status: 500 }
		);
	}
};