import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json(
				{ 
					success: false, 
					error: 'Not authenticated' 
				},
				{ status: 401 }
			);
		}

		return json({
			success: true,
			user: locals.user
		});

	} catch (error) {
		console.error('Get user API error:', error);
		return json(
			{ 
				success: false, 
				error: 'Internal server error' 
			},
			{ status: 500 }
		);
	}
};