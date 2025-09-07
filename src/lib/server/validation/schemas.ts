import { z } from 'zod';

// Base validation helpers
export const sanitizeString = (str: string) => str.trim().replace(/[<>]/g, '');

// User and Authentication Schemas
export const LoginSchema = z.object({
	emailOrUsername: z
		.string()
		.min(1, 'Email or username is required')
		.max(255, 'Email or username too long')
		.transform(sanitizeString),
	password: z
		.string()
		.min(6, 'Password must be at least 6 characters')
		.max(128, 'Password too long'),
	rememberMe: z.boolean().optional().default(false)
});

export const CreateUserSchema = z.object({
	email: z
		.string()
		.email('Invalid email format')
		.max(255, 'Email too long')
		.transform(sanitizeString),
	name: z
		.string()
		.min(1, 'Name is required')
		.max(100, 'Name too long')
		.transform(sanitizeString),
	role: z.enum(['ADMIN', 'CLIENT', 'VIEWER', 'UNAUTHORIZED']).default('CLIENT')
});

// Account Management Schemas
export const CreateAccountSchema = z.object({
	instagramUsername: z
		.string()
		.min(1, 'Instagram username is required')
		.max(255, 'Username too long')
		.regex(/^[a-zA-Z0-9._]+$/, 'Invalid username format')
		.transform(sanitizeString),
	instagramPassword: z
		.string()
		.min(1, 'Instagram password is required')
		.max(255, 'Password too long'),
	emailAddress: z
		.string()
		.email('Invalid email format')
		.max(255, 'Email too long')
		.transform(sanitizeString),
	emailPassword: z
		.string()
		.min(1, 'Email password is required')
		.max(255, 'Email password too long'),
	accountType: z.enum(['CLIENT', 'ML_TREND_FINDER', 'SYSTEM']).default('CLIENT'),
	visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC']).default('PRIVATE'),
	ownerId: z.number().int().positive().optional(),
	notes: z.string().max(500, 'Notes too long').optional().transform(val => val ? sanitizeString(val) : undefined)
});

export const UpdateAccountSchema = CreateAccountSchema.partial().extend({
	id: z.number().int().positive()
});

export const BulkAccountOperationSchema = z.object({
	accountIds: z
		.array(z.number().int().positive())
		.min(1, 'At least one account ID required')
		.max(100, 'Too many accounts selected'),
	operation: z.enum(['assign', 'unassign', 'delete', 'update_status', 'change_owner']),
	data: z.record(z.string(), z.any()).optional()
});

// Device Management Schemas
export const DeviceAssignmentSchema = z.object({
	accountId: z.number().int().positive(),
	deviceId: z
		.string()
		.min(1, 'Device ID required')
		.max(255, 'Device ID too long')
		.transform(sanitizeString),
	cloneNumber: z.number().int().min(0).max(99, 'Invalid clone number')
});

export const BulkAssignmentSchema = z.object({
	assignments: z
		.array(DeviceAssignmentSchema)
		.min(1, 'At least one assignment required')
		.max(50, 'Too many assignments')
});

// API Query Parameters Schema
export const PaginationSchema = z.object({
	limit: z
		.string()
		.optional()
		.transform(val => val ? Math.min(Math.max(parseInt(val) || 20, 1), 100) : 20),
	offset: z
		.string()
		.optional()
		.transform(val => {
			const parsed = parseInt(val || '0');
			return isNaN(parsed) ? 0 : Math.max(parsed, 0);
		}),
	page: z
		.string()
		.optional()
		.transform(val => {
			const parsed = parseInt(val || '1');
			return isNaN(parsed) ? 1 : Math.max(parsed, 1);
		})
});

export const AccountFilterSchema = z.object({
	status: z.string().optional(),
	search: z
		.string()
		.max(255, 'Search query too long')
		.optional()
		.transform(val => val ? sanitizeString(val) : undefined),
	ownerId: z
		.string()
		.optional()
		.transform(val => {
			if (!val) return undefined;
			if (val === 'null') return null;
			const parsed = parseInt(val);
			return isNaN(parsed) ? undefined : parsed;
		}),
	accountTypes: z
		.string()
		.optional()
		.transform(val => val ? val.split(',').map(type => type.trim()) : undefined),
	includeMLAccounts: z
		.string()
		.optional()
		.transform(val => val === 'true')
});

// Scraping and Analytics Schemas
export const ScrapingSessionSchema = z.object({
	sessionType: z.enum(['DETAILED_ANALYSIS', 'BASIC_SCRAPE', 'BULK_UPDATE']),
	targetAccounts: z
		.array(z.string().transform(sanitizeString))
		.min(1, 'At least one target account required')
		.max(100, 'Too many target accounts'),
	priority: z.enum(['LOW', 'NORMAL', 'HIGH']).default('NORMAL'),
	batchSize: z.number().int().min(1).max(20).default(5),
	costLimit: z.number().min(0).max(100).default(1.0),
	scheduledFor: z.date().optional()
});

export const WebhookSchema = z.object({
	url: z
		.string()
		.url('Invalid webhook URL')
		.max(255, 'URL too long'),
	events: z
		.array(z.string())
		.min(1, 'At least one event required'),
	secret: z.string().min(8, 'Webhook secret must be at least 8 characters').optional()
});

// File Upload Schema
export const FileUploadSchema = z.object({
	filename: z
		.string()
		.min(1, 'Filename required')
		.max(255, 'Filename too long')
		.regex(/^[a-zA-Z0-9._-]+\.[a-zA-Z0-9]+$/, 'Invalid filename format')
		.transform(sanitizeString),
	size: z.number().int().min(1).max(10 * 1024 * 1024), // 10MB limit
	type: z.enum(['text/csv', 'application/json', 'text/plain'])
});

// Settings Schema
export const SettingsSchema = z.object({
	notifications: z.object({
		email: z.boolean().default(true),
		browser: z.boolean().default(true),
		webhook: z.boolean().default(false)
	}).optional(),
	preferences: z.object({
		theme: z.enum(['light', 'dark', 'auto']).default('auto'),
		language: z.enum(['en', 'es', 'fr', 'de']).default('en'),
		timezone: z.string().max(50).default('UTC')
	}).optional(),
	security: z.object({
		twoFactorEnabled: z.boolean().default(false),
		sessionTimeout: z.number().int().min(300).max(86400).default(3600) // 5 minutes to 24 hours
	}).optional()
});

// IP Whitelist Schema
export const IPWhitelistSchema = z.object({
	ipAddress: z
		.string()
		.refine((val) => {
			// Basic IPv4 regex
			const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
			// Basic IPv6 regex (more comprehensive)
			const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^:(?:[0-9a-fA-F]{1,4}:){1,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,6}::[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}$|^(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}$|^(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}$|^[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$|^2001:db8::[0-9a-fA-F]{1,4}$/;
			return ipv4Regex.test(val) || ipv6Regex.test(val);
		}, 'Invalid IP address format')
		.transform(sanitizeString),
	description: z
		.string()
		.max(255, 'Description too long')
		.optional()
		.transform(val => val ? sanitizeString(val) : undefined),
	userId: z.number().int().positive().optional()
});

// Export/Import Schemas
export const ExportRequestSchema = z.object({
	format: z.enum(['csv', 'json', 'xlsx']).default('csv'),
	includeFields: z
		.array(z.string())
		.optional(),
	filters: AccountFilterSchema.optional(),
	maxRecords: z.number().int().min(1).max(10000).default(1000)
});

// Type exports for use in API endpoints
export type LoginData = z.infer<typeof LoginSchema>;
export type CreateAccountData = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountData = z.infer<typeof UpdateAccountSchema>;
export type BulkAccountOperation = z.infer<typeof BulkAccountOperationSchema>;
export type DeviceAssignment = z.infer<typeof DeviceAssignmentSchema>;
export type PaginationParams = z.infer<typeof PaginationSchema>;
export type AccountFilter = z.infer<typeof AccountFilterSchema>;
export type ScrapingSession = z.infer<typeof ScrapingSessionSchema>;
export type WebhookConfig = z.infer<typeof WebhookSchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type IPWhitelist = z.infer<typeof IPWhitelistSchema>;
export type ExportRequest = z.infer<typeof ExportRequestSchema>;