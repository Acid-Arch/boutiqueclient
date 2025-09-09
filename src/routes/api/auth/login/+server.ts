import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateIPAccess, recordFailedAttempt } from '$lib/server/ip-whitelist.ts';
import { validateAPIRequest } from '$lib/server/validation/middleware.js';
import { LoginSchema } from '$lib/server/validation/schemas.js';
import { signIn } from '../../../../auth-production.ts';

export const POST: RequestHandler = async (event) => {
	console.log('🔐 Login API endpoint called');
	
	// Comprehensive validation with rate limiting
	const validation = await validateAPIRequest(event, {
		bodySchema: LoginSchema,
		rateLimit: {
			requests: 5, // 5 attempts
			windowMs: 15 * 60 * 1000 // per 15 minutes
		},
		logRequest: true
	});

	if (!validation.success) {
		return validation.response;
	}

	const { emailOrUsername, password, rememberMe } = validation.body!;
	const { request, cookies } = event;
	
	try {
		console.log('📧 Login attempt for:', emailOrUsername);

		// Step 1: IP Whitelist validation (before credential check)
		const ipValidation = await validateIPAccess(request, undefined, emailOrUsername.trim());
		
		if (!ipValidation.allowed) {
			// Record failed attempt for rate limiting
			if (ipValidation.publicIP) {
				await recordFailedAttempt(ipValidation.publicIP);
			}
			
			return json(
				{
					success: false,
					error: 'Access denied',
					details: {
						reason: ipValidation.reason,
						publicIP: ipValidation.publicIP,
						code: 'IP_ACCESS_DENIED'
					}
				},
				{ status: 403 }
			);
		}

		// Step 2: Use Auth.js to handle authentication and session creation
		try {
			// Use Auth.js signIn with credentials provider
			const authResult = await signIn('credentials', {
				email: emailOrUsername.trim(),
				password: password,
				redirect: false // Don't redirect, return the result
			});

			if (authResult?.error) {
				// Record failed authentication attempt for rate limiting
				if (ipValidation.publicIP) {
					await recordFailedAttempt(ipValidation.publicIP);
				}
				
				return json(
					{ 
						success: false, 
						error: 'Invalid credentials' 
					},
					{ status: 401 }
				);
			}

			// Auth.js handles session creation automatically
			return json({
				success: true,
				redirectUrl: '/client-portal'
			});

		} catch (authError) {
			console.error('Auth.js signin error:', authError);
			
			// Record failed authentication attempt for rate limiting
			if (ipValidation.publicIP) {
				await recordFailedAttempt(ipValidation.publicIP);
			}
			
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