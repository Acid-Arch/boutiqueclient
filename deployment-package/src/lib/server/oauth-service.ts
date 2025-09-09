import pg from 'pg';
import { dev } from '$app/environment';
import { DATABASE_URL } from '$env/static/private';
import { AuthService, type SessionUser, type LoginResult } from './auth-direct.ts';

const { Client } = pg;

export interface GoogleProfile {
  sub: string; // Google user ID (subject)
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
  id?: string; // For backward compatibility
}

export interface OAuthResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
  isNewUser?: boolean;
  accountLinked?: boolean;
}

// Get database connection (same pattern as auth-direct.ts)
async function getDbClient() {
  const client = new Client({
    connectionString: DATABASE_URL
  });
  await client.connect();
  return client;
}

/**
 * OAuth Service for handling Google authentication integration
 * Works with existing auth system and database patterns
 */
export class OAuthService {
  
  /**
   * Handle Google OAuth callback and create/update user
   */
  static async handleGoogleCallback(profile: GoogleProfile): Promise<OAuthResult> {
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();
      
      // Start transaction for data consistency
      await client.query('BEGIN');

      // Check if user already exists by OAuth ID
      const oauthUserQuery = `
        SELECT id, email, name, company, avatar_url, role, subscription, active, last_login_at
        FROM users 
        WHERE oauth_id = $1 AND oauth_provider = $2 AND active = true
      `;
      
      const oauthResult = await client.query(oauthUserQuery, [profile.sub || profile.id, 'google']);
      
      if (oauthResult.rows.length > 0) {
        // Existing OAuth user - update profile and login
        const user = oauthResult.rows[0];
        
        const sessionUser = await this.updateOAuthUserProfile(client, user.id, profile);
        await client.query('COMMIT');
        
        return {
          success: true,
          user: sessionUser,
          isNewUser: false,
          accountLinked: false
        };
      }
      
      // Check if user exists by email for account linking
      const emailUserQuery = `
        SELECT id, email, name, company, avatar_url, role, subscription, active, last_login_at, oauth_provider
        FROM users 
        WHERE email = $1 AND active = true
      `;
      
      const emailResult = await client.query(emailUserQuery, [profile.email]);
      
      if (emailResult.rows.length > 0) {
        // Existing user by email - link OAuth account
        const existingUser = emailResult.rows[0];
        
        if (existingUser.oauth_provider) {
          // User already has OAuth provider
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Account is already linked to another OAuth provider'
          };
        }
        
        // Link OAuth to existing account
        const sessionUser = await this.linkOAuthToExistingUser(client, existingUser.id, profile);
        await client.query('COMMIT');
        
        return {
          success: true,
          user: sessionUser,
          isNewUser: false,
          accountLinked: true
        };
      }
      
      // Create new OAuth user
      const sessionUser = await this.createNewOAuthUser(client, profile);
      await client.query('COMMIT');
      
      return {
        success: true,
        user: sessionUser,
        isNewUser: true,
        accountLinked: false
      };
      
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error('OAuth callback error:', error);
      return {
        success: false,
        error: 'OAuth authentication failed'
      };
    } finally {
      if (client) {
        await client.end();
      }
    }
  }
  
  /**
   * Create new user from OAuth profile
   */
  private static async createNewOAuthUser(client: pg.Client, profile: GoogleProfile): Promise<SessionUser> {
    // Generate username from email or name
    const baseUsername = profile.email.split('@')[0] || profile.name.toLowerCase().replace(/\s+/g, '');
    const username = await this.generateUniqueUsername(client, baseUsername);
    
    const insertUserQuery = `
      INSERT INTO users (
        email, password_hash, name, avatar_url, 
        oauth_provider, oauth_id, email_verified, role, subscription, active, provider,
        created_at, updated_at, last_login_at
      ) VALUES (
        $1, NULL, $2, $3, 
        $4, $5, $6, $7, $8, $9, $10,
        NOW(), NOW(), NOW()
      ) RETURNING id, email, name, company, avatar_url, role, subscription, active, last_login_at
    `;
    
    const values = [
      profile.email,
      profile.name || 'User',
      profile.picture || null,
      'google',
      profile.sub || profile.id,
      profile.email_verified || false,
      'CLIENT', // Default role
      'Basic', // Default subscription
      true,
      'GOOGLE' // Provider enum value
    ];
    
    const result = await client.query(insertUserQuery, values);
    const user = result.rows[0];
    
    return this.mapDatabaseUserToSessionUser(user);
  }
  
  /**
   * Link OAuth account to existing user
   */
  private static async linkOAuthToExistingUser(client: pg.Client, userId: number, profile: GoogleProfile): Promise<SessionUser> {
    // Update existing user with OAuth information
    const updateUserQuery = `
      UPDATE users 
      SET 
        oauth_provider = $2,
        oauth_id = $3,
        avatar_url = COALESCE($4, avatar_url),
        name = COALESCE($5, name),
        email_verified = COALESCE($6, email_verified),
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, company, avatar_url, role, subscription, active, last_login_at
    `;
    
    const values = [
      userId,
      'google',
      profile.sub || profile.id,
      profile.picture || null,
      profile.name || null,
      profile.email_verified || null
    ];
    
    const result = await client.query(updateUserQuery, values);
    const user = result.rows[0];
    
    return this.mapDatabaseUserToSessionUser(user);
  }
  
  /**
   * Update OAuth user profile data
   */
  private static async updateOAuthUserProfile(client: pg.Client, userId: number, profile: GoogleProfile): Promise<SessionUser> {
    // Update user profile with latest OAuth data
    const updateUserQuery = `
      UPDATE users 
      SET 
        avatar_url = COALESCE($2, avatar_url),
        name = COALESCE($3, name),
        email_verified = COALESCE($4, email_verified),
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, email, name, company, avatar_url, role, subscription, active, last_login_at
    `;
    
    const values = [
      userId,
      profile.picture || null,
      profile.name || null,
      profile.email_verified || null
    ];
    
    const result = await client.query(updateUserQuery, values);
    const user = result.rows[0];
    
    return this.mapDatabaseUserToSessionUser(user);
  }
  
  /**
   * Generate unique username from base string
   */
  private static async generateUniqueUsername(client: pg.Client, baseUsername: string): Promise<string> {
    // Sanitize base username
    let cleanBase = baseUsername
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 20);
    
    if (!cleanBase || cleanBase.length < 3) {
      cleanBase = 'user';
    }
    
    let username = cleanBase;
    let counter = 1;
    
    while (true) {
      const checkQuery = `SELECT id FROM users WHERE username = $1`;
      const result = await client.query(checkQuery, [username]);
      
      if (result.rows.length === 0) {
        return username;
      }
      
      username = `${cleanBase}${counter}`;
      counter++;
      
      // Safety limit
      if (counter > 999) {
        username = `${cleanBase}${Date.now()}`;
        break;
      }
    }
    
    return username;
  }
  
  /**
   * Map database user to SessionUser interface
   */
  private static mapDatabaseUserToSessionUser(user: any): SessionUser {
    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name || 'User',
      company: user.company,
      avatar: user.avatar_url,
      role: user.role,
      subscription: user.subscription,
      isActive: user.active,
      lastLoginAt: user.last_login_at
    };
  }
  
  /**
   * Find OAuth user by provider and ID
   */
  static async findOAuthUser(provider: string, oauthId: string): Promise<SessionUser | null> {
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();
      
      const userQuery = `
        SELECT id, email, name, company, avatar_url, role, subscription, active, last_login_at
        FROM users 
        WHERE oauth_provider = $1 AND oauth_id = $2 AND active = true
      `;
      
      const result = await client.query(userQuery, [provider, oauthId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapDatabaseUserToSessionUser(result.rows[0]);
      
    } catch (error) {
      console.error('Find OAuth user error:', error);
      return null;
    } finally {
      if (client) {
        await client.end();
      }
    }
  }
  
  /**
   * Create session for OAuth user (uses existing AuthService patterns)
   */
  static async createOAuthSession(user: SessionUser, request: Request): Promise<{token: string, cookieOptions: any}> {
    // Generate session token using existing AuthService method
    const sessionToken = AuthService.generateSessionToken();
    
    // Get cookie options from existing AuthService
    const cookieOptions = AuthService.getSessionCookieOptions();
    
    // Store session in database
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();
      
      // Extract IP and User Agent
      const ipAddress = this.extractIPAddress(request);
      const userAgent = request.headers.get('user-agent') || null;
      
      // Create session record
      const insertSessionQuery = `
        INSERT INTO user_sessions (
          id, user_id, session_token, ip_address, user_agent, 
          last_activity, expires_at, active, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 
          NOW(), NOW() + INTERVAL '7 days', true, NOW()
        )
      `;
      
      await client.query(insertSessionQuery, [
        parseInt(user.id),
        sessionToken,
        ipAddress,
        userAgent
      ]);
      
      return {
        token: sessionToken,
        cookieOptions
      };
      
    } catch (error) {
      console.error('Create OAuth session error:', error);
      throw new Error('Failed to create session');
    } finally {
      if (client) {
        await client.end();
      }
    }
  }
  
  /**
   * Extract IP address from request
   */
  private static extractIPAddress(request: Request): string {
    // Check for forwarded IP in headers (for proxy/load balancer setups)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }
    
    // Fallback to localhost for development
    return dev ? '127.0.0.1' : 'unknown';
  }
  
  /**
   * Validate Google profile data
   */
  static validateGoogleProfile(profile: any): profile is GoogleProfile {
    return (
      profile &&
      (typeof profile.sub === 'string' || typeof profile.id === 'string') &&
      typeof profile.email === 'string' &&
      typeof profile.name === 'string' &&
      profile.email.includes('@') &&
      (profile.sub?.length > 0 || profile.id?.length > 0)
    );
  }
  
  /**
   * Check if user can link OAuth account
   */
  static async canLinkOAuthAccount(email: string, provider: string): Promise<{canLink: boolean, reason?: string}> {
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();
      
      const userQuery = `
        SELECT oauth_provider, active
        FROM users 
        WHERE email = $1
      `;
      
      const result = await client.query(userQuery, [email]);
      
      if (result.rows.length === 0) {
        return { canLink: true }; // New user, can create OAuth account
      }
      
      const user = result.rows[0];
      
      if (!user.active) {
        return { canLink: false, reason: 'Account is inactive' };
      }
      
      if (user.oauth_provider && user.oauth_provider !== provider) {
        return { canLink: false, reason: `Account is already linked to ${user.oauth_provider}` };
      }
      
      return { canLink: true };
      
    } catch (error) {
      console.error('Check OAuth link eligibility error:', error);
      return { canLink: false, reason: 'Unable to verify account status' };
    } finally {
      if (client) {
        await client.end();
      }
    }
  }
}

export default OAuthService;