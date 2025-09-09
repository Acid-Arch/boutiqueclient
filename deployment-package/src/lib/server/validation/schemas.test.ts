import { describe, it, expect } from 'vitest';
import {
	LoginSchema,
	CreateAccountSchema,
	UpdateAccountSchema,
	BulkAccountOperationSchema,
	DeviceAssignmentSchema,
	PaginationSchema,
	AccountFilterSchema,
	ScrapingSessionSchema,
	IPWhitelistSchema,
	ExportRequestSchema
} from './schemas.js';

describe('Validation Schemas', () => {
	describe('LoginSchema', () => {
		it('should validate correct login data', () => {
			const validData = {
				emailOrUsername: 'test@example.com',
				password: 'password123',
				rememberMe: true
			};

			const result = LoginSchema.parse(validData);
			expect(result).toEqual(validData);
		});

		it('should sanitize and trim input', () => {
			const dirtyData = {
				emailOrUsername: '  test@example.com  ',
				password: 'password123',
				rememberMe: false
			};

			const result = LoginSchema.parse(dirtyData);
			expect(result.emailOrUsername).toBe('test@example.com');
		});

		it('should reject short passwords', () => {
			const invalidData = {
				emailOrUsername: 'test@example.com',
				password: '123',
				rememberMe: false
			};

			expect(() => LoginSchema.parse(invalidData)).toThrow();
		});

		it('should reject empty username', () => {
			const invalidData = {
				emailOrUsername: '',
				password: 'password123',
				rememberMe: false
			};

			expect(() => LoginSchema.parse(invalidData)).toThrow();
		});

		it('should default rememberMe to false', () => {
			const dataWithoutRememberMe = {
				emailOrUsername: 'test@example.com',
				password: 'password123'
			};

			const result = LoginSchema.parse(dataWithoutRememberMe);
			expect(result.rememberMe).toBe(false);
		});
	});

	describe('CreateAccountSchema', () => {
		it('should validate correct account data', () => {
			const validData = {
				instagramUsername: 'testuser',
				instagramPassword: 'password123',
				emailAddress: 'test@example.com',
				emailPassword: 'emailpass123',
				accountType: 'CLIENT' as const,
				visibility: 'PRIVATE' as const,
				ownerId: 1
			};

			const result = CreateAccountSchema.parse(validData);
			expect(result).toEqual(validData);
		});

		it('should validate username format', () => {
			const invalidData = {
				instagramUsername: 'test@user!',
				instagramPassword: 'password123',
				emailAddress: 'test@example.com',
				emailPassword: 'emailpass123'
			};

			expect(() => CreateAccountSchema.parse(invalidData)).toThrow();
		});

		it('should validate email format', () => {
			const invalidData = {
				instagramUsername: 'testuser',
				instagramPassword: 'password123',
				emailAddress: 'invalid-email',
				emailPassword: 'emailpass123'
			};

			expect(() => CreateAccountSchema.parse(invalidData)).toThrow();
		});

		it('should apply defaults', () => {
			const minimalData = {
				instagramUsername: 'testuser',
				instagramPassword: 'password123',
				emailAddress: 'test@example.com',
				emailPassword: 'emailpass123'
			};

			const result = CreateAccountSchema.parse(minimalData);
			expect(result.accountType).toBe('CLIENT');
			expect(result.visibility).toBe('PRIVATE');
		});
	});

	describe('BulkAccountOperationSchema', () => {
		it('should validate bulk operations', () => {
			const validData = {
				accountIds: [1, 2, 3],
				operation: 'assign' as const,
				data: { deviceId: 'device123' }
			};

			const result = BulkAccountOperationSchema.parse(validData);
			expect(result).toEqual(validData);
		});

		it('should reject empty account list', () => {
			const invalidData = {
				accountIds: [],
				operation: 'assign' as const
			};

			expect(() => BulkAccountOperationSchema.parse(invalidData)).toThrow();
		});

		it('should reject too many accounts', () => {
			const invalidData = {
				accountIds: Array.from({ length: 101 }, (_, i) => i + 1),
				operation: 'assign' as const
			};

			expect(() => BulkAccountOperationSchema.parse(invalidData)).toThrow();
		});
	});

	describe('PaginationSchema', () => {
		it('should parse and transform pagination parameters', () => {
			const queryParams = {
				limit: '50',
				offset: '10',
				page: '2'
			};

			const result = PaginationSchema.parse(queryParams);
			expect(result.limit).toBe(50);
			expect(result.offset).toBe(10);
			expect(result.page).toBe(2);
		});

		it('should apply limits to prevent abuse', () => {
			const extremeParams = {
				limit: '1000',
				offset: '-10',
				page: '0'
			};

			const result = PaginationSchema.parse(extremeParams);
			expect(result.limit).toBe(100); // Max limit
			expect(result.offset).toBe(0); // Min offset
			expect(result.page).toBe(1); // Min page
		});

		it('should use defaults for invalid values', () => {
			const invalidParams = {
				limit: 'invalid',
				offset: 'invalid',
				page: 'invalid'
			};

			const result = PaginationSchema.parse(invalidParams);
			expect(result.limit).toBe(20); // Default
			expect(result.offset).toBe(0); // Default
			expect(result.page).toBe(1); // Default
		});
	});

	describe('IPWhitelistSchema', () => {
		it('should validate IPv4 addresses', () => {
			const validData = {
				ipAddress: '192.168.1.1',
				description: 'Test IP',
				userId: 1
			};

			const result = IPWhitelistSchema.parse(validData);
			expect(result).toEqual(validData);
		});

		it('should validate IPv6 addresses', () => {
			const validData = {
				ipAddress: '2001:db8::1',
				description: 'Test IPv6'
			};

			const result = IPWhitelistSchema.parse(validData);
			expect(result.ipAddress).toBe('2001:db8::1');
		});

		it('should reject invalid IP addresses', () => {
			const invalidData = {
				ipAddress: '999.999.999.999',
				description: 'Invalid IP'
			};

			expect(() => IPWhitelistSchema.parse(invalidData)).toThrow();
		});

		it('should sanitize description', () => {
			const dirtyData = {
				ipAddress: '192.168.1.1',
				description: '  Test IP with spaces  '
			};

			const result = IPWhitelistSchema.parse(dirtyData);
			expect(result.description).toBe('Test IP with spaces');
		});
	});

	describe('ScrapingSessionSchema', () => {
		it('should validate scraping session data', () => {
			const validData = {
				sessionType: 'DETAILED_ANALYSIS' as const,
				targetAccounts: ['user1', 'user2'],
				priority: 'HIGH' as const,
				batchSize: 10,
				costLimit: 5.0
			};

			const result = ScrapingSessionSchema.parse(validData);
			expect(result).toEqual(validData);
		});

		it('should apply defaults', () => {
			const minimalData = {
				sessionType: 'BASIC_SCRAPE' as const,
				targetAccounts: ['user1']
			};

			const result = ScrapingSessionSchema.parse(minimalData);
			expect(result.priority).toBe('NORMAL');
			expect(result.batchSize).toBe(5);
			expect(result.costLimit).toBe(1.0);
		});

		it('should reject empty target accounts', () => {
			const invalidData = {
				sessionType: 'BASIC_SCRAPE' as const,
				targetAccounts: []
			};

			expect(() => ScrapingSessionSchema.parse(invalidData)).toThrow();
		});

		it('should reject too many target accounts', () => {
			const invalidData = {
				sessionType: 'BASIC_SCRAPE' as const,
				targetAccounts: Array.from({ length: 101 }, (_, i) => `user${i}`)
			};

			expect(() => ScrapingSessionSchema.parse(invalidData)).toThrow();
		});
	});

	describe('ExportRequestSchema', () => {
		it('should validate export request', () => {
			const validData = {
				format: 'csv' as const,
				includeFields: ['username', 'email'],
				maxRecords: 500
			};

			const result = ExportRequestSchema.parse(validData);
			expect(result).toEqual(validData);
		});

		it('should apply defaults', () => {
			const minimalData = {};

			const result = ExportRequestSchema.parse(minimalData);
			expect(result.format).toBe('csv');
			expect(result.maxRecords).toBe(1000);
		});

		it('should enforce max records limit', () => {
			const extremeData = {
				maxRecords: 50000
			};

			expect(() => ExportRequestSchema.parse(extremeData)).toThrow();
		});
	});
});