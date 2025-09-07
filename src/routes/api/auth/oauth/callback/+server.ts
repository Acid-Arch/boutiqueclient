import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { OAuthService, type GoogleProfile } from '$lib/server/oauth-service.js';

/**
 * OAuth Callback Handler
 * Handles post-authentication processing and session creation
 * Works with Auth.js flow to integrate with existing OAuthService
 */

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
  try {
    // Get return URL from cookie
    const returnUrl = cookies.get('oauth_return_url') || '/client-portal';
    
    // Clear return URL cookie
    cookies.delete('oauth_return_url', { path: '/' });
    
    // Check if there's an OAuth error
    const error = url.searchParams.get('error');
    if (error) {
      console.error('OAuth callback error:', error);
      throw redirect(302, `/login?error=oauth_error&message=${encodeURIComponent(error)}`);
    }
    
    // In a real Auth.js flow, the user session would be available in locals.getSession()
    // For now, we'll check if user is already authenticated through our existing hooks
    if (locals.user) {
      // User is already authenticated, redirect to success page
      const successUrl = new URL(returnUrl, url.origin);
      successUrl.searchParams.set('oauth_success', 'true');
      throw redirect(302, successUrl.toString());
    }
    
    // If no user is authenticated, redirect to login
    throw redirect(302, '/login?error=oauth_no_session');
    
  } catch (err) {
    console.error('OAuth callback processing error:', err);
    
    if (err instanceof Error && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }
    
    throw redirect(302, '/login?error=oauth_callback_failed');
  }
};

/**
 * POST handler for webhook-style callbacks
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    
    // Validate webhook payload
    if (!body.user || !body.account || !body.profile) {
      return json({ error: 'Invalid callback payload' }, { status: 400 });
    }
    
    // Extract Google profile from Auth.js payload
    const googleProfile: GoogleProfile = {
      sub: body.profile.id,
      email: body.profile.email,
      name: body.profile.name,
      given_name: body.profile.given_name,
      family_name: body.profile.family_name,
      picture: body.profile.picture
    };
    
    // Validate profile structure
    if (!OAuthService.validateGoogleProfile(googleProfile)) {
      return json({ error: 'Invalid Google profile structure' }, { status: 400 });
    }
    
    // Handle user authentication through OAuthService
    const oauthResult = await OAuthService.handleGoogleCallback(googleProfile);
    
    if (!oauthResult.success) {
      return json({ 
        error: 'OAuth authentication failed',
        details: oauthResult.error 
      }, { status: 400 });
    }
    
    if (!oauthResult.user) {
      return json({ error: 'No user data returned' }, { status: 400 });
    }
    
    // Create session using OAuthService
    const sessionData = await OAuthService.createOAuthSession(oauthResult.user, request);
    
    // Return session data for Auth.js integration
    return json({
      success: true,
      user: oauthResult.user,
      session: {
        token: sessionData.token,
        cookieOptions: sessionData.cookieOptions
      },
      isNewUser: oauthResult.isNewUser,
      accountLinked: oauthResult.accountLinked
    });
    
  } catch (err) {
    console.error('OAuth POST callback error:', err);
    
    return json({ 
      error: 'OAuth callback processing failed',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
};
