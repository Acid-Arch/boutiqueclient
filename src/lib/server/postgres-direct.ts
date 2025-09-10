import { Pool, type PoolClient } from 'pg';
import { DATABASE_URL } from '$env/static/private';

class PostgresDirectClient {
    private pool: Pool;
    private static instance: PostgresDirectClient;

    private constructor() {
        console.log('🔍 PostgreSQL Direct Connection (NixOS Compatible):');
        console.log('- Using direct PostgreSQL client for NixOS deployment');
        
        // Override the DATABASE_URL to use sslmode=disable for this deployment
        // The server environment has sslmode=require but the database uses self-signed certs
        let connectionString = DATABASE_URL;
        
        if (connectionString?.includes('sslmode=require')) {
            connectionString = connectionString.replace('sslmode=require', 'sslmode=disable');
            console.log('- Changed sslmode=require to sslmode=disable');
        } else if (!connectionString?.includes('sslmode=')) {
            // Add sslmode=disable if not present
            connectionString = connectionString + (connectionString.includes('?') ? '&' : '?') + 'sslmode=disable';
            console.log('- Added sslmode=disable to connection string');
        }
        
        console.log('- SSL disabled for deployment compatibility (expected on NixOS)');
        
        this.pool = new Pool({
            connectionString: connectionString,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            ssl: false // Explicitly disable SSL
        });

        // Handle pool errors
        this.pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }

    static getInstance(): PostgresDirectClient {
        if (!PostgresDirectClient.instance) {
            PostgresDirectClient.instance = new PostgresDirectClient();
        }
        return PostgresDirectClient.instance;
    }

    async query(text: string, params?: any[]): Promise<any> {
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            return result;
        } finally {
            client.release();
        }
    }

    async getClient(): Promise<PoolClient> {
        return await this.pool.connect();
    }

    async testConnection(): Promise<boolean> {
        try {
            const result = await this.query('SELECT 1 as test');
            return result.rows[0]?.test === 1;
        } catch (error) {
            console.error('Database connection test failed:', error);
            return false;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }

    // Critical user operations for authentication
    async findUserByEmail(email: string): Promise<any | null> {
        try {
            const result = await this.query(
                'SELECT id, email, name, password_hash, role, active, email_verified FROM users WHERE email = $1',
                [email]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    async findUserById(id: number): Promise<any | null> {
        try {
            const result = await this.query(
                'SELECT id, email, name, role, active, email_verified FROM users WHERE id = $1',
                [id]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }

    async createUser(userData: {
        email: string;
        username: string;
        password_hash?: string;
        first_name?: string;
        last_name?: string;
        role?: string;
    }): Promise<any | null> {
        try {
            const result = await this.query(
                `INSERT INTO users (email, username, password_hash, first_name, last_name, role, is_active, email_verified, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, true, false, NOW(), NOW())
                 RETURNING id, email, username, role, is_active, email_verified`,
                [
                    userData.email,
                    userData.username,
                    userData.password_hash || null,
                    userData.first_name || null,
                    userData.last_name || null,
                    userData.role || 'CLIENT'
                ]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error creating user:', error);
            return null;
        }
    }

    async updateUserLastLogin(userId: number): Promise<boolean> {
        try {
            await this.query(
                'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
                [userId]
            );
            return true;
        } catch (error) {
            console.error('Error updating user last login:', error);
            return false;
        }
    }

    async logLoginAttempt(data: {
        userId?: number;
        email: string;
        ipAddress: string;
        userAgent?: string;
        success: boolean;
        failureReason?: string;
    }): Promise<boolean> {
        try {
            await this.query(
                `INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason, timestamp)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [
                    data.userId || null,
                    data.email,
                    data.ipAddress,
                    data.userAgent || null,
                    data.success,
                    data.failureReason || null
                ]
            );
            return true;
        } catch (error) {
            console.error('Error logging login attempt:', error);
            return false;
        }
    }

    async createAuditLog(data: {
        userId?: number;
        eventType: string;
        description?: string;
        ipAddress?: string;
        userAgent?: string;
        success?: boolean;
        errorMessage?: string;
    }): Promise<boolean> {
        try {
            await this.query(
                `INSERT INTO audit_logs (user_id, event_type, description, ip_address, user_agent, success, error_message, timestamp)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [
                    data.userId || null,
                    data.eventType,
                    data.description || null,
                    data.ipAddress || null,
                    data.userAgent || null,
                    data.success !== undefined ? data.success : true,
                    data.errorMessage || null
                ]
            );
            return true;
        } catch (error) {
            console.error('Error creating audit log:', error);
            return false;
        }
    }

    // IG Accounts operations
    async getUserAccounts(userId: number): Promise<any[]> {
        try {
            const result = await this.query(
                `SELECT id, record_id, instagram_username, email_address, status, account_type, visibility, created_at
                 FROM ig_accounts 
                 WHERE owner_id = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );
            return result.rows || [];
        } catch (error) {
            console.error('Error getting user accounts:', error);
            return [];
        }
    }

    async getAccountStats(userId: number): Promise<any> {
        try {
            const result = await this.query(
                `SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'Active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'Unused' THEN 1 END) as unused,
                    COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked
                 FROM ig_accounts 
                 WHERE owner_id = $1`,
                [userId]
            );
            return result.rows[0] || { total: 0, active: 0, unused: 0, blocked: 0 };
        } catch (error) {
            console.error('Error getting account stats:', error);
            return { total: 0, active: 0, unused: 0, blocked: 0 };
        }
    }
}

export const pgDirect = PostgresDirectClient.getInstance();
export default pgDirect;