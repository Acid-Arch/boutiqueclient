import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AuthService } from '$lib/server/auth-direct.ts';
import { validateIPAccess, recordFailedAttempt } from '$lib/server/ip-whitelist.ts';
import { validateAPIRequest } from '$lib/server/validation/middleware.js';
import { LoginSchema } from '$lib/server/validation/schemas.js';

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

		// Step 2: Authenticate user credentials
		const loginResult = await AuthService.authenticateUser(emailOrUsername.trim(), password);

		if (!loginResult.success) {
			// Record failed authentication attempt for rate limiting
			if (ipValidation.publicIP) {
				await recordFailedAttempt(ipValidation.publicIP, loginResult.user?.id);
			}
			
			return json(
				{ 
					success: false, 
					error: loginResult.error || 'Invalid credentials' 
				},
				{ status: 401 }
			);
		}

		// Step 3: Final IP validation with user context
		// Re-validate with user ID for user-specific rules
		if (loginResult.user) {
			const finalIPValidation = await validateIPAccess(
				request, 
				loginResult.user.id, 
				loginResult.user.email
			);
			
			if (!finalIPValidation.allowed) {
				// Record failed attempt
				if (finalIPValidation.publicIP) {
					await recordFailedAttempt(finalIPValidation.publicIP, loginResult.user.id);
				}
				
				return json(
					{
						success: false,
						error: 'Access denied for your account from this location',
						details: {
							reason: finalIPValidation.reason,
							publicIP: finalIPValidation.publicIP,
							code: 'USER_IP_ACCESS_DENIED'
						}
					},
					{ status: 403 }
				);
			}
		}

		// Create session
		const sessionToken = AuthService.generateSessionToken();
		const cookieOptions = AuthService.getSessionCookieOptions();

		// Set longer expiration for "remember me"
		if (rememberMe) {
			cookieOptions.maxAge = 30 * 24 * 60 * 60; // 30 days
		}

		// Set session cookie with user ID
		cookies.set('session', `${loginResult.user!.id}:${sessionToken}`, cookieOptions);

		return json({
			success: true,
			user: loginResult.user
		});

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