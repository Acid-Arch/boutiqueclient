import { z } from 'zod';
import { accountSchema, type AccountFormData, importAccountSchema, type ImportAccountData } from './validation.js';
import { ACCOUNT_STATUSES } from '$lib/utils/status.js';
import { createAccount } from '$lib/server/db-loader.js';

// Import result types
export interface ImportValidationResult {
	success: boolean;
	data?: ImportRecord[];
	errors?: ImportError[];
	summary?: ImportSummary;
}

export interface ImportRecord {
	rowNumber: number;
	data: ImportAccountData;
	valid: boolean;
	errors: string[];
	isDuplicate?: boolean;
	duplicateOf?: string;
}

export interface ImportError {
	rowNumber: number;
	field?: string;
	message: string;
	severity: 'error' | 'warning';
	value?: unknown;
}

export interface ImportSummary {
	totalRows: number;
	validRows: number;
	errorRows: number;
	duplicateRows: number;
	warningCount: number;
	fieldsDetected: string[];
	estimatedImportTime?: string;
}

export interface ImportProgress {
	currentRow: number;
	totalRows: number;
	successCount: number;
	errorCount: number;
	phase: 'parsing' | 'validating' | 'importing' | 'complete';
	message?: string;
}

// CSV parsing configuration
export interface CSVParseOptions {
	delimiter: ',' | ';' | '\t';
	hasHeader: boolean;
	trimWhitespace: boolean;
	skipEmptyRows: boolean;
	maxRows?: number;
}

// Default CSV options
export const DEFAULT_CSV_OPTIONS: CSVParseOptions = {
	delimiter: ',',
	hasHeader: true,
	trimWhitespace: true,
	skipEmptyRows: true,
	maxRows: 10000 // Prevent huge imports
};

// Column mapping for import
export interface ColumnMapping {
	[csvColumn: string]: keyof ImportAccountData | null;
}

// Standard column mappings (case-insensitive)
export const STANDARD_COLUMN_MAPPINGS: Record<string, keyof ImportAccountData> = {
	// Instagram username variations
	'instagram_username': 'instagramUsername',
	'ig_username': 'instagramUsername',
	'username': 'instagramUsername',
	'user': 'instagramUsername',
	'account': 'instagramUsername',
	
	// Instagram password variations
	'instagram_password': 'instagramPassword',
	'ig_password': 'instagramPassword',
	'password': 'instagramPassword',
	'pass': 'instagramPassword',
	
	// Email address variations
	'email_address': 'emailAddress',
	'email': 'emailAddress',
	'mail': 'emailAddress',
	'e_mail': 'emailAddress',
	
	// Email password variations
	'email_password': 'emailPassword',
	'email_pass': 'emailPassword',
	'mail_password': 'emailPassword',
	'mail_pass': 'emailPassword',
	
	// Status variations
	'status': 'status',
	'account_status': 'status',
	'state': 'status',
	
	// IMAP status variations
	'imap_status': 'imapStatus',
	'imap': 'imapStatus',
	
	// Device assignment variations
	'assigned_device_id': 'assignedDeviceId',
	'device_id': 'assignedDeviceId',
	'device': 'assignedDeviceId',
	
	'assigned_clone_number': 'assignedCloneNumber',
	'clone_number': 'assignedCloneNumber',
	'clone': 'assignedCloneNumber',
	
	'assigned_package_name': 'assignedPackageName',
	'package_name': 'assignedPackageName',
	'package': 'assignedPackageName',
	
	// Record ID variations
	'record_id': 'recordId',
	'id': 'recordId',
	'external_id': 'recordId'
};

/**
 * Parse CSV content into rows
 */
export function parseCSV(content: string, options: CSVParseOptions = DEFAULT_CSV_OPTIONS): {
	success: boolean;
	headers?: string[];
	rows?: string[][];
	error?: string;
} {
	try {
		const lines = content.split('\n');
		if (lines.length === 0) {
			return { success: false, error: 'CSV file is empty' };
		}

		let headers: string[] = [];
		let dataLines = lines;

		// Extract headers if specified
		if (options.hasHeader && lines.length > 0) {
			const headerLine = lines[0];
			headers = parseCsvLine(headerLine, options.delimiter);
			dataLines = lines.slice(1);
		}

		// Parse data rows
		const rows: string[][] = [];
		let rowNumber = options.hasHeader ? 2 : 1; // Line numbers for error reporting

		for (const line of dataLines) {
			const trimmedLine = options.trimWhitespace ? line.trim() : line;
			
			// Skip empty rows if configured
			if (options.skipEmptyRows && !trimmedLine) {
				continue;
			}

			// Check max rows limit
			if (options.maxRows && rows.length >= options.maxRows) {
				break;
			}

			const parsedRow = parseCsvLine(trimmedLine, options.delimiter);
			
			// Skip completely empty rows
			if (parsedRow.length === 0 || parsedRow.every(cell => !cell.trim())) {
				if (!options.skipEmptyRows) {
					rows.push(parsedRow);
				}
				continue;
			}

			if (options.trimWhitespace) {
				parsedRow.forEach((cell, index) => {
					parsedRow[index] = cell.trim();
				});
			}

			rows.push(parsedRow);
			rowNumber++;
		}

		return {
			success: true,
			headers: headers.length > 0 ? headers : undefined,
			rows
		};

	} catch (error) {
		return {
			success: false,
			error: `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
		};
	}
}

/**
 * Parse a single CSV line handling quotes and escapes
 */
function parseCsvLine(line: string, delimiter: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;
	let i = 0;

	while (i < line.length) {
		const char = line[i];
		const nextChar = line[i + 1];

		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				// Escaped quote
				current += '"';
				i += 2;
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
				i++;
			}
		} else if (char === delimiter && !inQuotes) {
			// Field separator
			result.push(current);
			current = '';
			i++;
		} else {
			current += char;
			i++;
		}
	}

	// Add the last field
	result.push(current);
	return result;
}

/**
 * Auto-detect column mapping based on headers
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
	const mapping: ColumnMapping = {};

	headers.forEach(header => {
		const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, '_');
		
		// Check for exact matches first
		if (STANDARD_COLUMN_MAPPINGS[normalizedHeader]) {
			mapping[header] = STANDARD_COLUMN_MAPPINGS[normalizedHeader];
			return;
		}

		// Check for partial matches
		for (const [pattern, field] of Object.entries(STANDARD_COLUMN_MAPPINGS)) {
			if (normalizedHeader.includes(pattern) || pattern.includes(normalizedHeader)) {
				mapping[header] = field;
				return;
			}
		}

		// No match found
		mapping[header] = null;
	});

	return mapping;
}

/**
 * Convert CSV row to account data using column mapping
 */
function convertRowToAccountData(
	row: string[],
	headers: string[],
	mapping: ColumnMapping,
	rowNumber: number
): {
	data: Partial<ImportAccountData>;
	errors: ImportError[];
} {
	const data: Partial<ImportAccountData> = {};
	const errors: ImportError[] = [];

	// Process each column
	headers.forEach((header, index) => {
		const fieldName = mapping[header] as string;
		if (!fieldName) return; // Skip unmapped columns

		const value = row[index] || '';

		try {
			// Convert value based on field type
			switch (fieldName) {
				case 'assignedCloneNumber':
					if (value) {
						const num = parseInt(value, 10);
						if (isNaN(num)) {
							errors.push({
								rowNumber,
								field: fieldName,
								message: `Invalid number: "${value}"`,
								severity: 'error',
								value
							});
						} else {
							data[fieldName] = num;
						}
					}
					break;

				case 'status':
					if (value) {
						if (ACCOUNT_STATUSES.includes(value as any)) {
							data[fieldName] = value as any;
						} else {
							errors.push({
								rowNumber,
								field: fieldName,
								message: `Invalid status: "${value}". Must be one of: ${ACCOUNT_STATUSES.join(', ')}`,
								severity: 'error',
								value
							});
						}
					}
					break;

				case 'imapStatus':
					if (value) {
						if (['On', 'Off'].includes(value)) {
							data[fieldName] = value as 'On' | 'Off';
						} else {
							errors.push({
								rowNumber,
								field: fieldName,
								message: `Invalid IMAP status: "${value}". Must be "On" or "Off"`,
								severity: 'error',
								value
							});
						}
					}
					break;

				default:
					// String fields
					if (value) {
						(data as any)[fieldName] = value;
					}
					break;
			}
		} catch (error) {
			errors.push({
				rowNumber,
				field: fieldName,
				message: `Error processing field: ${error instanceof Error ? error.message : 'Unknown error'}`,
				severity: 'error',
				value
			});
		}
	});

	return { data, errors };
}

/**
 * Validate import data using existing validation schema
 */
export function validateImportData(
	rows: string[][],
	headers: string[],
	mapping: ColumnMapping,
	existingUsernames?: Set<string>
): ImportValidationResult {
	const importRecords: ImportRecord[] = [];
	const allErrors: ImportError[] = [];
	const detectedUsernames = new Set<string>();
	const duplicatesInFile = new Set<string>();

	// Process each row
	rows.forEach((row, index) => {
		const rowNumber = index + 2; // Account for header row and 1-based indexing
		const { data, errors: conversionErrors } = convertRowToAccountData(row, headers, mapping, rowNumber);

		// Add conversion errors
		allErrors.push(...conversionErrors);

		// Validate using account schema if we have required fields
		const validationErrors: string[] = [];
		
		if (data.instagramUsername || data.instagramPassword || data.emailAddress || data.emailPassword) {
			try {
				// Create validation data in the format expected by accountSchema
				const validationData = {
					igUsername: data.instagramUsername || '',
					igPassword: data.instagramPassword || '',
					emailAddress: data.emailAddress || '',
					emailPassword: data.emailPassword || '',
					status: data.status || 'Unused',
					deviceId: data.assignedDeviceId ? parseInt(data.assignedDeviceId) : undefined
				};

				const result = accountSchema.safeParse(validationData);
				
				if (!result.success) {
					result.error.issues.forEach((error: any) => {
						validationErrors.push(`${error.path.join('.')}: ${error.message}`);
						allErrors.push({
							rowNumber,
							field: error.path[0] as string,
							message: error.message,
							severity: 'error',
							value: error.input
						});
					});
				}
			} catch (error) {
				validationErrors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		}

		// Check for duplicates within the file
		if (data.instagramUsername) {
			if (detectedUsernames.has(data.instagramUsername)) {
				duplicatesInFile.add(data.instagramUsername);
				validationErrors.push(`Duplicate username in file: ${data.instagramUsername}`);
				allErrors.push({
					rowNumber,
					field: 'instagramUsername',
					message: `Duplicate username in import file: ${data.instagramUsername}`,
					severity: 'error',
					value: data.instagramUsername
				});
			} else {
				detectedUsernames.add(data.instagramUsername);
			}

			// Check for duplicates with existing data
			if (existingUsernames?.has(data.instagramUsername)) {
				validationErrors.push(`Username already exists: ${data.instagramUsername}`);
				allErrors.push({
					rowNumber,
					field: 'instagramUsername',
					message: `Username already exists in database: ${data.instagramUsername}`,
					severity: 'error',
					value: data.instagramUsername
				});
			}
		}

		// Create import record
		const importRecord: ImportRecord = {
			rowNumber,
			data: data as ImportAccountData,
			valid: validationErrors.length === 0 && conversionErrors.length === 0,
			errors: validationErrors,
			isDuplicate: data.instagramUsername ? duplicatesInFile.has(data.instagramUsername) : false
		};

		importRecords.push(importRecord);
	});

	// Generate summary
	const summary: ImportSummary = {
		totalRows: rows.length,
		validRows: importRecords.filter(r => r.valid).length,
		errorRows: importRecords.filter(r => !r.valid).length,
		duplicateRows: importRecords.filter(r => r.isDuplicate).length,
		warningCount: allErrors.filter(e => e.severity === 'warning').length,
		fieldsDetected: Object.keys(mapping).filter(key => mapping[key] !== null),
		estimatedImportTime: estimateImportTime(importRecords.filter(r => r.valid).length)
	};

	return {
		success: allErrors.filter(e => e.severity === 'error').length === 0,
		data: importRecords,
		errors: allErrors,
		summary
	};
}

/**
 * Estimate import time based on record count
 */
function estimateImportTime(recordCount: number): string {
	if (recordCount === 0) return '0 seconds';
	
	// Rough estimate: ~50-100 records per second for database operations
	const estimatedSeconds = Math.ceil(recordCount / 75);
	
	if (estimatedSeconds < 60) {
		return `${estimatedSeconds} seconds`;
	} else if (estimatedSeconds < 3600) {
		const minutes = Math.ceil(estimatedSeconds / 60);
		return `${minutes} minute${minutes > 1 ? 's' : ''}`;
	} else {
		const hours = Math.ceil(estimatedSeconds / 3600);
		return `${hours} hour${hours > 1 ? 's' : ''}`;
	}
}

/**
 * Validate file before processing
 */
export function validateImportFile(file: File): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Check file size (max 10MB)
	const maxSizeBytes = 10 * 1024 * 1024;
	if (file.size > maxSizeBytes) {
		errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size of 10MB`);
	}

	// Check file type
	const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
	const allowedExtensions = ['.csv', '.txt'];
	
	const hasValidType = allowedTypes.includes(file.type);
	const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
	
	if (!hasValidType && !hasValidExtension) {
		errors.push('File must be a CSV file (.csv extension)');
	}

	// Check filename
	if (file.name.length > 255) {
		errors.push('Filename is too long (maximum 255 characters)');
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Read file content as text
 */
export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				resolve(reader.result);
			} else {
				reject(new Error('Failed to read file as text'));
			}
		};
		
		reader.onerror = () => {
			reject(new Error('Error reading file'));
		};
		
		reader.readAsText(file, 'utf-8');
	});
}

/**
 * Process import file end-to-end
 */
export async function processImportFile(
	file: File,
	options: CSVParseOptions = DEFAULT_CSV_OPTIONS,
	existingUsernames?: Set<string>
): Promise<ImportValidationResult> {
	try {
		// Validate file
		const fileValidation = validateImportFile(file);
		if (!fileValidation.valid) {
			return {
				success: false,
				errors: fileValidation.errors.map((message, index) => ({
					rowNumber: 0,
					message,
					severity: 'error' as const
				}))
			};
		}

		// Read file content
		const content = await readFileAsText(file);
		
		// Parse CSV
		const parseResult = parseCSV(content, options);
		if (!parseResult.success || !parseResult.rows) {
			return {
				success: false,
				errors: [{
					rowNumber: 0,
					message: parseResult.error || 'Failed to parse CSV file',
					severity: 'error'
				}]
			};
		}

		// Auto-detect column mapping if headers are available
		let mapping: ColumnMapping = {};
		let headers: string[] = [];

		if (parseResult.headers && parseResult.headers.length > 0) {
			headers = parseResult.headers;
			mapping = autoDetectColumnMapping(headers);
		} else {
			return {
				success: false,
				errors: [{
					rowNumber: 0,
					message: 'No headers detected. Please ensure your CSV file has a header row.',
					severity: 'error'
				}]
			};
		}

		// Validate data
		return validateImportData(parseResult.rows, headers, mapping, existingUsernames);

	} catch (error) {
		return {
			success: false,
			errors: [{
				rowNumber: 0,
				message: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				severity: 'error'
			}]
		};
	}
}

/**
 * Get sample CSV template
 */
export function generateCSVTemplate(): string {
	const headers = [
		'instagram_username',
		'instagram_password', 
		'email_address',
		'email_password',
		'status',
		'imap_status'
	];

	const sampleRows = [
		['your_instagram_username', 'your_instagram_password', 'your_email@domain.com', 'your_email_password', 'Unused', 'On'],
		['another_username', 'another_password', 'another_email@domain.com', 'another_email_password', 'Unused', 'On']
	];

	const csvLines = [
		headers.join(','),
		...sampleRows.map(row => row.join(','))
	];

	return csvLines.join('\n');
}

/**
 * Download CSV template
 */
export function downloadCSVTemplate(): void {
	const content = generateCSVTemplate();
	const blob = new Blob([content], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	
	const a = document.createElement('a');
	a.href = url;
	a.download = 'instagram-accounts-import-template.csv';
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	
	URL.revokeObjectURL(url);
}