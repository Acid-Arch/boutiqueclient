import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';

/**
 * OAuth Initiation API
 * Redirects to Auth.js Google OAuth flow
 */
export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    // Get return URL from query parameters
    const returnUrl = url.searchParams.get('returnUrl') || '/client-portal';
    
    // Store return URL in cookie for post-auth redirect
    cookies.set('oauth_return_url', returnUrl, {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    });
    
    // Build Auth.js OAuth initiation URL
    const baseUrl = url.origin;
    const oauthUrl = `${baseUrl}/auth/signin/google`;
    
    // Add callback URL if needed
    const callbackUrl = `${baseUrl}/auth/callback/google`;
    const fullOAuthUrl = `${oauthUrl}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    
    // Redirect to Auth.js OAuth flow
    throw redirect(302, fullOAuthUrl);
    
  } catch (err) {
    console.error('OAuth initiation error:', err);
    
    if (err instanceof Error && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }
    
    // Fallback redirect to login page with error
    throw redirect(302, '/login?error=oauth_initiation_failed');
  }
};

/**
 * POST method for form-based OAuth initiation
 */
export const POST: RequestHandler = async (event) => {
  return GET(event);
};