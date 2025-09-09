import bcrypt from 'bcrypt';
import { dev } from '$app/environment';
import pgDirect from './postgres-direct.ts';

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
   * Authenticate user with email or username and password using direct PostgreSQL client
   */
  static async authenticateUser(emailOrUsername: string, password: string): Promise<LoginResult> {
    return this.authenticate(emailOrUsername, password);
  }

  /**
   * Authenticate user with email and password using direct PostgreSQL client
   */
  static async authenticate(email: string, password: string): Promise<LoginResult> {
    try {
      console.log('🔍 Authenticating user:', email);

      // Find user by email using direct PostgreSQL client
      const user = await pgDirect.findUserByEmail(email);
      console.log('📊 User query result:', user ? 'found' : 'not found');
      
      // Debug: Log exact fields returned
      if (user) {
        console.log('🔍 Debug - User object keys:', Object.keys(user));
        console.log('🔍 Debug - password_hash value exists:', !!user.password_hash);
        console.log('🔍 Debug - password_hash length:', user.password_hash ? user.password_hash.length : 0);
      }
      
      if (!user) {
        console.log('❌ No user found or user is inactive');
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      console.log('👤 Found user:', user.email, 'has password hash:', !!user.password_hash, 'active:', user.active);

      if (!user.active) {
        console.log('❌ User is not active');
        return {
          success: false,
          error: 'Account is not active'
        };
      }

      if (!user.password_hash) {
        console.log('❌ User has no password hash (OAuth only)');
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.password_hash);
      console.log('🔑 Password verification result:', isValidPassword);
      
      if (!isValidPassword) {
        console.log('❌ Password verification failed');
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login timestamp
      await pgDirect.updateUserLastLogin(user.id);

      // Log successful login attempt
      await pgDirect.logLoginAttempt({
        userId: user.id,
        email: user.email,
        ipAddress: 'unknown',
        success: true
      });

      // Create audit log (temporarily disabled due to schema mismatch)
      try {
        await pgDirect.createAuditLog({
          userId: user.id,
          eventType: 'LOGIN_SUCCESS',
          description: `User ${user.email} successfully logged in`
        });
      } catch (error) {
        console.log('⚠️ Audit logging disabled due to schema mismatch:', error.message);
      }

      // Create session user object
      const sessionUser: SessionUser = {
        id: user.id.toString(),
        email: user.email,
        name: user.name || 'User',
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription || 'Basic',
        isActive: user.active,
        lastLoginAt: user.last_login_at
      };

      console.log('✅ Authentication successful for:', user.email);
      return {
        success: true,
        user: sessionUser
      };

    } catch (error) {
      console.error('Authentication error:', error);
      
      // Log failed login attempt
      await pgDirect.logLoginAttempt({
        email: email,
        ipAddress: 'unknown',
        success: false,
        failureReason: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Find user by ID using direct PostgreSQL client
   */
  static async getUserById(userId: string): Promise<SessionUser | null> {
    try {
      const user = await pgDirect.findUserById(parseInt(userId));
      
      if (!user) {
        return null;
      }

      return {
        id: user.id.toString(),
        email: user.email,
        name: user.name || 'User',
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription || 'Basic',
        isActive: user.active,
        lastLoginAt: user.last_login_at
      };

    } catch (error) {
      console.error('Get user by ID error:', error);
      return null;
    }
  }

  /**
   * Create a new user (for registration)
   */
  static async createUser(userData: {
    email: string;
    username: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  }): Promise<SessionUser | null> {
    try {
      // Hash password if provided
      const passwordHash = userData.password 
        ? await this.hashPassword(userData.password)
        : null;

      const newUser = await pgDirect.createUser({
        email: userData.email,
        username: userData.username,
        password_hash: passwordHash,
        first_name: userData.firstName,
        last_name: userData.lastName,
        role: userData.role || 'CLIENT'
      });

      if (!newUser) {
        return null;
      }

      // Create audit log for user creation (temporarily disabled due to schema mismatch)
      try {
        await pgDirect.createAuditLog({
          userId: newUser.id,
          eventType: 'USER_CREATED',
          description: `New user registered: ${newUser.email}`
        });
      } catch (error) {
        console.log('⚠️ User creation audit logging disabled due to schema mismatch:', error.message);
      }

      return {
        id: newUser.id.toString(),
        email: newUser.email,
        name: newUser.username || userData.firstName || 'User',
        role: newUser.role,
        subscription: 'Basic',
        isActive: newUser.is_active,
        lastLoginAt: null
      };

    } catch (error) {
      console.error('Create user error:', error);
      return null;
    }
  }

  /**
   * Test database connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      return await pgDirect.testConnection();
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get user accounts (IG accounts owned by user)
   */
  static async getUserAccounts(userId: number): Promise<any[]> {
    try {
      return await pgDirect.getUserAccounts(userId);
    } catch (error) {
      console.error('Get user accounts error:', error);
      return [];
    }
  }

  /**
   * Get account statistics for user
   */
  static async getAccountStats(userId: number): Promise<any> {
    try {
      return await pgDirect.getAccountStats(userId);
    } catch (error) {
      console.error('Get account stats error:', error);
      return { total: 0, active: 0, unused: 0, blocked: 0 };
    }
  }

  /**
   * Generate a random session token
   */
  static generateSessionToken(): string {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate a session token format
   * Checks if token is a valid hex string of correct length
   */
  static isValidSessionToken(token: string): boolean {
    // Token should be 64 character hex string (32 bytes)
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Check length and format (hexadecimal)
    return token.length === 64 && /^[a-f0-9]+$/.test(token);
  }

  /**
   * Get session cookie options
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
}