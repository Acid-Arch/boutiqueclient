import { json } from '@sveltejs/kit';
import { unassignAccountFromClone } from '$lib/server/database.js';
import type { RequestHandler } from './$types';

// POST /api/devices/unassign - Unassign account from clone
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { deviceId, cloneNumber } = body;

		if (!deviceId || cloneNumber === undefined) {
			return json(
				{ error: 'Missing required fields: deviceId, cloneNumber' },
				{ status: 400 }
			);
		}

		const success = await unassignAccountFromClone(deviceId, cloneNumber);
		
		if (success) {
			return json({ 
				message: `Successfully unassigned account from device ${deviceId} clone ${cloneNumber}` 
			});
		} else {
			return json(
				{ error: 'Failed to unassign account from clone. The clone may not have an assigned account.' },
				{ status: 400 }
			);
		}
	} catch (error) {
		console.error('Failed to unassign account from clone:', error);
		return json(
			{ error: 'An error occurred while unassigning the account' },
			{ status: 500 }
		);
	}
};