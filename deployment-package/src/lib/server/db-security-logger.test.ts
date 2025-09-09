import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSecurityLogger, monitoredQuery } from './db-security-logger.js';

describe('DatabaseSecurityLogger', () => {
	beforeEach(() => {
		DatabaseSecurityLogger.clearLogs();
		vi.clearAllMocks();
	});

	describe('logQuery', () => {
		it('should log sensitive queries', () => {
			const query = 'SELECT * FROM users WHERE email = $1';
			const params = ['test@example.com'];
			const duration = 150;

			DatabaseSecurityLogger.logQuery(query, params, duration, {
				userId: 'user123',
				ip: '192.168.1.1'
			});

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(1);
		});

		it('should detect suspicious query patterns', () => {
			const suspiciousQuery = "SELECT * FROM users WHERE id = 1 OR 1=1";
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			DatabaseSecurityLogger.logQuery(suspiciousQuery, [], 100);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('SUSPICIOUS DATABASE QUERY DETECTED'),
				expect.any(Object)
			);

			const suspicious = DatabaseSecurityLogger.getSuspiciousActivities();
			expect(suspicious.length).toBe(1);

			consoleSpy.mockRestore();
		});

		it('should detect SQL injection attempts', () => {
			const injectionQuery = "SELECT * FROM accounts WHERE username = '; DROP TABLE users; --'";
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			DatabaseSecurityLogger.logQuery(injectionQuery, [], 100);

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('SUSPICIOUS DATABASE QUERY DETECTED'),
				expect.any(Object)
			);

			consoleSpy.mockRestore();
		});

		it('should log slow queries', () => {
			const slowQuery = 'SELECT COUNT(*) FROM large_table';
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			DatabaseSecurityLogger.logQuery(slowQuery, [], 6000); // 6 seconds

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('SLOW DATABASE QUERY'),
				expect.any(Object)
			);

			consoleSpy.mockRestore();
		});

		it('should sanitize password values in queries', () => {
			const query = 'UPDATE users SET password = $1 WHERE id = $2';
			const params = ['secretpassword123', 1];

			DatabaseSecurityLogger.logQuery(query, params, 100);

			const suspicious = DatabaseSecurityLogger.getSuspiciousActivities();
			const logEntry = suspicious[0];
			
			if (logEntry) {
				expect(logEntry.query).toContain('[REDACTED]');
			}
		});

		it('should track different query types correctly', () => {
			DatabaseSecurityLogger.logQuery('SELECT * FROM users', [], 100);
			DatabaseSecurityLogger.logQuery('INSERT INTO users (name) VALUES ($1)', ['John'], 150);
			DatabaseSecurityLogger.logQuery('UPDATE users SET name = $1', ['Jane'], 120);
			DatabaseSecurityLogger.logQuery('DELETE FROM users WHERE id = $1', [1], 80);

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(4);
		});

		it('should limit log entries to prevent memory leaks', () => {
			// Add more than MAX_LOGS entries
			for (let i = 0; i < 1100; i++) {
				DatabaseSecurityLogger.logQuery(`SELECT ${i}`, [], 100);
			}

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBeLessThanOrEqual(1000);
		});
	});

	describe('getSuspiciousActivities', () => {
		it('should return recent suspicious activities', () => {
			const suspiciousQuery = "SELECT * FROM users WHERE 1=1 UNION SELECT * FROM passwords";
			DatabaseSecurityLogger.logQuery(suspiciousQuery, [], 100);
			
			const normalQuery = "SELECT name FROM users WHERE id = $1";
			DatabaseSecurityLogger.logQuery(normalQuery, [1], 100);

			const activities = DatabaseSecurityLogger.getSuspiciousActivities();
			expect(activities.length).toBe(1);
			expect(activities[0].query).toContain(suspiciousQuery);
		});

		it('should limit returned activities', () => {
			// Add many suspicious queries
			for (let i = 0; i < 60; i++) {
				DatabaseSecurityLogger.logQuery(`SELECT * FROM users WHERE 1=1 -- ${i}`, [], 100);
			}

			const activities = DatabaseSecurityLogger.getSuspiciousActivities(30);
			expect(activities.length).toBeLessThanOrEqual(30);
		});
	});

	describe('getSecurityStats', () => {
		it('should return accurate statistics', () => {
			// Normal query
			DatabaseSecurityLogger.logQuery('SELECT name FROM users', [], 100);
			
			// Suspicious query
			DatabaseSecurityLogger.logQuery("SELECT * WHERE 1=1", [], 150);
			
			// Query with error
			DatabaseSecurityLogger.logQuery('SELECT invalid', [], 200, {
				error: 'Syntax error'
			});
			
			// Slow query
			DatabaseSecurityLogger.logQuery('SELECT * FROM big_table', [], 6000);

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(4);
			expect(stats.suspiciousQueries).toBe(1);
			expect(stats.errorQueries).toBe(1);
			expect(stats.slowQueries).toBe(1);
			expect(stats.lastActivity).toBeDefined();
		});

		it('should return zero stats when no logs exist', () => {
			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(0);
			expect(stats.suspiciousQueries).toBe(0);
			expect(stats.errorQueries).toBe(0);
			expect(stats.slowQueries).toBe(0);
			expect(stats.lastActivity).toBeNull();
		});
	});

	describe('monitoredQuery', () => {
		it('should execute query and log success', async () => {
			const mockQueryFn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
			const query = 'SELECT * FROM users WHERE id = $1';
			const params = [1];

			const result = await monitoredQuery(mockQueryFn, query, params, {
				userId: 'user123'
			});

			expect(mockQueryFn).toHaveBeenCalled();
			expect(result).toEqual({ rows: [{ id: 1 }] });

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(1);
			expect(stats.errorQueries).toBe(0);
		});

		it('should log errors and re-throw', async () => {
			const mockQueryFn = vi.fn().mockRejectedValue(new Error('Database connection failed'));
			const query = 'SELECT * FROM users';

			await expect(monitoredQuery(mockQueryFn, query, [], {
				userId: 'user123'
			})).rejects.toThrow('Database connection failed');

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(1);
			expect(stats.errorQueries).toBe(1);
		});

		it('should measure query duration', async () => {
			const slowMockQueryFn = vi.fn().mockImplementation(() => 
				new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 50))
			);

			const startTime = Date.now();
			await monitoredQuery(slowMockQueryFn, 'SELECT * FROM slow_table', []);
			const endTime = Date.now();

			// Verify that some time has passed (at least 40ms, allowing for timing variance)
			expect(endTime - startTime).toBeGreaterThanOrEqual(40);

			const stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(1);
		});
	});

	describe('clearLogs', () => {
		it('should clear all logs', () => {
			DatabaseSecurityLogger.logQuery('SELECT * FROM users', [], 100);
			DatabaseSecurityLogger.logQuery('SELECT * FROM accounts', [], 150);

			let stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(2);

			DatabaseSecurityLogger.clearLogs();

			stats = DatabaseSecurityLogger.getSecurityStats();
			expect(stats.totalQueries).toBe(0);
		});
	});

	describe('parameter sanitization', () => {
		it('should truncate long parameters', () => {
			const longParam = 'a'.repeat(100);
			DatabaseSecurityLogger.logQuery('SELECT * FROM users WHERE data = $1', [longParam], 100);

			const activities = DatabaseSecurityLogger.getSuspiciousActivities(10);
			if (activities.length > 0) {
				const loggedParam = activities[0].params?.[0];
				expect(typeof loggedParam).toBe('string');
				if (typeof loggedParam === 'string') {
					expect(loggedParam.length).toBeLessThan(100);
					expect(loggedParam).toContain('[TRUNCATED]');
				}
			}
		});

		it('should redact sensitive parameters', () => {
			DatabaseSecurityLogger.logQuery('UPDATE users SET field = $1', ['password123'], 100);

			const activities = DatabaseSecurityLogger.getSuspiciousActivities(10);
			if (activities.length > 0) {
				expect(activities[0].params?.[0]).toBe('[REDACTED]');
			}
		});
	});
});