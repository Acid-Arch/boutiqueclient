import { json } from '@sveltejs/kit';
import { prisma } from '$lib/server/db-loader.js';
import { createAccount, checkUsernameExists } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';
import type { ImportRecord } from '$lib/utils/import.js';

// Interface for batch import progress
interface ImportProgress {
	phase: 'starting' | 'validating' | 'importing' | 'complete';
	current: number;
	total: number;
	successCount: number;
	errorCount: number;
	errors: string[];
	message?: string;
}

// POST /api/import - Import accounts from validated data
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { records }: { records: ImportRecord[] } = await request.json();
		
		if (!records || !Array.isArray(records)) {
			return json({
				success: false,
				error: 'Invalid import data. Expected array of records.'
			}, { status: 400 });
		}

		if (records.length === 0) {
			return json({
				success: false,
				error: 'No records provided for import.'
			}, { status: 400 });
		}

		// Filter only valid records
		const validRecords = records.filter(record => record.valid);
		
		if (validRecords.length === 0) {
			return json({
				success: false,
				error: 'No valid records found for import.'
			}, { status: 400 });
		}

		// Initialize progress tracking
		const progress: ImportProgress = {
			phase: 'starting',
			current: 0,
			total: validRecords.length,
			successCount: 0,
			errorCount: 0,
			errors: [],
			message: 'Starting import...'
		};

		const importResults = {
			imported: 0,
			errors: [] as string[],
			duplicatesSkipped: 0,
			partialSuccess: false
		};

		// Pre-validate all usernames to catch duplicates
		progress.phase = 'validating';
		progress.message = 'Validating usernames...';

		const usernamesToCheck = validRecords
			.map(record => record.data.instagramUsername)
			.filter((username): username is string => Boolean(username));

		// Check for existing usernames in database
		const existingAccounts = await (prisma as any).igAccount.findMany({
			where: {
				instagramUsername: { in: usernamesToCheck }
			},
			select: { instagramUsername: true }
		});

		const existingUsernames = new Set(existingAccounts.map((account: any) => account.instagramUsername));

		// Filter out records with existing usernames
		const recordsToImport = validRecords.filter(record => {
			if (record.data.instagramUsername && existingUsernames.has(record.data.instagramUsername)) {
				importResults.duplicatesSkipped++;
				importResults.errors.push(
					`Row ${record.rowNumber}: Username '${record.data.instagramUsername}' already exists`
				);
				return false;
			}
			return true;
		});

		if (recordsToImport.length === 0) {
			return json({
				success: false,
				error: 'All records contain duplicate usernames.',
				duplicatesSkipped: importResults.duplicatesSkipped
			}, { status: 400 });
		}

		// Start importing records
		progress.phase = 'importing';
		progress.total = recordsToImport.length;

		// Batch size for database operations (prevent overwhelming the DB)
		const batchSize = 50;
		const batches = [];

		for (let i = 0; i < recordsToImport.length; i += batchSize) {
			batches.push(recordsToImport.slice(i, i + batchSize));
		}

		// Process each batch
		for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
			const batch = batches[batchIndex];
			
			progress.message = `Processing batch ${batchIndex + 1} of ${batches.length}...`;
			
			try {
				// Use transaction for each batch to ensure data consistency
				await (prisma as any).$transaction(async (tx: any) => {
					for (const record of batch) {
						try {
							// Double-check for duplicates (race condition protection)
							const existingCheck = await tx.igAccount.findFirst({
								where: { instagramUsername: record.data.instagramUsername }
							});

							if (existingCheck) {
								importResults.duplicatesSkipped++;
								importResults.errors.push(
									`Row ${record.rowNumber}: Username '${record.data.instagramUsername}' was created by another process`
								);
								progress.current++;
								continue;
							}

							// Create the account
							await tx.igAccount.create({
								data: {
									recordId: record.data.recordId,
									instagramUsername: record.data.instagramUsername!,
									instagramPassword: record.data.instagramPassword!,
									emailAddress: record.data.emailAddress!,
									emailPassword: record.data.emailPassword!,
									status: record.data.status || 'Unused',
									imapStatus: record.data.imapStatus || 'On',
									assignedDeviceId: record.data.assignedDeviceId,
									assignedCloneNumber: record.data.assignedCloneNumber,
									assignedPackageName: record.data.assignedPackageName,
									assignmentTimestamp: record.data.assignedDeviceId ? new Date() : null
								}
							});

							importResults.imported++;
							progress.successCount++;

						} catch (error) {
							importResults.errors.push(
								`Row ${record.rowNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
							);
							progress.errorCount++;
						}

						progress.current++;
					}
				}, {
					timeout: 30000 // 30 second timeout per batch
				});

			} catch (batchError) {
				// If entire batch fails, mark all records in batch as failed
				for (const record of batch) {
					if (progress.current < progress.total) {
						importResults.errors.push(
							`Row ${record.rowNumber}: Batch processing failed - ${batchError instanceof Error ? batchError.message : 'Unknown error'}`
						);
						progress.errorCount++;
						progress.current++;
					}
				}
			}

			// Add small delay between batches to prevent overwhelming the database
			if (batchIndex < batches.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}

		progress.phase = 'complete';
		progress.message = 'Import completed';

		// Determine success status
		const hasSuccessfulImports = importResults.imported > 0;
		const hasErrors = importResults.errors.length > 0;
		const isPartialSuccess = hasSuccessfulImports && hasErrors;

		// Log import activity
		console.log(`Import completed: ${importResults.imported} accounts imported, ${importResults.errors.length} errors, ${importResults.duplicatesSkipped} duplicates skipped`);

		const response = {
			success: hasSuccessfulImports,
			imported: importResults.imported,
			errors: importResults.errors,
			duplicatesSkipped: importResults.duplicatesSkipped,
			partialSuccess: isPartialSuccess,
			summary: {
				totalProcessed: progress.current,
				successful: progress.successCount,
				failed: progress.errorCount,
				duplicatesSkipped: importResults.duplicatesSkipped
			}
		};

		// Return appropriate status code
		if (!hasSuccessfulImports) {
			return json(response, { status: 400 });
		} else if (isPartialSuccess) {
			return json(response, { status: 207 }); // Multi-status
		} else {
			return json(response, { status: 201 }); // Created
		}

	} catch (error) {
		console.error('Import failed:', error);
		
		// Handle specific database errors
		if (error instanceof Error) {
			if (error.message.includes('timeout')) {
				return json({
					success: false,
					error: 'Import timed out. Please try importing a smaller dataset or contact support.'
				}, { status: 408 });
			}
			
			if (error.message.includes('constraint')) {
				return json({
					success: false,
					error: 'Database constraint violation. Please check for duplicate usernames or invalid data.'
				}, { status: 409 });
			}

			if (error.message.includes('connection')) {
				return json({
					success: false,
					error: 'Database connection error. Please try again in a moment.'
				}, { status: 503 });
			}
		}

		return json({
			success: false,
			error: 'Import failed due to an internal error. Please try again.'
		}, { status: 500 });
	}
};

// GET /api/import/validate - Validate usernames against existing accounts
export const GET: RequestHandler = async ({ url }) => {
	try {
		const usernames = url.searchParams.get('usernames');
		
		if (!usernames) {
			return json({
				success: false,
				error: 'No usernames provided for validation'
			}, { status: 400 });
		}

		const usernameList = usernames.split(',').map(u => u.trim()).filter(Boolean);
		
		if (usernameList.length === 0) {
			return json({
				success: true,
				data: {
					existing: [],
					available: []
				}
			});
		}

		// Limit validation to prevent abuse
		if (usernameList.length > 1000) {
			return json({
				success: false,
				error: 'Too many usernames for validation (max 1000)'
			}, { status: 400 });
		}

		// Check which usernames already exist
		const existingAccounts = await (prisma as any).igAccount.findMany({
			where: {
				instagramUsername: { in: usernameList }
			},
			select: { instagramUsername: true }
		});

		const existingUsernames = existingAccounts.map((account: any) => account.instagramUsername);
		const availableUsernames = usernameList.filter(username => 
			!existingUsernames.includes(username)
		);

		return json({
			success: true,
			data: {
				existing: existingUsernames,
				available: availableUsernames,
				totalChecked: usernameList.length,
				duplicateCount: existingUsernames.length
			}
		});

	} catch (error) {
		console.error('Username validation failed:', error);
		return json({
			success: false,
			error: 'Failed to validate usernames'
		}, { status: 500 });
	}
};

// Template download functionality moved to existing GET handler with ?template parameter
