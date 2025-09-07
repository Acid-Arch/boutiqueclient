import { json } from '@sveltejs/kit';
import { getDeviceDetails } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// GET /api/devices/[deviceId] - Get specific device details
export const GET: RequestHandler = async ({ params }) => {
	try {
		const { deviceId } = params;
		
		if (!deviceId) {
			return json(
				{ error: 'Device ID is required' },
				{ status: 400 }
			);
		}

		const deviceDetails = await getDeviceDetails(deviceId);
		
		if (!deviceDetails.device) {
			return json(
				{ error: 'Device not found' },
				{ status: 404 }
			);
		}

		return json(deviceDetails);
	} catch (error) {
		console.error('Failed to fetch device details:', error);
		return json(
			{ error: 'Failed to fetch device details' },
			{ status: 500 }
		);
	}
};