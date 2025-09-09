import { j as json } from './index-Djsj11qr.js';
import { g as getIPWhitelistConfig, e as extractPublicIP } from './ip-utils-B5dp7ZZG.js';
import pg from 'pg';
import 'ip-address';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
const GET = async ({ request, url }) => {
  try {
    const config = getIPWhitelistConfig();
    const extractedIP = extractPublicIP(request);
    if (!extractedIP) {
      return json({
        success: true,
        ip: null,
        isPublic: false,
        source: "unknown",
        isWhitelisted: false,
        reason: "Could not determine public IP address",
        config: {
          enabled: config.enabled,
          mode: config.mode
        }
      });
    }
    const { ip: publicIP, source } = extractedIP;
    let isWhitelisted = false;
    let matchedRules = [];
    let groups = [];
    let expiresAt = null;
    if (config.enabled) {
      const client = await pool.connect();
      try {
        const query = `
					SELECT 
						iw.id,
						iw.address,
						iw.description,
						iw.user_id,
						iw.expires_at,
						iwg.group_name
					FROM ip_whitelist iw
					LEFT JOIN ip_whitelist_group_members iwgm ON iw.id = iwgm.whitelist_id
					LEFT JOIN ip_whitelist_groups iwg ON iwgm.group_id = iwg.id AND iwg.is_active = true
					WHERE 
						iw.is_active = true
						AND (iw.expires_at IS NULL OR iw.expires_at > NOW())
					ORDER BY 
						iw.user_id NULLS LAST,
						iw.id
				`;
        const result = await client.query(query);
        for (const row of result.rows) {
          if (row.address === publicIP || row.address === `${publicIP}/32` || row.address === `${publicIP}/128` || publicIP.startsWith(row.address.split("/")[0])) {
            isWhitelisted = true;
            matchedRules.push({
              id: row.id,
              address: row.address,
              description: row.description,
              isGlobal: row.user_id === null,
              userId: row.user_id
            });
            if (row.group_name && !groups.includes(row.group_name)) {
              groups.push(row.group_name);
            }
            if (row.expires_at) {
              expiresAt = row.expires_at;
            }
          }
        }
      } finally {
        client.release();
      }
    }
    let recentAttempts = 0;
    let isRateLimited = false;
    if (config.enabled) {
      const client = await pool.connect();
      try {
        const attemptsResult = await client.query(
          `SELECT COUNT(*) as count 
					 FROM ip_access_logs 
					 WHERE public_ip = $1 
					 AND timestamp > NOW() - INTERVAL '1 hour'`,
          [publicIP]
        );
        recentAttempts = parseInt(attemptsResult.rows[0].count);
        const rateLimitResult = await client.query(
          `SELECT is_blocked, blocked_until 
					 FROM ip_rate_limits 
					 WHERE ip_address = $1`,
          [publicIP]
        );
        if (rateLimitResult.rows.length > 0) {
          const rateLimitRow = rateLimitResult.rows[0];
          isRateLimited = rateLimitRow.is_blocked && rateLimitRow.blocked_until && new Date(rateLimitRow.blocked_until) > /* @__PURE__ */ new Date();
        }
      } finally {
        client.release();
      }
    }
    return json({
      success: true,
      ip: publicIP,
      source,
      isPublic: extractedIP.isPublic,
      version: extractedIP.version,
      isWhitelisted,
      matchedRules,
      groups,
      expiresAt,
      config: {
        enabled: config.enabled,
        mode: config.mode,
        devBypass: config.devBypass && process.env.NODE_ENV === "development"
      },
      security: {
        recentAttempts,
        isRateLimited
      }
    });
  } catch (error) {
    console.error("Check IP API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error"
      },
      { status: 500 }
    );
  }
};
const POST = async ({ request }) => {
  try {
    const { ip } = await request.json();
    if (!ip) {
      return json(
        {
          success: false,
          error: "IP address is required"
        },
        { status: 400 }
      );
    }
    const config = getIPWhitelistConfig();
    let isWhitelisted = false;
    let matchedRules = [];
    if (config.enabled) {
      const client = await pool.connect();
      try {
        const query = `
					SELECT 
						iw.id,
						iw.address,
						iw.description,
						iw.user_id,
						iw.expires_at
					FROM ip_whitelist iw
					WHERE 
						iw.is_active = true
						AND (iw.expires_at IS NULL OR iw.expires_at > NOW())
					ORDER BY 
						iw.user_id NULLS LAST,
						iw.id
				`;
        const result = await client.query(query);
        for (const row of result.rows) {
          if (row.address === ip || row.address === `${ip}/32` || row.address === `${ip}/128` || ip.startsWith(row.address.split("/")[0])) {
            isWhitelisted = true;
            matchedRules.push({
              id: row.id,
              address: row.address,
              description: row.description,
              isGlobal: row.user_id === null,
              userId: row.user_id
            });
          }
        }
      } finally {
        client.release();
      }
    }
    return json({
      success: true,
      ip,
      isWhitelisted,
      matchedRules,
      config: {
        enabled: config.enabled,
        mode: config.mode
      }
    });
  } catch (error) {
    console.error("Check IP POST API error:", error);
    return json(
      {
        success: false,
        error: "Internal server error"
      },
      { status: 500 }
    );
  }
};

export { GET, POST };
//# sourceMappingURL=_server.ts-DSIhPayR.js.map
