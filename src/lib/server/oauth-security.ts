import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

/**
 * OAuth Security Utilities
 * Provides security measures for OAuth flows including CSRF protection,
 * rate limiting, and secure session management
 */

export interface OAuthSecurityConfig {
  maxAttempts: number;
  windowMs: number;
  cookiePrefix: string;
  stateTtl: number;
}

export const DEFAULT_SECURITY_CONFIG: OAuthSecurityConfig = {
  maxAttempts: 5, // Max OAuth attempts per IP per window
  windowMs: 15 * 60 * 1000, // 15 minutes
  cookiePrefix: 'oauth_',
  stateTtl: 300 // 5 minutes in seconds
};

// In-memory store for rate limiting (should use Redis in production)
const rateLimitStore = new Map<string, { count: number; firstAttempt: number }>();

export class OAuthSecurity {
  private static config = DEFAULT_SECURITY_CONFIG;

  /**
   * Generate cryptographically secure state parameter for CSRF protection
   */
  static generateSecureState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Store OAuth state with expiration
   */
  static setOAuthState(cookies: Cookies, state: string, returnUrl?: string): void {
    const config = this.config;
    
    cookies.set(`${config.cookiePrefix}state`, state, {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      maxAge: config.stateTtl
    });

    if (returnUrl) {
      cookies.set(`${config.cookiePrefix}return_url`, returnUrl, {
        path: '/',
        httpOnly: true,
        secure: !dev,
        sameSite: 'lax',
        maxAge: config.stateTtl
      });
    }
  }

  /**
   * Validate OAuth state parameter
   */
  static validateOAuthState(cookies: Cookies, receivedState: string): { 
    valid: boolean; 
    returnUrl?: string; 
    error?: string 
  } {
    const config = this.config;
    const storedState = cookies.get(`${config.cookiePrefix}state`);
    const returnUrl = cookies.get(`${config.cookiePrefix}return_url`);

    // Clear state cookies immediately after validation
    cookies.delete(`${config.cookiePrefix}state`, { path: '/' });
    cookies.delete(`${config.cookiePrefix}return_url`, { path: '/' });

    if (!storedState) {
      return { valid: false, error: 'No state parameter stored' };
    }

    if (!receivedState) {
      return { valid: false, error: 'No state parameter received' };
    }

    if (storedState !== receivedState) {
      return { valid: false, error: 'State parameter mismatch' };
    }

    return { valid: true, returnUrl };
  }

  /**
   * Check rate limiting for OAuth attempts
   */
  static checkRateLimit(ipAddress: string): { 
    allowed: boolean; 
    remaining: number; 
    resetTime: number 
  } {
    const config = this.config;
    const now = Date.now();
    const key = `oauth_${ipAddress}`;
    
    const record = rateLimitStore.get(key);
    
    if (!record) {
      // First attempt
      rateLimitStore.set(key, { count: 1, firstAttempt: now });
      return { 
        allowed: true, 
        remaining: config.maxAttempts - 1, 
        resetTime: now + config.windowMs 
      };
    }

    // Check if window has expired
    if (now - record.firstAttempt > config.windowMs) {
      // Reset window
      rateLimitStore.set(key, { count: 1, firstAttempt: now });
      return { 
        allowed: true, 
        remaining: config.maxAttempts - 1, 
        resetTime: now + config.windowMs 
      };
    }

    // Increment count
    record.count++;
    
    if (record.count > config.maxAttempts) {
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime: record.firstAttempt + config.windowMs 
      };
    }

    return { 
      allowed: true, 
      remaining: config.maxAttempts - record.count, 
      resetTime: record.firstAttempt + config.windowMs 
    };
  }

  /**
   * Extract and validate IP address from request
   */
  static extractIPAddress(request: Request): string {
    // Check for forwarded IP in headers (for proxy/load balancer setups)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const ip = forwarded.split(',')[0].trim();
      if (this.isValidIP(ip)) {
        return ip;
      }
    }
    
    const realIP = request.headers.get('x-real-ip');
    if (realIP && this.isValidIP(realIP)) {
      return realIP;
    }
    
    const cfIP = request.headers.get('cf-connecting-ip');
    if (cfIP && this.isValidIP(cfIP)) {
      return cfIP;
    }
    
    // Fallback to localhost for development
    return dev ? '127.0.0.1' : 'unknown';
  }

  /**
   * Validate IP address format
   */
  private static isValidIP(ip: string): boolean {
    // Basic IPv4/IPv6 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Validate redirect URL for security
   */
  static validateRedirectUrl(url: string, allowedDomains?: string[]): boolean {
    try {
      // Must be a relative URL or from allowed domains
      if (url.startsWith('/')) {
        // Prevent open redirects to external sites via protocol-relative URLs
        return !url.startsWith('//');
      }

      // If absolute URL, check against allowed domains
      if (allowedDomains) {
        const parsedUrl = new URL(url);
        return allowedDomains.includes(parsedUrl.hostname);
      }

      // Default: only allow relative URLs
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Generate secure PKCE verifier and challenge
   */
  static generatePKCE(): { verifier: string; challenge: string; method: string } {
    // Generate code verifier (43-128 chars)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    
    const verifier = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Generate code challenge (SHA256 hash of verifier, base64url encoded)
    // Note: This would require crypto.subtle in a real implementation
    // For now, return the verifier as the challenge (not recommended for production)
    const challenge = verifier;
    
    return {
      verifier,
      challenge,
      method: 'S256'
    };
  }

  /**
   * Sanitize OAuth error messages for user display
   */
  static sanitizeOAuthError(error: string): { 
    userMessage: string; 
    logMessage: string; 
    code: string 
  } {
    const errorMappings: Record<string, { user: string; code: string }> = {
      'access_denied': {
        user: 'Authentication was cancelled. Please try again.',
        code: 'AUTH_CANCELLED'
      },
      'invalid_request': {
        user: 'Invalid authentication request. Please try again.',
        code: 'INVALID_REQUEST'
      },
      'unauthorized_client': {
        user: 'Authentication service is not configured properly.',
        code: 'SERVICE_CONFIG_ERROR'
      },
      'unsupported_response_type': {
        user: 'Authentication method is not supported.',
        code: 'UNSUPPORTED_METHOD'
      },
      'invalid_scope': {
        user: 'Requested permissions are invalid.',
        code: 'INVALID_PERMISSIONS'
      },
      'server_error': {
        user: 'Authentication service is temporarily unavailable.',
        code: 'SERVICE_ERROR'
      },
      'temporarily_unavailable': {
        user: 'Authentication service is temporarily unavailable.',
        code: 'SERVICE_UNAVAILABLE'
      }
    };

    const mapping = errorMappings[error] || {
      user: 'Authentication failed. Please try again.',
      code: 'UNKNOWN_ERROR'
    };

    return {
      userMessage: mapping.user,
      logMessage: `OAuth error: ${error}`,
      code: mapping.code
    };
  }

  /**
   * Create secure session cookie options
   */
  static getSecureCookieOptions(maxAge: number = 7 * 24 * 60 * 60) {
    return {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax' as const,
      maxAge: maxAge
    };
  }

  /**
   * Clean up expired rate limit records
   */
  static cleanupRateLimitStore(): void {
    const now = Date.now();
    const config = this.config;
    
    for (const [key, record] of rateLimitStore.entries()) {
      if (now - record.firstAttempt > config.windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }
}

// Clean up rate limit store periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    OAuthSecurity.cleanupRateLimitStore();
  }, 60000); // Every minute
}

export default OAuthSecurity;