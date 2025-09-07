import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { addIPToWhitelist, removeIPFromWhitelist } from '$lib/server/ip-whitelist.js';
import { isValidCIDR, ipToCIDR, normalizeCIDR } from '$lib/server/ip-utils.js';
import pkg from 'pg';

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// GET: List all IP whitelist entries
export const GET: RequestHandler = async ({ url }) => {
  try {
    const client = await pool.connect();
    
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    
    const activeOnly = url.searchParams.get('active') !== 'false';
    const userIdFilter = url.searchParams.get('userId');
    
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    if (activeOnly) {
      whereConditions.push('iw.is_active = true');
    }
    
    if (userIdFilter) {
      if (userIdFilter === 'global') {
        whereConditions.push('iw.user_id IS NULL');
      } else {
        whereConditions.push(`iw.user_id = $${paramIndex}`);
        queryParams.push(parseInt(userIdFilter));
        paramIndex++;
      }
    }
    
    const whereClause = whereConditions.length > 0 ? 
      'WHERE ' + whereConditions.join(' AND ') : '';
    
    try {
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ip_whitelist iw
        ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].total);
      
      // Get paginated results
      const dataQuery = `
        SELECT 
          iw.id,
          iw.address,
          iw.description,
          iw.user_id,
          iw.is_active,
          iw.created_by,
          iw.created_at,
          iw.expires_at,
          u.email as user_email,
          cu.email as created_by_email
        FROM ip_whitelist iw
        LEFT JOIN users u ON iw.user_id = u.id
        LEFT JOIN users cu ON iw.created_by = cu.id
        ${whereClause}
        ORDER BY 
          iw.user_id NULLS FIRST,
          iw.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      const dataResult = await client.query(dataQuery, queryParams);
      
      return json({
        success: true,
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Get IP whitelist error:', error);
    return json(
      {
        success: false,
        error: 'Failed to retrieve IP whitelist entries'
      },
      { status: 500 }
    );
  }
};

// POST: Add new IP to whitelist
export const POST: RequestHandler = async ({ request }) => {
  try {
    const { 
      address, 
      description, 
      userId, 
      expiresAt 
    } = await request.json();
    
    // Validation
    if (!address) {
      return json(
        {
          success: false,
          error: 'IP address or CIDR is required'
        },
        { status: 400 }
      );
    }
    
    // Normalize and validate the address
    let normalizedAddress: string;
    
    if (address.includes('/')) {
      // It's already in CIDR format
      if (!isValidCIDR(address)) {
        return json(
          {
            success: false,
            error: 'Invalid CIDR format'
          },
          { status: 400 }
        );
      }
      
      const normalized = normalizeCIDR(address);
      if (!normalized) {
        return json(
          {
            success: false,
            error: 'Failed to normalize CIDR address'
          },
          { status: 400 }
        );
      }
      normalizedAddress = normalized;
    } else {
      // It's a single IP, convert to CIDR
      const cidr = ipToCIDR(address);
      if (!cidr) {
        return json(
          {
            success: false,
            error: 'Invalid IP address format'
          },
          { status: 400 }
        );
      }
      normalizedAddress = cidr;
    }
    
    // Parse expiration date if provided
    let expirationDate: Date | null = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return json(
          {
            success: false,
            error: 'Invalid expiration date format'
          },
          { status: 400 }
        );
      }
    }
    
    // Add to whitelist (assuming created_by = 1 for now, should be from session)
    const result = await addIPToWhitelist(
      normalizedAddress,
      description || null,
      userId || null,
      1, // TODO: Get from authenticated user session
      expirationDate
    );
    
    if (!result.success) {
      return json(
        {
          success: false,
          error: result.error || 'Failed to add IP to whitelist'
        },
        { status: 500 }
      );
    }
    
    return json({
      success: true,
      id: result.id,
      address: normalizedAddress
    });
    
  } catch (error) {
    console.error('Add IP whitelist error:', error);
    return json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
};

// PUT: Update IP whitelist entry
export const PUT: RequestHandler = async ({ request }) => {
  try {
    const { 
      id, 
      description, 
      isActive, 
      expiresAt 
    } = await request.json();
    
    if (!id) {
      return json(
        {
          success: false,
          error: 'Entry ID is required'
        },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    
    try {
      const updates = [];
      const values = [];
      let paramIndex = 1;
      
      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        values.push(description);
        paramIndex++;
      }
      
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex}`);
        values.push(isActive);
        paramIndex++;
      }
      
      if (expiresAt !== undefined) {
        if (expiresAt) {
          const expirationDate = new Date(expiresAt);
          if (isNaN(expirationDate.getTime())) {
            return json(
              {
                success: false,
                error: 'Invalid expiration date format'
              },
              { status: 400 }
            );
          }
          updates.push(`expires_at = $${paramIndex}`);
          values.push(expirationDate);
        } else {
          updates.push(`expires_at = NULL`);
        }
        paramIndex++;
      }
      
      if (updates.length === 0) {
        return json(
          {
            success: false,
            error: 'No updates provided'
          },
          { status: 400 }
        );
      }
      
      values.push(id);
      
      const query = `
        UPDATE ip_whitelist 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      const result = await client.query(query, values);
      
      if (result.rows.length === 0) {
        return json(
          {
            success: false,
            error: 'Entry not found'
          },
          { status: 404 }
        );
      }
      
      return json({
        success: true,
        data: result.rows[0]
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Update IP whitelist error:', error);
    return json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
};

// DELETE: Remove IP from whitelist
export const DELETE: RequestHandler = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');
    
    if (!id) {
      return json(
        {
          success: false,
          error: 'Entry ID is required'
        },
        { status: 400 }
      );
    }
    
    const result = await removeIPFromWhitelist(parseInt(id));
    
    if (!result.success) {
      return json(
        {
          success: false,
          error: result.error || 'Failed to remove IP from whitelist'
        },
        { status: 500 }
      );
    }
    
    return json({
      success: true
    });
    
  } catch (error) {
    console.error('Delete IP whitelist error:', error);
    return json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
};