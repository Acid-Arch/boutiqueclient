import type { IgAccount, CloneInventory } from '@prisma/client';

// Export format types
export type ExportFormat = 'csv' | 'json';

// Available fields for export
export interface ExportableFields {
	// Account fields
	id: boolean;
	recordId: boolean;
	instagramUsername: boolean;
	instagramPassword: boolean;
	emailAddress: boolean;
	emailPassword: boolean;
	status: boolean;
	imapStatus: boolean;
	assignedDeviceId: boolean;
	assignedCloneNumber: boolean;
	assignedPackageName: boolean;
	assignmentTimestamp: boolean;
	loginTimestamp: boolean;
	createdAt: boolean;
	updatedAt: boolean;
}

// Export configuration
export interface ExportConfig {
	format: ExportFormat;
	fields: ExportableFields;
	includeHeaders: boolean;
	dateRange?: {
		from: Date;
		to: Date;
	};
	statusFilter?: string;
	searchQuery?: string;
}

// Export result types
export interface ExportResult {
	success: boolean;
	filename: string;
	data?: string;
	error?: string;
	recordCount?: number;
}

// Account with optional clone info for exports
export type AccountWithDevice = IgAccount & {
	assignedDevice?: {
		deviceName?: string | null;
		packageName?: string | null;
		cloneHealth?: string | null;
	};
};

// Default export fields
export const DEFAULT_EXPORT_FIELDS: ExportableFields = {
	id: true,
	recordId: false,
	instagramUsername: true,
	instagramPassword: true,
	emailAddress: true,
	emailPassword: true,
	status: true,
	imapStatus: true,
	assignedDeviceId: false,
	assignedCloneNumber: false,
	assignedPackageName: false,
	assignmentTimestamp: false,
	loginTimestamp: false,
	createdAt: true,
	updatedAt: false
};

// Field display names for export headers
export const FIELD_DISPLAY_NAMES: Record<keyof ExportableFields, string> = {
	id: 'ID',
	recordId: 'Record ID',
	instagramUsername: 'Instagram Username',
	instagramPassword: 'Instagram Password',
	emailAddress: 'Email Address',
	emailPassword: 'Email Password',
	status: 'Status',
	imapStatus: 'IMAP Status',
	assignedDeviceId: 'Device ID',
	assignedCloneNumber: 'Clone Number',
	assignedPackageName: 'Package Name',
	assignmentTimestamp: 'Assignment Date',
	loginTimestamp: 'Login Date',
	createdAt: 'Created Date',
	updatedAt: 'Updated Date'
};

// Safe field descriptions for UI
export const FIELD_DESCRIPTIONS: Record<keyof ExportableFields, string> = {
	id: 'Internal database ID',
	recordId: 'External record identifier',
	instagramUsername: 'Instagram account username',
	instagramPassword: 'Instagram account password',
	emailAddress: 'Associated email address',
	emailPassword: 'Email account password',
	status: 'Current account status',
	imapStatus: 'IMAP access status (On/Off)',
	assignedDeviceId: 'Assigned device identifier',
	assignedCloneNumber: 'Clone number on device',
	assignedPackageName: 'App package name on device',
	assignmentTimestamp: 'When account was assigned to device',
	loginTimestamp: 'When account was last logged in',
	createdAt: 'Account creation date',
	updatedAt: 'Last modification date'
};

/**
 * Format date for export
 */
function formatDateForExport(date: Date | null | undefined): string {
	if (!date) return '';
	return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get field value from account record
 */
function getFieldValue(account: AccountWithDevice, fieldName: keyof ExportableFields): string {
	const value = account[fieldName as keyof AccountWithDevice];
	
	// Handle dates
	if (fieldName.includes('Timestamp') || fieldName.includes('At')) {
		return formatDateForExport(value as Date);
	}
	
	// Handle null/undefined values
	if (value === null || value === undefined) {
		return '';
	}
	
	// Convert to string
	return String(value);
}

/**
 * Escape CSV field value
 */
function escapeCsvField(value: string): string {
	// If value contains comma, newline, or quotes, wrap in quotes and escape internal quotes
	if (value.includes(',') || value.includes('\n') || value.includes('"')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Convert accounts to CSV format
 */
export function convertToCSV(
	accounts: AccountWithDevice[],
	fields: ExportableFields,
	includeHeaders: boolean = true
): string {
	const selectedFields = Object.entries(fields)
		.filter(([_, selected]) => selected)
		.map(([fieldName, _]) => fieldName as keyof ExportableFields);

	const rows: string[] = [];

	// Add header row if requested
	if (includeHeaders) {
		const headers = selectedFields.map(field => FIELD_DISPLAY_NAMES[field]);
		rows.push(headers.map(header => escapeCsvField(header)).join(','));
	}

	// Add data rows
	accounts.forEach(account => {
		const values = selectedFields.map(field => {
			const value = getFieldValue(account, field);
			return escapeCsvField(value);
		});
		rows.push(values.join(','));
	});

	return rows.join('\n');
}

/**
 * Convert accounts to JSON format
 */
export function convertToJSON(
	accounts: AccountWithDevice[],
	fields: ExportableFields,
	includeMetadata: boolean = true
): string {
	const selectedFields = Object.entries(fields)
		.filter(([_, selected]) => selected)
		.map(([fieldName, _]) => fieldName as keyof ExportableFields);

	// Filter accounts to only include selected fields
	const filteredAccounts = accounts.map(account => {
		const filtered: any = {};
		
		selectedFields.forEach(field => {
			const value = account[field as keyof AccountWithDevice];
			
			// Handle dates - keep as ISO strings for JSON
			if (field.includes('Timestamp') || field.includes('At')) {
				filtered[field] = value ? (value as Date).toISOString() : undefined;
			} else {
				filtered[field] = value ?? undefined;
			}
		});
		
		return filtered;
	});

	if (includeMetadata) {
		return JSON.stringify({
			metadata: {
				exportDate: new Date().toISOString(),
				recordCount: accounts.length,
				fields: selectedFields,
				format: 'instagram-account-export-v1'
			},
			accounts: filteredAccounts
		}, null, 2);
	}

	return JSON.stringify(filteredAccounts, null, 2);
}

/**
 * Generate export filename
 */
export function generateExportFilename(
	format: ExportFormat,
	recordCount: number,
	prefix: string = 'ig-accounts'
): string {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
	const extension = format === 'csv' ? 'csv' : 'json';
	return `${prefix}-${recordCount}-records-${timestamp}.${extension}`;
}

/**
 * Create downloadable blob from export data
 */
export function createExportBlob(data: string, format: ExportFormat): Blob {
	const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
	return new Blob([data], { type: mimeType });
}

/**
 * Download export file in browser
 */
export function downloadExportFile(
	data: string,
	filename: string,
	format: ExportFormat
): void {
	const blob = createExportBlob(data, format);
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	
	// Clean up the blob URL
	URL.revokeObjectURL(url);
}

/**
 * Validate export configuration
 */
export function validateExportConfig(config: Partial<ExportConfig>): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Check if format is valid
	if (!config.format) {
		errors.push('Export format is required');
	} else if (!['csv', 'json'].includes(config.format)) {
		errors.push('Export format must be CSV or JSON');
	}

	// Check if at least one field is selected
	if (!config.fields) {
		errors.push('Field selection is required');
	} else {
		const selectedFields = Object.values(config.fields).filter(Boolean);
		if (selectedFields.length === 0) {
			errors.push('At least one field must be selected for export');
		}
	}

	// Validate date range if provided
	if (config.dateRange) {
		if (!config.dateRange.from || !config.dateRange.to) {
			errors.push('Both start and end dates are required for date range filtering');
		} else if (config.dateRange.from > config.dateRange.to) {
			errors.push('Start date cannot be after end date');
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Estimate export file size (rough approximation)
 */
export function estimateExportSize(
	recordCount: number,
	fields: ExportableFields,
	format: ExportFormat
): {
	size: number;
	unit: string;
	displaySize: string;
} {
	const selectedFieldCount = Object.values(fields).filter(Boolean).length;
	
	// Rough estimates based on average field lengths
	const avgFieldSize = format === 'csv' ? 25 : 35; // JSON has more overhead
	const headerSize = format === 'csv' ? 200 : 500; // Headers and metadata
	
	const estimatedBytes = (recordCount * selectedFieldCount * avgFieldSize) + headerSize;
	
	let size: number;
	let unit: string;
	
	if (estimatedBytes < 1024) {
		size = estimatedBytes;
		unit = 'B';
	} else if (estimatedBytes < 1024 * 1024) {
		size = estimatedBytes / 1024;
		unit = 'KB';
	} else {
		size = estimatedBytes / (1024 * 1024);
		unit = 'MB';
	}
	
	return {
		size: Math.round(size * 100) / 100,
		unit,
		displaySize: `${Math.round(size * 100) / 100} ${unit}`
	};
}

/**
 * Check if export will be large (>1MB)
 */
export function isLargeExport(recordCount: number, fields: ExportableFields): boolean {
	const estimate = estimateExportSize(recordCount, fields, 'json');
	return estimate.size > 1 && estimate.unit === 'MB';
}

/**
 * Get recommended batch size for large exports
 */
export function getRecommendedBatchSize(recordCount: number): number {
	if (recordCount <= 1000) return recordCount;
	if (recordCount <= 5000) return 1000;
	if (recordCount <= 10000) return 2000;
	return 5000;
}

/**
 * Split large dataset into batches
 */
export function createExportBatches<T>(
	data: T[],
	batchSize: number
): T[][] {
	const batches: T[][] = [];
	
	for (let i = 0; i < data.length; i += batchSize) {
		batches.push(data.slice(i, i + batchSize));
	}
	
	return batches;
}