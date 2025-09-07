// Database loader utility that handles fallback between Prisma and direct SQL
// This provides a consistent way for all pages to load database functions

let dbModule: any = null;
let fallbackModule: any = null;
let usingFallback = false;

// Force fallback mode for Hetzner connection
if (process.env.DATABASE_URL?.includes('5.78.151.248')) {
	console.log('🔧 Hetzner database detected, forcing fallback mode');
	usingFallback = true;
}

// Load the appropriate database module
async function getDbModule() {
	if (dbModule && !usingFallback) return dbModule;
	if (fallbackModule && usingFallback) return fallbackModule;
	
	try {
		// First try to load the main database module
		dbModule = await import('./database');
		
		// Check if Prisma is available
		const isPrismaWorking = await dbModule.isPrismaAvailable();
		
		
		if (isPrismaWorking) {
			console.log('✅ Using Prisma database module');
			usingFallback = false;
			return dbModule;
		} else {
			throw new Error('Prisma not available, switching to fallback');
		}
		
	} catch (error) {
		console.log('⚠️  Prisma not available, using fallback database connection');
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.log('📋 Fallback reason:', errorMessage);
		
		if (!fallbackModule) {
			fallbackModule = await import('./database-fallback');
		}
		
		usingFallback = true;
		return fallbackModule;
	}
}

// Export function that returns database functions
export async function getDb() {
	return await getDbModule();
}

// Convenience functions for common operations
export async function getAccountStats() {
	const db = await getDbModule();
	return db.getAccountStats();
}

export async function getAccounts(limit?: number, offset?: number, statusFilter?: string, searchQuery?: string, advancedFilters?: any) {
	const db = await getDbModule();
	return db.getAccounts(limit, offset, statusFilter, searchQuery, advancedFilters);
}

export async function getAccountsCount(statusFilter?: string, searchQuery?: string, advancedFilters?: any) {
	const db = await getDbModule();
	return db.getAccountsCount(statusFilter, searchQuery, advancedFilters);
}

export async function getAccountById(id: number) {
	const db = await getDbModule();
	return db.getAccountById(id);
}

export async function createAccount(data: any) {
	const db = await getDbModule();
	return db.createAccount(data);
}

export async function updateAccount(id: number, data: any) {
	const db = await getDbModule();
	return db.updateAccount(id, data);
}

export async function deleteAccount(id: number) {
	const db = await getDbModule();
	return db.deleteAccount(id);
}

export async function checkUsernameExists(username: string, excludeId?: number) {
	const db = await getDbModule();
	return db.checkUsernameExists(username, excludeId);
}

export async function getAvailableAccounts(limit?: number) {
	const db = await getDbModule();
	return db.getAvailableAccounts(limit);
}

export async function getDeviceList() {
	const db = await getDbModule();
	return db.getDeviceList();
}

export async function getDeviceSummaries() {
	const db = await getDbModule();
	return db.getDeviceSummaries();
}

export async function getDeviceStats() {
	const db = await getDbModule();
	return db.getDeviceStats();
}

export async function getDeviceDetails(deviceId: string) {
	const db = await getDbModule();
	return db.getDeviceDetails(deviceId);
}

export async function updateCloneStatus(deviceId: string, cloneNumber: number, status: any) {
	const db = await getDbModule();
	return db.updateCloneStatus(deviceId, cloneNumber, status);
}

export async function assignAccountToClone(accountId: number, deviceId: string, cloneNumber: number) {
	const db = await getDbModule();
	return db.assignAccountToClone(accountId, deviceId, cloneNumber);
}

export async function unassignAccountFromClone(accountId: number) {
	const db = await getDbModule();
	return db.unassignAccountFromClone(accountId);
}

// Re-export constants
export async function getConstants() {
	const db = await getDbModule();
	return {
		ACCOUNT_STATUSES: db.ACCOUNT_STATUSES,
		CLONE_STATUSES: db.CLONE_STATUSES,
		DEVICE_STATUSES: db.DEVICE_STATUSES,
		CLONE_HEALTH: db.CLONE_HEALTH
	};
}

// Export prisma instance
export async function getPrisma() {
	const db = await getDbModule();
	
	// If we're using fallback, return the fallback prisma
	if (usingFallback && fallbackModule) {
		return fallbackModule.prisma;
	}
	
	// If using main module, check if Prisma is actually available
	if (dbModule && !usingFallback) {
		try {
			// Test if Prisma is working by checking availability
			const isPrismaWorking = await dbModule.isPrismaAvailable();
			if (isPrismaWorking) {
				return dbModule.prisma;
			} else {
				// Prisma failed, switch to fallback
				console.log('⚠️  Prisma failed during getPrisma(), switching to fallback');
				if (!fallbackModule) {
					fallbackModule = await import('./database-fallback');
				}
				usingFallback = true;
				return fallbackModule.prisma;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.log('⚠️  Prisma error in getPrisma(), using fallback:', errorMessage);
			if (!fallbackModule) {
				fallbackModule = await import('./database-fallback');
			}
			usingFallback = true;
			return fallbackModule.prisma;
		}
	}
	
	return db.prisma;
}

// Re-export for direct access (backward compatibility)
export { ACCOUNT_STATUSES, CLONE_STATUSES, DEVICE_STATUSES, CLONE_HEALTH } from '$lib/utils/status.js';

// Get the prisma instance directly (lazy loaded with auto-initialization)
let _prisma: any = null;
let _prismaPromise: Promise<any> | null = null;

async function initializePrisma() {
	if (_prismaPromise) return _prismaPromise;
	
	_prismaPromise = (async () => {
		try {
			const db = await getDbModule();
			
			// Check if we're using fallback
			if (usingFallback && fallbackModule) {
				_prisma = fallbackModule.prisma;
				console.log('✅ Using fallback prisma interface');
				return _prisma;
			}
			
			// If main module, test Prisma availability
			if (!usingFallback && dbModule) {
				const isPrismaWorking = await dbModule.isPrismaAvailable();
				if (isPrismaWorking) {
					_prisma = dbModule.prisma;
					console.log('✅ Prisma initialized successfully');
					return _prisma;
				}
			}
			
			// Fall back to database-fallback
			if (!fallbackModule) {
				fallbackModule = await import('./database-fallback');
			}
			usingFallback = true;
			_prisma = fallbackModule.prisma;
			console.log('✅ Using fallback prisma interface');
			return _prisma;
			
		} catch (err) {
			console.log('⚠️  Prisma initialization failed, using fallback:', err);
			if (!fallbackModule) {
				fallbackModule = await import('./database-fallback');
			}
			usingFallback = true;
			_prisma = fallbackModule.prisma;
			console.log('✅ Using fallback prisma interface');
			return _prisma;
		}
	})();
	
	return _prismaPromise;
}

export const prisma = new Proxy({}, {
	get: function(target, prop) {
		if (_prisma === null) {
			// For immediate access, we need to throw an error that indicates async initialization is needed
			throw new Error(`Prisma not yet initialized. Please await getPrisma() first or use the database functions from db-loader instead.`);
		}
		
		if (_prisma && _prisma[prop]) {
			return _prisma[prop];
		}
		
		throw new Error(`Property ${String(prop)} not found on prisma instance`);
	}
});

// Auto-initialize on module load
initializePrisma();

// Account Status type export
export type AccountStatus = 'Unused' | 'Assigned' | 'Logged In' | 'Banned' | 'Login Error' | 'Password Error' | 'Login In Progress' | 'Critical Error';


// Scraping system support - expose query method for raw SQL queries
export async function query(sql: string, params: any[] = []) {
	const db = await getDbModule();
	return db.query(sql, params);
}