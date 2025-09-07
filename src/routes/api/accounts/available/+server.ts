import { json } from '@sveltejs/kit';
import { getAvailableAccounts } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// GET /api/accounts/available - Get available accounts for assignment
export const GET: RequestHandler = async ({ url }) => {
	try {
		const limitParam = url.searchParams.get('limit');
		const limit = limitParam ? parseInt(limitParam) : 50;

		const accounts = await getAvailableAccounts(limit);
		return json(accounts);
	} catch (error) {
		console.error('Failed to fetch available accounts:', error);
		return json(
			{ error: 'Failed to fetch available accounts' },
			{ status: 500 }
		);
	}
};