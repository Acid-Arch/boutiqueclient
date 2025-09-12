import { dev } from '$app/environment';
import type { 
	AccountStatus, 
	CloneStatus, 
	DeviceStatus, 
	CloneHealth 
} from '$lib/utils/status.js';

// Type definitions based on Prisma schema
export type IgAccount = {
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
	// Account ownership and classification fields
	ownerId: number | null;
	accountType: 'CLIENT' | 'ML_TREND_FINDER' | 'SYSTEM';
	visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
	isShared: boolean;
};

export type CloneInventory = {
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
};

// Database connection state with pooling configuration
let _prismaClient: any = null;
let _prismaAvailable: boolean | null = null;
let _initPromise: Promise<any> | null = null;

// Connection pool configuration
const DB_CONFIG = {
	maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
	connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '30000'),
	queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'),
	statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
	idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000'),
	poolTimeout: parseInt(process.env.DB_POOL_TIMEOUT_MS || '0'),
};

/**
 * Build optimized database connection URL with pooling parameters
 */
function buildOptimizedConnectionUrl(): string {
	const baseUrl = process.env.DATABASE_URL;
	if (!baseUrl) {
		throw new Error('DATABASE_URL environment variable is required');
	}

	// Parse existing URL and enhance with connection pool parameters
	const url = new URL(baseUrl);
	
	// Connection pool configuration
	const poolParams = new URLSearchParams(url.search);
	
	// Connection limits
	if (!poolParams.has('connection_limit')) {
		poolParams.set('connection_limit', DB_CONFIG.maxConnections.toString());
	}
	
	// Pool timeout settings
	if (!poolParams.has('pool_timeout')) {
		poolParams.set('pool_timeout', DB_CONFIG.poolTimeout.toString());
	}
	
	if (!poolParams.has('connect_timeout')) {
		poolParams.set('connect_timeout', (DB_CONFIG.connectionTimeout / 1000).toString());
	}

	// Query timeout settings
	if (!poolParams.has('statement_timeout')) {
		poolParams.set('statement_timeout', `${DB_CONFIG.statementTimeout}ms`);
	}

	// Connection recycling for production
	if (!poolParams.has('pgbouncer') && process.env.NODE_ENV === 'production') {
		poolParams.set('pgbouncer', 'true');
	}

	// SSL configuration
	if (!poolParams.has('sslmode')) {
		poolParams.set('sslmode', process.env.DB_SSL_MODE || 'prefer');
	}

	// Application identification
	if (!poolParams.has('application_name')) {
		poolParams.set('application_name', process.env.PUBLIC_APP_NAME || 'boutique-client-portal');
	}

	url.search = poolParams.toString();
	return url.toString();
}

/**
 * Initialize and test Prisma client with connection pooling
 */
async function initializePrisma(): Promise<{ client: any | null, available: boolean }> {
	if (_initPromise) {
		return _initPromise;
	}

	_initPromise = (async () => {
		try {
			console.log('🔄 Initializing Prisma client with connection pooling...');
			
			// Try to import and initialize Prisma
			const { PrismaClient } = await import('@prisma/client');
			
			// Create client with optimized connection URL
			const connectionUrl = buildOptimizedConnectionUrl();
			const client = new PrismaClient({
				datasources: {
					db: {
						url: connectionUrl,
					},
				},
				log: dev ? ['query', 'info', 'warn', 'error'] : ['error', 'warn'],
				errorFormat: 'pretty',
			});

			// Add connection pool middleware for monitoring
			client.$use(async (params: any, next: any) => {
				const start = Date.now();
				
				try {
					const result = await next(params);
					const duration = Date.now() - start;
					
					if (dev && duration > 1000) {
						console.warn(`⚠️ Slow query: ${params.model}.${params.action} took ${duration}ms`);
					}
					
					return result;
				} catch (error) {
					console.error(`❌ DB query failed: ${params.model}.${params.action}`, error);
					throw error;
				}
			});

			// Test connection with timeout
			const testPromise = client.$connect().then(() => client.igAccount.count());
			const timeoutPromise = new Promise((_, reject) => 
				setTimeout(() => reject(new Error('Connection timeout')), DB_CONFIG.connectionTimeout)
			);
			
			await Promise.race([testPromise, timeoutPromise]);
			
			console.log('✅ Prisma client with connection pooling initialized successfully');
			console.log(`📊 Pool config: Max ${DB_CONFIG.maxConnections} connections, ${DB_CONFIG.connectionTimeout}ms timeout`);
			
			// Setup graceful shutdown
			const gracefulShutdown = async () => {
				if (_prismaClient) {
					console.log('🔄 Closing database connections...');
					await _prismaClient.$disconnect();
					_prismaClient = null;
					console.log('✅ Database connections closed');
				}
			};

			// Handle various shutdown signals
			process.on('SIGINT', gracefulShutdown);
			process.on('SIGTERM', gracefulShutdown);
			process.on('SIGQUIT', gracefulShutdown);
			process.on('beforeExit', gracefulShutdown);
			
			_prismaClient = client;
			_prismaAvailable = true;
			
			return { client, available: true };
			
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.warn('⚠️  Prisma client initialization failed:', errorMessage);
			console.log('📋 This is expected on NixOS. Application will use direct SQL fallback.');
			
			_prismaClient = null;
			_prismaAvailable = false;
			
			return { client: null, available: false };
		}
	})();

	return _initPromise;
}

// Prisma client proxy that gracefully handles unavailability
export const prisma = new Proxy({} as any, {
	get: function(target, prop) {
		// Don't intercept Promise methods like 'then', 'catch', 'finally' or Symbol properties
		if (prop === 'then' || prop === 'catch' || prop === 'finally' || typeof prop === 'symbol') {
			return undefined;
		}
		// Handle special Prisma methods
		if (prop === '$connect' || prop === '$disconnect' || prop === '$queryRaw' || prop === '$executeRaw') {
			return async (...args: any[]) => {
				const { client, available } = await initializePrisma();
				if (available && client) {
					return client[prop](...args);
				}
				// Graceful fallback for connection methods
				if (prop === '$connect' || prop === '$disconnect') {
					return Promise.resolve();
				}
				throw new Error(`Prisma not available: Cannot execute ${String(prop)}`);
			};
		}
		
		// Handle model properties (like igAccount, cloneInventory)
		if (prop === 'igAccount' || prop === 'cloneInventory' || prop === 'warmupAccount' || prop === 'automationSession' || prop === 'automationLog') {
			return new Proxy({}, {
				get: function(modelTarget, method) {
					// Don't intercept Promise methods like 'then', 'catch', 'finally'
					if (method === 'then' || method === 'catch' || method === 'finally' || typeof method === 'symbol') {
						return undefined;
					}
					
					return async (...args: any[]) => {
						const { client, available } = await initializePrisma();
						if (available && client && client[prop]) {
							const modelClient = client[prop];
							if (typeof modelClient[method] === 'function') {
								return modelClient[method](...args);
							}
						}
						throw new Error(`Prisma not available: Cannot execute ${String(prop)}.${String(method)}`);
					};
				}
			});
		}
		
		// Handle transactions and other methods
		if (prop === '$transaction') {
			return async (...args: any[]) => {
				const { client, available } = await initializePrisma();
				if (available && client) {
					return client.$transaction(...args);
				}
				throw new Error('Prisma not available: Cannot execute transaction');
			};
		}
		
		// Default case
		return async (...args: any[]) => {
			const { client, available } = await initializePrisma();
			if (available && client && typeof client[prop] === 'function') {
				return client[prop](...args);
			}
			throw new Error(`Prisma not available: Cannot execute ${String(prop)}`);
		};
	}
});

/**
 * Check if Prisma is available (cached result)
 */
export async function isPrismaAvailable(): Promise<boolean> {
	if (_prismaAvailable !== null) {
		return _prismaAvailable;
	}
	
	const { available } = await initializePrisma();
	return available;
}

/**
 * Get Prisma client directly (throws if not available)
 */
export async function getPrismaClient() {
	const { client, available } = await initializePrisma();
	if (!available || !client) {
		throw new Error('Prisma client is not available');
	}
	return client;
}

// Initialize on module load but don't wait for it
initializePrisma().catch(() => {
	// Ignore errors during initial load
});

// Re-export status utilities for backward compatibility
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


// Helper function to get account statistics
export async function getAccountStats() {
	const [total, statusCounts] = await Promise.all([
		prisma.igAccount.count(),
		prisma.igAccount.groupBy({
			by: ['status'],
			_count: {
				status: true
			}
		})
	]);

	return {
		total,
		byStatus: statusCounts.reduce((acc: Record<string, number>, item: { status: string; _count: { status: number } }) => {
			acc[item.status] = item._count.status;
			return acc;
		}, {} as Record<string, number>)
	};
}

// CRUD Operations for Instagram Accounts

// Create account interface for type safety
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
	// Account ownership and classification fields
	ownerId?: number;
	accountType?: 'CLIENT' | 'ML_TREND_FINDER' | 'SYSTEM';
	visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
	isShared?: boolean;
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
	// Account ownership and classification fields
	ownerId?: number | null;
	accountType?: 'CLIENT' | 'ML_TREND_FINDER' | 'SYSTEM';
	visibility?: 'PRIVATE' | 'SHARED' | 'PUBLIC';
	isShared?: boolean;
}

// Create a new account
export async function createAccount(data: CreateAccountData) {
	return await prisma.igAccount.create({
		data: {
			recordId: data.recordId,
			instagramUsername: data.instagramUsername,
			instagramPassword: data.instagramPassword,
			emailAddress: data.emailAddress,
			emailPassword: data.emailPassword,
			status: data.status || 'Unused',
			imapStatus: data.imapStatus || 'On',
			assignedDeviceId: data.assignedDeviceId,
			assignedCloneNumber: data.assignedCloneNumber,
			assignedPackageName: data.assignedPackageName,
			assignmentTimestamp: data.assignedDeviceId ? new Date() : null,
			// Account ownership and classification fields
			ownerId: data.ownerId || null,
			accountType: data.accountType || 'CLIENT',
			visibility: data.visibility || 'PRIVATE',
			isShared: data.isShared || false,
		}
	});
}

// Get account by ID
export async function getAccountById(id: number) {
	return await prisma.igAccount.findUnique({
		where: { id }
	});
}

// Advanced filtering interface for accounts
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
	// Ownership and account type filters
	ownerId?: number | null; // Filter by specific owner, null for unassigned
	accountTypes?: string[]; // Filter by account types (CLIENT, ML_TREND_FINDER, SYSTEM)
	includeMLAccounts?: boolean; // Whether to include ML accounts (admin only)
	includeShared?: boolean; // Whether to include shared accounts
	visibilityFilter?: string[]; // Filter by visibility (PRIVATE, SHARED, PUBLIC)
}

// Get accounts with advanced filtering and pagination
export async function getAccounts(
	limit = 20, 
	offset = 0, 
	statusFilter?: string, 
	searchQuery?: string,
	advancedFilters?: AccountFilterOptions
) {
	const where: any = {};
	const searchClauses: any[] = [];
	
	// Handle legacy parameters for backward compatibility
	if (statusFilter && !advancedFilters?.statuses) {
		where.status = statusFilter;
	}
	
	if (searchQuery && !advancedFilters?.search) {
		searchClauses.push(
			{ instagramUsername: { contains: searchQuery, mode: 'insensitive' } },
			{ emailAddress: { contains: searchQuery, mode: 'insensitive' } }
		);
	}

	// Apply advanced filters if provided
	if (advancedFilters) {
		// Search filter
		if (advancedFilters.search) {
			searchClauses.push(
				{ instagramUsername: { contains: advancedFilters.search, mode: 'insensitive' } },
				{ emailAddress: { contains: advancedFilters.search, mode: 'insensitive' } },
				{ assignedDeviceId: { contains: advancedFilters.search, mode: 'insensitive' } }
			);
		}

		// Status filter (multiple statuses)
		if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
			where.status = { in: advancedFilters.statuses };
		}

		// Device assignment filter
		if (advancedFilters.deviceAssignment) {
			switch (advancedFilters.deviceAssignment) {
				case 'assigned':
					where.assignedDeviceId = { not: null };
					break;
				case 'unassigned':
					where.assignedDeviceId = null;
					break;
				case 'specific':
					if (advancedFilters.specificDevice) {
						where.assignedDeviceId = advancedFilters.specificDevice;
					}
					break;
				// 'all' case doesn't add any filter
			}
		}

		// Created date range filter
		if (advancedFilters.createdDateFrom || advancedFilters.createdDateTo) {
			where.createdAt = {};
			if (advancedFilters.createdDateFrom) {
				where.createdAt.gte = advancedFilters.createdDateFrom;
			}
			if (advancedFilters.createdDateTo) {
				// Set to end of day for inclusive filtering
				const endOfDay = new Date(advancedFilters.createdDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				where.createdAt.lte = endOfDay;
			}
		}

		// Login date range filter
		if (advancedFilters.loginDateFrom || advancedFilters.loginDateTo) {
			where.loginTimestamp = {};
			if (advancedFilters.loginDateFrom) {
				where.loginTimestamp.gte = advancedFilters.loginDateFrom;
			}
			if (advancedFilters.loginDateTo) {
				// Set to end of day for inclusive filtering
				const endOfDay = new Date(advancedFilters.loginDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				where.loginTimestamp.lte = endOfDay;
			}
		}

		// IMAP status filter
		if (advancedFilters.imapStatus && advancedFilters.imapStatus !== 'all') {
			where.imapStatus = advancedFilters.imapStatus;
		}

		// Account ownership filters
		if (advancedFilters.ownerId !== undefined) {
			where.ownerId = advancedFilters.ownerId;
		}

		// Account type filters
		if (advancedFilters.accountTypes && advancedFilters.accountTypes.length > 0) {
			where.accountType = { in: advancedFilters.accountTypes };
		}

		// Exclude ML accounts unless explicitly included (admin only)
		if (!advancedFilters.includeMLAccounts) {
			// If accountType filter is already set, add ML exclusion to it
			if (where.accountType && where.accountType.in) {
				where.accountType.in = where.accountType.in.filter((type: string) => type !== 'ML_TREND_FINDER');
			} else if (!where.accountType) {
				// Only exclude ML if no specific account types are requested
				where.accountType = { not: 'ML_TREND_FINDER' };
			}
		}

		// Visibility filters
		if (advancedFilters.visibilityFilter && advancedFilters.visibilityFilter.length > 0) {
			where.visibility = { in: advancedFilters.visibilityFilter };
		}

		// Include shared accounts logic
		if (advancedFilters.includeShared === false) {
			where.isShared = false;
		} else if (advancedFilters.includeShared === true) {
			// Don't add any filter - include both shared and non-shared
		}
	}

	// Add search clauses to where condition
	if (searchClauses.length > 0) {
		where.OR = searchClauses;
	}

	return await prisma.igAccount.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		take: limit,
		skip: offset
	});
}

// Get total count of accounts matching filters (for pagination)
export async function getAccountsCount(
	statusFilter?: string, 
	searchQuery?: string,
	advancedFilters?: AccountFilterOptions
): Promise<number> {
	const where: any = {};
	const searchClauses: any[] = [];
	
	// Handle legacy parameters for backward compatibility
	if (statusFilter && !advancedFilters?.statuses) {
		where.status = statusFilter;
	}
	
	if (searchQuery && !advancedFilters?.search) {
		searchClauses.push(
			{ instagramUsername: { contains: searchQuery, mode: 'insensitive' } },
			{ emailAddress: { contains: searchQuery, mode: 'insensitive' } }
		);
	}

	// Apply advanced filters if provided
	if (advancedFilters) {
		// Search filter
		if (advancedFilters.search) {
			searchClauses.push(
				{ instagramUsername: { contains: advancedFilters.search, mode: 'insensitive' } },
				{ emailAddress: { contains: advancedFilters.search, mode: 'insensitive' } },
				{ assignedDeviceId: { contains: advancedFilters.search, mode: 'insensitive' } }
			);
		}

		// Status filter (multiple statuses)
		if (advancedFilters.statuses && advancedFilters.statuses.length > 0) {
			where.status = { in: advancedFilters.statuses };
		}

		// Device assignment filter
		if (advancedFilters.deviceAssignment) {
			switch (advancedFilters.deviceAssignment) {
				case 'assigned':
					where.assignedDeviceId = { not: null };
					break;
				case 'unassigned':
					where.assignedDeviceId = null;
					break;
				case 'specific':
					if (advancedFilters.specificDevice) {
						where.assignedDeviceId = advancedFilters.specificDevice;
					}
					break;
			}
		}

		// Created date range filter
		if (advancedFilters.createdDateFrom || advancedFilters.createdDateTo) {
			where.createdAt = {};
			if (advancedFilters.createdDateFrom) {
				where.createdAt.gte = advancedFilters.createdDateFrom;
			}
			if (advancedFilters.createdDateTo) {
				const endOfDay = new Date(advancedFilters.createdDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				where.createdAt.lte = endOfDay;
			}
		}

		// Login date range filter
		if (advancedFilters.loginDateFrom || advancedFilters.loginDateTo) {
			where.loginTimestamp = {};
			if (advancedFilters.loginDateFrom) {
				where.loginTimestamp.gte = advancedFilters.loginDateFrom;
			}
			if (advancedFilters.loginDateTo) {
				const endOfDay = new Date(advancedFilters.loginDateTo);
				endOfDay.setHours(23, 59, 59, 999);
				where.loginTimestamp.lte = endOfDay;
			}
		}

		// IMAP status filter
		if (advancedFilters.imapStatus && advancedFilters.imapStatus !== 'all') {
			where.imapStatus = advancedFilters.imapStatus;
		}

		// Account ownership filters
		if (advancedFilters.ownerId !== undefined) {
			where.ownerId = advancedFilters.ownerId;
		}

		// Account type filters
		if (advancedFilters.accountTypes && advancedFilters.accountTypes.length > 0) {
			where.accountType = { in: advancedFilters.accountTypes };
		}

		// Exclude ML accounts unless explicitly included (admin only)
		if (!advancedFilters.includeMLAccounts) {
			// If accountType filter is already set, add ML exclusion to it
			if (where.accountType && where.accountType.in) {
				where.accountType.in = where.accountType.in.filter((type: string) => type !== 'ML_TREND_FINDER');
			} else if (!where.accountType) {
				// Only exclude ML if no specific account types are requested
				where.accountType = { not: 'ML_TREND_FINDER' };
			}
		}

		// Visibility filters
		if (advancedFilters.visibilityFilter && advancedFilters.visibilityFilter.length > 0) {
			where.visibility = { in: advancedFilters.visibilityFilter };
		}

		// Include shared accounts logic
		if (advancedFilters.includeShared === false) {
			where.isShared = false;
		} else if (advancedFilters.includeShared === true) {
			// Don't add any filter - include both shared and non-shared
		}
	}

	// Add search clauses to where condition
	if (searchClauses.length > 0) {
		where.OR = searchClauses;
	}

	return await prisma.igAccount.count({ where });
}

// Update account
export async function updateAccount(id: number, data: UpdateAccountData) {
	const updateData: any = { ...data };
	
	// Set assignment timestamp if device is being assigned
	if (data.assignedDeviceId && data.assignedDeviceId !== '') {
		updateData.assignmentTimestamp = new Date();
	} else if (data.assignedDeviceId === '') {
		updateData.assignedDeviceId = null;
		updateData.assignedCloneNumber = null;
		updateData.assignedPackageName = null;
		updateData.assignmentTimestamp = null;
	}

	// Set login timestamp if status is being changed to 'Logged In'
	if (data.status === 'Logged In') {
		updateData.loginTimestamp = new Date();
	}

	return await prisma.igAccount.update({
		where: { id },
		data: updateData
	});
}

// Delete account
export async function deleteAccount(id: number) {
	return await prisma.igAccount.delete({
		where: { id }
	});
}

// Check if username already exists
export async function checkUsernameExists(username: string, excludeId?: number) {
	const where: any = { instagramUsername: username };
	if (excludeId) {
		where.id = { not: excludeId };
	}
	
	const account = await prisma.igAccount.findFirst({ where });
	return !!account;
}

// Account ownership helper functions

// Get accounts for a specific user (with role-based filtering)
export async function getAccountsForUser(userId: number | string, userRole: 'ADMIN' | 'CLIENT' | 'VIEWER' | 'UNAUTHORIZED', limit = 20, offset = 0) {
	if (userRole === 'UNAUTHORIZED') {
		return { accounts: [], totalCount: 0 };
	}

	// Try Prisma first, fall back to direct SQL if Prisma is not available
	try {
		if (userRole === 'ADMIN') {
			// Admins can see all accounts (including ML accounts)
			const advancedFilters: AccountFilterOptions = {
				includeMLAccounts: true
			};
			
			const [accounts, totalCount] = await Promise.all([
				getAccounts(limit, offset, undefined, undefined, advancedFilters),
				getAccountsCount(undefined, undefined, advancedFilters)
			]);
			
			return { accounts, totalCount };
		}

		// For CLIENT/VIEWER users, we need custom Prisma queries with OR conditions
		const where: any = {
			OR: [
				// User's own accounts
				{ 
					ownerId: userId.toString(), // Convert to string for user ID comparison
					accountType: { not: 'ML_TREND_FINDER' } // Exclude ML accounts
				},
				// Shared accounts that are not ML accounts
				{
					isShared: true,
					visibility: { in: ['SHARED', 'PUBLIC'] },
					accountType: { not: 'ML_TREND_FINDER' }
				}
			]
		};

		const [accounts, totalCount] = await Promise.all([
			prisma.igAccount.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				take: limit,
				skip: offset
			}),
			prisma.igAccount.count({ where })
		]);

		return { accounts, totalCount };

	} catch (error) {
		console.log('Prisma not available, falling back to direct SQL queries');
		
		// For the direct SQL fallback, we need the user's email to check for model access
		// Since we don't have the user object here, we'll pass it via a modified function
		return await getAccountsForUserDirectSQL(userId, userRole, limit, offset);
	}
}

// Direct SQL fallback when Prisma is not available
async function getAccountsForUserDirectSQL(userId: number | string, userRole: 'ADMIN' | 'CLIENT' | 'VIEWER' | 'UNAUTHORIZED', limit = 20, offset = 0, userEmail?: string) {
	// Import pg here to avoid issues if not available
	const pg = await import('pg');
	const { Client } = pg.default;
	
	const client = new Client({
		connectionString: process.env.DATABASE_URL
	});

	try {
		await client.connect();

		if (userRole === 'ADMIN') {
			// Admin can see all accounts
			const accountsQuery = `
				SELECT 
					id, instagram_username, instagram_password, email_address, email_password,
					status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
					assignment_timestamp, login_timestamp, created_at, updated_at,
					owner_id, account_type, visibility, is_shared, model
				FROM ig_accounts 
				ORDER BY created_at DESC 
				LIMIT $1 OFFSET $2
			`;
			
			const countQuery = `SELECT COUNT(*) as total FROM ig_accounts`;
			
			const [accountsResult, countResult] = await Promise.all([
				client.query(accountsQuery, [limit, offset]),
				client.query(countQuery)
			]);

			return {
				accounts: accountsResult.rows.map(row => mapDatabaseRowToAccount(row)),
				totalCount: parseInt(countResult.rows[0].total)
			};
		} else {
			// CLIENT/VIEWER users - use model-based access for Gmail users
			let modelFilter = '';
			let queryParams = [userId.toString(), limit, offset];
			
			// Add model-based access for Gmail users
			if (userEmail && userEmail.includes('@gmail.com')) {
				modelFilter = `OR (model = 'Dillion' AND account_type != 'ML_TREND_FINDER')`;
				console.log(`🔑 Adding Dillion model access for Gmail user: ${userEmail}`);
			}
			
			const accountsQuery = `
				SELECT 
					id, instagram_username, instagram_password, email_address, email_password,
					status, imap_status, assigned_device_id, assigned_clone_number, assigned_package_name,
					assignment_timestamp, login_timestamp, created_at, updated_at,
					owner_id, account_type, visibility, is_shared, model
				FROM ig_accounts 
				WHERE (
					(owner_id = $1 AND account_type != 'ML_TREND_FINDER')
					OR 
					(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND account_type != 'ML_TREND_FINDER')
					${modelFilter}
				)
				ORDER BY created_at DESC 
				LIMIT $2 OFFSET $3
			`;
			
			const countQuery = `
				SELECT COUNT(*) as total 
				FROM ig_accounts 
				WHERE (
					(owner_id = $1 AND account_type != 'ML_TREND_FINDER')
					OR 
					(is_shared = true AND visibility IN ('SHARED', 'PUBLIC') AND account_type != 'ML_TREND_FINDER')
					${modelFilter}
				)
			`;
			
			const [accountsResult, countResult] = await Promise.all([
				client.query(accountsQuery, queryParams),
				client.query(countQuery, [userId.toString()])
			]);

			return {
				accounts: accountsResult.rows.map(row => mapDatabaseRowToAccount(row)),
				totalCount: parseInt(countResult.rows[0].total)
			};
		}

	} finally {
		await client.end();
	}
}

// Helper function to map database row to account object
function mapDatabaseRowToAccount(row: any): any {
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
		updatedAt: row.updated_at,
		ownerId: row.owner_id,
		accountType: row.account_type,
		visibility: row.visibility,
		isShared: row.is_shared,
		model: row.model
	};
}

// Assign account to user
export async function assignAccountToUser(accountId: number, userId: number, visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC' = 'PRIVATE') {
	return await updateAccount(accountId, {
		ownerId: userId,
		accountType: 'CLIENT',
		visibility: visibility,
		isShared: visibility === 'SHARED'
	});
}

// Unassign account from user (make it unassigned)
export async function unassignAccountFromUser(accountId: number) {
	return await updateAccount(accountId, {
		ownerId: null,
		visibility: 'PRIVATE',
		isShared: false
	});
}

// Convert account to ML trend finder account
export async function convertAccountToML(accountId: number) {
	return await updateAccount(accountId, {
		ownerId: null,
		accountType: 'ML_TREND_FINDER',
		visibility: 'PRIVATE',
		isShared: false
	});
}

// Get account ownership summary for admin dashboard
export async function getAccountOwnershipSummary() {
	const [
		totalAccounts,
		clientAccounts, 
		mlAccounts,
		systemAccounts,
		unassignedAccounts,
		sharedAccounts
	] = await Promise.all([
		prisma.igAccount.count(),
		prisma.igAccount.count({ where: { accountType: 'CLIENT' } }),
		prisma.igAccount.count({ where: { accountType: 'ML_TREND_FINDER' } }),
		prisma.igAccount.count({ where: { accountType: 'SYSTEM' } }),
		prisma.igAccount.count({ where: { ownerId: null, accountType: 'CLIENT' } }),
		prisma.igAccount.count({ where: { isShared: true } })
	]);
	
	return {
		total: totalAccounts,
		byType: {
			CLIENT: clientAccounts,
			ML_TREND_FINDER: mlAccounts,
			SYSTEM: systemAccounts
		},
		unassigned: unassignedAccounts,
		shared: sharedAccounts
	};
}


// Device and Clone interfaces

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


// Get device statistics
export async function getDeviceStats(): Promise<DeviceStats> {
	// Get all clone data and calculate stats
	const allClones = await prisma.cloneInventory.findMany();
	
	// Group clones by device
	const deviceMap = new Map<string, CloneInventory[]>();
	allClones.forEach((clone: CloneInventory) => {
		if (!deviceMap.has(clone.deviceId)) {
			deviceMap.set(clone.deviceId, []);
		}
		deviceMap.get(clone.deviceId)!.push(clone);
	});
	
	// Calculate device stats
	const totalDevices = deviceMap.size;
	const totalClones = allClones.length;
	const availableClones = allClones.filter((c: CloneInventory) => c.cloneStatus === 'Available').length;
	const assignedClones = allClones.filter((c: CloneInventory) => c.cloneStatus === 'Assigned').length;
	const loggedInClones = allClones.filter((c: CloneInventory) => c.cloneStatus === 'Logged In').length;
	const brokenClones = allClones.filter((c: CloneInventory) => c.cloneStatus === 'Broken').length;
	
	// Count clones by status
	const clonesByStatus = allClones.reduce((acc: Record<CloneStatus, number>, clone: CloneInventory) => {
		acc[clone.cloneStatus as CloneStatus] = (acc[clone.cloneStatus as CloneStatus] || 0) + 1;
		return acc;
	}, {} as Record<CloneStatus, number>);
	
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
}

// Helper function to determine device overall status from its clones
function determineDeviceStatus(clones: CloneInventory[]): DeviceStatus {
	if (clones.some(c => c.cloneStatus === 'Broken' || c.cloneHealth === 'Broken')) {
		return 'Broken';
	}
	if (clones.some(c => c.cloneStatus === 'Maintenance')) {
		return 'Maintenance';
	}
	if (clones.some(c => c.cloneStatus === 'Logged In')) {
		return 'Logged In';
	}
	return 'Available';
}

// Get all devices with summary information
export async function getDeviceSummaries(): Promise<DeviceSummary[]> {
	const allClones = await prisma.cloneInventory.findMany({
		orderBy: [
			{ deviceId: 'asc' },
			{ cloneNumber: 'asc' }
		]
	});
	
	// Group by device
	const deviceMap = new Map<string, CloneInventory[]>();
	allClones.forEach((clone: CloneInventory) => {
		if (!deviceMap.has(clone.deviceId)) {
			deviceMap.set(clone.deviceId, []);
		}
		deviceMap.get(clone.deviceId)!.push(clone);
	});
	
	// Create summaries
	const summaries: DeviceSummary[] = [];
	deviceMap.forEach((clones, deviceId) => {
		const totalClones = clones.length;
		const availableClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Available').length;
		const assignedClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Assigned').length;
		const loggedInClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Logged In').length;
		const brokenClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Broken').length;
		
		const deviceStatus = determineDeviceStatus(clones);
		const deviceName = clones[0].deviceName || null;
		const deviceHealth = clones[0].cloneHealth || null;
		const lastScanned = clones.reduce((latest: Date, clone: CloneInventory) => 
			clone.lastScanned > latest ? clone.lastScanned : latest, 
			clones[0].lastScanned
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
}

// Get detailed device information with all clones
export async function getDeviceDetails(deviceId: string): Promise<{
	device: DeviceSummary | null;
	clones: CloneInventory[];
}> {
	const clones = await prisma.cloneInventory.findMany({
		where: { deviceId },
		orderBy: { cloneNumber: 'asc' }
	});
	
	if (clones.length === 0) {
		return { device: null, clones: [] };
	}
	
	// Calculate device summary
	const totalClones = clones.length;
	const availableClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Available').length;
	const assignedClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Assigned').length;
	const loggedInClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Logged In').length;
	const brokenClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Broken').length;
	
	const deviceStatus = determineDeviceStatus(clones);
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
}

// Assign account to clone
export async function assignAccountToClone(
	deviceId: string,
	cloneNumber: number,
	instagramUsername: string
): Promise<boolean> {
	try {
		// Start transaction
		const [updateClone, updateAccount] = await prisma.$transaction([
			// Update clone status
			prisma.cloneInventory.update({
				where: {
					deviceId_cloneNumber: {
						deviceId,
						cloneNumber
					}
				},
				data: {
					cloneStatus: 'Assigned',
					currentAccount: instagramUsername,
					updatedAt: new Date()
				}
			}),
			// Update account assignment
			prisma.igAccount.updateMany({
				where: { instagramUsername },
				data: {
					status: 'Assigned',
					assignedDeviceId: deviceId,
					assignedCloneNumber: cloneNumber,
					assignmentTimestamp: new Date(),
					updatedAt: new Date()
				}
			})
		]);
		
		return true;
	} catch (error) {
		console.error('Failed to assign account to clone:', error);
		return false;
	}
}

// Unassign account from clone
export async function unassignAccountFromClone(
	deviceId: string,
	cloneNumber: number
): Promise<boolean> {
	try {
		// Get current clone info
		const clone = await prisma.cloneInventory.findUnique({
			where: {
				deviceId_cloneNumber: {
					deviceId,
					cloneNumber
				}
			}
		});
		
		if (!clone || !clone.currentAccount) {
			return false;
		}
		
		// Start transaction
		await prisma.$transaction([
			// Update clone status
			prisma.cloneInventory.update({
				where: {
					deviceId_cloneNumber: {
						deviceId,
						cloneNumber
					}
				},
				data: {
					cloneStatus: 'Available',
					currentAccount: null,
					updatedAt: new Date()
				}
			}),
			// Update account assignment
			prisma.igAccount.updateMany({
				where: { instagramUsername: clone.currentAccount },
				data: {
					status: 'Unused',
					assignedDeviceId: null,
					assignedCloneNumber: null,
					assignmentTimestamp: null,
					updatedAt: new Date()
				}
			})
		]);
		
		return true;
	} catch (error) {
		console.error('Failed to unassign account from clone:', error);
		return false;
	}
}

// Update clone status
export async function updateCloneStatus(
	deviceId: string,
	cloneNumber: number,
	status: CloneStatus
): Promise<boolean> {
	try {
		await prisma.cloneInventory.update({
			where: {
				deviceId_cloneNumber: {
					deviceId,
					cloneNumber
				}
			},
			data: {
				cloneStatus: status,
				updatedAt: new Date()
			}
		});
		
		return true;
	} catch (error) {
		console.error('Failed to update clone status:', error);
		return false;
	}
}

// Search available accounts for assignment (unused accounts)
export async function getAvailableAccounts(limit = 20): Promise<Array<{
	id: number;
	instagramUsername: string;
	status: string;
}>> {
	const accounts = await prisma.igAccount.findMany({
		where: { status: 'Unused' },
		select: {
			id: true,
			instagramUsername: true,
			status: true
		},
		orderBy: { instagramUsername: 'asc' },
		take: limit
	});
	
	return accounts;
}

// Get list of all devices for filtering
export async function getDeviceList(): Promise<Array<{
	deviceId: string;
	deviceName: string | null;
}>> {
	const devices = await prisma.cloneInventory.groupBy({
		by: ['deviceId', 'deviceName'],
		orderBy: {
			deviceId: 'asc'
		}
	});
	
	return devices.map((device: { deviceId: string; deviceName: string | null }) => ({
		deviceId: device.deviceId,
		deviceName: device.deviceName
	}));
}

// ========== AUTOMATIC ASSIGNMENT SYSTEM ==========

// Assignment strategy types
export type AssignmentStrategy = 'round-robin' | 'fill-first' | 'capacity-based';

// Device capacity analysis interface
export interface DeviceCapacity {
	deviceId: string;
	deviceName: string | null;
	totalClones: number;
	availableClones: number;
	assignedClones: number;
	loggedInClones: number;
	brokenClones: number;
	deviceStatus: DeviceStatus;
	utilizationRate: number; // Percentage of clones in use (assigned + logged in)
	efficiency: number; // Score based on device status and utilization
}

// Optimal assignment result
export interface OptimalAssignment {
	accountId: number;
	instagramUsername: string;
	deviceId: string;
	cloneNumber: number;
	packageName: string;
}

// Assignment validation result
export interface AssignmentValidation {
	isValid: boolean;
	canAssign: number;
	totalRequested: number;
	errors: string[];
	warnings: string[];
}

// Batch assignment result
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

/**
 * Get detailed device capacity analysis for assignment planning
 * Calculates utilization rates and efficiency scores for optimal assignment decisions
 */
export async function getDeviceCapacityAnalysis(): Promise<DeviceCapacity[]> {
	const allClones = await prisma.cloneInventory.findMany({
		orderBy: [
			{ deviceId: 'asc' },
			{ cloneNumber: 'asc' }
		]
	});
	
	// Group clones by device
	const deviceMap = new Map<string, CloneInventory[]>();
	allClones.forEach((clone: CloneInventory) => {
		if (!deviceMap.has(clone.deviceId)) {
			deviceMap.set(clone.deviceId, []);
		}
		deviceMap.get(clone.deviceId)!.push(clone);
	});
	
	// Calculate capacity analysis for each device
	const capacityAnalysis: DeviceCapacity[] = [];
	deviceMap.forEach((clones, deviceId) => {
		const totalClones = clones.length;
		const availableClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Available').length;
		const assignedClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Assigned').length;
		const loggedInClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Logged In').length;
		const brokenClones = clones.filter((c: CloneInventory) => c.cloneStatus === 'Broken').length;
		
		const deviceStatus = determineDeviceStatus(clones);
		const deviceName = clones[0].deviceName || null;
		
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
}

/**
 * Calculate optimal device assignments using specified strategy
 * Returns assignment recommendations without executing them
 */
export async function getOptimalDeviceAssignments(
	accountIds: number[],
	strategy: AssignmentStrategy = 'capacity-based'
): Promise<OptimalAssignment[]> {
	if (accountIds.length === 0) {
		return [];
	}
	
	// Get accounts to assign
	const accounts = await prisma.igAccount.findMany({
		where: {
			id: { in: accountIds },
			status: 'Unused',
			assignedDeviceId: null
		},
		select: {
			id: true,
			instagramUsername: true
		}
	});
	
	if (accounts.length === 0) {
		return [];
	}
	
	// Get available clones for assignment
	const availableClones = await prisma.cloneInventory.findMany({
		where: { cloneStatus: 'Available' },
		orderBy: [
			{ deviceId: 'asc' },
			{ cloneNumber: 'asc' }
		]
	});
	
	if (availableClones.length === 0) {
		return [];
	}
	
	// Get device capacity analysis for strategy calculations
	const deviceCapacity = await getDeviceCapacityAnalysis();
	const capacityMap = new Map(deviceCapacity.map(d => [d.deviceId, d]));
	
	const assignments: OptimalAssignment[] = [];
	let cloneIndex = 0;
	
	// Sort accounts for consistent assignment order
	const sortedAccounts = [...accounts].sort((a, b) => a.instagramUsername.localeCompare(b.instagramUsername));
	
	// Apply assignment strategy
	switch (strategy) {
		case 'round-robin': {
			// Distribute evenly across devices
			const deviceIds = [...new Set(availableClones.map((c: CloneInventory) => c.deviceId))].sort();
			let currentDeviceIndex = 0;
			
			for (const account of sortedAccounts) {
				if (cloneIndex >= availableClones.length) break;
				
				// Find next available clone for current device in rotation
				let attempts = 0;
				while (attempts < deviceIds.length) {
					const targetDeviceId = deviceIds[currentDeviceIndex];
					const availableClone = availableClones.slice(cloneIndex).find((c: CloneInventory) => c.deviceId === targetDeviceId);
					
					if (availableClone) {
						assignments.push({
							accountId: account.id,
							instagramUsername: account.instagramUsername,
							deviceId: availableClone.deviceId,
							cloneNumber: availableClone.cloneNumber,
							packageName: availableClone.packageName
						});
						
						// Remove assigned clone from available list
						const removeIndex = availableClones.findIndex((c: CloneInventory) => 
							c.deviceId === availableClone.deviceId && c.cloneNumber === availableClone.cloneNumber
						);
						if (removeIndex >= 0) {
							availableClones.splice(removeIndex, 1);
						}
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
			
			for (let i = 0; i < sortedAccounts.length && i < sortedClones.length; i++) {
				const account = sortedAccounts[i];
				const clone = sortedClones[i];
				
				assignments.push({
					accountId: account.id,
					instagramUsername: account.instagramUsername,
					deviceId: clone.deviceId,
					cloneNumber: clone.cloneNumber,
					packageName: clone.packageName
				});
			}
			break;
		}
		
		case 'capacity-based': {
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
			
			const clonesByDevice = new Map<string, CloneInventory[]>();
			availableClones.forEach((clone: CloneInventory) => {
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
			for (const deviceCapacity of deviceEfficiencyOrder) {
				const deviceClones = clonesByDevice.get(deviceCapacity.deviceId) || [];
				
				for (const clone of deviceClones) {
					if (accountIndex >= sortedAccounts.length) break;
					
					const account = sortedAccounts[accountIndex];
					assignments.push({
						accountId: account.id,
						instagramUsername: account.instagramUsername,
						deviceId: clone.deviceId,
						cloneNumber: clone.cloneNumber,
						packageName: clone.packageName
					});
					
					accountIndex++;
				}
				
				if (accountIndex >= sortedAccounts.length) break;
			}
			break;
		}
	}
	
	return assignments;
}

/**
 * Validate assignment feasibility before execution
 * Checks capacity and constraints without making changes
 */
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
	
	try {
		// Check if accounts exist and are available for assignment
		const accounts = await prisma.igAccount.findMany({
			where: { id: { in: accountIds } },
			select: {
				id: true,
				instagramUsername: true,
				status: true,
				assignedDeviceId: true
			}
		});
		
		if (accounts.length !== accountIds.length) {
			const foundIds = accounts.map((a: any) => a.id);
			const missingIds = accountIds.filter(id => !foundIds.includes(id));
			result.errors.push(`Accounts not found: ${missingIds.join(', ')}`);
		}
		
		// Check account availability
		const unavailableAccounts = accounts.filter((a: any) => 
			a.status !== 'Unused' || a.assignedDeviceId !== null
		);
		
		if (unavailableAccounts.length > 0) {
			result.errors.push(
				`Accounts not available for assignment: ${unavailableAccounts.map((a: any) => a.instagramUsername).join(', ')}`
			);
		}
		
		const availableAccountCount = accounts.length - unavailableAccounts.length;
		
		// Check clone availability
		const availableClones = await prisma.cloneInventory.count({
			where: { cloneStatus: 'Available' }
		});
		
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
		const deviceCapacity = await getDeviceCapacityAnalysis();
		const brokenDevices = deviceCapacity.filter(d => d.deviceStatus === 'Broken');
		if (brokenDevices.length > 0) {
			result.warnings.push(`${brokenDevices.length} devices are in broken status and unavailable`);
		}
		
		const maintenanceDevices = deviceCapacity.filter(d => d.deviceStatus === 'Maintenance');
		if (maintenanceDevices.length > 0) {
			result.warnings.push(`${maintenanceDevices.length} devices are in maintenance and may have limited availability`);
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
	}
}

/**
 * Execute automatic assignment of accounts to devices
 * Uses transactions for atomic operations with rollback capability
 */
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
		await prisma.$transaction(async (tx: any) => {
			for (const assignment of optimalAssignments) {
				try {
					// Update clone status first
					await tx.cloneInventory.update({
						where: {
							deviceId_cloneNumber: {
								deviceId: assignment.deviceId,
								cloneNumber: assignment.cloneNumber
							}
						},
						data: {
							cloneStatus: 'Assigned',
							currentAccount: assignment.instagramUsername,
							updatedAt: new Date()
						}
					});
					
					// Update account assignment
					await tx.igAccount.update({
						where: { id: assignment.accountId },
						data: {
							status: 'Assigned',
							assignedDeviceId: assignment.deviceId,
							assignedCloneNumber: assignment.cloneNumber,
							assignedPackageName: assignment.packageName,
							assignmentTimestamp: new Date(),
							updatedAt: new Date()
						}
					});
					
					result.assignments.push(assignment);
					result.assignedCount++;
					
				} catch (assignmentError) {
					console.error(`Failed to assign account ${assignment.instagramUsername}:`, assignmentError);
					result.failedAccounts.push({
						accountId: assignment.accountId,
						instagramUsername: assignment.instagramUsername,
						error: assignmentError instanceof Error ? assignmentError.message : 'Unknown assignment error'
					});
				}
			}
		});
		
		// Determine overall success
		result.success = result.assignedCount > 0;
		
		if (result.failedAccounts.length > 0) {
			result.errors.push(`Failed to assign ${result.failedAccounts.length} accounts`);
		}
		
		return result;
		
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
}