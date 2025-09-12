import bcrypt from 'bcrypt';
import { prisma } from './database.js';
import type { User, UserRole } from '@prisma/client';
import { dev } from '$app/environment';

const SALT_ROUNDS = 12;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface SessionUser {
  id: number;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  avatar?: string | null;
  role: UserRole;
  subscription: string;
  accountsLimit: number;
  isActive: boolean;
  lastLoginAt?: Date | null;
}

export interface CreateUserData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  role?: UserRole;
  subscription?: string;
  accountsLimit?: number;
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
   * Create a new user
   */
  static async createUser(userData: CreateUserData): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);
    
    return prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        passwordHash: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        company: userData.company,
        role: userData.role || 'UNAUTHORIZED',
        subscription: userData.subscription || 'Basic',
        accountsLimit: userData.accountsLimit || 10,
      },
    });
  }

  /**
   * Authenticate user with email/username and password
   */
  static async authenticateUser(emailOrUsername: string, password: string): Promise<LoginResult> {
    try {
      // Try Prisma first
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { email: emailOrUsername },
            { username: emailOrUsername }
          ],
          isActive: true
        }
      });

      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Verify password
      const isValidPassword = await this.verifyPassword(password, user.passwordHash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login timestamp
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Create session user object (exclude sensitive data)
      const sessionUser: SessionUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        accountsLimit: user.accountsLimit,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
      };

      return {
        success: true,
        user: sessionUser
      };

    } catch (error) {
      console.error('Prisma authentication failed, trying direct SQL fallback:', error);
      
      // Direct SQL fallback for when Prisma is not available
      return await this.authenticateUserDirectSQL(emailOrUsername, password);
    }
  }

  /**
   * Direct SQL authentication fallback for when Prisma is not available
   */
  static async authenticateUserDirectSQL(emailOrUsername: string, password: string): Promise<LoginResult> {
    try {
      // Import pg dynamically
      const pg = await import('pg');
      const { Client } = pg.default;
      
      const client = new Client({
        connectionString: process.env.DATABASE_URL
      });

      await client.connect();

      try {
        // Find user by email (since the database doesn't have username)
        const result = await client.query(`
          SELECT 
            id, email, name, company, role, subscription, active, 
            last_login_at, password_hash, avatar_url, model
          FROM users 
          WHERE email = $1 AND active = true
          LIMIT 1
        `, [emailOrUsername]);

        if (result.rows.length === 0) {
          return {
            success: false,
            error: 'Invalid credentials'
          };
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = user.password_hash ? 
          await this.verifyPassword(password, user.password_hash) :
          false;
        
        if (!isValidPassword) {
          return {
            success: false,
            error: 'Invalid credentials'
          };
        }

        // Update last login timestamp
        await client.query(`
          UPDATE users 
          SET last_login_at = NOW() 
          WHERE id = $1
        `, [user.id]);

        // Create session user object
        const sessionUser: SessionUser = {
          id: parseInt(user.id) || 0,
          email: user.email,
          username: user.email, // Use email as username since DB doesn't have username
          firstName: user.name ? user.name.split(' ')[0] : null,
          lastName: user.name ? user.name.split(' ').slice(1).join(' ') : null,
          company: user.company,
          avatar: user.avatar_url,
          role: user.role,
          subscription: user.subscription || 'Basic',
          accountsLimit: 10, // Default value
          isActive: user.active,
          lastLoginAt: user.last_login_at
        };

        console.log('✅ Direct SQL authentication successful for:', user.email, 'model:', user.model);

        return {
          success: true,
          user: sessionUser
        };

      } finally {
        await client.end();
      }

    } catch (error) {
      console.error('Direct SQL authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Find user by ID
   */
  static async getUserById(userId: number): Promise<SessionUser | null> {
    try {
      const user = await prisma.user.findFirst({
        where: { 
          id: userId,
          isActive: true
        }
      });

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        avatar: user.avatar,
        role: user.role,
        subscription: user.subscription,
        accountsLimit: user.accountsLimit,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt
      };
    } catch (error) {
      console.error('Get user error:', error);
      return null;
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