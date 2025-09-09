import bcrypt from 'bcrypt';
import pg from 'pg';
import { dev } from '$app/environment';
import { DATABASE_URL } from '$env/static/private';

const { Client } = pg;

const SALT_ROUNDS = 12;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  company?: string | null;
  avatar?: string | null;
  role: string;
  subscription: string;
  isActive: boolean;
  lastLoginAt?: Date | null;
}

export interface LoginResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
}

// Get database connection
async function getDbClient() {
  const client = new Client({
    connectionString: DATABASE_URL
  });
  await client.connect();
  return client;
}

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Authenticate user with email and password
   */
  static async authenticateUser(email: string, password: string): Promise<LoginResult> {
    let client: pg.Client | null = null;
    
    try {
      console.log('🔍 Authenticating user:', email);
      client = await getDbClient();

      // Find user by email
      const userQuery = `
        SELECT id, email, password_hash as password, name, company, avatar_url as avatar, role, subscription, active, last_login_at
        FROM users 
        WHERE email = $1 AND active = true
      `;
      
      const result = await client.query(userQuery, [email]);
      console.log('📊 User query result:', result.rows.length, 'rows found');
      
      if (result.rows.length === 0) {
        console.log('❌ No user found or user is inactive');
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      const user = result.rows[0];
      console.log('👤 Found user:', user.email, 'has password hash:', !!user.password);

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password);
      console.log('🔑 Password verification result:', isValidPassword);
      
      if (!isValidPassword) {
        console.log('❌ Password verification failed');
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login timestamp
      await client.query(
        'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
      );

      // Create session user object
      const sessionUser: SessionUser = {
        id: user.id,
        email: user.email,
        name: user.name || 'User',
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        isActive: user.active,
        lastLoginAt: user.last_login_at
      };

      return {
        success: true,
        user: sessionUser
      };

    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  /**
   * Find user by ID
   */
  static async getUserById(userId: string): Promise<SessionUser | null> {
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();

      const userQuery = `
        SELECT id, email, name, company, avatar_url as avatar, role, subscription, active, last_login_at
        FROM users 
        WHERE id = $1 AND active = true
      `;
      
      const result = await client.query(userQuery, [userId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      
      return {
        id: user.id,
        email: user.email,
        name: user.name || 'User',
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        isActive: user.active,
        lastLoginAt: user.last_login_at
      };
      
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  /**
   * Find user by email
   */
  static async getUserByEmail(email: string): Promise<SessionUser | null> {
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();
      
      const userQuery = `
        SELECT id, email, name, company, avatar_url as avatar, role, subscription, active, last_login_at
        FROM users 
        WHERE email = $1 AND active = true
      `;
      
      const result = await client.query(userQuery, [email]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      return {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription || 'Basic',
        isActive: user.active,
        lastLoginAt: user.last_login_at
      };
      
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  /**
   * Get the first admin user from the database (for trusted IP fallback)
   */
  static async getFirstAdminUser(): Promise<SessionUser | null> {
    let client: pg.Client | null = null;
    
    try {
      client = await getDbClient();
      
      const userQuery = `
        SELECT id, email, name, company, avatar_url as avatar, role, subscription, active, last_login_at
        FROM users 
        WHERE role = 'ADMIN' AND active = true
        ORDER BY id ASC
        LIMIT 1
      `;
      
      const result = await client.query(userQuery);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const user = result.rows[0];
      return {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription || 'Enterprise',
        isActive: user.active,
        lastLoginAt: user.last_login_at
      };
      
    } catch (error) {
      console.error('Error getting first admin user:', error);
      return null;
    } finally {
      if (client) {
        await client.end();
      }
    }
  }

  /**
   * Generate a secure session token
   */
  static generateSessionToken(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create secure session cookie options
   */
  static getSessionCookieOptions() {
    return {
      httpOnly: true,
      secure: !dev, // Use secure cookies in production
      sameSite: 'lax' as const,
      maxAge: SESSION_DURATION / 1000, // Convert to seconds
      path: '/'
    };
  }

  /**
   * Validate session token format
   */
  static isValidSessionToken(token: string): boolean {
    return typeof token === 'string' && token.length === 64 && /^[a-f0-9]+$/i.test(token);
  }
}

export default AuthService;