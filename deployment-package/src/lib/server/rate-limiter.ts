import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const { Client } = pg;

export interface RateLimitResult {
	allowed: boolean;
	remainingAttempts: number;
	resetTime: Date;
	totalAttempts: number;
	message?: string;
}

export interface RateLimitConfig {
	maxAttempts: number;
	windowMinutes: number;
	progressiveDelays: number[]; // Delays in seconds for each attempt
}

// Default rate limit configuration
const DEFAULT_CONFIG: RateLimitConfig = {
	maxAttempts: 5,
	windowMinutes: 15,
	progressiveDelays: [0, 1, 2, 5, 10] // 0s, 1s, 2s, 5s, 10s, then block
};

async function getDbClient() {
	const client = new Client({
		connectionString: DATABASE_URL
	});
	await client.connect();
	return client;
}

export class RateLimiter {
	/**
	 * Check if a login attempt is allowed for an email/IP combination
	 */
	static async checkLoginAttempt(
		email: string, 
		ipAddress: string,
		config: RateLimitConfig = DEFAULT_CONFIG
	): Promise<RateLimitResult> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			const windowStart = new Date(Date.now() - config.windowMinutes * 60 * 1000);
			
			// Count recent failed attempts by email and IP
			const emailAttemptsQuery = `
				SELECT COUNT(*) as count, MAX(timestamp) as last_attempt
				FROM login_attempts 
				WHERE email = $1 AND success = false AND timestamp > $2
			`;
			
			const ipAttemptsQuery = `
				SELECT COUNT(*) as count, MAX(timestamp) as last_attempt
				FROM login_attempts 
				WHERE ip_address = $1 AND success = false AND timestamp > $2
			`;
			
			const [emailResult, ipResult] = await Promise.all([
				client.query(emailAttemptsQuery, [email, windowStart]),
				client.query(ipAttemptsQuery, [ipAddress, windowStart])
			]);
			
			const emailAttempts = parseInt(emailResult.rows[0].count);
			const ipAttempts = parseInt(ipResult.rows[0].count);
			const totalAttempts = Math.max(emailAttempts, ipAttempts);
			
			const resetTime = new Date(Date.now() + config.windowMinutes * 60 * 1000);
			const remainingAttempts = Math.max(0, config.maxAttempts - totalAttempts);
			
			// Check if blocked
			if (totalAttempts >= config.maxAttempts) {
				const lastAttemptTime = emailResult.rows[0].last_attempt || ipResult.rows[0].last_attempt;
				const nextAllowedTime = new Date(lastAttemptTime);
				nextAllowedTime.setMinutes(nextAllowedTime.getMinutes() + config.windowMinutes);
				
				return {
					allowed: false,
					remainingAttempts: 0,
					resetTime: nextAllowedTime,
					totalAttempts,
					message: `Too many failed attempts. Please try again after ${nextAllowedTime.toLocaleTimeString()}`
				};
			}
			
			// Check progressive delays
			if (totalAttempts > 0 && totalAttempts < config.progressiveDelays.length) {
				const delaySeconds = config.progressiveDelays[totalAttempts];
				const lastAttemptTime = new Date(emailResult.rows[0].last_attempt || ipResult.rows[0].last_attempt);
				const nextAllowedTime = new Date(lastAttemptTime.getTime() + delaySeconds * 1000);
				
				if (Date.now() < nextAllowedTime.getTime()) {
					const waitSeconds = Math.ceil((nextAllowedTime.getTime() - Date.now()) / 1000);
					return {
						allowed: false,
						remainingAttempts,
						resetTime: nextAllowedTime,
						totalAttempts,
						message: `Please wait ${waitSeconds} seconds before trying again`
					};
				}
			}
			
			return {
				allowed: true,
				remainingAttempts,
				resetTime,
				totalAttempts,
				message: remainingAttempts <= 2 ? `${remainingAttempts} attempts remaining` : undefined
			};
			
		} catch (error) {
			console.error('Rate limit check error:', error);
			// Fail open - allow the attempt but log the error
			return {
				allowed: true,
				remainingAttempts: config.maxAttempts,
				resetTime: new Date(Date.now() + config.windowMinutes * 60 * 1000),
				totalAttempts: 0
			};
		} finally {
			if (client) {
				await client.end();
			}
		}
	}

	/**
	 * Record a login attempt (success or failure)
	 */
	static async recordLoginAttempt(
		email: string,
		ipAddress: string,
		userAgent: string | null,
		success: boolean,
		userId?: number,
		failureReason?: string
	): Promise<void> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			await client.query(`
				INSERT INTO login_attempts (user_id, email, ip_address, user_agent, success, failure_reason, timestamp)
				VALUES ($1, $2, $3, $4, $5, $6, NOW())
			`, [userId || null, email, ipAddress, userAgent, success, failureReason || null]);
			
		} catch (error) {
			console.error('Failed to record login attempt:', error);
			// Don't throw - logging failure shouldn't block authentication
		} finally {
			if (client) {
				await client.end();
			}
		}
	}

	/**
	 * Clear failed attempts for a user after successful login
	 */
	static async clearFailedAttempts(email: string, ipAddress: string): Promise<void> {
		let client: pg.Client | null = null;
		
		try {
			client = await getDbClient();
			
			// Don't delete - just for historical tracking
			// But we could add a "cleared" flag if needed for performance
			
		} catch (error) {
			console.error('Failed to clear login attempts:', error);
		} finally {
			if (client) {
				await client.end();
			}
		}
	}

	/**
	 * Get rate limit status for display in UI
	 */
	static async getRateLimitStatus(email: string, ipAddress: string): Promise<{
		isLimited: boolean;
		nextAttemptTime?: Date;
		attemptsRemaining: number;
	}> {
		const result = await this.checkLoginAttempt(email, ipAddress);
		
		return {
			isLimited: !result.allowed,
			nextAttemptTime: result.allowed ? undefined : result.resetTime,
			attemptsRemaining: result.remainingAttempts
		};
	}
}

export default RateLimiter;