import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '$lib/server/auth.js';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request }) => {
	// Only allow in development mode
	if (!dev) {
		return json(
			{ 
				success: false, 
				error: 'Not available in production' 
			},
			{ status: 403 }
		);
	}

	try {
		const { email, username, password, firstName, lastName, company } = await request.json();

		// Create test user
		const user = await AuthService.createUser({
			email: email || 'test@domain.com',
			username: username || 'jorge',
			password: password || 'password123',
			firstName: firstName || 'Jorge',
			lastName: lastName || 'Martinez',
			company: company || '',
			role: 'CLIENT',
			subscription: 'Premium',
			accountsLimit: 50
		});

		return json({
			success: true,
			message: 'Test user created successfully',
			user: {
				id: user.id,
				email: user.email,
				username: user.username,
				firstName: user.firstName,
				lastName: user.lastName,
				company: user.company
			}
		});

	} catch (error: any) {
		console.error('Create test user error:', error);
		
		// Handle unique constraint errors
		if (error.code === 'P2002') {
			return json(
				{ 
					success: false, 
					error: 'User with this email or username already exists' 
				},
				{ status: 400 }
			);
		}

		return json(
			{ 
				success: false, 
				error: 'Internal server error' 
			},
			{ status: 500 }
		);
	}
};