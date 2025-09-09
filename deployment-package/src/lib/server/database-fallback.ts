// Enhanced fallback database connection using direct SQL
// This provides complete feature parity when Prisma client generation fails
import pg from 'pg';
import { DatabaseSecurityLogger, monitoredQuery } from './db-security-logger.js';

const { Pool } = pg;

// Enhanced connection pool with health checks and retry logic
const sslRequired = process.env.DATABASE_URL?.includes('sslmode=require') && !process.env.DATABASE_URL?.includes('sslmode=disable');

const pool = new Pool({
	connectionString: process.env.DATABASE_URL || (() => {
		throw new Error('DATABASE_URL environment variable is required');
	})(),
	max: parseInt(process.env.DB_POOL_MAX || '20'), // Configurable connection pool size
	min: parseInt(process.env.DB_POOL_MIN || '5'),
	idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
	connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
	statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
	query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
	// Enhanced SSL configuration for security
	ssl: sslRequired ? { 
		rejectUnauthorized: process.env.NODE_ENV === 'production', // Strict in production
		checkServerIdentity: process.env.NODE_ENV === 'production' ? undefined : () => undefined,
		ca: process.env.DB_SSL_CA_CERT, // Support for CA certificate
		cert: process.env.DB_SSL_CLIENT_CERT, // Client certificate
		key: process.env.DB_SSL_CLIENT_KEY // Client private key
	} : false,
});

// Connection pool health monitoring
pool.on('error', (err, client) => {
	console.error('Unexpected database error on idle client:', err);
});

pool.on('connect', (client) => {
	console.log('Database connection established via fallback pool');
});

// Retry wrapper for database operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
	let lastError: Error | null = null;
	for (let i = 0; i <= maxRetries; i++) {
		try {
			return await operation();
		} catch (error) {
			lastError = error as Error;
			if (i < maxRetries && isRetryableError(error)) {
				const delay = Math.pow(2, i) * 1000; // Exponential backoff
				console.warn(`Database operation failed, retrying in ${delay}ms (attempt ${i + 1}/${maxRetries + 1}):`, error);
				await new Promise(resolve => setTimeout(resolve, delay));
			} else {
				break;
			}
		}
	}
	throw lastError || new Error('Operation failed after retries');
}

function isRetryableError(error: any): boolean {
	if (!error) return false;
	const retryableCodes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
	return retryableCodes.includes(error.code) || 
	       (error instanceof Error && error.message.includes('connection'));
}

// Re-export status utilities for consistency
export {
	ACCOUNT_STATUSES,
	CLONE_STATUSES,
	DEVICE_STATUSES,
	CLONE_HEALTH,
	getStatusClass,
	getCloneStatusClass,
	getDeviceStatusClass,
	type AccountStatus,
	type CloneStatus,
	type DeviceStatus,
	type CloneHealth
} from '$lib/utils/status.js';

// Import types locally for use within this file
import type { 
	AccountStatus, 
	CloneStatus, 
	DeviceStatus, 
	CloneHealth 
} from '$lib/utils/status.js';

// Helper function to get account statistics
export async function getAccountStats() {
	const client = await pool.connect();
	try {
		const totalResult = await client.query('SELECT COUNT(*) as total FROM ig_accounts');
		const statusResult = await client.query(`
			SELECT status, COUNT(*) as count 
			FROM ig_accounts 
			GROUP BY status 
			ORDER BY count DESC
		`);
		
		const total = parseInt(totalResult.rows[0].total);
		const byStatus = statusResult.rows.reduce((acc: Record<string, number>, row: any) => {
			acc[row.status] = parseInt(row.count);
			return acc;
		}, {} as Record<string, number>);
		
		return { total, byStatus };
	} finally {
		client.release();
	}
}

// Export pool for other operations if needed
export { pool };

// Helper functions for building SQL clauses with proper parameter binding

// Build WHERE clause for accounts with support for complex conditions
function buildWhereClause(where: any): { whereClause: string, params: any[] } {
	const conditions: string[] = [];
	const params: any[] = [];
	let paramCount = 0;
	
	function addCondition(key: string, value: any, operator = '='): void {
		const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		
		if (value === null) {
			conditions.push(`${dbKey} IS NULL`);
		} else if (value !== undefined) {
			paramCount++;
			if (operator === 'IN' && Array.isArray(value)) {
				// Handle IN clauses with arrays
				const placeholders = value.map((_, index) => {
					return `$${paramCount + index}`;
				});
				conditions.push(`${dbKey} IN (${placeholders.join(', ')})`);
				params.push(...value);
				paramCount += value.length - 1; // Adjust for the multiple parameters
			} else {
				conditions.push(`${dbKey} ${operator} $${paramCount}`);
				params.push(value);
			}
		}
	}
	
	function processWhereConditions(whereObj: any): void {
		for (const [key, value] of Object.entries(whereObj)) {
			if (key === 'OR') {
				// Handle OR conditions
				const orConditions: string[] = [];
				for (const orCondition of value as any[]) {
					const { whereClause: subWhere, params: subParams } = buildWhereClause(orCondition);
					if (subWhere) {
						orConditions.push(`(${subWhere})`);
						params.push(...subParams);
						paramCount += subParams.length;
					}
				}
				if (orConditions.length > 0) {
					conditions.push(`(${orConditions.join(' OR ')})`);
				}
			} else if (key === 'AND') {
				// Handle AND conditions
				for (const andCondition of value as any[]) {
					for (const subCondition of andCondition.AND || [andCondition]) {
						processWhereConditions(subCondition);
					}
				}
			} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				// Handle complex field conditions (e.g., { in: [...], not: ... })
				if ('in' in value) {
					addCondition(key, value.in, 'IN');
				} else if ('notIn' in value) {
					addCondition(key, value.notIn, 'NOT IN');
				} else if ('not' in value) {
					addCondition(key, value.not, '!=');
				} else if ('contains' in value) {
					paramCount++;
					const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
					const valueObj = value as { contains: string; mode?: string };
					const ilike = valueObj.mode === 'insensitive' ? 'ILIKE' : 'LIKE';
					conditions.push(`${dbKey} ${ilike} $${paramCount}`);
					params.push(`%${valueObj.contains}%`);
				} else if ('gte' in value) {
					addCondition(key, value.gte, '>=');
				} else if ('lte' in value) {
					addCondition(key, value.lte, '<=');
				} else if ('gt' in value) {
					addCondition(key, value.gt, '>');
				} else if ('lt' in value) {
					addCondition(key, value.lt, '<');
				}
			} else {
				// Simple equality condition
				addCondition(key, value);
			}
		}
	}
	
	processWhereConditions(where);
	
	return {
		whereClause: conditions.join(' AND '),
		params
	};
}

// Build SET clause for UPDATE statements
function buildSetClause(data: any, startParamCount = 0): { setClause: string, params: any[] } {
	const setClauses: string[] = [];
	const params: any[] = [];
	let paramCount = startParamCount;
	
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined && key !== 'updatedAt') { // Skip updatedAt as it's added automatically
			paramCount++;
			const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
			setClauses.push(`${dbKey} = $${paramCount}`);
			params.push(value);
		}
	}
	
	return {
		setClause: setClauses.join(', '),
		params
	};
}

// Build ORDER BY clause
function buildOrderByClause(orderBy: any): string {
	const clauses: string[] = [];
	
	for (const [key, direction] of Object.entries(orderBy)) {
		const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
		clauses.push(`${dbKey} ${direction}`);
	}
	
	return clauses.join(', ');
}

// Build WHERE clause for clone inventory
function buildCloneWhereClause(where: any): { whereClause: string, params: any[] } {
	const conditions: string[] = [];
	const params: any[] = [];
	let paramCount = 0;
	
	function addCondition(key: string, value: any, operator = '='): void {
		let dbKey = key;
		// Map camelCase to snake_case for clone inventory fields
		switch (key) {
			case 'deviceId':
				dbKey = 'device_id';
				break;
			case 'deviceId_cloneNumber':
				// Handle composite key condition for clone updates
				if (typeof value === 'object' && value.deviceId && value.cloneNumber !== undefined) {
					paramCount++;
					conditions.push(`device_id = $${paramCount}`);
					params.push(value.deviceId);
					
					paramCount++;
					conditions.push(`clone_number = $${paramCount}`);
					params.push(value.cloneNumber);
				}
				return;
			case 'cloneNumber':
				dbKey = 'clone_number';
				break;
			case 'cloneStatus':
				dbKey = 'clone_status';
				break;
			case 'cloneHealth':
				dbKey = 'clone_health';
				break;
			case 'currentAccount':
				dbKey = 'current_account';
				break;
			case 'packageName':
				dbKey = 'package_name';
				break;
			case 'lastScanned':
				dbKey = 'last_scanned';
				break;
			case 'updatedAt':
				dbKey = 'updated_at';
				break;
		}
		
		if (value === null) {
			conditions.push(`${dbKey} IS NULL`);
		} else if (value !== undefined) {
			paramCount++;
			if (operator === 'IN' && Array.isArray(value)) {
				const placeholders = value.map((_, index) => {
					return `$${paramCount + index}`;
				});
				conditions.push(`${dbKey} IN (${placeholders.join(', ')})`);
				params.push(...value);
				paramCount += value.length - 1; // Adjust for the multiple parameters
			} else {
				conditions.push(`${dbKey} ${operator} $${paramCount}`);
				params.push(value);
			}
		}
	}
	
	function processWhereConditions(whereObj: any): void {
		for (const [key, value] of Object.entries(whereObj)) {
			if (key === 'OR') {
				const orConditions: string[] = [];
				for (const orCondition of value as any[]) {
					const { whereClause: subWhere, params: subParams } = buildCloneWhereClause(orCondition);
					if (subWhere) {
						orConditions.push(`(${subWhere})`);
						params.push(...subParams);
						paramCount += subParams.length;
					}
				}
				if (orConditions.length > 0) {
					conditions.push(`(${orConditions.join(' OR ')})`);
				}
			} else if (key === 'AND') {
				for (const andCondition of value as any[]) {
					for (const subCondition of andCondition.AND || [andCondition]) {
						processWhereConditions(subCondition);
					}
				}
			} else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
				if ('in' in value) {
					addCondition(key, value.in, 'IN');
				} else if ('notIn' in value) {
					addCondition(key, value.notIn, 'NOT IN');
				} else if ('not' in value) {
					addCondition(key, value.not, '!=');
				}
			} else {
				addCondition(key, value);
			}
		}
	}
	
	processWhereConditions(where);
	
	return {
		whereClause: conditions.join(' AND '),
		params
	};
}

// Build SET clause for clone inventory updates
function buildCloneSetClause(data: any, startParamCount = 0): { setClause: string, params: any[] } {
	const setClauses: string[] = [];
	const params: any[] = [];
	let paramCount = startParamCount;
	
	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined && key !== 'updatedAt') { // Skip updatedAt as it's added automatically
			paramCount++;
			
			let dbKey = key;
			switch (key) {
				case 'cloneStatus':
					dbKey = 'clone_status';
					break;
				case 'currentAccount':
					dbKey = 'current_account';
					break;
			}
			
			setClauses.push(`${dbKey} = $${paramCount}`);
			params.push(value);
		}
	}
	
	return {
		setClause: setClauses.join(', '),
		params
	};
}

// Build ORDER BY clause for clone inventory
function buildCloneOrderByClause(orderBy: any): string {
	const clauses: string[] = [];
	
	// Handle both array and object formats
	if (Array.isArray(orderBy)) {
		for (const orderItem of orderBy) {
			for (const [key, direction] of Object.entries(orderItem)) {
				let dbKey = key;
				switch (key) {
					case 'deviceId':
						dbKey = 'device_id';
						break;
					case 'cloneNumber':
						dbKey = 'clone_number';
						break;
				}
				clauses.push(`${dbKey} ${direction}`);
			}
		}
	} else {
		for (const [key, direction] of Object.entries(orderBy)) {
			let dbKey = key;
			switch (key) {
				case 'deviceId':
					dbKey = 'device_id';
					break;
				case 'cloneNumber':
					dbKey = 'clone_number';
					break;
			}
			clauses.push(`${dbKey} ${direction}`);
		}
	}
	
	return clauses.join(', ');
}

// Map database row to account object (camelCase conversion)
function mapDbRowToAccount(row: any): any {
	return {
		id: row.id,
		recordId: row.record_id,
		instagramUsername: row.instagram_username,
		instagramPassword: row.instagram_password,
		emailAddress: row.email_address,
		emailPassword: row.email_password,
		status: row.status,
		imapStatus: row.imap_status,
		assignedDeviceId: row.assigned_device_id,
		assignedCloneNumber: row.assigned_clone_number,
		assignedPackageName: row.assigned_package_name,
		assignmentTimestamp: row.assignment_timestamp,
		loginTimestamp: row.login_timestamp,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

// Map database row to clone object (camelCase conversion)
function mapDbRowToClone(row: any): any {
	return {
		deviceId: row.device_id,
		deviceName: row.device_name,
		cloneNumber: row.clone_number,
		cloneStatus: row.clone_status,
		cloneHealth: row.clone_health,
		currentAccount: row.current_account,
		packageName: row.package_name,
		lastScanned: row.last_scanned,
		updatedAt: row.updated_at,
		createdAt: row.created_at
	};
}

// Enhanced prisma-like interface with bulk operations and transaction support
export const prisma = {
	igAccount: {
		count: async (options: any = {}) => {
			const client = await pool.connect();
			try {
				let query = 'SELECT COUNT(*) as count FROM ig_accounts';
				const { whereClause, params } = buildWhereClause(options.where || {});
				
				if (whereClause) {
					query += ` WHERE ${whereClause}`;
				}
				
				const result = await client.query(query, params);
				return parseInt(result.rows[0].count);
			} finally {
				client.release();
			}
		},
		findMany: async (options: any = {}) => {
			const client = await pool.connect();
			try {
				let query = 'SELECT * FROM ig_accounts';
				const { whereClause, params } = buildWhereClause(options.where || {});
				let paramCount = params.length;
				
				if (whereClause) {
					query += ` WHERE ${whereClause}`;
				}
				
				if (options.orderBy) {
					const orderByClauses = buildOrderByClause(options.orderBy);
					if (orderByClauses) {
						query += ` ORDER BY ${orderByClauses}`;
					}
				}
				
				if (options.take) {
					paramCount++;
					query += ` LIMIT $${paramCount}`;
					params.push(options.take);
				}
				
				if (options.skip) {
					paramCount++;
					query += ` OFFSET $${paramCount}`;
					params.push(options.skip);
				}
				
				const result = await client.query(query, params);
				return result.rows.map(mapDbRowToAccount);
			} finally {
				client.release();
			}
		},
		findFirst: async (options: any = {}) => {
			const client = await pool.connect();
			try {
				let query = 'SELECT * FROM ig_accounts';
				const { whereClause, params } = buildWhereClause(options.where || {});
				let paramCount = params.length;
				
				if (whereClause) {
					query += ` WHERE ${whereClause}`;
				}
				
				if (options.orderBy) {
					const orderByClauses = buildOrderByClause(options.orderBy);
					if (orderByClauses) {
						query += ` ORDER BY ${orderByClauses}`;
					}
				}
				
				query += ' LIMIT 1';
				
				const result = await client.query(query, params);
				return result.rows.length > 0 ? mapDbRowToAccount(result.rows[0]) : null;
			} finally {
				client.release();
			}
		},
		update: async (options: any) => {
			const client = await pool.connect();
			try {
				const { whereClause, params: whereParams } = buildWhereClause(options.where);
				const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
				
				if (!whereClause || !setClause) {
					throw new Error('Invalid update parameters');
				}
				
				const query = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
				const allParams = [...whereParams, ...setParams];
				
				const result = await client.query(query, allParams);
				return result.rows.length > 0 ? mapDbRowToAccount(result.rows[0]) : null;
			} finally {
				client.release();
			}
		},
		updateMany: async (options: any) => {
			const client = await pool.connect();
			try {
				const { whereClause, params: whereParams } = buildWhereClause(options.where);
				const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
				
				if (!whereClause || !setClause) {
					throw new Error('Invalid updateMany parameters');
				}
				
				const query = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
				const allParams = [...whereParams, ...setParams];
				
				const result = await client.query(query, allParams);
				return { count: result.rowCount || 0 };
			} finally {
				client.release();
			}
		},
		deleteMany: async (options: any) => {
			const client = await pool.connect();
			try {
				const { whereClause, params } = buildWhereClause(options.where);
				
				if (!whereClause) {
					throw new Error('DELETE requires WHERE clause for safety');
				}
				
				const query = `DELETE FROM ig_accounts WHERE ${whereClause}`;
				
				const result = await client.query(query, params);
				return { count: result.rowCount || 0 };
			} finally {
				client.release();
			}
		},
		groupBy: async (options: any) => {
			const client = await pool.connect();
			try {
				const { whereClause, params } = buildWhereClause(options.where || {});
				
				// Build GROUP BY clause
				const groupByFields = options.by.map((field: string) => {
					return field.replace(/([A-Z])/g, '_$1').toLowerCase();
				});
				
				// Build SELECT clause with aggregations
				let selectClause = groupByFields.join(', ');
				if (options._count) {
					for (const [countField, _] of Object.entries(options._count)) {
						const dbField = countField.replace(/([A-Z])/g, '_$1').toLowerCase();
						selectClause += `, COUNT(${dbField}) as _count_${dbField}`;
					}
				}
				
				let query = `SELECT ${selectClause} FROM ig_accounts`;
				
				if (whereClause) {
					query += ` WHERE ${whereClause}`;
				}
				
				query += ` GROUP BY ${groupByFields.join(', ')}`;
				
				const result = await client.query(query, params);
				
				// Transform result to match Prisma groupBy format
				return result.rows.map((row: any) => {
					const transformed: any = {};
					
					// Map grouped fields
					options.by.forEach((field: string, index: number) => {
						const dbField = groupByFields[index];
						transformed[field] = row[dbField];
					});
					
					// Map count fields
					if (options._count) {
						transformed._count = {};
						for (const countField of Object.keys(options._count)) {
							const dbField = countField.replace(/([A-Z])/g, '_$1').toLowerCase();
							transformed._count[countField] = parseInt(row[`_count_${dbField}`]);
						}
					}
					
					return transformed;
				});
			} finally {
				client.release();
			}
		}
	},
	cloneInventory: {
		count: async (options: any = {}) => {
			const client = await pool.connect();
			try {
				let query = 'SELECT COUNT(*) as count FROM clone_inventory';
				const { whereClause, params } = buildCloneWhereClause(options.where || {});
				
				if (whereClause) {
					query += ` WHERE ${whereClause}`;
				}
				
				const result = await client.query(query, params);
				return parseInt(result.rows[0].count);
			} finally {
				client.release();
			}
		},
		findMany: async (options: any = {}) => {
			const client = await pool.connect();
			try {
				let query = 'SELECT * FROM clone_inventory';
				const { whereClause, params } = buildCloneWhereClause(options.where || {});
				let paramCount = params.length;
				
				if (whereClause) {
					query += ` WHERE ${whereClause}`;
				}
				
				if (options.orderBy) {
					const orderByClauses = buildCloneOrderByClause(options.orderBy);
					if (orderByClauses) {
						query += ` ORDER BY ${orderByClauses}`;
					}
				}
				
				if (options.take) {
					paramCount++;
					query += ` LIMIT $${paramCount}`;
					params.push(options.take);
				}
				
				if (options.skip) {
					paramCount++;
					query += ` OFFSET $${paramCount}`;
					params.push(options.skip);
				}
				
				const result = await client.query(query, params);
				return result.rows.map(mapDbRowToClone);
			} finally {
				client.release();
			}
		},
		update: async (options: any) => {
			const client = await pool.connect();
			try {
				const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
				const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
				
				if (!whereClause || !setClause) {
					throw new Error('Invalid clone update parameters');
				}
				
				const query = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
				const allParams = [...whereParams, ...setParams];
				
				const result = await client.query(query, allParams);
				return result.rows.length > 0 ? mapDbRowToClone(result.rows[0]) : null;
			} finally {
				client.release();
			}
		},
		updateMany: async (options: any) => {
			const client = await pool.connect();
			try {
				const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
				const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
				
				if (!whereClause || !setClause) {
					throw new Error('Invalid clone updateMany parameters');
				}
				
				const query = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
				const allParams = [...whereParams, ...setParams];
				
				const result = await client.query(query, allParams);
				return { count: result.rowCount || 0 };
			} finally {
				client.release();
			}
		}
	},
	// Transaction support
	$transaction: async (callback: (tx: any) => Promise<any>) => {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			
			// Create transaction object with same API
			const tx = {
				igAccount: {
					update: async (options: any) => {
						const { whereClause, params: whereParams } = buildWhereClause(options.where);
						const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
						
						if (!whereClause || !setClause) {
							throw new Error('Invalid update parameters');
						}
						
						const query = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
						const allParams = [...whereParams, ...setParams];
						
						const result = await client.query(query, allParams);
						return result.rows.length > 0 ? mapDbRowToAccount(result.rows[0]) : null;
					},
					updateMany: async (options: any) => {
						const { whereClause, params: whereParams } = buildWhereClause(options.where);
						const { setClause, params: setParams } = buildSetClause(options.data, whereParams.length);
						
						if (!whereClause || !setClause) {
							throw new Error('Invalid updateMany parameters');
						}
						
						const query = `UPDATE ig_accounts SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
						const allParams = [...whereParams, ...setParams];
						
						const result = await client.query(query, allParams);
						return { count: result.rowCount || 0 };
					},
					deleteMany: async (options: any) => {
						const { whereClause, params } = buildWhereClause(options.where);
						
						if (!whereClause) {
							throw new Error('DELETE requires WHERE clause for safety');
						}
						
						const query = `DELETE FROM ig_accounts WHERE ${whereClause}`;
						
						const result = await client.query(query, params);
						return { count: result.rowCount || 0 };
					},
					findMany: async (options: any = {}) => {
						const { whereClause, params } = buildWhereClause(options.where || {});
						let paramCount = params.length;
						
						let query = 'SELECT * FROM ig_accounts';
						
						if (whereClause) {
							query += ` WHERE ${whereClause}`;
						}
						
						const result = await client.query(query, params);
						return result.rows.map(mapDbRowToAccount);
					}
				},
				cloneInventory: {
					update: async (options: any) => {
						const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
						const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
						
						if (!whereClause || !setClause) {
							throw new Error('Invalid clone update parameters');
						}
						
						const query = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause} RETURNING *`;
						const allParams = [...whereParams, ...setParams];
						
						const result = await client.query(query, allParams);
						return result.rows.length > 0 ? mapDbRowToClone(result.rows[0]) : null;
					},
					updateMany: async (options: any) => {
						const { whereClause, params: whereParams } = buildCloneWhereClause(options.where);
						const { setClause, params: setParams } = buildCloneSetClause(options.data, whereParams.length);
						
						if (!whereClause || !setClause) {
							throw new Error('Invalid clone updateMany parameters');
						}
						
						const query = `UPDATE clone_inventory SET ${setClause}, updated_at = NOW() WHERE ${whereClause}`;
						const allParams = [...whereParams, ...setParams];
						
						const result = await client.query(query, allParams);
						return { count: result.rowCount || 0 };
					}
				}
			};
			
			const result = await callback(tx);
			await client.query('COMMIT');
			return result;
			
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	}
};

// Get paginated accounts with filtering
export async function getAccounts(limit = 20, offset = 0, statusFilter?: string, searchQuery?: string, advancedFilters?: any) {
	const client = await pool.connect();
	try {
		let query = 'SELECT * FROM ig_accounts';
		const params: any[] = [];
		const conditions: string[] = [];
		const searchClauses: string[] = [];
		let paramCount = 0;
		
		
		// Handle legacy parameters for backward compatibility
		if (statusFilter && !advancedFilters?.statuses) {
			paramCount++;
			conditions.push(`status = $${paramCount}`);
			params.push(statusFilter);
		}
		
		if (searchQuery && !advancedFilters?.search) {
			paramCount++;
			searchClauses.push(`instagram_username ILIKE $${paramCount}`);
			params.push(`%${searchQuery}%`);
			
			paramCount++;
			searchClauses.push(`email_address ILIKE $${paramCount}`);
			params.push(`%${searchQuery}%`);
		}
		
		// Apply advanced filters if provided
		if (advancedFilters) {
			// Search filter
			if (advancedFilters.search) {
				paramCount++;
				searchClauses.push(`instagram_username ILIKE $${paramCount}`);
				params.push(`%${advancedFilters.search}%`);
				
				paramCount++;
				searchClauses.push(`email_address ILIKE $${paramCount}`);
				params.push(`%${advancedFilters.search}%`);
				
				paramCount++;
				searchClauses.push(`assigned_device_id ILIKE $${paramCount}`);
				params.push(`%${advancedFilters.search}%`);
			}

			// Status filter (multiple statuses)
			if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
				const statusPlaceholders = [];
				for (const status of advancedFilters.statuses) {
					paramCount++;
					statusPlaceholders.push(`$${paramCount}`);
					params.push(status);
				}
				conditions.push(`status IN (${statusPlaceholders.join(', ')})`);
			}

			// Device assignment filter
			if (advancedFilters.deviceAssignment) {
				switch (advancedFilters.deviceAssignment) {
					case 'assigned':
						conditions.push('assigned_device_id IS NOT NULL');
						break;
					case 'unassigned':
						conditions.push('assigned_device_id IS NULL');
						break;
					case 'specific':
						if (advancedFilters.specificDevice) {
							paramCount++;
							conditions.push(`assigned_device_id = $${paramCount}`);
							params.push(advancedFilters.specificDevice);
						}
						break;
					// 'all' case doesn't add any filter
				}
			}

			// Created date range filter
			if (advancedFilters.createdDateFrom) {
				paramCount++;
				conditions.push(`created_at >= $${paramCount}`);
				params.push(advancedFilters.createdDateFrom);
			}
			if (advancedFilters.createdDateTo) {
				// Set to end of day for inclusive filtering
				const endOfDay = new Date(advancedFilters.createdDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				paramCount++;
				conditions.push(`created_at <= $${paramCount}`);
				params.push(endOfDay);
			}

			// Login date range filter
			if (advancedFilters.loginDateFrom) {
				paramCount++;
				conditions.push(`login_timestamp >= $${paramCount}`);
				params.push(advancedFilters.loginDateFrom);
			}
			if (advancedFilters.loginDateTo) {
				// Set to end of day for inclusive filtering
				const endOfDay = new Date(advancedFilters.loginDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				paramCount++;
				conditions.push(`login_timestamp <= $${paramCount}`);
				params.push(endOfDay);
			}

			// IMAP status filter
			if (advancedFilters.imapStatus && advancedFilters.imapStatus !== 'all') {
				paramCount++;
				conditions.push(`imap_status = $${paramCount}`);
				params.push(advancedFilters.imapStatus);
			}
		}
		
		// Add search clauses to conditions
		if (searchClauses.length > 0) {
			conditions.push(`(${searchClauses.join(' OR ')})`);
		}
		
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(' AND ')}`;
		}
		
		query += ` ORDER BY created_at DESC`;
		
		if (limit > 0) {
			paramCount++;
			query += ` LIMIT $${paramCount}`;
			params.push(limit);
		}
		
		if (offset > 0) {
			paramCount++;
			query += ` OFFSET $${paramCount}`;
			params.push(offset);
		}
		
		const result = await client.query(query, params);
		
		// Map snake_case field names to camelCase for consistency with Prisma
		return result.rows.map((row: any) => ({
			id: row.id,
			recordId: row.record_id,
			instagramUsername: row.instagram_username,
			instagramPassword: row.instagram_password,
			emailAddress: row.email_address,
			emailPassword: row.email_password,
			status: row.status,
			imapStatus: row.imap_status,
			assignedDeviceId: row.assigned_device_id,
			assignedCloneNumber: row.assigned_clone_number,
			assignedPackageName: row.assigned_package_name,
			assignmentTimestamp: row.assignment_timestamp,
			loginTimestamp: row.login_timestamp,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		}));
	} finally {
		client.release();
	}
}

// Get account by ID
export async function getAccountById(id: number) {
	const client = await pool.connect();
	try {
		const result = await client.query('SELECT * FROM ig_accounts WHERE id = $1', [id]);
		if (!result.rows[0]) return null;
		
		const row = result.rows[0];
		return {
			id: row.id,
			recordId: row.record_id,
			instagramUsername: row.instagram_username,
			instagramPassword: row.instagram_password,
			emailAddress: row.email_address,
			emailPassword: row.email_password,
			status: row.status,
			imapStatus: row.imap_status,
			assignedDeviceId: row.assigned_device_id,
			assignedCloneNumber: row.assigned_clone_number,
			assignedPackageName: row.assigned_package_name,
			assignmentTimestamp: row.assignment_timestamp,
			loginTimestamp: row.login_timestamp,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
	} finally {
		client.release();
	}
}

// Create account
export async function createAccount(data: CreateAccountData) {
	const client = await pool.connect();
	try {
		const query = `
			INSERT INTO ig_accounts (
				record_id, instagram_username, instagram_password, 
				email_address, email_password, status, imap_status,
				assigned_device_id, assigned_clone_number, assigned_package_name,
				assignment_timestamp, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
			RETURNING *
		`;
		
		const values = [
			data.recordId || null,
			data.instagramUsername,
			data.instagramPassword,
			data.emailAddress,
			data.emailPassword,
			data.status || 'Unused',
			data.imapStatus || 'On',
			data.assignedDeviceId || null,
			data.assignedCloneNumber || null,
			data.assignedPackageName || null,
			data.assignedDeviceId ? new Date() : null
		];
		
		const result = await client.query(query, values);
		const row = result.rows[0];
		return {
			id: row.id,
			recordId: row.record_id,
			instagramUsername: row.instagram_username,
			instagramPassword: row.instagram_password,
			emailAddress: row.email_address,
			emailPassword: row.email_password,
			status: row.status,
			imapStatus: row.imap_status,
			assignedDeviceId: row.assigned_device_id,
			assignedCloneNumber: row.assigned_clone_number,
			assignedPackageName: row.assigned_package_name,
			assignmentTimestamp: row.assignment_timestamp,
			loginTimestamp: row.login_timestamp,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
	} finally {
		client.release();
	}
}

// Update account
export async function updateAccount(id: number, data: UpdateAccountData) {
	const client = await pool.connect();
	try {
		const updates: string[] = [];
		const values: any[] = [];
		let paramCount = 0;
		
		Object.entries(data).forEach(([key, value]) => {
			if (value !== undefined) {
				paramCount++;
				const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
				updates.push(`${dbKey} = $${paramCount}`);
				values.push(value);
			}
		});
		
		if (updates.length === 0) return null;
		
		paramCount++;
		updates.push(`updated_at = NOW()`);
		values.push(id);
		
		const query = `
			UPDATE ig_accounts 
			SET ${updates.join(', ')} 
			WHERE id = $${paramCount}
			RETURNING *
		`;
		
		const result = await client.query(query, values);
		if (!result.rows[0]) return null;
		
		const row = result.rows[0];
		return {
			id: row.id,
			recordId: row.record_id,
			instagramUsername: row.instagram_username,
			instagramPassword: row.instagram_password,
			emailAddress: row.email_address,
			emailPassword: row.email_password,
			status: row.status,
			imapStatus: row.imap_status,
			assignedDeviceId: row.assigned_device_id,
			assignedCloneNumber: row.assigned_clone_number,
			assignedPackageName: row.assigned_package_name,
			assignmentTimestamp: row.assignment_timestamp,
			loginTimestamp: row.login_timestamp,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
	} finally {
		client.release();
	}
}

// Delete account
export async function deleteAccount(id: number) {
	const client = await pool.connect();
	try {
		const result = await client.query('DELETE FROM ig_accounts WHERE id = $1 RETURNING *', [id]);
		if (!result.rows[0]) return null;
		
		const row = result.rows[0];
		return {
			id: row.id,
			recordId: row.record_id,
			instagramUsername: row.instagram_username,
			instagramPassword: row.instagram_password,
			emailAddress: row.email_address,
			emailPassword: row.email_password,
			status: row.status,
			imapStatus: row.imap_status,
			assignedDeviceId: row.assigned_device_id,
			assignedCloneNumber: row.assigned_clone_number,
			assignedPackageName: row.assigned_package_name,
			assignmentTimestamp: row.assignment_timestamp,
			loginTimestamp: row.login_timestamp,
			createdAt: row.created_at,
			updatedAt: row.updated_at
		};
	} finally {
		client.release();
	}
}

// Check if username exists
export async function checkUsernameExists(username: string, excludeId?: number) {
	const client = await pool.connect();
	try {
		let query = 'SELECT id FROM ig_accounts WHERE instagram_username = $1';
		const params = [username];
		
		if (excludeId) {
			query += ' AND id != $2';
			params.push(excludeId.toString());
		}
		
		const result = await client.query(query, params);
		return result.rows.length > 0;
	} finally {
		client.release();
	}
}

// Get total count of accounts matching filters (for pagination)
export async function getAccountsCount(statusFilter?: string, searchQuery?: string, advancedFilters?: any): Promise<number> {
	const client = await pool.connect();
	try {
		let query = 'SELECT COUNT(*) as count FROM ig_accounts';
		const params: any[] = [];
		const conditions: string[] = [];
		const searchClauses: string[] = [];
		let paramCount = 0;
		
		
		// Handle legacy parameters for backward compatibility
		if (statusFilter && !advancedFilters?.statuses) {
			paramCount++;
			conditions.push(`status = $${paramCount}`);
			params.push(statusFilter);
		}
		
		if (searchQuery && !advancedFilters?.search) {
			paramCount++;
			searchClauses.push(`instagram_username ILIKE $${paramCount}`);
			params.push(`%${searchQuery}%`);
			
			paramCount++;
			searchClauses.push(`email_address ILIKE $${paramCount}`);
			params.push(`%${searchQuery}%`);
		}
		
		// Apply advanced filters if provided (same logic as getAccounts)
		if (advancedFilters) {
			// Search filter
			if (advancedFilters.search) {
				paramCount++;
				searchClauses.push(`instagram_username ILIKE $${paramCount}`);
				params.push(`%${advancedFilters.search}%`);
				
				paramCount++;
				searchClauses.push(`email_address ILIKE $${paramCount}`);
				params.push(`%${advancedFilters.search}%`);
				
				paramCount++;
				searchClauses.push(`assigned_device_id ILIKE $${paramCount}`);
				params.push(`%${advancedFilters.search}%`);
			}

			// Status filter (multiple statuses)
			if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
				const statusPlaceholders = [];
				for (const status of advancedFilters.statuses) {
					paramCount++;
					statusPlaceholders.push(`$${paramCount}`);
					params.push(status);
				}
				conditions.push(`status IN (${statusPlaceholders.join(', ')})`);
			}

			// Device assignment filter
			if (advancedFilters.deviceAssignment) {
				switch (advancedFilters.deviceAssignment) {
					case 'assigned':
						conditions.push('assigned_device_id IS NOT NULL');
						break;
					case 'unassigned':
						conditions.push('assigned_device_id IS NULL');
						break;
					case 'specific':
						if (advancedFilters.specificDevice) {
							paramCount++;
							conditions.push(`assigned_device_id = $${paramCount}`);
							params.push(advancedFilters.specificDevice);
						}
						break;
					// 'all' case doesn't add any filter
				}
			}

			// Created date range filter
			if (advancedFilters.createdDateFrom) {
				paramCount++;
				conditions.push(`created_at >= $${paramCount}`);
				params.push(advancedFilters.createdDateFrom);
			}
			if (advancedFilters.createdDateTo) {
				// Set to end of day for inclusive filtering
				const endOfDay = new Date(advancedFilters.createdDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				paramCount++;
				conditions.push(`created_at <= $${paramCount}`);
				params.push(endOfDay);
			}

			// Login date range filter
			if (advancedFilters.loginDateFrom) {
				paramCount++;
				conditions.push(`login_timestamp >= $${paramCount}`);
				params.push(advancedFilters.loginDateFrom);
			}
			if (advancedFilters.loginDateTo) {
				// Set to end of day for inclusive filtering
				const endOfDay = new Date(advancedFilters.loginDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				paramCount++;
				conditions.push(`login_timestamp <= $${paramCount}`);
				params.push(endOfDay);
			}

			// IMAP status filter
			if (advancedFilters.imapStatus && advancedFilters.imapStatus !== 'all') {
				paramCount++;
				conditions.push(`imap_status = $${paramCount}`);
				params.push(advancedFilters.imapStatus);
			}
		}
		
		// Add search clauses to conditions
		if (searchClauses.length > 0) {
			conditions.push(`(${searchClauses.join(' OR ')})`);
		}
		
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(' AND ')}`;
		}
		
		const result = await client.query(query, params);
		return parseInt(result.rows[0].count);
	} finally {
		client.release();
	}
}

// Get available accounts
export async function getAvailableAccounts(limit = 20) {
	const client = await pool.connect();
	try {
		const result = await client.query(`
			SELECT id, instagram_username, status 
			FROM ig_accounts 
			WHERE status = 'Unused' 
			ORDER BY instagram_username 
			LIMIT $1
		`, [limit]);
		return result.rows.map((row: any) => ({
			id: row.id,
			instagramUsername: row.instagram_username,
			status: row.status
		}));
	} finally {
		client.release();
	}
}

// Device related functions (basic implementations)
export async function getDeviceSummaries(): Promise<DeviceSummary[]> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			const result = await client.query('SELECT * FROM clone_inventory ORDER BY device_id, clone_number');
			// Group by device and create summaries
			const deviceMap = new Map<string, any[]>();
			result.rows.forEach((clone: any) => {
				if (!deviceMap.has(clone.device_id)) {
					deviceMap.set(clone.device_id, []);
				}
				deviceMap.get(clone.device_id)!.push(clone);
			});
			
			const summaries: DeviceSummary[] = [];
			deviceMap.forEach((clones, deviceId) => {
				const totalClones = clones.length;
				const availableClones = clones.filter((c: any) => c.clone_status === 'Available').length;
				const assignedClones = clones.filter((c: any) => c.clone_status === 'Assigned').length;
				const loggedInClones = clones.filter((c: any) => c.clone_status === 'Logged In').length;
				const brokenClones = clones.filter((c: any) => c.clone_status === 'Broken').length;
				
				const deviceStatus = determineDeviceStatus(clones);
				const deviceName = clones[0].device_name || null;
				const deviceHealth = clones[0].clone_health || null;
				const lastScanned = clones.reduce((latest: Date, clone: any) => 
					clone.last_scanned > latest ? clone.last_scanned : latest, 
					clones[0].last_scanned
				);
				
				summaries.push({
					deviceId,
					deviceName,
					totalClones,
					availableClones,
					assignedClones,
					loggedInClones,
					brokenClones,
					deviceStatus,
					deviceHealth,
					lastScanned
				});
			});
			
			return summaries.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
		} finally {
			client.release();
		}
	});
}

export async function getDeviceStats(): Promise<DeviceStats> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			const result = await client.query('SELECT * FROM clone_inventory');
			const allClones = result.rows;
			
			// Group clones by device
			const deviceMap = new Map<string, any[]>();
			allClones.forEach((clone: any) => {
				if (!deviceMap.has(clone.device_id)) {
					deviceMap.set(clone.device_id, []);
				}
				deviceMap.get(clone.device_id)!.push(clone);
			});
			
			const totalDevices = deviceMap.size;
			const totalClones = allClones.length;
			const availableClones = allClones.filter((c: any) => c.clone_status === 'Available').length;
			const assignedClones = allClones.filter((c: any) => c.clone_status === 'Assigned').length;
			const loggedInClones = allClones.filter((c: any) => c.clone_status === 'Logged In').length;
			const brokenClones = allClones.filter((c: any) => c.clone_status === 'Broken').length;
			
			// Count clones by status (matching all possible statuses)
			const clonesByStatus: Record<CloneStatus, number> = {
				'Available': availableClones,
				'Assigned': assignedClones,
				'Logged In': loggedInClones,
				'Login Error': allClones.filter((c: any) => c.clone_status === 'Login Error').length,
				'Maintenance': allClones.filter((c: any) => c.clone_status === 'Maintenance').length,
				'Broken': brokenClones
			};
			
			// Determine device status for each device and count by status
			const devicesByStatus: Record<DeviceStatus, number> = {
				'Available': 0,
				'Logged In': 0,
				'Maintenance': 0,
				'Broken': 0
			};
			
			deviceMap.forEach(clones => {
				const deviceStatus = determineDeviceStatus(clones);
				devicesByStatus[deviceStatus]++;
			});
			
			return {
				totalDevices,
				totalClones,
				availableClones,
				assignedClones,
				loggedInClones,
				brokenClones,
				devicesByStatus,
				clonesByStatus
			};
		} finally {
			client.release();
		}
	});
}

export async function getDeviceDetails(deviceId: string): Promise<{
	device: DeviceSummary | null;
	clones: CloneInventory[];
}> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			const result = await client.query('SELECT * FROM clone_inventory WHERE device_id = $1 ORDER BY clone_number', [deviceId]);
			const rawClones = result.rows;
			
			if (rawClones.length === 0) {
				return { device: null, clones: [] };
			}
			
			// Map database rows to CloneInventory objects
			const clones: CloneInventory[] = rawClones.map((row: any) => ({
				id: row.id,
				deviceId: row.device_id,
				cloneNumber: row.clone_number,
				packageName: row.package_name,
				cloneStatus: row.clone_status,
				currentAccount: row.current_account,
				deviceName: row.device_name,
				cloneHealth: row.clone_health,
				lastScanned: row.last_scanned,
				createdAt: row.created_at,
				updatedAt: row.updated_at
			}));
			
			const totalClones = clones.length;
			const availableClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Available').length;
			const assignedClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Assigned').length;
			const loggedInClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Logged In').length;
			const brokenClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Broken').length;
			
			const deviceStatus = determineDeviceStatus(rawClones);
			const deviceName = clones[0].deviceName || null;
			const deviceHealth = clones[0].cloneHealth || null;
			const lastScanned = clones.reduce((latest: Date, clone: CloneInventory) => 
				clone.lastScanned > latest ? clone.lastScanned : latest,
				clones[0].lastScanned
			);
			
			const device: DeviceSummary = {
				deviceId,
				deviceName,
				totalClones,
				availableClones,
				assignedClones,
				loggedInClones,
				brokenClones,
				deviceStatus,
				deviceHealth,
				lastScanned
			};
			
			return { device, clones };
		} finally {
			client.release();
		}
	});
}

// Get list of all devices for filtering
export async function getDeviceList() {
	const client = await pool.connect();
	try {
		const result = await client.query(`
			SELECT DISTINCT device_id, device_name 
			FROM clone_inventory 
			ORDER BY device_id
		`);
		return result.rows.map((row: any) => ({
			deviceId: row.device_id,
			deviceName: row.device_name
		}));
	} finally {
		client.release();
	}
}

// ========== MISSING DEVICE ASSIGNMENT FUNCTIONS ==========

// Helper function to determine device overall status from its clones
function determineDeviceStatus(clones: any[]): DeviceStatus {
	if (clones.some(c => c.clone_status === 'Broken' || c.clone_health === 'Broken')) {
		return 'Broken';
	}
	if (clones.some(c => c.clone_status === 'Maintenance')) {
		return 'Maintenance';
	}
	if (clones.some(c => c.clone_status === 'Logged In')) {
		return 'Logged In';
	}
	return 'Available';
}

// Assign account to clone with transaction support
export async function assignAccountToClone(
	deviceId: string,
	cloneNumber: number,
	instagramUsername: string
): Promise<boolean> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			// Update clone status
			const cloneResult = await client.query(`
				UPDATE clone_inventory 
				SET clone_status = 'Assigned',
				    current_account = $1,
				    updated_at = NOW()
				WHERE device_id = $2 AND clone_number = $3
				RETURNING *
			`, [instagramUsername, deviceId, cloneNumber]);

			if (cloneResult.rows.length === 0) {
				await client.query('ROLLBACK');
				return false;
			}

			// Update account assignment
			const accountResult = await client.query(`
				UPDATE ig_accounts 
				SET status = 'Assigned',
				    assigned_device_id = $1,
				    assigned_clone_number = $2,
				    assignment_timestamp = NOW(),
				    updated_at = NOW()
				WHERE instagram_username = $3
			`, [deviceId, cloneNumber, instagramUsername]);

			if (accountResult.rowCount === null || accountResult.rowCount === 0) {
				await client.query('ROLLBACK');
				return false;
			}

			await client.query('COMMIT');
			return true;
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('Failed to assign account to clone:', error);
			return false;
		} finally {
			client.release();
		}
	});
}

// Unassign account from clone with transaction support
export async function unassignAccountFromClone(
	deviceId: string,
	cloneNumber: number
): Promise<boolean> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			// Get current clone info
			const cloneResult = await client.query(`
				SELECT current_account 
				FROM clone_inventory 
				WHERE device_id = $1 AND clone_number = $2
			`, [deviceId, cloneNumber]);

			if (cloneResult.rows.length === 0 || !cloneResult.rows[0].current_account) {
				await client.query('ROLLBACK');
				return false;
			}

			const currentAccount = cloneResult.rows[0].current_account;

			// Update clone status
			await client.query(`
				UPDATE clone_inventory 
				SET clone_status = 'Available',
				    current_account = NULL,
				    updated_at = NOW()
				WHERE device_id = $1 AND clone_number = $2
			`, [deviceId, cloneNumber]);

			// Update account assignment
			await client.query(`
				UPDATE ig_accounts 
				SET status = 'Unused',
				    assigned_device_id = NULL,
				    assigned_clone_number = NULL,
				    assignment_timestamp = NULL,
				    updated_at = NOW()
				WHERE instagram_username = $1
			`, [currentAccount]);

			await client.query('COMMIT');
			return true;
		} catch (error) {
			await client.query('ROLLBACK');
			console.error('Failed to unassign account from clone:', error);
			return false;
		} finally {
			client.release();
		}
	});
}

// Update clone status
export async function updateCloneStatus(
	deviceId: string,
	cloneNumber: number,
	status: CloneStatus
): Promise<boolean> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			const result = await client.query(`
				UPDATE clone_inventory 
				SET clone_status = $1,
				    updated_at = NOW()
				WHERE device_id = $2 AND clone_number = $3
				RETURNING id
			`, [status, deviceId, cloneNumber]);

			return result.rowCount !== null && result.rowCount > 0;
		} catch (error) {
			console.error('Failed to update clone status:', error);
			return false;
		} finally {
			client.release();
		}
	});
}

// ========== ADVANCED DEVICE CAPACITY ANALYSIS ==========

// Get detailed device capacity analysis for assignment planning
export async function getDeviceCapacityAnalysis(): Promise<DeviceCapacity[]> {
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			const result = await client.query('SELECT * FROM clone_inventory ORDER BY device_id, clone_number');
			const allClones = result.rows;
			
			// Group clones by device
			const deviceMap = new Map<string, any[]>();
			allClones.forEach((clone: any) => {
				if (!deviceMap.has(clone.device_id)) {
					deviceMap.set(clone.device_id, []);
				}
				deviceMap.get(clone.device_id)!.push(clone);
			});
			
			// Calculate capacity analysis for each device
			const capacityAnalysis: DeviceCapacity[] = [];
			deviceMap.forEach((clones, deviceId) => {
				const totalClones = clones.length;
				const availableClones = clones.filter((c: any) => c.clone_status === 'Available').length;
				const assignedClones = clones.filter((c: any) => c.clone_status === 'Assigned').length;
				const loggedInClones = clones.filter((c: any) => c.clone_status === 'Logged In').length;
				const brokenClones = clones.filter((c: any) => c.clone_status === 'Broken').length;
				
				const deviceStatus = determineDeviceStatus(clones);
				const deviceName = clones[0].device_name || null;
				
				// Calculate utilization rate (percentage of clones in active use)
				const activeClones = assignedClones + loggedInClones;
				const utilizationRate = totalClones > 0 ? (activeClones / totalClones) * 100 : 0;
				
				// Calculate efficiency score (prioritizes healthy devices with available capacity)
				let efficiency = 100;
				
				// Penalize broken or maintenance devices
				if (deviceStatus === 'Broken') efficiency -= 50;
				if (deviceStatus === 'Maintenance') efficiency -= 30;
				
				// Reward devices with available capacity
				if (availableClones > 0) efficiency += 10;
				
				// Slight preference for balanced utilization (not completely empty, not completely full)
				if (utilizationRate > 10 && utilizationRate < 90) efficiency += 5;
				
				// Penalize devices with many broken clones
				const brokenRate = totalClones > 0 ? (brokenClones / totalClones) * 100 : 0;
				efficiency -= brokenRate * 0.5;
				
				// Ensure efficiency is within bounds
				efficiency = Math.max(0, Math.min(100, efficiency));
				
				capacityAnalysis.push({
					deviceId,
					deviceName,
					totalClones,
					availableClones,
					assignedClones,
					loggedInClones,
					brokenClones,
					deviceStatus,
					utilizationRate: Math.round(utilizationRate * 100) / 100,
					efficiency: Math.round(efficiency * 100) / 100
				});
			});
			
			return capacityAnalysis.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
		} finally {
			client.release();
		}
	});
}

// Calculate optimal device assignments using specified strategy
export async function getOptimalDeviceAssignments(
	accountIds: number[],
	strategy: AssignmentStrategy = 'capacity-based'
): Promise<OptimalAssignment[]> {
	if (accountIds.length === 0) {
		return [];
	}
	
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			// Get accounts to assign
			const accountsResult = await client.query(`
				SELECT id, instagram_username 
				FROM ig_accounts 
				WHERE id = ANY($1) AND status = 'Unused' AND assigned_device_id IS NULL
				ORDER BY instagram_username
			`, [accountIds]);
			
			if (accountsResult.rows.length === 0) {
				return [];
			}
			
			// Get available clones for assignment
			const clonesResult = await client.query(`
				SELECT device_id, clone_number, package_name, device_name, clone_health 
				FROM clone_inventory 
				WHERE clone_status = 'Available' 
				ORDER BY device_id, clone_number
			`);
			
			if (clonesResult.rows.length === 0) {
				return [];
			}
			
			const accounts = accountsResult.rows;
			const availableClones = clonesResult.rows.map((row: any) => ({
				deviceId: row.device_id,
				cloneNumber: row.clone_number,
				packageName: row.package_name,
				deviceName: row.device_name,
				cloneHealth: row.clone_health
			}));
			
			const assignments: OptimalAssignment[] = [];
			
			// Apply assignment strategy
			switch (strategy) {
				case 'round-robin': {
					// Distribute evenly across devices
					const deviceIds = [...new Set(availableClones.map(c => c.deviceId))].sort();
					let currentDeviceIndex = 0;
					
					for (const account of accounts) {
						if (assignments.length >= availableClones.length) break;
						
						// Find next available clone for current device in rotation
						let attempts = 0;
						while (attempts < deviceIds.length) {
							const targetDeviceId = deviceIds[currentDeviceIndex];
							const availableClone = availableClones.find(c => 
								c.deviceId === targetDeviceId && 
								!assignments.some(a => a.deviceId === c.deviceId && a.cloneNumber === c.cloneNumber)
							);
							
							if (availableClone) {
								assignments.push({
									accountId: account.id,
									instagramUsername: account.instagram_username,
									deviceId: availableClone.deviceId,
									cloneNumber: availableClone.cloneNumber,
									packageName: availableClone.packageName
								});
								break;
							}
							
							currentDeviceIndex = (currentDeviceIndex + 1) % deviceIds.length;
							attempts++;
						}
						
						currentDeviceIndex = (currentDeviceIndex + 1) % deviceIds.length;
					}
					break;
				}
				
				case 'fill-first': {
					// Fill devices sequentially by device ID
					const sortedClones = [...availableClones].sort((a, b) => 
						a.deviceId.localeCompare(b.deviceId) || a.cloneNumber - b.cloneNumber
					);
					
					for (let i = 0; i < accounts.length && i < sortedClones.length; i++) {
						const account = accounts[i];
						const clone = sortedClones[i];
						
						assignments.push({
							accountId: account.id,
							instagramUsername: account.instagram_username,
							deviceId: clone.deviceId,
							cloneNumber: clone.cloneNumber,
							packageName: clone.packageName
						});
					}
					break;
				}
				
				case 'capacity-based': {
					// Get device capacity analysis for optimization
					const deviceCapacity = await getDeviceCapacityAnalysis();
					
					// Prioritize devices by efficiency score and available capacity
					const deviceEfficiencyOrder = deviceCapacity
						.filter(d => d.availableClones > 0 && d.deviceStatus !== 'Broken')
						.sort((a, b) => {
							// Primary sort: efficiency (higher is better)
							if (b.efficiency !== a.efficiency) {
								return b.efficiency - a.efficiency;
							}
							// Secondary sort: available clones (more is better)
							if (b.availableClones !== a.availableClones) {
								return b.availableClones - a.availableClones;
							}
							// Tertiary sort: device ID for consistency
							return a.deviceId.localeCompare(b.deviceId);
						});
					
					const clonesByDevice = new Map<string, any[]>();
					availableClones.forEach((clone: any) => {
						if (!clonesByDevice.has(clone.deviceId)) {
							clonesByDevice.set(clone.deviceId, []);
						}
						clonesByDevice.get(clone.deviceId)!.push(clone);
					});
					
					// Sort clones within each device
					clonesByDevice.forEach(clones => {
						clones.sort((a, b) => a.cloneNumber - b.cloneNumber);
					});
					
					let accountIndex = 0;
					for (const deviceInfo of deviceEfficiencyOrder) {
						const deviceClones = clonesByDevice.get(deviceInfo.deviceId) || [];
						
						for (const clone of deviceClones) {
							if (accountIndex >= accounts.length) break;
							
							const account = accounts[accountIndex];
							assignments.push({
								accountId: account.id,
								instagramUsername: account.instagram_username,
								deviceId: clone.deviceId,
								cloneNumber: clone.cloneNumber,
								packageName: clone.packageName
							});
							
							accountIndex++;
						}
						
						if (accountIndex >= accounts.length) break;
					}
					break;
				}
			}
			
			return assignments;
		} finally {
			client.release();
		}
	});
}

// Validate assignment feasibility before execution
export async function validateAssignmentFeasibility(
	accountIds: number[]
): Promise<AssignmentValidation> {
	const result: AssignmentValidation = {
		isValid: true,
		canAssign: 0,
		totalRequested: accountIds.length,
		errors: [],
		warnings: []
	};
	
	if (accountIds.length === 0) {
		result.errors.push('No accounts specified for assignment');
		result.isValid = false;
		return result;
	}
	
	return withRetry(async () => {
		const client = await pool.connect();
		try {
			// Check if accounts exist and are available for assignment
			const accountsResult = await client.query(`
				SELECT id, instagram_username, status, assigned_device_id 
				FROM ig_accounts 
				WHERE id = ANY($1)
			`, [accountIds]);
			
			if (accountsResult.rows.length !== accountIds.length) {
				const foundIds = accountsResult.rows.map((a: any) => a.id);
				const missingIds = accountIds.filter(id => !foundIds.includes(id));
				result.errors.push(`Accounts not found: ${missingIds.join(', ')}`);
			}
			
			// Check account availability
			const unavailableAccounts = accountsResult.rows.filter((a: any) => 
				a.status !== 'Unused' || a.assigned_device_id !== null
			);
			
			if (unavailableAccounts.length > 0) {
				result.errors.push(
					`Accounts not available for assignment: ${unavailableAccounts.map((a: any) => a.instagram_username).join(', ')}`
				);
			}
			
			const availableAccountCount = accountsResult.rows.length - unavailableAccounts.length;
			
			// Check clone availability
			const cloneCountResult = await client.query(`
				SELECT COUNT(*) as count 
				FROM clone_inventory 
				WHERE clone_status = 'Available'
			`);
			const availableClones = parseInt(cloneCountResult.rows[0].count);
			
			if (availableClones === 0) {
				result.errors.push('No available clones for assignment');
			}
			
			// Calculate how many can be assigned
			result.canAssign = Math.min(availableAccountCount, availableClones);
			
			// Add warnings
			if (result.canAssign < result.totalRequested) {
				const shortage = result.totalRequested - result.canAssign;
				result.warnings.push(`Can only assign ${result.canAssign} of ${result.totalRequested} accounts (shortage: ${shortage})`);
			}
			
			if (availableClones < result.totalRequested) {
				result.warnings.push(`Only ${availableClones} clones available for ${result.totalRequested} accounts`);
			}
			
			// Get device health warnings
			const deviceHealthResult = await client.query(`
				SELECT 
					COUNT(DISTINCT CASE WHEN clone_status = 'Broken' THEN device_id END) as broken_devices,
					COUNT(DISTINCT CASE WHEN clone_status = 'Maintenance' THEN device_id END) as maintenance_devices
				FROM clone_inventory
			`);
			
			const brokenDevices = parseInt(deviceHealthResult.rows[0].broken_devices);
			const maintenanceDevices = parseInt(deviceHealthResult.rows[0].maintenance_devices);
			
			if (brokenDevices > 0) {
				result.warnings.push(`${brokenDevices} devices are in broken status and unavailable`);
			}
			
			if (maintenanceDevices > 0) {
				result.warnings.push(`${maintenanceDevices} devices are in maintenance and may have limited availability`);
			}
			
			// Final validation
			if (result.errors.length > 0) {
				result.isValid = false;
			}
			
			return result;
			
		} catch (error) {
			console.error('Error validating assignment feasibility:', error);
			result.isValid = false;
			result.errors.push('Failed to validate assignment feasibility due to database error');
			return result;
		} finally {
			client.release();
		}
	});
}

// Execute automatic assignment of accounts to devices with full transaction support
export async function assignAccountsToDevicesAutomatically(
	accountIds: number[],
	strategy: AssignmentStrategy = 'capacity-based'
): Promise<BatchAssignmentResult> {
	const result: BatchAssignmentResult = {
		success: false,
		assignedCount: 0,
		totalRequested: accountIds.length,
		assignments: [],
		errors: [],
		failedAccounts: []
	};
	
	return withRetry(async () => {
		try {
			// Validate feasibility first
			const validation = await validateAssignmentFeasibility(accountIds);
			if (!validation.isValid) {
				result.errors = validation.errors;
				return result;
			}
			
			// Get optimal assignments
			const optimalAssignments = await getOptimalDeviceAssignments(accountIds, strategy);
			
			if (optimalAssignments.length === 0) {
				result.errors.push('No optimal assignments found');
				return result;
			}
			
			// Execute assignments in transaction
			const client = await pool.connect();
			try {
				await client.query('BEGIN');
				
				for (const assignment of optimalAssignments) {
					try {
						// Update clone status first
						const cloneUpdateResult = await client.query(`
							UPDATE clone_inventory 
							SET clone_status = 'Assigned',
							    current_account = $1,
							    updated_at = NOW()
							WHERE device_id = $2 AND clone_number = $3 AND clone_status = 'Available'
							RETURNING id
						`, [assignment.instagramUsername, assignment.deviceId, assignment.cloneNumber]);
						
						if (cloneUpdateResult.rowCount === null || cloneUpdateResult.rowCount === 0) {
							throw new Error('Clone no longer available for assignment');
						}
						
						// Update account assignment
						const accountUpdateResult = await client.query(`
							UPDATE ig_accounts 
							SET status = 'Assigned',
							    assigned_device_id = $1,
							    assigned_clone_number = $2,
							    assigned_package_name = $3,
							    assignment_timestamp = NOW(),
							    updated_at = NOW()
							WHERE id = $4 AND status = 'Unused' AND assigned_device_id IS NULL
							RETURNING id
						`, [assignment.deviceId, assignment.cloneNumber, assignment.packageName, assignment.accountId]);
						
						if (accountUpdateResult.rowCount === null || accountUpdateResult.rowCount === 0) {
							throw new Error('Account no longer available for assignment');
						}
						
						result.assignments.push(assignment);
						result.assignedCount++;
						
					} catch (assignmentError) {
						console.error(`Failed to assign account ${assignment.instagramUsername}:`, assignmentError);
						result.failedAccounts.push({
							accountId: assignment.accountId,
							instagramUsername: assignment.instagramUsername,
							error: assignmentError instanceof Error ? assignmentError.message : 'Unknown assignment error'
						});
						
						// Continue with other assignments - don't fail entire transaction for individual assignment errors
					}
				}
				
				await client.query('COMMIT');
				
				// Determine overall success
				result.success = result.assignedCount > 0;
				
				if (result.failedAccounts.length > 0) {
					result.errors.push(`Failed to assign ${result.failedAccounts.length} accounts`);
				}
				
				return result;
				
			} catch (transactionError) {
				await client.query('ROLLBACK');
				throw transactionError;
			} finally {
				client.release();
			}
			
		} catch (error) {
			console.error('Error in automatic assignment:', error);
			result.errors.push('Transaction failed during automatic assignment');
			
			// Add any accounts that weren't processed to failed list
			const processedAccountIds = result.assignments.map(a => a.accountId);
			const unprocessedIds = accountIds.filter(id => !processedAccountIds.includes(id));
			
			for (const accountId of unprocessedIds) {
				result.failedAccounts.push({
					accountId,
					instagramUsername: `Account-${accountId}`,
					error: 'Assignment transaction was rolled back'
				});
			}
			
			return result;
		}
	});
}

// Complete type definitions for API compatibility
export interface CreateAccountData {
	recordId?: string;
	instagramUsername: string;
	instagramPassword: string;
	emailAddress: string;
	emailPassword: string;
	status?: AccountStatus;
	imapStatus?: 'On' | 'Off';
	assignedDeviceId?: string;
	assignedCloneNumber?: number;
	assignedPackageName?: string;
}

export interface UpdateAccountData {
	recordId?: string;
	instagramUsername?: string;
	instagramPassword?: string;
	emailAddress?: string;
	emailPassword?: string;
	status?: AccountStatus;
	imapStatus?: 'On' | 'Off';
	assignedDeviceId?: string;
	assignedCloneNumber?: number;
	assignedPackageName?: string;
}

export interface AccountFilterOptions {
	search?: string;
	statuses?: string[];
	deviceAssignment?: 'all' | 'assigned' | 'unassigned' | 'specific';
	specificDevice?: string;
	createdDateFrom?: Date;
	createdDateTo?: Date;
	loginDateFrom?: Date;
	loginDateTo?: Date;
	imapStatus?: 'all' | 'On' | 'Off';
}

export interface IgAccount {
	id: number;
	recordId: string | null;
	instagramUsername: string;
	instagramPassword: string;
	emailAddress: string;
	emailPassword: string;
	status: string;
	imapStatus: string;
	assignedDeviceId: string | null;
	assignedCloneNumber: number | null;
	assignedPackageName: string | null;
	assignmentTimestamp: Date | null;
	loginTimestamp: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface CloneInventory {
	id: number;
	deviceId: string;
	cloneNumber: number;
	packageName: string;
	cloneStatus: CloneStatus;
	currentAccount: string | null;
	deviceName: string | null;
	cloneHealth: CloneHealth | null;
	lastScanned: Date;
	createdAt: Date;
	updatedAt: Date;
}

export interface DeviceSummary {
	deviceId: string;
	deviceName: string | null;
	totalClones: number;
	availableClones: number;
	assignedClones: number;
	loggedInClones: number;
	brokenClones: number;
	deviceStatus: DeviceStatus;
	deviceHealth: CloneHealth | null;
	lastScanned: Date;
}

export interface DeviceStats {
	totalDevices: number;
	totalClones: number;
	availableClones: number;
	assignedClones: number;
	loggedInClones: number;
	brokenClones: number;
	devicesByStatus: Record<DeviceStatus, number>;
	clonesByStatus: Record<CloneStatus, number>;
}

export interface DeviceCapacity {
	deviceId: string;
	deviceName: string | null;
	totalClones: number;
	availableClones: number;
	assignedClones: number;
	loggedInClones: number;
	brokenClones: number;
	deviceStatus: DeviceStatus;
	utilizationRate: number;
	efficiency: number;
}

export interface OptimalAssignment {
	accountId: number;
	instagramUsername: string;
	deviceId: string;
	cloneNumber: number;
	packageName: string;
}

export interface AssignmentValidation {
	isValid: boolean;
	canAssign: number;
	totalRequested: number;
	errors: string[];
	warnings: string[];
}

export interface BatchAssignmentResult {
	success: boolean;
	assignedCount: number;
	totalRequested: number;
	assignments: OptimalAssignment[];
	errors: string[];
	failedAccounts: Array<{
		accountId: number;
		instagramUsername: string;
		error: string;
	}>;
}

export type AssignmentStrategy = 'round-robin' | 'fill-first' | 'capacity-based';

// Enhanced error handling for bulk operations
export class BulkOperationError extends Error {
	constructor(message: string, public code: string, public details?: any) {
		super(message);
		this.name = 'BulkOperationError';
	}
}

// Function to validate bulk operation parameters
export function validateBulkOperationParams(accountIds: any[], operation: string): { valid: boolean, errors: string[] } {
	const errors: string[] = [];
	
	if (!Array.isArray(accountIds)) {
		errors.push('accountIds must be an array');
		return { valid: false, errors };
	}
	
	if (accountIds.length === 0) {
		errors.push('accountIds array cannot be empty');
	}
	
	if (accountIds.length > 1000) {
		errors.push('Cannot process more than 1000 accounts at once');
	}
	
	// Validate all IDs are positive integers
	for (let i = 0; i < accountIds.length; i++) {
		const id = accountIds[i];
		if (!Number.isInteger(id) || id <= 0) {
			errors.push(`Invalid account ID at index ${i}: ${id}`);
		}
	}
	
	const validOperations = ['updateStatus', 'assignDevices', 'export', 'delete'];
	if (!validOperations.includes(operation)) {
		errors.push(`Invalid operation: ${operation}`);
	}
	
	return { valid: errors.length === 0, errors };
}

// Validate SQL injection prevention
export function sanitizeInput(input: any): any {
	if (typeof input === 'string') {
		// Basic sanitization - remove potential SQL injection patterns
		return input.replace(/[;\\-\\-\\/\\*\\*\\/\\x00\\x1a]/g, '');
	}
	return input;
}

// Bulk operation helper functions
export async function bulkUpdateAccountStatus(accountIds: number[], newStatus: string, additionalData?: any) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		
		// Build the parameter placeholders for the IN clause
		const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(', ');
		const params: any[] = [...accountIds];
		let paramCount = accountIds.length;
		
		// Build SET clause
		let setClause = 'status = $' + (++paramCount);
		params.push(newStatus);
		
		if (additionalData) {
			for (const [key, value] of Object.entries(additionalData)) {
				if (value !== undefined) {
					const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
					setClause += `, ${dbKey} = $${++paramCount}`;
					// Properly type the parameter value for PostgreSQL
					params.push(value);
				}
			}
		}
		
		setClause += ', updated_at = NOW()';
		
		const query = `UPDATE ig_accounts SET ${setClause} WHERE id IN (${placeholders})`;
		
		const result = await client.query(query, params);
		
		await client.query('COMMIT');
		return { count: result.rowCount || 0 };
		
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export async function bulkDeleteAccounts(accountIds: number[]) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		
		// First get accounts that have device assignments
		const placeholders = accountIds.map((_, index) => `$${index + 1}`).join(', ');
		const assignedAccountsResult = await client.query(`
			SELECT id, assigned_device_id, assigned_clone_number 
			FROM ig_accounts 
			WHERE id IN (${placeholders}) 
			  AND assigned_device_id IS NOT NULL 
			  AND assigned_clone_number IS NOT NULL
		`, accountIds);
		
		// Free up clone assignments
		for (const account of assignedAccountsResult.rows) {
			await client.query(`
				UPDATE clone_inventory 
				SET clone_status = 'Available', current_account = NULL, updated_at = NOW() 
				WHERE device_id = $1 AND clone_number = $2
			`, [account.assigned_device_id, account.assigned_clone_number]);
		}
		
		// Delete accounts
		const deleteResult = await client.query(`
			DELETE FROM ig_accounts WHERE id IN (${placeholders})
		`, accountIds);
		
		await client.query('COMMIT');
		return { count: deleteResult.rowCount || 0 };
		
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

// Export data helper function
export async function getAccountsForExport(filters: any = {}, fields: string[] = []) {
	const client = await pool.connect();
	try {
		let selectClause = '*';
		if (fields.length > 0) {
			// Map camelCase fields to snake_case
			const dbFields = fields.map(field => {
				switch (field) {
					case 'instagramUsername': return 'instagram_username';
					case 'instagramPassword': return 'instagram_password';
					case 'emailAddress': return 'email_address';
					case 'emailPassword': return 'email_password';
					case 'imapStatus': return 'imap_status';
					case 'assignedDeviceId': return 'assigned_device_id';
					case 'assignedCloneNumber': return 'assigned_clone_number';
					case 'assignedPackageName': return 'assigned_package_name';
					case 'assignmentTimestamp': return 'assignment_timestamp';
					case 'loginTimestamp': return 'login_timestamp';
					case 'createdAt': return 'created_at';
					case 'updatedAt': return 'updated_at';
					default: return field;
				}
			});
			selectClause = dbFields.join(', ');
		}
		
		let query = `SELECT ${selectClause} FROM ig_accounts`;
		const params: any[] = [];
		let paramCount = 0;
		
		// Apply filters
		const conditions: string[] = [];
		
		if (filters.status) {
			paramCount++;
			conditions.push(`status = $${paramCount}`);
			params.push(filters.status);
		}
		
		if (filters.search) {
			paramCount++;
			const searchParam = `%${filters.search}%`;
			conditions.push(`(instagram_username ILIKE $${paramCount} OR email_address ILIKE $${paramCount})`);
			params.push(searchParam);
		}
		
		if (filters.dateFrom) {
			paramCount++;
			conditions.push(`created_at >= $${paramCount}`);
			params.push(filters.dateFrom);
		}
		
		if (filters.dateTo) {
			paramCount++;
			conditions.push(`created_at <= $${paramCount}`);
			params.push(filters.dateTo);
		}
		
		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(' AND ')}`;
		}
		
		query += ' ORDER BY created_at DESC';
		
		const result = await client.query(query, params);
		return result.rows.map(mapDbRowToAccount);
		
	} finally {
		client.release();
	}
}

// Add a $queryRaw equivalent for compatibility
export async function $queryRaw(query: TemplateStringsArray | string, ...values: any[]) {
	const client = await pool.connect();
	try {
		if (typeof query === 'string') {
			return await client.query(query, values);
		} else {
			// Handle template literal
			const queryStr = query.join('?');
			return await client.query(queryStr, values);
		}
	} finally {
		client.release();
	}
}

// Add direct query method for API endpoint compatibility
export async function query(sql: string, params: any[] = [], context?: { userId?: string; ip?: string; userAgent?: string }) {
	return await monitoredQuery(
		async () => {
			return await withRetry(async () => {
				const client = await pool.connect();
				try {
					const result = await client.query(sql, params);
					return result;
				} finally {
					client.release();
				}
			});
		},
		sql,
		params,
		context
	);
}