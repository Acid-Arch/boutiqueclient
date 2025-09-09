import { g as getIPWhitelistConfig, e as extractPublicIP, b as getUserAgent, c as ipInCIDR } from './ip-utils-B5dp7ZZG.js';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
const whitelistCache = /* @__PURE__ */ new Map();
async function validateIPAccess(request, userId, userEmail) {
  const config = getIPWhitelistConfig();
  if (!config.enabled) {
    return {
      allowed: true,
      publicIP: null,
      source: "disabled",
      reason: "IP whitelist is disabled"
    };
  }
  if (config.devBypass && process.env.NODE_ENV === "development") {
    return {
      allowed: true,
      publicIP: null,
      source: "dev_bypass",
      reason: "Development mode bypass enabled"
    };
  }
  const extractedIP = extractPublicIP(request);
  if (!extractedIP) {
    await logIPAccess(null, userEmail || null, null, false, "no_public_ip_found", request);
    return {
      allowed: false,
      publicIP: null,
      source: "extraction_failed",
      reason: "Could not determine public IP address"
    };
  }
  const { ip: publicIP } = extractedIP;
  const rateLimitResult = await checkRateLimits(publicIP, userId);
  if (!rateLimitResult.allowed) {
    await logIPAccess(userId || null, userEmail || null, publicIP, false, rateLimitResult.blockReason || "rate_limit", request);
    return {
      allowed: false,
      publicIP,
      source: "rate_limited",
      reason: `Rate limit exceeded: ${rateLimitResult.blockReason}`
    };
  }
  if (config.adminBypass && userId) {
    const isAdmin = await checkIfUserIsAdmin(userId);
    if (isAdmin) {
      await logIPAccess(userId || null, userEmail || null, publicIP, true, "admin_bypass", request);
      return {
        allowed: true,
        publicIP,
        source: "admin_bypass",
        reason: "Admin user bypass enabled"
      };
    }
  }
  const cacheKey = `${publicIP}:${userId || "global"}`;
  const cached = getFromCache(cacheKey);
  if (cached !== null) {
    await logIPAccess(userId || null, userEmail || null, publicIP, cached, cached ? "cache_hit" : "cache_miss", request);
    return {
      allowed: cached,
      publicIP,
      source: "cache",
      reason: cached ? "IP found in cache" : "IP not in whitelist (cached)"
    };
  }
  const validationResult = await checkIPWhitelist(publicIP, userId);
  addToCache(cacheKey, validationResult.allowed, config.cacheTTL);
  await logIPAccess(
    userId || null,
    userEmail || null,
    publicIP,
    validationResult.allowed,
    validationResult.allowed ? "whitelist_match" : "not_whitelisted",
    request
  );
  return {
    allowed: validationResult.allowed,
    publicIP,
    source: "database",
    reason: validationResult.reason,
    matchedRule: validationResult.matchedRule
  };
}
async function checkIPWhitelist(publicIP, userId) {
  const client = await pool.connect();
  try {
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
    for (const row of result.rows) {
      if (ipInCIDR(publicIP, row.address)) {
        return {
          allowed: true,
          reason: "IP matches whitelist rule",
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
      reason: "IP not found in whitelist"
    };
  } catch (error) {
    console.error("IP whitelist database error:", error);
    const config = getIPWhitelistConfig();
    return {
      allowed: config.mode === "permissive",
      reason: `Database error: ${config.mode} mode applied`
    };
  } finally {
    client.release();
  }
}
async function checkRateLimits(publicIP, userId) {
  const client = await pool.connect();
  const now = /* @__PURE__ */ new Date();
  const windowMinutes = 15;
  const ipLimit = 5;
  const userLimit = 10;
  try {
    await client.query("BEGIN");
    let ipRateLimit = await client.query(
      "SELECT * FROM ip_rate_limits WHERE ip_address = $1",
      [publicIP]
    );
    if (ipRateLimit.rows.length === 0) {
      await client.query(
        "INSERT INTO ip_rate_limits (ip_address, failed_attempts) VALUES ($1, 0)",
        [publicIP]
      );
      ipRateLimit = await client.query(
        "SELECT * FROM ip_rate_limits WHERE ip_address = $1",
        [publicIP]
      );
    }
    const ipRecord = ipRateLimit.rows[0];
    if (ipRecord.is_blocked && ipRecord.blocked_until && new Date(ipRecord.blocked_until) > now) {
      await client.query("COMMIT");
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: new Date(ipRecord.blocked_until),
        blockReason: "ip_rate_limit"
      };
    }
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1e3);
    if (new Date(ipRecord.first_attempt) < windowStart) {
      await client.query(
        "UPDATE ip_rate_limits SET failed_attempts = 0, first_attempt = $1, is_blocked = false, blocked_until = NULL WHERE ip_address = $2",
        [now, publicIP]
      );
    }
    if (ipRecord.failed_attempts >= ipLimit) {
      const blockUntil = new Date(now.getTime() + 60 * 60 * 1e3);
      await client.query(
        "UPDATE ip_rate_limits SET is_blocked = true, blocked_until = $1 WHERE ip_address = $2",
        [blockUntil, publicIP]
      );
      await client.query("COMMIT");
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: blockUntil,
        blockReason: "ip_rate_limit"
      };
    }
    if (userId) {
      let userRateLimit = await client.query(
        "SELECT * FROM user_rate_limits WHERE user_id = $1",
        [userId]
      );
      if (userRateLimit.rows.length === 0) {
        await client.query(
          "INSERT INTO user_rate_limits (user_id, failed_attempts) VALUES ($1, 0)",
          [userId]
        );
        userRateLimit = await client.query(
          "SELECT * FROM user_rate_limits WHERE user_id = $1",
          [userId]
        );
      }
      const userRecord = userRateLimit.rows[0];
      if (userRecord.is_blocked && userRecord.blocked_until && new Date(userRecord.blocked_until) > now) {
        await client.query("COMMIT");
        return {
          allowed: false,
          remainingAttempts: 0,
          resetTime: new Date(userRecord.blocked_until),
          blockReason: "user_rate_limit"
        };
      }
      if (new Date(userRecord.first_attempt) < windowStart) {
        await client.query(
          "UPDATE user_rate_limits SET failed_attempts = 0, first_attempt = $1, is_blocked = false, blocked_until = NULL WHERE user_id = $2",
          [now, userId]
        );
      }
      if (userRecord.failed_attempts >= userLimit) {
        const blockUntil = new Date(now.getTime() + 2 * 60 * 60 * 1e3);
        await client.query(
          "UPDATE user_rate_limits SET is_blocked = true, blocked_until = $1 WHERE user_id = $2",
          [blockUntil, userId]
        );
        await client.query("COMMIT");
        return {
          allowed: false,
          remainingAttempts: 0,
          resetTime: blockUntil,
          blockReason: "user_rate_limit"
        };
      }
    }
    await client.query("COMMIT");
    return {
      allowed: true,
      remainingAttempts: ipLimit - ipRecord.failed_attempts,
      resetTime: null
    };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Rate limit check error:", error);
    return {
      allowed: true,
      remainingAttempts: 1,
      resetTime: null
    };
  } finally {
    client.release();
  }
}
async function recordFailedAttempt(publicIP, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO ip_rate_limits (ip_address, failed_attempts, last_attempt) 
      VALUES ($1, 1, NOW())
      ON CONFLICT (ip_address) 
      DO UPDATE SET 
        failed_attempts = ip_rate_limits.failed_attempts + 1,
        last_attempt = NOW()
    `, [publicIP]);
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
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to record failed attempt:", error);
  } finally {
    client.release();
  }
}
async function checkIfUserIsAdmin(userId) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    return result.rows.length > 0 && result.rows[0].role === "ADMIN";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  } finally {
    client.release();
  }
}
async function logIPAccess(userId, email, publicIP, granted, reason, request) {
  const config = getIPWhitelistConfig();
  if (!config.logAll && granted) {
    return;
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
    console.error("Failed to log IP access:", error);
  } finally {
    client.release();
  }
}
function getFromCache(key) {
  const entry = whitelistCache.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now > entry.timestamp + entry.ttl * 1e3) {
    whitelistCache.delete(key);
    return null;
  }
  return entry.result;
}
function addToCache(key, result, ttlSeconds) {
  whitelistCache.set(key, {
    result,
    timestamp: Date.now(),
    ttl: ttlSeconds
  });
}
async function addIPToWhitelist(address, description, userId, createdBy, expiresAt = null) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO ip_whitelist (address, description, user_id, created_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [address, description, userId, createdBy, expiresAt]);
    clearCacheForIP(address);
    return { success: true, id: result.rows[0].id };
  } catch (error) {
    console.error("Failed to add IP to whitelist:", error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}
async function removeIPFromWhitelist(id) {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM ip_whitelist WHERE id = $1", [id]);
    whitelistCache.clear();
    return { success: true };
  } catch (error) {
    console.error("Failed to remove IP from whitelist:", error);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}
function clearCacheForIP(address) {
  whitelistCache.clear();
}

export { addIPToWhitelist as a, recordFailedAttempt as b, removeIPFromWhitelist as r, validateIPAccess as v };
//# sourceMappingURL=ip-whitelist-Di39y6GV.js.map
