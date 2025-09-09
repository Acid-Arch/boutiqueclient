import { OAuthService, type GoogleProfile } from './oauth-service.js';
import type { SessionUser } from './auth-direct.js';

/**
 * OAUTH INTEGRATION EXAMPLE
 * This file shows how to integrate the OAuth service with SvelteKit Auth.js
 * This is for documentation and integration reference purposes.
 */

/**
 * Example: Handle Google OAuth callback in a SvelteKit route
 * File: src/routes/auth/callback/google/+server.ts
 */
export async function handleGoogleAuthCallback(request: Request) {
  try {
    // Extract profile data from Auth.js callback
    // This would typically come from Auth.js session/token
    const profile: GoogleProfile = {
      sub: 'google-user-id-123',
      email: 'user@example.com',
      name: 'John Doe',
      given_name: 'John',
      family_name: 'Doe',
      picture: 'https://example.com/avatar.jpg'
    };

    // Validate profile data
    if (!OAuthService.validateGoogleProfile(profile)) {
      return new Response(JSON.stringify({ error: 'Invalid profile data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle OAuth authentication
    const result = await OAuthService.handleGoogleCallback(profile);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session for the user
    const session = await OAuthService.createOAuthSession(result.user!, request);

    // Return success with session cookie
    const response = new Response(JSON.stringify({
      success: true,
      user: result.user,
      isNewUser: result.isNewUser,
      accountLinked: result.accountLinked
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    // Set session cookie
    response.headers.set('Set-Cookie', `session=${session.token}; ${Object.entries(session.cookieOptions)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ')}`);

    return response;

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Example: Check if user can link OAuth account
 */
export async function checkOAuthLinkEligibility(email: string): Promise<{canLink: boolean, reason?: string}> {
  return await OAuthService.canLinkOAuthAccount(email, 'google');
}

/**
 * Example: Find existing OAuth user
 */
export async function findExistingOAuthUser(googleId: string): Promise<SessionUser | null> {
  return await OAuthService.findOAuthUser('google', googleId);
}

/**
 * USAGE WITH AUTH.JS CONFIGURATION
 * 
 * In your auth.js configuration (src/hooks.server.ts or auth config):
 * 
 * import GoogleProvider from '@auth/core/providers/google';
 * import { OAuthService } from '$lib/server/oauth-service.js';
 * 
 * export const authConfig = {
 *   providers: [
 *     GoogleProvider({
 *       clientId: GOOGLE_CLIENT_ID,
 *       clientSecret: GOOGLE_CLIENT_SECRET,
 *     })
 *   ],
 *   callbacks: {
 *     async signIn({ profile, account }) {
 *       if (account?.provider === 'google' && profile) {
 *         // Pre-check if user can link account
 *         const eligibility = await OAuthService.canLinkOAuthAccount(profile.email, 'google');
 *         return eligibility.canLink;
 *       }
 *       return true;
 *     },
 *     
 *     async session({ token, session }) {
 *       if (token.provider === 'google') {
 *         // Handle OAuth user session
 *         const result = await OAuthService.handleGoogleCallback(token.profile);
 *         if (result.success) {
 *           session.user = result.user;
 *         }
 *       }
 *       return session;
 *     }
 *   }
 * };
 */

/**
 * EXPECTED DATABASE SCHEMA ADDITIONS
 * 
 * The OAuth service expects these fields to be added to the users table:
 * 
 * ALTER TABLE users 
 * ADD COLUMN oauth_provider VARCHAR(50),
 * ADD COLUMN oauth_id VARCHAR(255),
 * ALTER COLUMN password_hash DROP NOT NULL;
 * 
 * CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);
 * 
 * Or in Prisma schema:
 * 
 * model User {
 *   // ... existing fields
 *   oauthProvider String? @map("oauth_provider") @db.VarChar(50)
 *   oauthId       String? @map("oauth_id") @db.VarChar(255)
 *   passwordHash  String? @map("password_hash") @db.VarChar(255) // Made optional
 *   
 *   @@index([oauthProvider, oauthId], map: "idx_users_oauth")
 * }
 */
