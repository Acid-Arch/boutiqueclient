import { z } from 'zod';
import { ACCOUNT_STATUSES } from '$lib/utils/status.js';

// Account validation schema
export const accountSchema = z.object({
	igUsername: z
		.string()
		.min(1, 'Instagram username is required')
		.max(255, 'Username must be less than 255 characters')
		.regex(
			/^[a-zA-Z0-9._]+$/,
			'Username can only contain letters, numbers, dots, and underscores'
		)
		.refine(
			(username) => !username.startsWith('.') && !username.endsWith('.'),
			'Username cannot start or end with a dot'
		)
		.refine(
			(username) => !username.includes('..'),
			'Username cannot contain consecutive dots'
		),
	
	igPassword: z
		.string()
		.min(6, 'Instagram password must be at least 6 characters')
		.max(100, 'Password must be less than 100 characters'),
	
	emailAddress: z
		.string()
		.min(1, 'Email address is required')
		.email('Please enter a valid email address')
		.max(255, 'Email must be less than 255 characters')
		.toLowerCase(),
	
	emailPassword: z
		.string()
		.min(6, 'Email password must be at least 6 characters')
		.max(100, 'Email password must be less than 100 characters'),
	
	status: z.enum(ACCOUNT_STATUSES, {
		message: 'Please select a valid account status'
	}),
	
	deviceId: z
		.number()
		.int()
		.positive('Device ID must be a positive number')
		.optional()
		.or(z.literal('').transform(() => undefined))
});

// Type for the form data
export type AccountFormData = z.infer<typeof accountSchema>;

// Form validation result type
export interface ValidationResult<T = AccountFormData> {
	success: boolean;
	data?: T;
	errors?: Record<string, string[]>;
	fieldErrors?: Record<string, string>;
}

// Validate form data
export function validateAccountForm(data: unknown): ValidationResult {
	const result = accountSchema.safeParse(data);
	
	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}
	
	// Format errors for easier use in components
	const fieldErrors: Record<string, string> = {};
	const errors: Record<string, string[]> = {};
	
	result.error.issues.forEach((error: any) => {
		const field = error.path.join('.');
		const message = error.message;
		
		if (!errors[field]) {
			errors[field] = [];
		}
		errors[field].push(message);
		
		// Store first error for each field for simple display
		if (!fieldErrors[field]) {
			fieldErrors[field] = message;
		}
	});
	
	return {
		success: false,
		errors,
		fieldErrors: fieldErrors as Record<keyof AccountFormData, string>
	};
}

// Helper function to get field error
export function getFieldError(
	fieldName: keyof AccountFormData,
	errors?: Record<keyof AccountFormData, string>
): string | undefined {
	return errors?.[fieldName];
}

// Helper function to check if field has error
export function hasFieldError(
	fieldName: keyof AccountFormData,
	errors?: Record<keyof AccountFormData, string>
): boolean {
	return Boolean(errors?.[fieldName]);
}

// Form state management
export interface FormState {
	isSubmitting: boolean;
	isDirty: boolean;
	errors?: Record<keyof AccountFormData, string>;
	touched: Set<keyof AccountFormData>;
}

// Helper to create initial form state
export function createInitialFormState(): FormState {
	return {
		isSubmitting: false,
		isDirty: false,
		touched: new Set()
	};
}

// Helper to mark field as touched
export function markFieldTouched(
	state: FormState,
	fieldName: keyof AccountFormData
): FormState {
	const newTouched = new Set(state.touched);
	newTouched.add(fieldName);
	
	return {
		...state,
		touched: newTouched,
		isDirty: true
	};
}

// Helper to validate single field
export function validateField(
	fieldName: keyof AccountFormData,
	value: unknown,
	allData?: Partial<AccountFormData>
): string | undefined {
	try {
		// Create a partial schema for the specific field
		const fieldSchema = accountSchema.pick({ [fieldName]: true });
		const result = fieldSchema.safeParse({ [fieldName]: value });
		
		if (!result.success) {
			return result.error.issues[0]?.message;
		}
		
		return undefined;
	} catch {
		return 'Invalid input';
	}
}

// Utility to clean form data (remove empty strings, etc.)
export function cleanFormData(data: Record<string, unknown>): Record<string, unknown> {
	const cleaned: Record<string, unknown> = {};
	
	for (const [key, value] of Object.entries(data)) {
		if (value !== '' && value !== null && value !== undefined) {
			cleaned[key] = value;
		}
	}
	
	return cleaned;
}

// Helper to get status display name
export function getStatusDisplayName(status: string): string {
	return status;
}

// Helper to format error message for display
export function formatErrorMessage(error: string): string {
	// Capitalize first letter and ensure it ends with a period
	const formatted = error.charAt(0).toUpperCase() + error.slice(1);
	return formatted.endsWith('.') ? formatted : formatted + '.';
}

// Import-specific validation schemas
// More lenient schema for import data that may have empty/optional fields
export const importAccountSchema = z.object({
	instagramUsername: z
		.string()
		.min(1, 'Instagram username is required')
		.max(255, 'Username must be less than 255 characters')
		.regex(
			/^[a-zA-Z0-9._]+$/,
			'Username can only contain letters, numbers, dots, and underscores'
		)
		.refine(
			(username) => !username.startsWith('.') && !username.endsWith('.'),
			'Username cannot start or end with a dot'
		)
		.refine(
			(username) => !username.includes('..'),
			'Username cannot contain consecutive dots'
		),
	
	instagramPassword: z
		.string()
		.min(6, 'Instagram password must be at least 6 characters')
		.max(100, 'Password must be less than 100 characters'),
	
	emailAddress: z
		.string()
		.min(1, 'Email address is required')
		.email('Please enter a valid email address')
		.max(255, 'Email must be less than 255 characters')
		.toLowerCase(),
	
	emailPassword: z
		.string()
		.min(6, 'Email password must be at least 6 characters')
		.max(100, 'Email password must be less than 100 characters'),
	
	status: z.enum(ACCOUNT_STATUSES, {
		message: 'Please select a valid account status'
	}).optional().default('Unused'),
	
	imapStatus: z.enum(['On', 'Off'] as const, {
		message: 'IMAP status must be "On" or "Off"'
	}).optional().default('On'),
	
	assignedDeviceId: z
		.string()
		.max(255, 'Device ID must be less than 255 characters')
		.optional()
		.or(z.literal('').transform(() => undefined)),
	
	assignedCloneNumber: z
		.number()
		.int()
		.positive('Clone number must be a positive number')
		.optional()
		.or(z.string().transform((val, ctx) => {
			if (val === '' || val === null || val === undefined) return undefined;
			const parsed = parseInt(val, 10);
			if (isNaN(parsed)) {
				ctx.addIssue({
					code: z.ZodIssueCode.invalid_type,
					expected: 'number',
					received: typeof val,
					message: 'Clone number must be a valid number'
				});
				return z.NEVER;
			}
			if (parsed <= 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Clone number must be a positive number'
				});
				return z.NEVER;
			}
			return parsed;
		})),
	
	assignedPackageName: z
		.string()
		.max(255, 'Package name must be less than 255 characters')
		.optional()
		.or(z.literal('').transform(() => undefined)),
	
	recordId: z
		.string()
		.max(255, 'Record ID must be less than 255 characters')
		.optional()
		.or(z.literal('').transform(() => undefined))
});

// Type for import account data
export type ImportAccountData = z.infer<typeof importAccountSchema>;

// Batch validation for multiple import records
export interface BatchValidationResult {
	success: boolean;
	validRecords: ImportAccountData[];
	invalidRecords: Array<{
		rowNumber: number;
		data: any;
		errors: z.ZodError;
	}>;
	totalRecords: number;
	validCount: number;
	invalidCount: number;
	summary: {
		duplicateUsernames: string[];
		invalidEmails: number;
		invalidPasswords: number;
		invalidStatuses: number;
		otherErrors: number;
	};
}

// Validate multiple import records
export function validateImportBatch(
	records: Array<{ data: unknown; rowNumber: number }>
): BatchValidationResult {
	const validRecords: ImportAccountData[] = [];
	const invalidRecords: Array<{
		rowNumber: number;
		data: any;
		errors: z.ZodError;
	}> = [];
	
	const seenUsernames = new Set<string>();
	const duplicateUsernames: string[] = [];
	let invalidEmails = 0;
	let invalidPasswords = 0;
	let invalidStatuses = 0;
	let otherErrors = 0;

	records.forEach(({ data, rowNumber }) => {
		try {
			const result = importAccountSchema.safeParse(data);
			
			if (result.success) {
				// Check for duplicate usernames within the batch
				if (seenUsernames.has(result.data.instagramUsername)) {
					duplicateUsernames.push(result.data.instagramUsername);
				} else {
					seenUsernames.add(result.data.instagramUsername);
				}
				
				validRecords.push(result.data);
			} else {
				// Categorize errors for summary
				result.error.issues.forEach((error: any) => {
					const path = error.path.join('.');
					if (path === 'emailAddress') {
						invalidEmails++;
					} else if (path.includes('Password')) {
						invalidPasswords++;
					} else if (path === 'status' || path === 'imapStatus') {
						invalidStatuses++;
					} else {
						otherErrors++;
					}
				});
				
				invalidRecords.push({
					rowNumber,
					data,
					errors: result.error
				});
			}
		} catch (error) {
			otherErrors++;
			invalidRecords.push({
				rowNumber,
				data,
				errors: new z.ZodError([{
					code: z.ZodIssueCode.custom,
					path: [],
					message: error instanceof Error ? error.message : 'Unknown validation error'
				}])
			});
		}
	});

	return {
		success: invalidRecords.length === 0,
		validRecords,
		invalidRecords,
		totalRecords: records.length,
		validCount: validRecords.length,
		invalidCount: invalidRecords.length,
		summary: {
			duplicateUsernames: Array.from(new Set(duplicateUsernames)),
			invalidEmails,
			invalidPasswords,
			invalidStatuses,
			otherErrors
		}
	};
}

// Helper to format import validation errors for display
export function formatImportError(error: z.ZodError): string[] {
	return error.issues.map((err: any) => {
		const field = err.path.length > 0 ? err.path.join('.') : 'data';
		return `${field}: ${err.message}`;
	});
}

// Validate single import record with more detailed error reporting
export function validateImportRecord(data: unknown, rowNumber: number): {
	success: boolean;
	data?: ImportAccountData;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	try {
		const result = importAccountSchema.safeParse(data);
		
		if (result.success) {
			// Add warnings for optional fields that are commonly expected
			if (!result.data.assignedDeviceId && result.data.assignedCloneNumber) {
				warnings.push('Clone number provided without device ID');
			}
			
			if (!result.data.assignedCloneNumber && result.data.assignedDeviceId) {
				warnings.push('Device ID provided without clone number');
			}
			
			if (result.data.assignedPackageName && !result.data.assignedDeviceId) {
				warnings.push('Package name provided without device assignment');
			}

			return {
				success: true,
				data: result.data,
				errors: [],
				warnings
			};
		} else {
			return {
				success: false,
				errors: formatImportError(result.error),
				warnings
			};
		}
	} catch (error) {
		return {
			success: false,
			errors: [error instanceof Error ? error.message : 'Unknown validation error'],
			warnings
		};
	}
}

// Username validation regex patterns (more comprehensive for import)
export const USERNAME_PATTERNS = {
	instagram: /^[a-zA-Z0-9._]{1,30}$/,
	reservedWords: ['admin', 'root', 'api', 'www', 'mail', 'ftp', 'help', 'support', 'instagram', 'meta'],
	consecutiveDots: /\.{2,}/,
	startEndDot: /^\.|\.$/
};

// Assignment validation schemas
export const assignmentStrategySchema = z.enum(['round-robin', 'fill-first', 'capacity-based'], {
	message: 'Please select a valid assignment strategy'
});

export const deviceAssignmentSchema = z.object({
	accountIds: z
		.array(z.number().int().positive('Account ID must be a positive number'))
		.min(1, 'At least one account must be selected')
		.max(1000, 'Cannot assign more than 1000 accounts at once'),
	
	assignmentMode: z.enum(['auto', 'specific'], {
		message: 'Assignment mode must be either "auto" or "specific"'
	}),
	
	assignmentStrategy: assignmentStrategySchema.optional(),
	
	deviceId: z
		.string()
		.max(255, 'Device ID must be less than 255 characters')
		.optional(),
}).refine(
	(data) => {
		// If mode is specific, deviceId is required
		if (data.assignmentMode === 'specific') {
			return data.deviceId && data.deviceId.trim().length > 0;
		}
		return true;
	},
	{
		message: 'Device ID is required when using specific assignment mode',
		path: ['deviceId']
	}
).refine(
	(data) => {
		// If mode is auto, assignmentStrategy is required
		if (data.assignmentMode === 'auto') {
			return data.assignmentStrategy !== undefined;
		}
		return true;
	},
	{
		message: 'Assignment strategy is required when using automatic assignment mode',
		path: ['assignmentStrategy']
	}
);

export const autoAssignmentFormSchema = z.object({
	autoAssign: z.boolean(),
	assignmentStrategy: assignmentStrategySchema.optional(),
	accountData: accountSchema,
}).refine(
	(data) => {
		// If auto-assignment is enabled, strategy is required
		if (data.autoAssign) {
			return data.assignmentStrategy !== undefined;
		}
		return true;
	},
	{
		message: 'Assignment strategy is required when auto-assignment is enabled',
		path: ['assignmentStrategy']
	}
);

// Types for assignment operations
export type AssignmentStrategyType = z.infer<typeof assignmentStrategySchema>;
export type DeviceAssignmentData = z.infer<typeof deviceAssignmentSchema>;
export type AutoAssignmentFormData = z.infer<typeof autoAssignmentFormSchema>;

// Validation functions for assignment operations
export function validateDeviceAssignment(data: unknown): ValidationResult<DeviceAssignmentData> {
	const result = deviceAssignmentSchema.safeParse(data);
	
	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}
	
	const fieldErrors: Record<string, string> = {};
	const errors: Record<string, string[]> = {};
	
	result.error.issues.forEach((error: any) => {
		const field = error.path.join('.');
		const message = error.message;
		
		if (!errors[field]) {
			errors[field] = [];
		}
		errors[field].push(message);
		
		if (!fieldErrors[field]) {
			fieldErrors[field] = message;
		}
	});
	
	return {
		success: false,
		errors,
		fieldErrors: fieldErrors as any
	};
}

export function validateAutoAssignmentForm(data: unknown): ValidationResult<AutoAssignmentFormData> {
	const result = autoAssignmentFormSchema.safeParse(data);
	
	if (result.success) {
		return {
			success: true,
			data: result.data
		};
	}
	
	const fieldErrors: Record<string, string> = {};
	const errors: Record<string, string[]> = {};
	
	result.error.issues.forEach((error: any) => {
		const field = error.path.join('.');
		const message = error.message;
		
		if (!errors[field]) {
			errors[field] = [];
		}
		errors[field].push(message);
		
		if (!fieldErrors[field]) {
			fieldErrors[field] = message;
		}
	});
	
	return {
		success: false,
		errors,
		fieldErrors: fieldErrors as any
	};
}

// Capacity validation helper
export function validateAssignmentCapacity(
	accountCount: number,
	availableCapacity: number,
	strategy: AssignmentStrategyType
): {
	valid: boolean;
	errors: string[];
	warnings: string[];
	suggestions: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];
	const suggestions: string[] = [];
	
	if (accountCount <= 0) {
		errors.push('No accounts selected for assignment');
		return { valid: false, errors, warnings, suggestions };
	}
	
	if (availableCapacity <= 0) {
		errors.push('No available device capacity');
		suggestions.push('Add more devices or free up existing clones');
		return { valid: false, errors, warnings, suggestions };
	}
	
	if (accountCount > availableCapacity) {
		errors.push(`Insufficient capacity: need ${accountCount} slots, only ${availableCapacity} available`);
		suggestions.push(`Add ${accountCount - availableCapacity} more slots or reduce account count`);
		return { valid: false, errors, warnings, suggestions };
	}
	
	// Capacity warnings and suggestions based on strategy
	const utilizationPercent = (accountCount / availableCapacity) * 100;
	
	if (utilizationPercent > 90) {
		warnings.push('High capacity utilization - consider adding more devices for future scalability');
	} else if (utilizationPercent < 20) {
		if (strategy === 'round-robin') {
			suggestions.push('Consider using "Fill-First" strategy to better utilize fewer devices');
		}
	}
	
	if (accountCount > 100) {
		if (strategy === 'round-robin') {
			suggestions.push('Round-Robin strategy is optimal for large-scale assignments');
		} else if (strategy === 'fill-first') {
			warnings.push('Fill-First strategy may create uneven load distribution with many accounts');
		}
	}
	
	return {
		valid: true,
		errors,
		warnings,
		suggestions
	};
}

// Device capacity validation
export function validateDeviceCapacity(
	deviceCapacity: Array<{ deviceId: string; available: number; total: number }>,
	assignmentMode: 'auto' | 'specific',
	selectedDeviceId?: string
): {
	valid: boolean;
	errors: string[];
	warnings: string[];
	totalCapacity: number;
} {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	if (deviceCapacity.length === 0) {
		errors.push('No devices available');
		return { valid: false, errors, warnings, totalCapacity: 0 };
	}
	
	const totalCapacity = deviceCapacity.reduce((sum, device) => sum + device.available, 0);
	
	if (assignmentMode === 'specific') {
		if (!selectedDeviceId) {
			errors.push('No device selected for specific assignment');
			return { valid: false, errors, warnings, totalCapacity };
		}
		
		const selectedDevice = deviceCapacity.find(d => d.deviceId === selectedDeviceId);
		if (!selectedDevice) {
			errors.push('Selected device not found');
			return { valid: false, errors, warnings, totalCapacity };
		}
		
		if (selectedDevice.available === 0) {
			errors.push('Selected device has no available capacity');
			return { valid: false, errors, warnings, totalCapacity };
		}
		
		const utilizationPercent = ((selectedDevice.total - selectedDevice.available) / selectedDevice.total) * 100;
		if (utilizationPercent > 80) {
			warnings.push('Selected device is highly utilized');
		}
	} else {
		// Auto mode - check overall capacity
		const availableDevices = deviceCapacity.filter(d => d.available > 0);
		if (availableDevices.length === 0) {
			errors.push('No devices have available capacity');
			return { valid: false, errors, warnings, totalCapacity };
		}
		
		if (availableDevices.length < deviceCapacity.length) {
			warnings.push(`${deviceCapacity.length - availableDevices.length} devices are at full capacity`);
		}
	}
	
	return {
		valid: errors.length === 0,
		errors,
		warnings,
		totalCapacity
	};
}

// Enhanced username validation for import
export function validateInstagramUsername(username: string): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	if (!username || username.trim() === '') {
		errors.push('Username is required');
		return { valid: false, errors, warnings };
	}
	
	const trimmed = username.trim().toLowerCase();
	
	// Length check
	if (trimmed.length < 1) {
		errors.push('Username cannot be empty');
	} else if (trimmed.length > 30) {
		errors.push('Username cannot be longer than 30 characters');
	}
	
	// Pattern check
	if (!USERNAME_PATTERNS.instagram.test(trimmed)) {
		errors.push('Username can only contain letters, numbers, dots, and underscores');
	}
	
	// Consecutive dots check
	if (USERNAME_PATTERNS.consecutiveDots.test(trimmed)) {
		errors.push('Username cannot contain consecutive dots');
	}
	
	// Start/end with dot check
	if (USERNAME_PATTERNS.startEndDot.test(trimmed)) {
		errors.push('Username cannot start or end with a dot');
	}
	
	// Reserved words check
	if (USERNAME_PATTERNS.reservedWords.includes(trimmed)) {
		warnings.push('Username appears to be a reserved word and may not be available');
	}
	
	// Common problematic patterns
	if (trimmed.includes('..')) {
		errors.push('Username contains consecutive dots');
	}
	
	if (trimmed.length < 3) {
		warnings.push('Username is very short and may not be available on Instagram');
	}
	
	// Suspicious patterns
	if (/^\d+$/.test(trimmed)) {
		warnings.push('Username contains only numbers and may not be allowed');
	}
	
	if (trimmed.split('').every(char => char === char.toLowerCase() && char === trimmed[0])) {
		warnings.push('Username contains repeating characters and may look suspicious');
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	};
}

// Email validation with additional checks for import
export function validateEmailForImport(email: string): {
	valid: boolean;
	errors: string[];
	warnings: string[];
} {
	const errors: string[] = [];
	const warnings: string[] = [];
	
	if (!email || email.trim() === '') {
		errors.push('Email is required');
		return { valid: false, errors, warnings };
	}
	
	const trimmed = email.trim().toLowerCase();
	
	// Basic email format
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(trimmed)) {
		errors.push('Invalid email format');
		return { valid: false, errors, warnings };
	}
	
	// Length check
	if (trimmed.length > 255) {
		errors.push('Email is too long (maximum 255 characters)');
	}
	
	// Common temporary/disposable email providers
	const disposableProviders = [
		'10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
		'mailinator.com', 'trash-mail.com', 'throwaway.email'
	];
	
	const domain = trimmed.split('@')[1];
	if (disposableProviders.some(provider => domain.includes(provider))) {
		warnings.push('Email appears to be from a disposable email provider');
	}
	
	// Check for plus addressing
	if (trimmed.includes('+')) {
		warnings.push('Email uses plus addressing which may cause issues');
	}
	
	// Check for unusual characters
	if (/[^a-zA-Z0-9@._-]/.test(trimmed)) {
		warnings.push('Email contains unusual characters');
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings
	};
}