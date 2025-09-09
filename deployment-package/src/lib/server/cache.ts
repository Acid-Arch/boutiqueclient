import { dev } from '$app/environment';

/**
 * Redis Cache Implementation for Boutique Client Portal
 * 
 * Provides high-performance caching with:
 * - Redis connection management with fallback
 * - Multiple cache strategies (LRU, TTL, etc.)
 * - Database query result caching
 * - Session management
 * - Real-time invalidation
 * - Performance monitoring
 */

export interface CacheConfig {
	enabled: boolean;
	defaultTtl: number; // seconds
	maxRetries: number;
	retryDelay: number;
	keyPrefix: string;
	compression: boolean;
}

export interface CacheEntry<T = any> {
	value: T;
	expiresAt: number;
	createdAt: number;
	accessCount: number;
	lastAccessed: number;
}

export interface CacheStats {
	hits: number;
	misses: number;
	hitRate: number;
	totalKeys: number;
	memoryUsed: number;
	connectionStatus: 'connected' | 'disconnected' | 'error';
	lastError?: string;
}

class CacheManager {
	private static instance: CacheManager | null = null;
	private redisClient: any = null;
	private fallbackCache = new Map<string, CacheEntry>();
	private isRedisAvailable = false;
	private connectionAttempts = 0;
	private stats: CacheStats = {
		hits: 0,
		misses: 0,
		hitRate: 0,
		totalKeys: 0,
		memoryUsed: 0,
		connectionStatus: 'disconnected',
	};

	private readonly config: CacheConfig = {
		enabled: process.env.REDIS_ENABLED !== 'false',
		defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'), // 1 hour
		maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
		retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000'),
		keyPrefix: process.env.CACHE_KEY_PREFIX || 'boutique:',
		compression: process.env.CACHE_COMPRESSION === 'true',
	};

	// Cache keys for different data types
	public static readonly KEYS = {
		USER_SESSION: 'session:user:',
		DATABASE_QUERY: 'db:query:',
		API_RESPONSE: 'api:response:',
		DEVICE_STATS: 'device:stats:',
		HEALTH_METRICS: 'health:metrics:',
		ACCOUNT_DATA: 'account:data:',
		DASHBOARD_DATA: 'dashboard:data:',
	} as const;

	public static getInstance(): CacheManager {
		if (!this.instance) {
			this.instance = new CacheManager();
		}
		return this.instance;
	}

	private constructor() {
		if (this.config.enabled) {
			this.initializeRedis();
		}
		
		// Cleanup interval for fallback cache
		setInterval(() => this.cleanupFallbackCache(), 60000); // Every minute
		
		// Stats update interval
		setInterval(() => this.updateStats(), 30000); // Every 30 seconds
	}

	/**
	 * Initialize Redis connection
	 */
	private async initializeRedis(): Promise<void> {
		try {
			// Dynamically import Redis to avoid issues if not installed
			const { createClient } = await import('redis');
			
			const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
			
			this.redisClient = createClient({
				url: redisUrl,
				retryDelayOnFailover: this.config.retryDelay,
				maxRetriesPerRequest: this.config.maxRetries,
			});

			// Event listeners
			this.redisClient.on('connect', () => {
				this.isRedisAvailable = true;
				this.stats.connectionStatus = 'connected';
				this.connectionAttempts = 0;
				if (dev) console.log('✅ Redis connected');
			});

			this.redisClient.on('error', (error: Error) => {
				this.isRedisAvailable = false;
				this.stats.connectionStatus = 'error';
				this.stats.lastError = error.message;
				this.connectionAttempts++;
				
				if (dev) console.warn('⚠️ Redis error:', error.message);
				
				// Exponential backoff for reconnection
				if (this.connectionAttempts < this.config.maxRetries) {
					setTimeout(() => this.initializeRedis(), 
						this.config.retryDelay * Math.pow(2, this.connectionAttempts));
				}
			});

			this.redisClient.on('end', () => {
				this.isRedisAvailable = false;
				this.stats.connectionStatus = 'disconnected';
				if (dev) console.log('🔌 Redis disconnected');
			});

			// Connect to Redis
			await this.redisClient.connect();

		} catch (error) {
			console.warn('Redis initialization failed, using fallback cache:', error);
			this.isRedisAvailable = false;
			this.stats.connectionStatus = 'error';
			this.stats.lastError = error instanceof Error ? error.message : 'Unknown error';
		}
	}

	/**
	 * Generate cache key with prefix
	 */
	private generateKey(key: string): string {
		return `${this.config.keyPrefix}${key}`;
	}

	/**
	 * Compress data if enabled
	 */
	private async compressData(data: any): Promise<string> {
		const jsonString = JSON.stringify(data);
		
		if (!this.config.compression || jsonString.length < 1024) {
			return jsonString;
		}
		
		try {
			// Use built-in gzip compression
			const { gzip } = await import('zlib');
			const { promisify } = await import('util');
			const gzipAsync = promisify(gzip);
			
			const compressed = await gzipAsync(Buffer.from(jsonString));
			return `gzip:${compressed.toString('base64')}`;
		} catch (error) {
			// Fallback to uncompressed
			return jsonString;
		}
	}

	/**
	 * Decompress data if compressed
	 */
	private async decompressData(data: string): Promise<any> {
		if (!data.startsWith('gzip:')) {
			return JSON.parse(data);
		}
		
		try {
			const { gunzip } = await import('zlib');
			const { promisify } = await import('util');
			const gunzipAsync = promisify(gunzip);
			
			const compressedData = data.substring(5); // Remove 'gzip:' prefix
			const compressed = Buffer.from(compressedData, 'base64');
			const decompressed = await gunzipAsync(compressed);
			return JSON.parse(decompressed.toString());
		} catch (error) {
			throw new Error(`Failed to decompress cache data: ${error}`);
		}
	}

	/**
	 * Set cache value
	 */
	public async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
		if (!this.config.enabled) return false;
		
		const cacheKey = this.generateKey(key);
		const actualTtl = ttl || this.config.defaultTtl;
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				// Use Redis
				const compressedValue = await this.compressData(value);
				await this.redisClient.setEx(cacheKey, actualTtl, compressedValue);
				return true;
			} else {
				// Use fallback cache
				const entry: CacheEntry<T> = {
					value,
					expiresAt: Date.now() + (actualTtl * 1000),
					createdAt: Date.now(),
					accessCount: 0,
					lastAccessed: Date.now(),
				};
				this.fallbackCache.set(cacheKey, entry);
				return true;
			}
		} catch (error) {
			console.warn('Cache set failed:', error);
			return false;
		}
	}

	/**
	 * Get cache value
	 */
	public async get<T>(key: string): Promise<T | null> {
		if (!this.config.enabled) return null;
		
		const cacheKey = this.generateKey(key);
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				// Use Redis
				const data = await this.redisClient.get(cacheKey);
				if (data) {
					this.stats.hits++;
					return await this.decompressData(data);
				}
			} else {
				// Use fallback cache
				const entry = this.fallbackCache.get(cacheKey);
				if (entry) {
					// Check expiration
					if (Date.now() < entry.expiresAt) {
						entry.accessCount++;
						entry.lastAccessed = Date.now();
						this.stats.hits++;
						return entry.value;
					} else {
						// Expired, remove it
						this.fallbackCache.delete(cacheKey);
					}
				}
			}
			
			this.stats.misses++;
			return null;
		} catch (error) {
			console.warn('Cache get failed:', error);
			this.stats.misses++;
			return null;
		}
	}

	/**
	 * Delete cache value
	 */
	public async delete(key: string): Promise<boolean> {
		if (!this.config.enabled) return false;
		
		const cacheKey = this.generateKey(key);
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				const result = await this.redisClient.del(cacheKey);
				return result > 0;
			} else {
				return this.fallbackCache.delete(cacheKey);
			}
		} catch (error) {
			console.warn('Cache delete failed:', error);
			return false;
		}
	}

	/**
	 * Check if key exists
	 */
	public async exists(key: string): Promise<boolean> {
		if (!this.config.enabled) return false;
		
		const cacheKey = this.generateKey(key);
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				const result = await this.redisClient.exists(cacheKey);
				return result > 0;
			} else {
				const entry = this.fallbackCache.get(cacheKey);
				return entry !== undefined && Date.now() < entry.expiresAt;
			}
		} catch (error) {
			console.warn('Cache exists check failed:', error);
			return false;
		}
	}

	/**
	 * Clear cache by pattern
	 */
	public async clearPattern(pattern: string): Promise<number> {
		if (!this.config.enabled) return 0;
		
		const fullPattern = this.generateKey(pattern);
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				const keys = await this.redisClient.keys(fullPattern);
				if (keys.length > 0) {
					return await this.redisClient.del(keys);
				}
				return 0;
			} else {
				let cleared = 0;
				for (const [key] of this.fallbackCache.entries()) {
					if (key.includes(pattern)) {
						this.fallbackCache.delete(key);
						cleared++;
					}
				}
				return cleared;
			}
		} catch (error) {
			console.warn('Cache clear pattern failed:', error);
			return 0;
		}
	}

	/**
	 * Get cache statistics
	 */
	public async getStats(): Promise<CacheStats> {
		await this.updateStats();
		
		const totalRequests = this.stats.hits + this.stats.misses;
		this.stats.hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
		
		return { ...this.stats };
	}

	/**
	 * Update cache statistics
	 */
	private async updateStats(): Promise<void> {
		try {
			if (this.isRedisAvailable && this.redisClient) {
				const info = await this.redisClient.info('memory');
				const memoryMatch = info.match(/used_memory:(\d+)/);
				if (memoryMatch) {
					this.stats.memoryUsed = parseInt(memoryMatch[1]);
				}
				
				const dbSizeInfo = await this.redisClient.dbSize();
				this.stats.totalKeys = dbSizeInfo;
			} else {
				this.stats.totalKeys = this.fallbackCache.size;
				// Estimate memory usage for fallback cache
				let estimatedMemory = 0;
				for (const [key, entry] of this.fallbackCache.entries()) {
					estimatedMemory += key.length * 2; // Rough string size
					estimatedMemory += JSON.stringify(entry.value).length * 2;
				}
				this.stats.memoryUsed = estimatedMemory;
			}
		} catch (error) {
			console.warn('Failed to update cache stats:', error);
		}
	}

	/**
	 * Cleanup expired entries in fallback cache
	 */
	private cleanupFallbackCache(): void {
		const now = Date.now();
		let cleaned = 0;
		
		for (const [key, entry] of this.fallbackCache.entries()) {
			if (now >= entry.expiresAt) {
				this.fallbackCache.delete(key);
				cleaned++;
			}
		}
		
		if (dev && cleaned > 0) {
			console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
		}
	}

	/**
	 * Flush all cache
	 */
	public async flush(): Promise<boolean> {
		try {
			if (this.isRedisAvailable && this.redisClient) {
				await this.redisClient.flushAll();
			}
			this.fallbackCache.clear();
			
			// Reset stats
			this.stats.hits = 0;
			this.stats.misses = 0;
			this.stats.hitRate = 0;
			
			return true;
		} catch (error) {
			console.warn('Cache flush failed:', error);
			return false;
		}
	}

	/**
	 * Close cache connections
	 */
	public async close(): Promise<void> {
		try {
			if (this.redisClient && this.isRedisAvailable) {
				await this.redisClient.quit();
			}
			this.fallbackCache.clear();
		} catch (error) {
			console.warn('Cache close failed:', error);
		}
	}

	/**
	 * Get or set cache with function
	 */
	public async getOrSet<T>(
		key: string,
		fetchFunction: () => Promise<T>,
		ttl?: number
	): Promise<T> {
		// Try to get from cache first
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}
		
		// Cache miss, fetch the data
		const data = await fetchFunction();
		
		// Store in cache for next time
		await this.set(key, data, ttl);
		
		return data;
	}

	/**
	 * Increment counter in cache
	 */
	public async increment(key: string, amount = 1, ttl?: number): Promise<number> {
		if (!this.config.enabled) return amount;
		
		const cacheKey = this.generateKey(key);
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				const result = await this.redisClient.incrBy(cacheKey, amount);
				if (ttl) {
					await this.redisClient.expire(cacheKey, ttl);
				}
				return result;
			} else {
				const entry = this.fallbackCache.get(cacheKey);
				const currentValue = entry ? (typeof entry.value === 'number' ? entry.value : 0) : 0;
				const newValue = currentValue + amount;
				
				await this.set(key, newValue, ttl);
				return newValue;
			}
		} catch (error) {
			console.warn('Cache increment failed:', error);
			return amount;
		}
	}

	/**
	 * Set cache with expiration timestamp
	 */
	public async setExpireAt(key: string, value: any, expireAt: Date): Promise<boolean> {
		const ttl = Math.max(0, Math.floor((expireAt.getTime() - Date.now()) / 1000));
		return await this.set(key, value, ttl);
	}

	/**
	 * Get remaining TTL for a key
	 */
	public async getTtl(key: string): Promise<number> {
		if (!this.config.enabled) return -1;
		
		const cacheKey = this.generateKey(key);
		
		try {
			if (this.isRedisAvailable && this.redisClient) {
				return await this.redisClient.ttl(cacheKey);
			} else {
				const entry = this.fallbackCache.get(cacheKey);
				if (entry) {
					return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
				}
				return -2; // Key doesn't exist
			}
		} catch (error) {
			console.warn('Cache TTL check failed:', error);
			return -1;
		}
	}
}

// Export singleton instance
export const cache = CacheManager.getInstance();

// Cache utility functions for common patterns
export class CacheUtils {
	/**
	 * Cache database query results
	 */
	static async cacheQuery<T>(
		queryName: string,
		queryParams: any,
		queryFunction: () => Promise<T>,
		ttl = 300 // 5 minutes default
	): Promise<T> {
		const key = `${CacheManager.KEYS.DATABASE_QUERY}${queryName}:${JSON.stringify(queryParams)}`;
		return await cache.getOrSet(key, queryFunction, ttl);
	}

	/**
	 * Cache API responses
	 */
	static async cacheApiResponse<T>(
		endpoint: string,
		params: any,
		responseFunction: () => Promise<T>,
		ttl = 600 // 10 minutes default
	): Promise<T> {
		const key = `${CacheManager.KEYS.API_RESPONSE}${endpoint}:${JSON.stringify(params)}`;
		return await cache.getOrSet(key, responseFunction, ttl);
	}

	/**
	 * Cache user session data
	 */
	static async setUserSession(userId: string, sessionData: any, ttl = 3600): Promise<boolean> {
		const key = `${CacheManager.KEYS.USER_SESSION}${userId}`;
		return await cache.set(key, sessionData, ttl);
	}

	/**
	 * Get user session data
	 */
	static async getUserSession(userId: string): Promise<any | null> {
		const key = `${CacheManager.KEYS.USER_SESSION}${userId}`;
		return await cache.get(key);
	}

	/**
	 * Clear user session
	 */
	static async clearUserSession(userId: string): Promise<boolean> {
		const key = `${CacheManager.KEYS.USER_SESSION}${userId}`;
		return await cache.delete(key);
	}

	/**
	 * Cache dashboard data
	 */
	static async cacheDashboardData<T>(
		userId: string,
		dataFunction: () => Promise<T>,
		ttl = 180 // 3 minutes default
	): Promise<T> {
		const key = `${CacheManager.KEYS.DASHBOARD_DATA}${userId}`;
		return await cache.getOrSet(key, dataFunction, ttl);
	}

	/**
	 * Invalidate user-specific cache
	 */
	static async invalidateUserCache(userId: string): Promise<number> {
		const patterns = [
			`${CacheManager.KEYS.USER_SESSION}${userId}*`,
			`${CacheManager.KEYS.DASHBOARD_DATA}${userId}*`,
			`${CacheManager.KEYS.ACCOUNT_DATA}${userId}*`,
		];
		
		let cleared = 0;
		for (const pattern of patterns) {
			cleared += await cache.clearPattern(pattern);
		}
		
		return cleared;
	}

	/**
	 * Cache health metrics
	 */
	static async cacheHealthMetrics<T>(
		metricsFunction: () => Promise<T>,
		ttl = 60 // 1 minute default
	): Promise<T> {
		const key = `${CacheManager.KEYS.HEALTH_METRICS}latest`;
		return await cache.getOrSet(key, metricsFunction, ttl);
	}
}

// Graceful shutdown
if (typeof process !== 'undefined') {
	process.on('SIGINT', async () => {
		await cache.close();
	});
	
	process.on('SIGTERM', async () => {
		await cache.close();
	});
}

export type { CacheConfig, CacheEntry, CacheStats };