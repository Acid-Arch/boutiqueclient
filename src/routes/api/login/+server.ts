import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateAPIRequest } from '$lib/server/validation/middleware.js';
import { LoginSchema } from '$lib/server/validation/schemas.js';
import { signIn } from '../../../auth.js';
import { AuthService } from '$lib/server/auth-direct.js';

export const POST: RequestHandler = async (event) => {
	console.log('🔐 Login API endpoint called');
	const { request } = event;
	
	let emailOrUsername: string;
	let password: string;
	let rememberMe: boolean = false;
	
	// Simple JSON parsing without middleware conflicts
	try {
		const body = await request.json();
		emailOrUsername = body.emailOrUsername;
		password = body.password;
		rememberMe = body.rememberMe || false;
		
		// Basic validation
		if (!emailOrUsername || !password) {
			return json({
				success: false,
				error: 'Email and password are required'
			}, { status: 400 });
		}
	} catch (error) {
		return json({
			success: false,
			error: 'Invalid JSON in request body'
		}, { status: 400 });
	}
	
	try {
		console.log('📧 Login attempt for:', emailOrUsername);

		// Use AuthService directly for credentials authentication
		try {
			// Authenticate user directly with AuthService
			const result = await AuthService.authenticateUser(
				emailOrUsername.trim(),
				password
			);

			if (result.success && result.user) {
				console.log('✅ Authentication successful for:', emailOrUsername);
				
				// For direct API login, we'll need to create a manual session
				// This is a temporary solution until we fix Auth.js integration
				return json({
					success: true,
					user: {
						id: result.user.id,
						email: result.user.email,
						name: result.user.name,
						role: result.user.role
					},
					redirectUrl: '/client-portal'
				});
			} else {
				console.log('❌ Authentication failed for:', emailOrUsername, 'Error:', result.error);
				return json(
					{ 
						success: false, 
						error: 'Invalid credentials' 
					},
					{ status: 401 }
				);
			}

		} catch (authError) {
			console.error('Authentication error:', authError);
			
			return json(
				{ 
					success: false, 
					error: 'Authentication failed' 
				},
				{ status: 401 }
			);
		}

	} catch (error) {
		console.error('Login API error:', error);
		return json(
			{ 
				success: false, 
				error: 'Internal server error' 
			},
			{ status: 500 }
		);
	}
};