/**
 * IP Whitelist Validation Service
 * Enterprise-grade public IP validation with CIDR support and caching
 */

import { extractPublicIP, ipInCIDR, getIPWhitelistConfig, getUserAgent, type ExtractedIP } from './ip-utils.js';
import pkg from 'pg';
const { Pool } = pkg;

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// In-memory cache for whitelist entries (TTL-based)
interface CacheEntry {
  result: boolean;
  timestamp: number;
  ttl: number;
}

const whitelistCache = new Map<string, CacheEntry>();

export interface IPValidationResult {
  allowed: boolean;
  publicIP: string | null;
  source: string;
  reason?: string;
  userId?: number;
  matchedRule?: {
    id: number;
    address: string;
    description: string | null;
    isGlobal: boolean;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  resetTime: Date | null;
  blockReason?: 'ip_rate_limit' | 'user_rate_limit';
}

/**
 * Main IP whitelist validation function
 * Combines IP extraction, validation, and rate limiting
 */
export async function validateIPAccess(
  request: Request,
  userId?: number,
  userEmail?: string
): Promise<IPValidationResult> {
  const config = getIPWhitelistConfig();
  
  // If IP whitelist is disabled, allow all
  if (!config.enabled) {
    return {
      allowed: true,
      publicIP: null,
      source: 'disabled',
      reason: 'IP whitelist is disabled'
    };
  }
  
  // Development bypass
  if (config.devBypass && process.env.NODE_ENV === 'development') {
    return {
      allowed: true,
      publicIP: null,
      source: 'dev_bypass',
      reason: 'Development mode bypass enabled'
    };
  }
  
  // Extract public IP
  const extractedIP = extractPublicIP(request);
  if (!extractedIP) {
    await logIPAccess(null, userEmail || null, null, false, 'no_public_ip_found', request);
    return {
      allowed: false,
      publicIP: null,
      source: 'extraction_failed',
      reason: 'Could not determine public IP address'
    };
  }
  
  const { ip: publicIP } = extractedIP;
  
  // Check rate limits first
  const rateLimitResult = await checkRateLimits(publicIP, userId);
  if (!rateLimitResult.allowed) {
    await logIPAccess(userId || null, userEmail || null, publicIP, false, rateLimitResult.blockReason || 'rate_limit', request);
    return {
      allowed: false,
      publicIP,
      source: 'rate_limited',
      reason: `Rate limit exceeded: ${rateLimitResult.blockReason}`
    };
  }
  
  // Admin bypass check
  if (config.adminBypass && userId) {
    const isAdmin = await checkIfUserIsAdmin(userId);
    if (isAdmin) {
      await logIPAccess(userId || null, userEmail || null, publicIP, true, 'admin_bypass', request);
      return {
        allowed: true,
        publicIP,
        source: 'admin_bypass',
        reason: 'Admin user bypass enabled'
      };
    }
  }
  
  // Check whitelist cache first
  const cacheKey = `${publicIP}:${userId || 'global'}`;
  const cached = getFromCache(cacheKey);
  if (cached !== null) {
    await logIPAccess(userId || null, userEmail || null, publicIP, cached, cached ? 'cache_hit' : 'cache_miss', request);
    return {
      allowed: cached,
      publicIP,
      source: 'cache',
      reason: cached ? 'IP found in cache' : 'IP not in whitelist (cached)'
    };
  }
  
  // Perform database lookup
  const validationResult = await checkIPWhitelist(publicIP, userId);
  
  // Cache the result
  addToCache(cacheKey, validationResult.allowed, config.cacheTTL);
  
  // Log the access attempt
  await logIPAccess(
    userId || null, 
    userEmail || null, 
    publicIP, 
    validationResult.allowed, 
    validationResult.allowed ? 'whitelist_match' : 'not_whitelisted',
    request
  );
  
  return {
    allowed: validationResult.allowed,
    publicIP,
    source: 'database',
    reason: validationResult.reason,
    matchedRule: validationResult.matchedRule
  };
}

/**
 * Check IP against database whitelist using optimized single query
 */
async function checkIPWhitelist(publicIP: string, userId?: number): Promise<{
  allowed: boolean;
  reason: string;
  matchedRule?: IPValidationResult['matchedRule'];
}> {
  const client = await pool.connect();
  
  try {
    // Single optimized query that checks all conditions
    const query = `
      SELECT 
        iw.id,
        iw.address,
        iw.description,
        iw.user_id IS NULL as is_global
      FROM ip_whitelist iw
      WHERE 
        iw.is_active = true
        AND (iw.expires_at IS NULL OR iw.expires_at > NOW())
        AND (iw.user_id IS NULL OR iw.user_id = $2)
      ORDER BY 
        iw.user_id NULLS LAST,  -- User-specific rules first
        iw.id
    `;
    
    const result = await client.query(query, [publicIP, userId]);
    
    // Check each whitelist entry using CIDR matching
    for (const row of result.rows) {
      if (ipInCIDR(publicIP, row.address)) {
        return {
          allowed: true,
          reason: 'IP matches whitelist rule',
          matchedRule: {
            id: row.id,
            address: row.address,
            description: row.description,
            isGlobal: row.is_global
          }
        };
      }
    }
    
    return {
      allowed: false,
      reason: 'IP not found in whitelist'
    };
    
  } catch (error) {
    console.error('IP whitelist database error:', error);
    // In case of database error, use permissive mode behavior
    const config = getIPWhitelistConfig();
    return {
      allowed: config.mode === 'permissive',
      reason: `Database error: ${config.mode} mode applied`
    };
  } finally {
    client.release();
  }
}

/**
 * Check both IP-based and user-based rate limits
 */
async function checkRateLimits(publicIP: string, userId?: number): Promise<RateLimitResult> {
  const client = await pool.connect();
  const now = new Date();
  const windowMinutes = 15; // Rate limit window
  const ipLimit = 5; // Max attempts per IP per window
  const userLimit = 10; // Max attempts per user per window
  
  try {
    await client.query('BEGIN');
    
    // Check IP rate limit
    let ipRateLimit = await client.query(
      'SELECT * FROM ip_rate_limits WHERE ip_address = $1',
      [publicIP]
    );
    
    if (ipRateLimit.rows.length === 0) {
      // Create new IP rate limit record
      await client.query(
        'INSERT INTO ip_rate_limits (ip_address, failed_attempts) VALUES ($1, 0)',
        [publicIP]
      );
      ipRateLimit = await client.query(
        'SELECT * FROM ip_rate_limits WHERE ip_address = $1',
        [publicIP]
      );
    }
    
    const ipRecord = ipRateLimit.rows[0];
    
    // Check if IP is currently blocked
    if (ipRecord.is_blocked && ipRecord.blocked_until && new Date(ipRecord.blocked_until) > now) {
      await client.query('COMMIT');
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(ipRecord.blocked_until),
        blockReason: 'ip_rate_limit'
      };
    }
    
    // Reset IP rate limit if window has passed
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);
    if (new Date(ipRecord.first_attempt) < windowStart) {
      await client.query(
        'UPDATE ip_rate_limits SET failed_attempts = 0, first_attempt = $1, is_blocked = false, blocked_until = NULL WHERE ip_address = $2',
        [now, publicIP]
      );
    }
    
    // Check if IP has exceeded rate limit
    if (ipRecord.failed_attempts >= ipLimit) {
      const blockUntil = new Date(now.getTime() + 60 * 60 * 1000); // Block for 1 hour
      await client.query(
        'UPDATE ip_rate_limits SET is_blocked = true, blocked_until = $1 WHERE ip_address = $2',
        [blockUntil, publicIP]
      );
      await client.query('COMMIT');
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: blockUntil,
        blockReason: 'ip_rate_limit'
      };
    }
    
    // Check user rate limit if userId provided
    if (userId) {
      let userRateLimit = await client.query(
        'SELECT * FROM user_rate_limits WHERE user_id = $1',
        [userId]
      );
      
      if (userRateLimit.rows.length === 0) {
        // Create new user rate limit record
        await client.query(
          'INSERT INTO user_rate_limits (user_id, failed_attempts) VALUES ($1, 0)',
          [userId]
        );
        userRateLimit = await client.query(
          'SELECT * FROM user_rate_limits WHERE user_id = $1',
          [userId]
        );
      }
      
      const userRecord = userRateLimit.rows[0];
      
      // Check if user is currently blocked
      if (userRecord.is_blocked && userRecord.blocked_until && new Date(userRecord.blocked_until) > now) {
        await client.query('COMMIT');
        return {
          allowed: false,
          remainingAttempts: 0,
          resetTime: new Date(userRecord.blocked_until),
          blockReason: 'user_rate_limit'
        };
      }
      
      // Reset user rate limit if window has passed
      if (new Date(userRecord.first_attempt) < windowStart) {
        await client.query(
          'UPDATE user_rate_limits SET failed_attempts = 0, first_attempt = $1, is_blocked = false, blocked_until = NULL WHERE user_id = $2',
          [now, userId]
        );
      }
      
      // Check if user has exceeded rate limit
      if (userRecord.failed_attempts >= userLimit) {
        const blockUntil = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Block for 2 hours
        await client.query(
          'UPDATE user_rate_limits SET is_blocked = true, blocked_until = $1 WHERE user_id = $2',
          [blockUntil, userId]
        );
        await client.query('COMMIT');
        return {
          allowed: false,
          remainingAttempts: 0,
          resetTime: blockUntil,
          blockReason: 'user_rate_limit'
        };
      }
    }
    
    await client.query('COMMIT');
    
    return {
      allowed: true,
      remainingAttempts: ipLimit - ipRecord.failed_attempts,
      resetTime: null
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rate limit check error:', error);
    // On error, allow but with caution
    return {
      allowed: true,
      remainingAttempts: 1,
      resetTime: null
    };
  } finally {
    client.release();
  }
}

/**
 * Record failed authentication attempt for rate limiting
 */
export async function recordFailedAttempt(publicIP: string, userId?: number): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update IP rate limit
    await client.query(`
      INSERT INTO ip_rate_limits (ip_address, failed_attempts, last_attempt) 
      VALUES ($1, 1, NOW())
      ON CONFLICT (ip_address) 
      DO UPDATE SET 
        failed_attempts = ip_rate_limits.failed_attempts + 1,
        last_attempt = NOW()
    `, [publicIP]);
    
    // Update user rate limit if userId provided
    if (userId) {
      await client.query(`
        INSERT INTO user_rate_limits (user_id, failed_attempts, last_attempt)
        VALUES ($1, 1, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET 
          failed_attempts = user_rate_limits.failed_attempts + 1,
          last_attempt = NOW()
      `, [userId]);
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to record failed attempt:', error);
  } finally {
    client.release();
  }
}

/**
 * Check if user has admin role
 */
async function checkIfUserIsAdmin(userId: number): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    return result.rows.length > 0 && result.rows[0].role === 'ADMIN';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Log IP access attempt
 */
async function logIPAccess(
  userId: number | null,
  email: string | null,
  publicIP: string | null,
  granted: boolean,
  reason: string,
  request: Request
): Promise<void> {
  // Only log if configured to do so
  const config = getIPWhitelistConfig();
  if (!config.logAll && granted) {
    return; // Skip logging successful attempts unless logAll is true
  }
  
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO ip_access_logs (user_id, email, public_ip, access_granted, denial_reason, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      userId,
      email,
      publicIP,
      granted,
      granted ? null : reason,
      getUserAgent(request)
    ]);
  } catch (error) {
    console.error('Failed to log IP access:', error);
  } finally {
    client.release();
  }
}

/**
 * Cache management functions
 */
function getFromCache(key: string): boolean | null {
  const entry = whitelistCache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now > entry.timestamp + entry.ttl * 1000) {
    whitelistCache.delete(key);
    return null;
  }
  
  return entry.result;
}

function addToCache(key: string, result: boolean, ttlSeconds: number): void {
  whitelistCache.set(key, {
    result,
    timestamp: Date.now(),
    ttl: ttlSeconds
  });
}

/**
 * Admin functions for managing whitelist
 */
export async function addIPToWhitelist(
  address: string,
  description: string | null,
  userId: number | null,
  createdBy: number,
  expiresAt: Date | null = null
): Promise<{ success: boolean; id?: number; error?: string }> {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      INSERT INTO ip_whitelist (address, description, user_id, created_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [address, description, userId, createdBy, expiresAt]);
    
    // Clear relevant cache entries
    clearCacheForIP(address);
    
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error('Failed to add IP to whitelist:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    client.release();
  }
}

export async function removeIPFromWhitelist(id: number): Promise<{ success: boolean; error?: string }> {
  const client = await pool.connect();
  
  try {
    await client.query('DELETE FROM ip_whitelist WHERE id = $1', [id]);
    
    // Clear cache (we don't know which IPs to clear, so clear all)
    whitelistCache.clear();
    
    return { success: true };
  } catch (error) {
    console.error('Failed to remove IP from whitelist:', error);
    return { success: false, error: (error as Error).message };
  } finally {
    client.release();
  }
}

function clearCacheForIP(address: string): void {
  // Clear all cache entries that might match this CIDR
  // This is a simple approach - in production you might want more sophisticated cache invalidation
  whitelistCache.clear();
}
