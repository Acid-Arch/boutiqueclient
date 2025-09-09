import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { validateRequestBody, validateSearchParams, validateFileUpload } from './middleware.js';

// Mock the database security logger
vi.mock('../db-security-logger.js', () => ({
	DatabaseSecurityLogger: {
		logQuery: vi.fn()
	}
}));

describe('Validation Middleware', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('validateRequestBody', () => {
		const testSchema = z.object({
			name: z.string().min(1),
			age: z.number().int().min(0)
		});

		it('should validate correct request body', async () => {
			const mockRequest = {
				json: vi.fn().mockResolvedValue({ name: 'John', age: 30 }),
				headers: {
					get: vi.fn().mockReturnValue('test-user-agent')
				}
			} as any;

			const result = await validateRequestBody(mockRequest, testSchema);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ name: 'John', age: 30 });
			}
		});

		it('should reject invalid request body', async () => {
			const mockRequest = {
				json: vi.fn().mockResolvedValue({ name: '', age: -1 }),
				headers: {
					get: vi.fn().mockReturnValue('test-user-agent')
				}
			} as any;

			const result = await validateRequestBody(mockRequest, testSchema);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.response.status).toBe(400);
			}
		});

		it('should handle JSON parse errors', async () => {
			const mockRequest = {
				json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
				headers: {
					get: vi.fn().mockReturnValue('test-user-agent')
				}
			} as any;

			const result = await validateRequestBody(mockRequest, testSchema);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.response.status).toBe(400);
			}
		});

		it('should log validation attempts when requested', async () => {
			const { DatabaseSecurityLogger } = await import('../db-security-logger.js');
			
			const mockRequest = {
				json: vi.fn().mockResolvedValue({ name: 'John', age: 30 }),
				headers: {
					get: vi.fn().mockReturnValue('test-user-agent')
				}
			} as any;

			await validateRequestBody(mockRequest, testSchema, {
				logValidation: true,
				userId: 'test-user-123'
			});

			expect(DatabaseSecurityLogger.logQuery).toHaveBeenCalled();
		});
	});

	describe('validateSearchParams', () => {
		const testSchema = z.object({
			limit: z.string().transform(val => parseInt(val)).optional(),
			search: z.string().optional()
		});

		it('should validate correct search parameters', () => {
			const mockURL = new URL('http://example.com?limit=10&search=test');

			const result = validateSearchParams(mockURL, testSchema);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ limit: 10, search: 'test' });
			}
		});

		it('should reject invalid search parameters', () => {
			const testStrictSchema = z.object({
				requiredField: z.string()
			});

			const mockURL = new URL('http://example.com?optionalField=test');

			const result = validateSearchParams(mockURL, testStrictSchema);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.response.status).toBe(400);
			}
		});

		it('should handle empty search parameters', () => {
			const mockURL = new URL('http://example.com');

			const result = validateSearchParams(mockURL, testSchema);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({});
			}
		});
	});

	describe('validateFileUpload', () => {
		it('should validate correct file upload', () => {
			const mockFile = {
				name: 'test-file.csv',
				size: 1024 * 1024, // 1MB
				type: 'text/csv'
			} as File;

			const result = validateFileUpload(mockFile);

			expect(result.valid).toBe(true);
			expect(result.sanitizedName).toBe('test-file.csv');
		});

		it('should reject oversized files', () => {
			const mockFile = {
				name: 'large-file.csv',
				size: 15 * 1024 * 1024, // 15MB (over 10MB limit)
				type: 'text/csv'
			} as File;

			const result = validateFileUpload(mockFile);

			expect(result.valid).toBe(false);
			expect(result.error).toContain('File too large');
		});

		it('should reject invalid file types', () => {
			const mockFile = {
				name: 'malicious.exe',
				size: 1024,
				type: 'application/x-executable'
			} as File;

			const result = validateFileUpload(mockFile);

			expect(result.valid).toBe(false);
			expect(result.error).toContain('Invalid file type');
		});

		it('should sanitize dangerous filenames', () => {
			const mockFile = {
				name: '../../../etc/passwd',
				size: 1024,
				type: 'text/plain'
			} as File;

			const result = validateFileUpload(mockFile);

			expect(result.valid).toBe(true);
			expect(result.sanitizedName).toBe('______etc_passwd');
		});

		it('should reject suspicious filenames', () => {
			const mockFile = {
				name: 'script.js.csv',
				size: 1024,
				type: 'text/csv'
			} as File;

			const result = validateFileUpload(mockFile);

			expect(result.valid).toBe(false);
			expect(result.error).toContain('Potentially dangerous file name');
		});

		it('should handle extremely long filenames', () => {
			const longName = 'a'.repeat(300) + '.csv';
			const mockFile = {
				name: longName,
				size: 1024,
				type: 'text/csv'
			} as File;

			const result = validateFileUpload(mockFile);

			expect(result.valid).toBe(true);
			expect(result.sanitizedName?.length).toBeLessThanOrEqual(255);
		});
	});
});