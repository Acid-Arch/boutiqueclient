import { dev } from '$app/environment';

/**
 * Database Health Monitoring System
 * Provides comprehensive database health checks, metrics, and monitoring
 */

export interface DatabaseHealthMetrics {
	status: 'healthy' | 'warning' | 'critical' | 'unavailable';
	responseTime: number;
	connectionCount: number;
	maxConnections: number;
	connectionUtilization: number; // Percentage
	activeQueries: number;
	longRunningQueries: number;
	deadlocks: number;
	diskUsage?: {
		total: number;
		used: number;
		free: number;
		percentUsed: number;
	};
	tableStats?: {
		totalTables: number;
		totalRows: number;
		indexHitRatio: number;
	};
	performanceMetrics?: {
		avgQueryTime: number;
		slowQueries: number;
		cacheHitRatio: number;
	};
	lastCheck: Date;
	errors: string[];
	warnings: string[];
}

export interface DatabaseAlert {
	id: string;
	type: 'error' | 'warning' | 'info';
	category: 'connection' | 'performance' | 'disk' | 'queries' | 'security';
	message: string;
	details: any;
	threshold?: {
		value: number;
		limit: number;
		unit: string;
	};
	timestamp: Date;
	resolved: boolean;
}

class DatabaseHealthMonitor {
	private static instance: DatabaseHealthMonitor | null = null;
	private healthCache: DatabaseHealthMetrics | null = null;
	private cacheExpiry: number = 0;
	private readonly CACHE_TTL = 30000; // 30 seconds
	private alerts: Map<string, DatabaseAlert> = new Map();
	private alertHistory: DatabaseAlert[] = [];
	private monitoringActive = false;
	private monitoringInterval: NodeJS.Timeout | null = null;

	// Health check thresholds
	private readonly THRESHOLDS = {
		responseTime: {
			warning: 1000, // 1s
			critical: 5000, // 5s
		},
		connectionUtilization: {
			warning: 70, // 70%
			critical: 90, // 90%
		},
		diskUsage: {
			warning: 80, // 80%
			critical: 95, // 95%
		},
		indexHitRatio: {
			warning: 90, // 90%
			critical: 80, // 80%
		},
		cacheHitRatio: {
			warning: 95, // 95%
			critical: 85, // 85%
		},
		longRunningQueries: {
			warning: 5,
			critical: 10,
		},
	};

	public static getInstance(): DatabaseHealthMonitor {
		if (!this.instance) {
			this.instance = new DatabaseHealthMonitor();
		}
		return this.instance;
	}

	/**
	 * Get comprehensive database health metrics
	 */
	public async getHealthMetrics(useCache = true): Promise<DatabaseHealthMetrics> {
		// Return cached result if available and not expired
		if (useCache && this.healthCache && Date.now() < this.cacheExpiry) {
			return this.healthCache;
		}

		const start = Date.now();
		const metrics: DatabaseHealthMetrics = {
			status: 'healthy',
			responseTime: 0,
			connectionCount: 0,
			maxConnections: 0,
			connectionUtilization: 0,
			activeQueries: 0,
			longRunningQueries: 0,
			deadlocks: 0,
			lastCheck: new Date(),
			errors: [],
			warnings: [],
		};

		try {
			// Import database connection
			const { prisma, isPrismaAvailable } = await import('./database.js');

			// Check if Prisma is available
			const prismaAvailable = await isPrismaAvailable();
			if (!prismaAvailable) {
				// Use direct PostgreSQL connection
				await this.checkHealthDirectSQL(metrics);
			} else {
				// Use Prisma client
				await this.checkHealthPrisma(prisma, metrics);
			}

			metrics.responseTime = Date.now() - start;

			// Determine overall health status
			this.determineHealthStatus(metrics);

			// Process alerts based on metrics
			this.processAlerts(metrics);

			// Cache the results
			this.healthCache = metrics;
			this.cacheExpiry = Date.now() + this.CACHE_TTL;

		} catch (error) {
			metrics.status = 'unavailable';
			metrics.responseTime = Date.now() - start;
			metrics.errors.push(error instanceof Error ? error.message : 'Unknown database error');
			
			this.addAlert('db-unavailable', 'error', 'connection', 
				'Database is unavailable', { error: error instanceof Error ? error.message : error });
		}

		return metrics;
	}

	/**
	 * Check database health using Prisma
	 */
	private async checkHealthPrisma(prisma: any, metrics: DatabaseHealthMetrics): Promise<void> {
		try {
			// Basic connectivity test
			await prisma.$queryRaw`SELECT 1 as health_check`;

			// Get connection statistics
			const connectionStats = await prisma.$queryRaw`
				SELECT 
					count(*) as total_connections,
					count(*) FILTER (WHERE state = 'active') as active_connections,
					current_setting('max_connections')::int as max_connections
				FROM pg_stat_activity
			`;

			if (connectionStats && connectionStats.length > 0) {
				const stats = connectionStats[0];
				metrics.connectionCount = parseInt(stats.total_connections);
				metrics.activeQueries = parseInt(stats.active_connections);
				metrics.maxConnections = parseInt(stats.max_connections);
				metrics.connectionUtilization = (metrics.connectionCount / metrics.maxConnections) * 100;
			}

			// Get long-running queries
			const longQueries = await prisma.$queryRaw`
				SELECT count(*) as long_queries
				FROM pg_stat_activity 
				WHERE state = 'active' 
					AND query_start < now() - interval '5 minutes'
					AND query NOT LIKE '%pg_stat_activity%'
			`;

			if (longQueries && longQueries.length > 0) {
				metrics.longRunningQueries = parseInt(longQueries[0].long_queries);
			}

			// Get deadlock statistics
			const deadlockStats = await prisma.$queryRaw`
				SELECT deadlocks 
				FROM pg_stat_database 
				WHERE datname = current_database()
			`;

			if (deadlockStats && deadlockStats.length > 0) {
				metrics.deadlocks = parseInt(deadlockStats[0].deadlocks) || 0;
			}

			// Get table statistics
			await this.getTableStats(prisma, metrics);

			// Get performance metrics
			await this.getPerformanceMetrics(prisma, metrics);

			// Get disk usage (if available)
			await this.getDiskUsage(prisma, metrics);

		} catch (error) {
			metrics.errors.push(`Prisma health check failed: ${error instanceof Error ? error.message : error}`);
		}
	}

	/**
	 * Check database health using direct SQL
	 */
	private async checkHealthDirectSQL(metrics: DatabaseHealthMetrics): Promise<void> {
		try {
			// Import pg here to avoid issues if not available
			const pg = await import('pg');
			const { Client } = pg.default;
			
			const client = new Client({
				connectionString: process.env.DATABASE_URL
			});

			await client.connect();

			try {
				// Basic connectivity test
				await client.query('SELECT 1 as health_check');

				// Get connection statistics
				const connectionResult = await client.query(`
					SELECT 
						count(*) as total_connections,
						count(*) FILTER (WHERE state = 'active') as active_connections,
						current_setting('max_connections')::int as max_connections
					FROM pg_stat_activity
				`);

				if (connectionResult.rows.length > 0) {
					const stats = connectionResult.rows[0];
					metrics.connectionCount = parseInt(stats.total_connections);
					metrics.activeQueries = parseInt(stats.active_connections);
					metrics.maxConnections = parseInt(stats.max_connections);
					metrics.connectionUtilization = (metrics.connectionCount / metrics.maxConnections) * 100;
				}

				// Get long-running queries
				const longQueriesResult = await client.query(`
					SELECT count(*) as long_queries
					FROM pg_stat_activity 
					WHERE state = 'active' 
						AND query_start < now() - interval '5 minutes'
						AND query NOT LIKE '%pg_stat_activity%'
				`);

				if (longQueriesResult.rows.length > 0) {
					metrics.longRunningQueries = parseInt(longQueriesResult.rows[0].long_queries);
				}

				// Get basic table stats
				const tableResult = await client.query(`
					SELECT COUNT(*) as table_count 
					FROM information_schema.tables 
					WHERE table_schema = 'public'
				`);

				if (tableResult.rows.length > 0) {
					metrics.tableStats = {
						totalTables: parseInt(tableResult.rows[0].table_count),
						totalRows: 0,
						indexHitRatio: 0,
					};
				}

			} finally {
				await client.end();
			}

		} catch (error) {
			metrics.errors.push(`Direct SQL health check failed: ${error instanceof Error ? error.message : error}`);
		}
	}

	/**
	 * Get table statistics
	 */
	private async getTableStats(prisma: any, metrics: DatabaseHealthMetrics): Promise<void> {
		try {
			const tableStats = await prisma.$queryRaw`
				SELECT 
					COUNT(*) as table_count,
					SUM(n_tup_ins + n_tup_upd + n_tup_del) as total_rows,
					CASE 
						WHEN SUM(idx_blks_hit + idx_blks_read) = 0 THEN 0
						ELSE (SUM(idx_blks_hit) * 100.0 / SUM(idx_blks_hit + idx_blks_read))
					END as index_hit_ratio
				FROM pg_stat_user_tables
			`;

			if (tableStats && tableStats.length > 0) {
				const stats = tableStats[0];
				metrics.tableStats = {
					totalTables: parseInt(stats.table_count) || 0,
					totalRows: parseInt(stats.total_rows) || 0,
					indexHitRatio: parseFloat(stats.index_hit_ratio) || 0,
				};
			}
		} catch (error) {
			metrics.warnings.push(`Table stats unavailable: ${error instanceof Error ? error.message : error}`);
		}
	}

	/**
	 * Get performance metrics
	 */
	private async getPerformanceMetrics(prisma: any, metrics: DatabaseHealthMetrics): Promise<void> {
		try {
			const perfStats = await prisma.$queryRaw`
				SELECT 
					COALESCE(AVG(mean_exec_time), 0) as avg_query_time,
					COUNT(*) FILTER (WHERE mean_exec_time > 1000) as slow_queries,
					CASE 
						WHEN SUM(blks_hit + blks_read) = 0 THEN 0
						ELSE (SUM(blks_hit) * 100.0 / SUM(blks_hit + blks_read))
					END as cache_hit_ratio
				FROM pg_stat_statements
				WHERE calls > 0
			`;

			if (perfStats && perfStats.length > 0) {
				const stats = perfStats[0];
				metrics.performanceMetrics = {
					avgQueryTime: parseFloat(stats.avg_query_time) || 0,
					slowQueries: parseInt(stats.slow_queries) || 0,
					cacheHitRatio: parseFloat(stats.cache_hit_ratio) || 0,
				};
			}
		} catch (error) {
			// pg_stat_statements may not be available
			metrics.warnings.push('Performance metrics unavailable (pg_stat_statements not enabled)');
		}
	}

	/**
	 * Get disk usage information
	 */
	private async getDiskUsage(prisma: any, metrics: DatabaseHealthMetrics): Promise<void> {
		try {
			const diskStats = await prisma.$queryRaw`
				SELECT 
					pg_database_size(current_database()) as db_size,
					pg_size_pretty(pg_database_size(current_database())) as db_size_pretty
			`;

			if (diskStats && diskStats.length > 0) {
				const stats = diskStats[0];
				const dbSize = parseInt(stats.db_size);
				
				// This is a simplified disk usage - in production, you'd want
				// to query actual filesystem stats or use monitoring tools
				metrics.diskUsage = {
					total: dbSize * 2, // Rough estimate
					used: dbSize,
					free: dbSize,
					percentUsed: 50, // Placeholder
				};
			}
		} catch (error) {
			metrics.warnings.push(`Disk usage unavailable: ${error instanceof Error ? error.message : error}`);
		}
	}

	/**
	 * Determine overall health status based on metrics
	 */
	private determineHealthStatus(metrics: DatabaseHealthMetrics): void {
		let status: DatabaseHealthMetrics['status'] = 'healthy';

		// Check response time
		if (metrics.responseTime > this.THRESHOLDS.responseTime.critical) {
			status = 'critical';
		} else if (metrics.responseTime > this.THRESHOLDS.responseTime.warning && status === 'healthy') {
			status = 'warning';
		}

		// Check connection utilization
		if (metrics.connectionUtilization > this.THRESHOLDS.connectionUtilization.critical) {
			status = 'critical';
		} else if (metrics.connectionUtilization > this.THRESHOLDS.connectionUtilization.warning && status === 'healthy') {
			status = 'warning';
		}

		// Check long-running queries
		if (metrics.longRunningQueries > this.THRESHOLDS.longRunningQueries.critical) {
			status = 'critical';
		} else if (metrics.longRunningQueries > this.THRESHOLDS.longRunningQueries.warning && status === 'healthy') {
			status = 'warning';
		}

		// Check disk usage
		if (metrics.diskUsage && metrics.diskUsage.percentUsed > this.THRESHOLDS.diskUsage.critical) {
			status = 'critical';
		} else if (metrics.diskUsage && metrics.diskUsage.percentUsed > this.THRESHOLDS.diskUsage.warning && status === 'healthy') {
			status = 'warning';
		}

		// Check cache hit ratio
		if (metrics.performanceMetrics) {
			if (metrics.performanceMetrics.cacheHitRatio < this.THRESHOLDS.cacheHitRatio.critical) {
				status = 'critical';
			} else if (metrics.performanceMetrics.cacheHitRatio < this.THRESHOLDS.cacheHitRatio.warning && status === 'healthy') {
				status = 'warning';
			}
		}

		// If we have errors, set to critical
		if (metrics.errors.length > 0) {
			status = 'critical';
		}

		metrics.status = status;
	}

	/**
	 * Process and generate alerts based on metrics
	 */
	private processAlerts(metrics: DatabaseHealthMetrics): void {
		// Response time alerts
		if (metrics.responseTime > this.THRESHOLDS.responseTime.critical) {
			this.addAlert('slow-response-critical', 'error', 'performance',
				`Database response time is critically slow: ${metrics.responseTime}ms`,
				{ responseTime: metrics.responseTime, threshold: this.THRESHOLDS.responseTime.critical });
		} else if (metrics.responseTime > this.THRESHOLDS.responseTime.warning) {
			this.addAlert('slow-response-warning', 'warning', 'performance',
				`Database response time is slow: ${metrics.responseTime}ms`,
				{ responseTime: metrics.responseTime, threshold: this.THRESHOLDS.responseTime.warning });
		} else {
			this.resolveAlert('slow-response-critical');
			this.resolveAlert('slow-response-warning');
		}

		// Connection utilization alerts
		if (metrics.connectionUtilization > this.THRESHOLDS.connectionUtilization.critical) {
			this.addAlert('high-connection-usage', 'error', 'connection',
				`Database connection usage is critically high: ${metrics.connectionUtilization.toFixed(1)}%`,
				{ utilization: metrics.connectionUtilization, threshold: this.THRESHOLDS.connectionUtilization.critical });
		} else if (metrics.connectionUtilization > this.THRESHOLDS.connectionUtilization.warning) {
			this.addAlert('moderate-connection-usage', 'warning', 'connection',
				`Database connection usage is elevated: ${metrics.connectionUtilization.toFixed(1)}%`,
				{ utilization: metrics.connectionUtilization, threshold: this.THRESHOLDS.connectionUtilization.warning });
		} else {
			this.resolveAlert('high-connection-usage');
			this.resolveAlert('moderate-connection-usage');
		}

		// Long-running queries
		if (metrics.longRunningQueries > this.THRESHOLDS.longRunningQueries.critical) {
			this.addAlert('long-running-queries', 'error', 'queries',
				`Many long-running queries detected: ${metrics.longRunningQueries}`,
				{ count: metrics.longRunningQueries, threshold: this.THRESHOLDS.longRunningQueries.critical });
		} else if (metrics.longRunningQueries > 0) {
			this.resolveAlert('long-running-queries');
		}

		// Disk usage alerts
		if (metrics.diskUsage && metrics.diskUsage.percentUsed > this.THRESHOLDS.diskUsage.critical) {
			this.addAlert('disk-space-critical', 'error', 'disk',
				`Database disk usage is critically high: ${metrics.diskUsage.percentUsed.toFixed(1)}%`,
				{ usage: metrics.diskUsage.percentUsed, threshold: this.THRESHOLDS.diskUsage.critical });
		} else if (metrics.diskUsage && metrics.diskUsage.percentUsed > this.THRESHOLDS.diskUsage.warning) {
			this.addAlert('disk-space-warning', 'warning', 'disk',
				`Database disk usage is high: ${metrics.diskUsage.percentUsed.toFixed(1)}%`,
				{ usage: metrics.diskUsage.percentUsed, threshold: this.THRESHOLDS.diskUsage.warning });
		} else {
			this.resolveAlert('disk-space-critical');
			this.resolveAlert('disk-space-warning');
		}
	}

	/**
	 * Add or update an alert
	 */
	private addAlert(id: string, type: DatabaseAlert['type'], category: DatabaseAlert['category'], 
					 message: string, details: any): void {
		const alert: DatabaseAlert = {
			id,
			type,
			category,
			message,
			details,
			timestamp: new Date(),
			resolved: false,
		};

		this.alerts.set(id, alert);
		
		if (dev) {
			console.log(`🚨 Database Alert [${type.toUpperCase()}]: ${message}`);
		}
	}

	/**
	 * Resolve an alert
	 */
	private resolveAlert(id: string): void {
		const alert = this.alerts.get(id);
		if (alert && !alert.resolved) {
			alert.resolved = true;
			this.alertHistory.push(alert);
			this.alerts.delete(id);
			
			if (dev) {
				console.log(`✅ Database Alert Resolved: ${alert.message}`);
			}
		}
	}

	/**
	 * Get current active alerts
	 */
	public getActiveAlerts(): DatabaseAlert[] {
		return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
	}

	/**
	 * Get alert history
	 */
	public getAlertHistory(limit = 50): DatabaseAlert[] {
		return this.alertHistory
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
			.slice(0, limit);
	}

	/**
	 * Start continuous monitoring
	 */
	public startMonitoring(intervalMs = 60000): void {
		if (this.monitoringActive) {
			console.log('Database monitoring already active');
			return;
		}

		this.monitoringActive = true;
		console.log(`🔍 Starting database health monitoring (${intervalMs}ms interval)`);

		this.monitoringInterval = setInterval(async () => {
			try {
				await this.getHealthMetrics(false); // Force fresh check
			} catch (error) {
				console.error('Database monitoring error:', error);
			}
		}, intervalMs);
	}

	/**
	 * Stop continuous monitoring
	 */
	public stopMonitoring(): void {
		if (!this.monitoringActive) {
			return;
		}

		this.monitoringActive = false;
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval);
			this.monitoringInterval = null;
		}
		console.log('🛑 Database health monitoring stopped');
	}

	/**
	 * Clear cache and force fresh health check
	 */
	public async refreshHealthMetrics(): Promise<DatabaseHealthMetrics> {
		this.healthCache = null;
		this.cacheExpiry = 0;
		return await this.getHealthMetrics(false);
	}

	/**
	 * Get monitoring status
	 */
	public getMonitoringStatus(): {
		active: boolean;
		cacheAge: number;
		alertCount: number;
		lastCheck: Date | null;
	} {
		return {
			active: this.monitoringActive,
			cacheAge: this.healthCache ? Date.now() - (this.cacheExpiry - this.CACHE_TTL) : -1,
			alertCount: this.alerts.size,
			lastCheck: this.healthCache?.lastCheck || null,
		};
	}
}

// Export singleton instance
export const databaseHealthMonitor = DatabaseHealthMonitor.getInstance();

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
	databaseHealthMonitor.startMonitoring();
}

// Export types for external use
export type { DatabaseHealthMetrics, DatabaseAlert };

// Helper function for API routes
export async function getDatabaseHealthStatus() {
	const metrics = await databaseHealthMonitor.getHealthMetrics();
	const alerts = databaseHealthMonitor.getActiveAlerts();
	const monitoringStatus = databaseHealthMonitor.getMonitoringStatus();

	return {
		health: metrics,
		alerts,
		monitoring: monitoringStatus,
	};
}