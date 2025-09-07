import { json } from '@sveltejs/kit';
import { assignAccountToClone } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// POST /api/devices/assign - Assign account to clone
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { deviceId, cloneNumber, instagramUsername } = body;

		if (!deviceId || cloneNumber === undefined || !instagramUsername) {
			return json(
				{ error: 'Missing required fields: deviceId, cloneNumber, instagramUsername' },
				{ status: 400 }
			);
		}

		const success = await assignAccountToClone(deviceId, cloneNumber, instagramUsername);
		
		if (success) {
			return json({ 
				message: `Successfully assigned ${instagramUsername} to device ${deviceId} clone ${cloneNumber}` 
			});
		} else {
			return json(
				{ error: 'Failed to assign account to clone. The clone may already be assigned or the account may not exist.' },
				{ status: 400 }
			);
		}
	} catch (error) {
		console.error('Failed to assign account to clone:', error);
		return json(
			{ error: 'An error occurred while assigning the account' },
			{ status: 500 }
		);
	}
};