import { json } from '@sveltejs/kit';
import { getPrisma } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';
import type { ExportConfig, AccountWithDevice } from '$lib/utils/export.js';
import { 
	convertToCSV, 
	convertToJSON, 
	generateExportFilename,
	validateExportConfig,
	createExportBatches,
	getRecommendedBatchSize,
	isLargeExport
} from '$lib/utils/export.js';

// POST /api/export - Export accounts based on configuration
export const POST: RequestHandler = async ({ request }) => {
	try {
		const config: ExportConfig = await request.json();
		const prisma = await getPrisma();
		
		// Validate export configuration
		const validation = validateExportConfig(config);
		if (!validation.valid) {
			return json({
				success: false,
				error: `Invalid export configuration: ${validation.errors.join(', ')}`
			}, { status: 400 });
		}

		// Build where clause for filtering
		const where: any = {};
		
		// Apply status filter
		if (config.statusFilter) {
			where.status = config.statusFilter;
		}
		
		// Apply search query
		if (config.searchQuery) {
			where.OR = [
				{ instagramUsername: { contains: config.searchQuery, mode: 'insensitive' } },
				{ emailAddress: { contains: config.searchQuery, mode: 'insensitive' } }
			];
		}
		
		// Apply date range filter
		if (config.dateRange) {
			where.createdAt = {
				gte: config.dateRange.from,
				lte: config.dateRange.to
			};
		}

		// First, get count for estimation and batching
		const totalCount = await (prisma as any).igAccount.count({ where });
		
		if (totalCount === 0) {
			return json({
				success: false,
				error: 'No accounts match the specified filters'
			}, { status: 400 });
		}

		// Check if this is a large export that needs batching
		const needsBatching = isLargeExport(totalCount, config.fields);
		let accounts: AccountWithDevice[] = [];

		if (needsBatching) {
			// For large exports, process in batches to prevent memory issues
			const batchSize = getRecommendedBatchSize(totalCount);
			let skip = 0;
			
			while (skip < totalCount) {
				const batchAccounts = await (prisma as any).igAccount.findMany({
					where,
					orderBy: { createdAt: 'desc' },
					take: batchSize,
					skip,
					include: {
						// Only include device info if device fields are selected
						...(config.fields.assignedDeviceId || config.fields.assignedCloneNumber || config.fields.assignedPackageName ? {
							// Note: In a real scenario, you'd join with CloneInventory table
							// For now, we'll just include the basic assignment info
						} : {})
					}
				});
				
				accounts.push(...batchAccounts as AccountWithDevice[]);
				skip += batchSize;
				
				// Prevent infinite loops
				if (batchAccounts.length === 0) break;
			}
		} else {
			// For smaller exports, get all data at once
			accounts = await (prisma as any).igAccount.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				include: {
					// Only include device info if device fields are selected
					...(config.fields.assignedDeviceId || config.fields.assignedCloneNumber || config.fields.assignedPackageName ? {
						// Note: In a real scenario, you'd join with CloneInventory table
					} : {})
				}
			}) as AccountWithDevice[];
		}

		// If we have device assignment fields selected, enrich with device data
		if (config.fields.assignedDeviceId || config.fields.assignedCloneNumber || config.fields.assignedPackageName) {
			const deviceIds = accounts
				.map(account => account.assignedDeviceId)
				.filter((id): id is string => Boolean(id));

			if (deviceIds.length > 0) {
				const deviceData = await (prisma as any).cloneInventory.findMany({
					where: {
						deviceId: { in: deviceIds }
					},
					select: {
						deviceId: true,
						deviceName: true,
						packageName: true,
						cloneHealth: true,
						cloneNumber: true
					}
				});

				// Create a map for quick lookup
				const deviceMap = new Map(
					deviceData.map((device: any) => [`${device.deviceId}-${device.cloneNumber}`, device])
				);

				// Enrich accounts with device data
				accounts = accounts.map(account => {
					if (account.assignedDeviceId && account.assignedCloneNumber !== null) {
						const deviceKey = `${account.assignedDeviceId}-${account.assignedCloneNumber}`;
						const deviceInfo = deviceMap.get(deviceKey);
						
						if (deviceInfo) {
							return {
								...account,
								assignedDevice: {
									deviceName: (deviceInfo as any).deviceName,
									packageName: (deviceInfo as any).packageName,
									cloneHealth: (deviceInfo as any).cloneHealth
								}
							};
						}
					}
					return account;
				});
			}
		}

		// Generate export data based on format
		let exportData: string;
		let filename: string;

		if (config.format === 'csv') {
			exportData = convertToCSV(accounts, config.fields, config.includeHeaders);
			filename = generateExportFilename('csv', accounts.length, 'ig-accounts');
		} else {
			exportData = convertToJSON(accounts, config.fields, true);
			filename = generateExportFilename('json', accounts.length, 'ig-accounts');
		}

		// Log export activity (optional - for audit trail)
		console.log(`Export completed: ${accounts.length} accounts exported in ${config.format.toUpperCase()} format`);

		return json({
			success: true,
			data: exportData,
			filename,
			recordCount: accounts.length,
			metadata: {
				format: config.format,
				timestamp: new Date().toISOString(),
				totalRecords: accounts.length,
				fieldsExported: Object.entries(config.fields)
					.filter(([_, selected]) => selected)
					.map(([field, _]) => field),
				filtersApplied: {
					status: config.statusFilter || null,
					search: config.searchQuery || null,
					dateRange: config.dateRange || null
				}
			}
		});

	} catch (error) {
		console.error('Export failed:', error);
		
		// Return specific error messages for common issues
		if (error instanceof Error) {
			if (error.message.includes('timeout')) {
				return json({
					success: false,
					error: 'Export timed out. Please try exporting a smaller dataset or contact support.'
				}, { status: 408 });
			}
			
			if (error.message.includes('memory')) {
				return json({
					success: false,
					error: 'Export dataset too large. Please apply additional filters to reduce the data size.'
				}, { status: 413 });
			}
		}

		return json({
			success: false,
			error: 'Export failed due to an internal error. Please try again.'
		}, { status: 500 });
	}
};

// GET /api/export/stats - Get export statistics for the UI
export const GET: RequestHandler = async ({ url }) => {
	try {
		const prisma = await getPrisma();
		const statusFilter = url.searchParams.get('status') || undefined;
		const searchQuery = url.searchParams.get('search') || undefined;
		
		// Build where clause
		const where: any = {};
		if (statusFilter) {
			where.status = statusFilter;
		}
		if (searchQuery) {
			where.OR = [
				{ instagramUsername: { contains: searchQuery, mode: 'insensitive' } },
				{ emailAddress: { contains: searchQuery, mode: 'insensitive' } }
			];
		}

		// Get total count and date range
		const [totalCount, oldestAccount, newestAccount] = await Promise.all([
			(prisma as any).igAccount.count({ where }),
			(prisma as any).igAccount.findFirst({
				where,
				orderBy: { createdAt: 'asc' },
				select: { createdAt: true }
			}),
			(prisma as any).igAccount.findFirst({
				where,
				orderBy: { createdAt: 'desc' },
				select: { createdAt: true }
			})
		]);

		// Get status breakdown
		const statusBreakdown = await (prisma as any).igAccount.groupBy({
			by: ['status'],
			where: searchQuery ? {
				OR: [
					{ instagramUsername: { contains: searchQuery, mode: 'insensitive' } },
					{ emailAddress: { contains: searchQuery, mode: 'insensitive' } }
				]
			} : {},
			_count: {
				status: true
			}
		});

		const statusCounts = statusBreakdown.reduce((acc: any, item: any) => {
			acc[item.status] = item._count.status;
			return acc;
		}, {} as Record<string, number>);

		return json({
			success: true,
			data: {
				totalRecords: totalCount,
				dateRange: {
					oldest: oldestAccount?.createdAt || null,
					newest: newestAccount?.createdAt || null
				},
				statusBreakdown: statusCounts,
				hasData: totalCount > 0
			}
		});

	} catch (error) {
		console.error('Failed to get export stats:', error);
		return json({
			success: false,
			error: 'Failed to retrieve export statistics'
		}, { status: 500 });
	}
};