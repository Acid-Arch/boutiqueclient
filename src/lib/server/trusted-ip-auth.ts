/**
 * Trusted IP Authentication Service
 * Handles automatic authentication for trusted IP addresses
 */

import { extractPublicIP } from './ip-utils.js';
import { AuthService } from './auth-direct.js';
import type { SessionUser } from './auth-direct.js';
import { AuditLogger, AuditEventType } from './audit-logger.js';
import { TRUSTED_IP_AUTO_LOGIN, AUTO_LOGIN_USER_EMAIL } from '$env/static/private';

/**
 * Configuration for trusted IP authentication
 */
interface TrustedIPConfig {
  enabled: boolean;
  trustedIPs: string[];
  autoLoginEmail: string | null;
}

/**
 * Get trusted IP configuration from environment variables
 */
function getTrustedIPConfig(): TrustedIPConfig {
  return {
    enabled: Boolean(TRUSTED_IP_AUTO_LOGIN && TRUSTED_IP_AUTO_LOGIN.trim()),
    trustedIPs: TRUSTED_IP_AUTO_LOGIN ? TRUSTED_IP_AUTO_LOGIN.split(',').map(ip => ip.trim()) : [],
    autoLoginEmail: AUTO_LOGIN_USER_EMAIL || null
  };
}

/**
 * Check if the request is from a trusted IP address
 */
export async function isFromTrustedIP(request: Request): Promise<{
  isTrusted: boolean;
  publicIP: string | null;
  matchedIP?: string;
}> {
  const config = getTrustedIPConfig();
  
  // If feature is disabled, no IP is trusted
  if (!config.enabled || config.trustedIPs.length === 0) {
    return {
      isTrusted: false,
      publicIP: null
    };
  }
  
  // Extract public IP from request
  let extractedIP = extractPublicIP(request);
  
  // In development/local testing, if no proxy headers are found,
  // check if we're on localhost and use an external IP service
  if (!extractedIP && process.env.NODE_ENV === 'development') {
    try {
      // For local development, fetch the external IP
      const response = await fetch('https://ipv4.icanhazip.com', { 
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      if (response.ok) {
        const externalIP = (await response.text()).trim();
        extractedIP = {
          ip: externalIP,
          source: 'external-service' as any,
          isPublic: true,
          version: 'ipv4' as const
        };
      }
    } catch (error) {
      // Silently fail - this is expected if no internet connection
    }
  }
  
  if (!extractedIP) {
    return {
      isTrusted: false,
      publicIP: null
    };
  }
  
  const { ip: publicIP } = extractedIP;
  
  // Check if the IP matches any trusted IP
  for (const trustedIP of config.trustedIPs) {
    if (publicIP === trustedIP) {
      return {
        isTrusted: true,
        publicIP,
        matchedIP: trustedIP
      };
    }
  }
  
  return {
    isTrusted: false,
    publicIP
  };
}

/**
 * Create an automatic session for trusted IP
 */
export async function createTrustedIPSession(request: Request): Promise<{
  success: boolean;
  user?: SessionUser;
  sessionToken?: string;
  error?: string;
}> {
  const config = getTrustedIPConfig();
  const ipCheck = await isFromTrustedIP(request);
  
  if (!ipCheck.isTrusted) {
    return {
      success: false,
      error: 'Request not from trusted IP'
    };
  }
  
  try {
    // If no specific email is configured, find the first admin user or create fallback
    let user: SessionUser;
    
    if (config.autoLoginEmail) {
      // Try to find the specific user
      const foundUser = await AuthService.getUserByEmail(config.autoLoginEmail);
      if (!foundUser) {
        return {
          success: false,
          error: `Auto-login user not found: ${config.autoLoginEmail}`
        };
      }
      user = foundUser;
    } else {
      // Try to find the first admin user in the database
      const firstAdmin = await AuthService.getFirstAdminUser();
      
      if (firstAdmin) {
        // Use the first admin user found
        user = firstAdmin;
      } else {
        // Fallback: Create a temporary admin session (no database dependency)
        // This allows trusted IP access even if no admin users exist yet
        user = {
          id: `trusted-ip-${Date.now()}`, // Unique temporary ID
          email: 'trusted-ip@boutique-portal.com',
          name: 'Trusted IP Admin',
          role: 'ADMIN',
          isActive: true,
          company: 'Trusted Access',
          avatar: null,
          subscription: 'Enterprise',
          lastLoginAt: new Date()
        };
      }
    }
    
    // Generate session token
    const sessionToken = AuthService.generateSessionToken();
    
    // Log the trusted IP authentication event
    await logTrustedIPAuth(
      user.id,
      user.email,
      ipCheck.publicIP!,
      ipCheck.matchedIP!,
      request
    );
    
    return {
      success: true,
      user,
      sessionToken
    };
  } catch (error) {
    console.error('Failed to create trusted IP session:', error);
    return {
      success: false,
      error: 'Failed to create trusted IP session'
    };
  }
}

/**
 * Log trusted IP authentication event
 */
async function logTrustedIPAuth(
  userId: string,
  email: string,
  publicIP: string,
  matchedTrustedIP: string,
  request: Request
): Promise<void> {
  try {
    await AuditLogger.log({
      userId: userId.startsWith('trusted-ip-') ? undefined : Number(userId),
      eventType: AuditEventType.TRUSTED_IP_LOGIN,
      description: `Trusted IP automatic login for ${email} from ${matchedTrustedIP}`,
      ipAddress: publicIP,
      userAgent: request.headers.get('user-agent') || 'Unknown',
      metadata: {
        email,
        trustedIP: matchedTrustedIP,
        timestamp: new Date().toISOString(),
        automaticLogin: true,
        temporaryUser: userId.startsWith('trusted-ip-')
      }
    });
  } catch (error) {
    console.error('Failed to log trusted IP authentication:', error);
  }
}

/**
 * Check if trusted IP authentication is enabled
 */
export function isTrustedIPAuthEnabled(): boolean {
  const config = getTrustedIPConfig();
  return config.enabled;
}

/**
 * Get list of trusted IPs (for admin display)
 */
export function getTrustedIPs(): string[] {
  const config = getTrustedIPConfig();
  return config.trustedIPs;
}