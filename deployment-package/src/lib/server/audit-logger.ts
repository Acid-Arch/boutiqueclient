import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const { Client } = pg;

export enum AuditEventType {
	LOGIN_SUCCESS = 'LOGIN_SUCCESS',
	LOGIN_FAILURE = 'LOGIN_FAILURE',
	LOGIN_BLOCKED_RATE_LIMIT = 'LOGIN_BLOCKED_RATE_LIMIT',
	PASSWORD_RESET_REQUEST = 'PASSWORD_RESET_REQUEST',
	PASSWORD_RESET_COMPLETE = 'PASSWORD_RESET_COMPLETE',
	PASSWORD_CHANGE = 'PASSWORD_CHANGE',
	SESSION_INVALIDATED = 'SESSION_INVALIDATED',
	TWO_FACTOR_ENABLED = 'TWO_FACTOR_ENABLED',
	TWO_FACTOR_DISABLED = 'TWO_FACTOR_DISABLED',
	ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
	ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',
	TRUSTED_IP_LOGIN = 'TRUSTED_IP_LOGIN'
}

export interface AuditLogEntry {
	userId?: number;
	eventType: AuditEventType;
	description: string;
	ipAddress: string;
	userAgent?: string;
	metadata?: Record<string, any>;
}

export interface AuditLogQuery {
	userId?: number;
	eventTypes?: AuditEventType[];
	startDate?: Date;
	endDate?: Date;
	ipAddress?: string;
	limit?: number;
	offset?: number;
}

async function getDbClient() {
	const client = new Client({
		connectionString: DATABASE_URL
	});
	await client.connect();
	return client;
}

export class AuditLogger {
	/**
	 * Log a security event
	 */
	static async log(entry: AuditLogEntry): Promise<void> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			await client.query(`
				INSERT INTO audit_logs (user_id, action, entity_type, ip_address, user_agent, old_values, timestamp)
				VALUES ($1, $2, $3, $4, $5, $6, NOW())
			`, [
				entry.userId || null,
				entry.eventType,
				'authentication',
				entry.ipAddress,
				entry.userAgent || null,
				entry.metadata ? JSON.stringify(entry.metadata) : null
			]);
			
		} catch (error) {
			console.error('Failed to log audit event:', error);
			// Don't throw - audit logging failure shouldn't block operations
		} finally {
			if (client) {
				await client.end();
			}
		}
	}

	/**
	 * Convenience methods for common events
	 */
	static async logLoginSuccess(userId: number, email: string, ipAddress: string, userAgent?: string, metadata?: Record<string, any>): Promise<void> {
		await this.log({
			userId,
			eventType: AuditEventType.LOGIN_SUCCESS,
			description: `User ${email} logged in successfully`,
			ipAddress,
			userAgent,
			metadata: { email, ...metadata }
		});
	}

	static async logLoginFailure(email: string, ipAddress: string, reason: string, userAgent?: string, userId?: number): Promise<void> {
		await this.log({
			userId,
			eventType: AuditEventType.LOGIN_FAILURE,
			description: `Failed login attempt for ${email}: ${reason}`,
			ipAddress,
			userAgent,
			metadata: { email, reason }
		});
	}

	static async logRateLimitBlock(email: string, ipAddress: string, attemptsCount: number, userAgent?: string): Promise<void> {
		await this.log({
			eventType: AuditEventType.LOGIN_BLOCKED_RATE_LIMIT,
			description: `Login blocked due to rate limit for ${email} (${attemptsCount} attempts)`,
			ipAddress,
			userAgent,
			metadata: { email, attemptsCount }
		});
	}

	static async logPasswordResetRequest(userId: number, email: string, ipAddress: string, userAgent?: string): Promise<void> {
		await this.log({
			userId,
			eventType: AuditEventType.PASSWORD_RESET_REQUEST,
			description: `Password reset requested for ${email}`,
			ipAddress,
			userAgent,
			metadata: { email }
		});
	}

	static async logPasswordResetComplete(userId: number, email: string, ipAddress: string, userAgent?: string): Promise<void> {
		await this.log({
			userId,
			eventType: AuditEventType.PASSWORD_RESET_COMPLETE,
			description: `Password reset completed for ${email}`,
			ipAddress,
			userAgent,
			metadata: { email }
		});
	}

	static async logPasswordChange(userId: number, email: string, ipAddress: string, userAgent?: string): Promise<void> {
		await this.log({
			userId,
			eventType: AuditEventType.PASSWORD_CHANGE,
			description: `Password changed for ${email}`,
			ipAddress,
			userAgent,
			metadata: { email }
		});
	}

	static async logSessionInvalidated(userId: number, email: string, reason: string, ipAddress: string, userAgent?: string): Promise<void> {
		await this.log({
			userId,
			eventType: AuditEventType.SESSION_INVALIDATED,
			description: `Session invalidated for ${email}: ${reason}`,
			ipAddress,
			userAgent,
			metadata: { email, reason }
		});
	}

	/**
	 * Get audit logs for a user or system-wide
	 */
	static async getAuditLogs(query: AuditLogQuery = {}): Promise<any[]> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			let whereConditions: string[] = [];
			let params: any[] = [];
			let paramCount = 0;
			
			if (query.userId) {
				whereConditions.push(`user_id = $${++paramCount}`);
				params.push(query.userId);
			}
			
			if (query.eventTypes && query.eventTypes.length > 0) {
				whereConditions.push(`action = ANY($${++paramCount})`);
				params.push(query.eventTypes);
			}
			
			if (query.startDate) {
				whereConditions.push(`timestamp >= $${++paramCount}`);
				params.push(query.startDate);
			}
			
			if (query.endDate) {
				whereConditions.push(`timestamp <= $${++paramCount}`);
				params.push(query.endDate);
			}
			
			if (query.ipAddress) {
				whereConditions.push(`ip_address = $${++paramCount}`);
				params.push(query.ipAddress);
			}
			
			const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
			const limit = query.limit || 100;
			const offset = query.offset || 0;
			
			const auditQuery = `
				SELECT 
					al.*,
					u.email as user_email,
					u.username as user_username
				FROM audit_logs al
				LEFT JOIN users u ON al.user_id = u.id
				${whereClause}
				ORDER BY al.timestamp DESC
				LIMIT $${++paramCount} OFFSET $${++paramCount}
			`;
			
			params.push(limit, offset);
			
			const result = await client.query(auditQuery, params);
			return result.rows;
			
		} catch (error) {
			console.error('Failed to get audit logs:', error);
			return [];
		} finally {
			if (client) {
				await client.end();
			}
		}
	}

	/**
	 * Get recent suspicious activity
	 */
	static async getSuspiciousActivity(hours: number = 24): Promise<any[]> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			const since = new Date(Date.now() - hours * 60 * 60 * 1000);
			
			// Find IPs with multiple failed attempts
			const suspiciousQuery = `
				SELECT 
					ip_address,
					COUNT(*) as attempt_count,
					COUNT(DISTINCT email) as target_count,
					MIN(timestamp) as first_attempt,
					MAX(timestamp) as last_attempt,
					array_agg(DISTINCT email) as targeted_emails
				FROM login_attempts 
				WHERE success = false AND timestamp > $1
				GROUP BY ip_address
				HAVING COUNT(*) >= 3
				ORDER BY attempt_count DESC
				LIMIT 20
			`;
			
			const result = await client.query(suspiciousQuery, [since]);
			return result.rows;
			
		} catch (error) {
			console.error('Failed to get suspicious activity:', error);
			return [];
		} finally {
			if (client) {
				await client.end();
			}
		}
	}

	/**
	 * Get login statistics for dashboard
	 */
	static async getLoginStats(days: number = 7): Promise<{
		totalLogins: number;
		successfulLogins: number;
		failedLogins: number;
		uniqueUsers: number;
		uniqueIPs: number;
	}> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
			
			const statsQuery = `
				SELECT 
					COUNT(*) as total_logins,
					COUNT(*) FILTER (WHERE success = true) as successful_logins,
					COUNT(*) FILTER (WHERE success = false) as failed_logins,
					COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
					COUNT(DISTINCT ip_address) as unique_ips
				FROM login_attempts 
				WHERE timestamp > $1
			`;
			
			const result = await client.query(statsQuery, [since]);
			const stats = result.rows[0];
			
			return {
				totalLogins: parseInt(stats.total_logins) || 0,
				successfulLogins: parseInt(stats.successful_logins) || 0,
				failedLogins: parseInt(stats.failed_logins) || 0,
				uniqueUsers: parseInt(stats.unique_users) || 0,
				uniqueIPs: parseInt(stats.unique_ips) || 0
			};
			
		} catch (error) {
			console.error('Failed to get login stats:', error);
			return {
				totalLogins: 0,
				successfulLogins: 0,
				failedLogins: 0,
				uniqueUsers: 0,
				uniqueIPs: 0
			};
		} finally {
			if (client) {
				await client.end();
			}
		}
	}
}

export default AuditLogger;