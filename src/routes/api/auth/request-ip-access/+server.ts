import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractPublicIP } from '$lib/server/ip-utils.js';
import { addIPToWhitelist } from '$lib/server/ip-whitelist.js';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Simple email simulation (in production, use a real email service)
async function sendBreakGlassEmail(email: string, token: string, publicIP: string) {
  // In a real implementation, you would use a service like SendGrid, Nodemailer, etc.
  console.log(`
🔓 Break-Glass IP Access Request
================================
Email: ${email}
Public IP: ${publicIP}
Access Token: ${token}
Valid for: 24 hours

Click this link to grant temporary access:
${process.env.DEV_SERVER_URL || 'http://localhost:5173'}/auth/grant-ip-access?token=${token}

This link will add your current IP (${publicIP}) to the whitelist for 24 hours.
  `);
  
  // For development/testing, we'll just log it
  // In production, replace with actual email sending
  return true;
}

// POST: Request break-glass IP access
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { email, reason } = await request.json();
    
    if (!email) {
      return json(
        {
          success: false,
          error: 'Email address is required'
        },
        { status: 400 }
      );
    }
    
    // Extract the user's public IP
    const extractedIP = extractPublicIP(request);
    if (!extractedIP || !extractedIP.isPublic) {
      return json(
        {
          success: false,
          error: 'Could not determine your public IP address'
        },
        { status: 400 }
      );
    }
    
    const publicIP = extractedIP.ip;
    
    // Verify the user exists in the system
    const client = await pool.connect();
    let userId: number | null = null;
    
    try {
      const userResult = await client.query(
        'SELECT id, email FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      
      if (userResult.rows.length === 0) {
        return json(
          {
            success: false,
            error: 'No active account found with this email address'
          },
          { status: 404 }
        );
      }
      
      userId = userResult.rows[0].id;
      
      // Check if there's already a pending request for this IP/user combination
      const existingRequest = await client.query(`
        SELECT id, expires_at FROM ip_access_requests 
        WHERE user_id = $1 AND public_ip = $2 AND used = false AND expires_at > NOW()
      `, [userId, publicIP]);
      
      if (existingRequest.rows.length > 0) {
        return json(
          {
            success: false,
            error: 'A pending access request already exists for this IP address'
          },
          { status: 409 }
        );
      }
      
      // Generate a secure token
      const token = crypto.randomUUID() + '-' + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store the access request
      await client.query(`
        INSERT INTO ip_access_requests (user_id, public_ip, token, reason, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [userId, publicIP, token, reason || null, expiresAt]);
      
      // Send the email (in production, this would be a real email)
      await sendBreakGlassEmail(email, token, publicIP);
      
      // Log the request
      await client.query(`
        INSERT INTO ip_access_logs (user_id, email, public_ip, access_granted, denial_reason, user_agent)
        VALUES ($1, $2, $3, false, 'break_glass_request_sent', $4)
      `, [userId, email, publicIP, request.headers.get('user-agent')]);
      
      return json({
        success: true,
        message: 'Access request sent. Please check your email for further instructions.',
        expiresIn: '24 hours'
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Break-glass request error:', error);
    return json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
};

// Create the ip_access_requests table if it doesn't exist
export const PATCH: RequestHandler = async () => {
  try {
    const client = await pool.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ip_access_requests (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          public_ip VARCHAR(45) NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          reason TEXT,
          used BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP NOT NULL,
          granted_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ip_access_requests_token ON ip_access_requests(token)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ip_access_requests_user ON ip_access_requests(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ip_access_requests_expires ON ip_access_requests(expires_at)
      `);
      
      return json({
        success: true,
        message: 'Break-glass access table created successfully'
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Table creation error:', error);
    return json(
      {
        success: false,
        error: 'Failed to create break-glass access table'
      },
      { status: 500 }
    );
  }
};