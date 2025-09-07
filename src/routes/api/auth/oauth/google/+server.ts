import { json, error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';
import { OAuthService, type GoogleProfile } from '$lib/server/oauth-service.js';

/**
 * OAuth Google Authentication API
 * Provides OAuth initiation and callback handling
 */

// OAuth initiation endpoint
export const GET: RequestHandler = async ({ url, cookies }) => {
  const action = url.searchParams.get('action');
  
  try {
    switch (action) {
      case 'initiate':
        await handleOAuthInitiation(url, cookies);
        // This will never reach here due to redirect throw, but TypeScript needs a return
        return new Response(null, { status: 302 });
        
      case 'callback':
        await handleOAuthCallback(url, cookies);
        // This will never reach here due to redirect throw, but TypeScript needs a return
        return new Response(null, { status: 302 });
        
      case 'status':
        return handleOAuthStatus();
        
      default:
        throw error(400, 'Invalid OAuth action. Use ?action=initiate, ?action=callback, or ?action=status');
    }
    
  } catch (err) {
    console.error('OAuth endpoint error:', err);
    
    if (err instanceof Error && 'status' in err) {
      throw err; // Re-throw SvelteKit errors
    }
    
    throw error(500, 'OAuth authentication failed');
  }
};

/**
 * Handle OAuth initiation - redirect to Google
 */
async function handleOAuthInitiation(url: URL, cookies: any) {
  // Generate state parameter for CSRF protection
  const state = generateSecureState();
  const returnUrl = url.searchParams.get('returnUrl') || '/client-portal';
  
  // Store state and return URL in secure cookie
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'lax',
    maxAge: 300 // 5 minutes
  });
  
  cookies.set('oauth_return_url', returnUrl, {
    path: '/',
    httpOnly: true,
    secure: !dev,
    sameSite: 'lax',
    maxAge: 300 // 5 minutes
  });
  
  // Build Google OAuth URL
  const baseUrl = dev ? 'http://localhost:5173' : 'https://your-domain.com';
  const redirectUri = `${baseUrl}/api/auth/oauth/google?action=callback`;
  
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'select_account');
  googleAuthUrl.searchParams.set('state', state);
  
  // Redirect to Google OAuth
  throw redirect(302, googleAuthUrl.toString());
}

/**
 * Handle OAuth callback from Google
 */
async function handleOAuthCallback(url: URL, cookies: any) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error_param = url.searchParams.get('error');
  
  // Retrieve stored state and return URL
  const storedState = cookies.get('oauth_state');
  const returnUrl = cookies.get('oauth_return_url') || '/client-portal';
  
  // Clear OAuth cookies
  cookies.delete('oauth_state', { path: '/' });
  cookies.delete('oauth_return_url', { path: '/' });
  
  // Handle OAuth errors
  if (error_param) {
    console.error('OAuth error from Google:', error_param);
    throw redirect(302, `/login?error=oauth_error&message=${encodeURIComponent(error_param)}`);
  }
  
  // Validate state parameter (CSRF protection)
  if (!state || !storedState || state !== storedState) {
    console.error('OAuth state mismatch:', { received: state, stored: storedState });
    throw redirect(302, '/login?error=oauth_state_mismatch');
  }
  
  // Validate authorization code
  if (!code) {
    console.error('Missing OAuth authorization code');
    throw redirect(302, '/login?error=oauth_no_code');
  }
  
  try {
    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code);
    
    // Get user profile from Google
    const userProfile = await getGoogleUserProfile(tokenResponse.access_token);
    
    // Validate profile structure
    if (!OAuthService.validateGoogleProfile(userProfile)) {
      throw new Error('Invalid Google profile structure');
    }
    
    // Handle user authentication through OAuthService
    const oauthResult = await OAuthService.handleGoogleCallback(userProfile);
    
    if (!oauthResult.success) {
      console.error('OAuth user handling failed:', oauthResult.error);
      throw redirect(302, `/login?error=oauth_user_error&message=${encodeURIComponent(oauthResult.error || 'Authentication failed')}`);
    }
    
    if (!oauthResult.user) {
      throw new Error('No user returned from OAuth handling');
    }
    
    // Create session using OAuthService
    const sessionData = await OAuthService.createOAuthSession(oauthResult.user, new Request(url.toString()));
    
    // Set session cookie
    cookies.set('session', `${oauthResult.user.id}:${sessionData.token}`, sessionData.cookieOptions);
    
    // Build success redirect URL with context
    const successUrl = new URL(returnUrl, url.origin);
    if (oauthResult.isNewUser) {
      successUrl.searchParams.set('welcome', 'true');
    }
    if (oauthResult.accountLinked) {
      successUrl.searchParams.set('linked', 'true');
    }
    
    // Redirect to success page
    throw redirect(302, successUrl.toString());
    
  } catch (err) {
    console.error('OAuth callback processing error:', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
    throw redirect(302, `/login?error=oauth_callback_error&message=${encodeURIComponent(errorMessage)}`);
  }
}

/**
 * Handle OAuth status check
 */
async function handleOAuthStatus() {
  return json({
    provider: 'google',
    available: true,
    clientId: GOOGLE_CLIENT_ID ? 'configured' : 'missing',
    clientSecret: GOOGLE_CLIENT_SECRET ? 'configured' : 'missing',
    redirectUris: {
      development: 'http://localhost:5173/api/auth/oauth/google?action=callback',
      production: 'https://your-domain.com/api/auth/oauth/google?action=callback'
    }
  });
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(code: string): Promise<{access_token: string, id_token: string}> {
  const baseUrl = dev ? 'http://localhost:5173' : 'https://your-domain.com';
  const redirectUri = `${baseUrl}/api/auth/oauth/google?action=callback`;
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  });
  
  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    console.error('Token exchange failed:', errorData);
    throw new Error('Failed to exchange authorization code for tokens');
  }
  
  const tokens = await tokenResponse.json();
  
  if (!tokens.access_token) {
    throw new Error('No access token received from Google');
  }
  
  return tokens;
}

/**
 * Get user profile from Google
 */
async function getGoogleUserProfile(accessToken: string): Promise<GoogleProfile> {
  const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (!profileResponse.ok) {
    const errorData = await profileResponse.text();
    console.error('Profile fetch failed:', errorData);
    throw new Error('Failed to fetch user profile from Google');
  }
  
  const profile = await profileResponse.json();
  
  // Ensure required fields are present
  if (!profile.id || !profile.email || !profile.name) {
    throw new Error('Incomplete profile data from Google');
  }
  
  return profile as GoogleProfile;
}

/**
 * Generate cryptographically secure state parameter
 */
function generateSecureState(): string {
  // Generate random bytes for state parameter
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // Convert to base64url
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
