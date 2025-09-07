import { json, error } from '@sveltejs/kit';
import { getPrisma, type AccountStatus, ACCOUNT_STATUSES } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types.js';
import type { PrismaClient } from '@prisma/client';

interface BulkOperationRequest {
	operation: 'updateStatus' | 'assignDevices' | 'export' | 'delete';
	accountIds: number[];
	newStatus?: AccountStatus;
	assignmentMode?: 'auto' | 'specific';
	autoAssignmentStrategy?: 'round-robin' | 'fill-first' | 'capacity-based' | 'balanced-load' | 'optimal-distribution';
	deviceId?: string;
	preferredDeviceIds?: string[];
	excludeDeviceIds?: string[];
	maxAccountsPerDevice?: number;
	allowPartialAssignment?: boolean;
	format?: 'csv' | 'json';
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: BulkOperationRequest = await request.json();
		const { operation, accountIds } = body;

		if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
			throw error(400, 'No account IDs provided');
		}

		// Initialize prisma
		const prisma = await getPrisma();

		// Verify account IDs exist
		const existingAccounts = await prisma.igAccount.findMany({
			where: { id: { in: accountIds } },
			select: { 
				id: true, 
				instagramUsername: true, 
				status: true, 
				assignedDeviceId: true,
				assignedCloneNumber: true,
				emailAddress: true,
				createdAt: true,
				updatedAt: true
			}
		});

		if (existingAccounts.length !== accountIds.length) {
			throw error(400, 'Some account IDs are invalid');
		}

		switch (operation) {
			case 'updateStatus':
				return await handleStatusUpdate(existingAccounts, body.newStatus!, prisma);
			
			case 'assignDevices':
				return await handleDeviceAssignment(existingAccounts, body, prisma);
			
			case 'export':
				return await handleExport(existingAccounts, body.format!, prisma);
			
			case 'delete':
				return await handleBulkDelete(accountIds, prisma);
			
			default:
				throw error(400, 'Invalid operation');
		}
	} catch (err) {
		console.error('Bulk operation error:', err);
		if (err instanceof Error) {
			throw error(500, err.message);
		}
		throw error(500, 'Internal server error');
	}
};

async function handleStatusUpdate(accounts: any[], newStatus: AccountStatus, prisma: any) {
	if (!ACCOUNT_STATUSES.includes(newStatus)) {
		throw error(400, 'Invalid status');
	}

	const errors: string[] = [];
	let updated = 0;

	try {
		// Prepare update data based on status
		const updateData: any = { status: newStatus, updatedAt: new Date() };
		
		if (newStatus === 'Logged In') {
			updateData.loginTimestamp = new Date();
		} else if (newStatus === 'Unused') {
			// Clear device assignments when marking as unused
			updateData.assignedDeviceId = null;
			updateData.assignedCloneNumber = null;
			updateData.assignedPackageName = null;
			updateData.assignmentTimestamp = null;
		}

		// Batch update all accounts
		const result = await prisma.igAccount.updateMany({
			where: { id: { in: accounts.map(a => a.id) } },
			data: updateData
		});

		updated = result.count;

		// If status is 'Unused', also update clone inventory
		if (newStatus === 'Unused') {
			const assignedClones = accounts.filter(a => a.assignedDeviceId && a.assignedCloneNumber);
			if (assignedClones.length > 0) {
				await prisma.cloneInventory.updateMany({
					where: {
						OR: assignedClones.map((account: any) => ({
							AND: [
								{ deviceId: account.assignedDeviceId },
								{ cloneNumber: account.assignedCloneNumber }
							]
						}))
					},
					data: {
						cloneStatus: 'Available',
						currentAccount: null,
						updatedAt: new Date()
					}
				});
			}
		}

	} catch (updateError) {
		console.error('Status update error:', updateError);
		errors.push('Failed to update some accounts');
	}

	return json({
		updated,
		errors,
		message: updated > 0 ? `Successfully updated ${updated} accounts` : 'No accounts were updated'
	});
}

async function handleDeviceAssignment(accounts: any[], options: BulkOperationRequest, prisma: any) {
	const { 
		assignmentMode = 'auto', 
		deviceId, 
		autoAssignmentStrategy = 'round-robin',
		preferredDeviceIds = [],
		excludeDeviceIds = [],
		maxAccountsPerDevice,
		allowPartialAssignment = false
	} = options;
	// Only assign to accounts that don't already have devices
	const unassignedAccounts = accounts.filter((account: any) => !account.assignedDeviceId);
	
	if (unassignedAccounts.length === 0) {
		return json({
			assigned: 0,
			errors: [],
			message: 'No unassigned accounts to process'
		});
	}

	// Get assignments using the specified strategy
	let assignments: Array<{account: any, clone: any}>;
	let errors: string[] = [];

	try {
		assignments = await getAssignments(unassignedAccounts, {
			assignmentMode,
			deviceId,
			strategy: autoAssignmentStrategy,
			preferredDeviceIds,
			excludeDeviceIds,
			maxAccountsPerDevice,
			allowPartialAssignment
		}, prisma);
	} catch (assignmentError: any) {
		if (allowPartialAssignment && assignmentError.message.includes('Insufficient capacity')) {
			// Try partial assignment
			try {
				assignments = await getPartialAssignments(unassignedAccounts, {
					assignmentMode,
					deviceId,
					strategy: autoAssignmentStrategy,
					preferredDeviceIds,
					excludeDeviceIds,
					maxAccountsPerDevice
				}, prisma);
				errors.push(`Partial assignment: Only ${assignments.length} of ${unassignedAccounts.length} accounts could be assigned`);
			} catch (partialError: any) {
				throw error(400, partialError.message);
			}
		} else {
			throw error(400, assignmentError.message);
		}
	}

	let assigned = 0;

	// Process assignments
	try {
		await prisma.$transaction(async (tx: PrismaClient) => {
			for (const { account, clone } of assignments) {
				// Update account
				await tx.igAccount.update({
					where: { id: account.id },
					data: {
						status: 'Assigned',
						assignedDeviceId: clone.deviceId,
						assignedCloneNumber: clone.cloneNumber,
						assignedPackageName: clone.packageName,
						assignmentTimestamp: new Date(),
						updatedAt: new Date()
					}
				});

				// Update clone
				await tx.cloneInventory.update({
					where: {
						deviceId_cloneNumber: {
							deviceId: clone.deviceId,
							cloneNumber: clone.cloneNumber
						}
					},
					data: {
						cloneStatus: 'Assigned',
						currentAccount: account.instagramUsername,
						updatedAt: new Date()
					}
				});

				assigned++;
			}
		});
	} catch (assignError) {
		console.error('Assignment error:', assignError);
		errors.push('Failed to assign some accounts to devices');
	}

	return json({
		assigned,
		errors,
		message: assigned > 0 ? `Successfully assigned ${assigned} accounts to devices` : 'No accounts were assigned'
	});
}

async function handleExport(accounts: any[], format: 'csv' | 'json', prisma: any) {
	// Get complete account data
	const completeAccounts = await prisma.igAccount.findMany({
		where: { id: { in: accounts.map(a => a.id) } },
		select: {
			id: true,
			instagramUsername: true,
			emailAddress: true,
			status: true,
			assignedDeviceId: true,
			assignedCloneNumber: true,
			assignedPackageName: true,
			assignmentTimestamp: true,
			loginTimestamp: true,
			createdAt: true,
			updatedAt: true
		}
	});

	if (format === 'csv') {
		// Generate CSV
		const headers = [
			'ID',
			'Username',
			'Email',
			'Status',
			'Device ID',
			'Clone Number',
			'Package Name',
			'Assignment Date',
			'Last Login',
			'Created',
			'Updated'
		];

		const rows = completeAccounts.map((account: any) => [
			account.id.toString(),
			account.instagramUsername,
			account.emailAddress,
			account.status,
			account.assignedDeviceId || '',
			account.assignedCloneNumber?.toString() || '',
			account.assignedPackageName || '',
			account.assignmentTimestamp?.toISOString() || '',
			account.loginTimestamp?.toISOString() || '',
			account.createdAt.toISOString(),
			account.updatedAt.toISOString()
		]);

		const csv = [headers, ...rows]
			.map(row => row.map((field: any) => `"${field}"`).join(','))
			.join('\n');

		return new Response(csv, {
			headers: {
				'Content-Type': 'text/csv',
				'Content-Disposition': `attachment; filename="accounts_${new Date().toISOString().split('T')[0]}.csv"`
			}
		});
	} else {
		// Generate JSON
		const jsonData = {
			exported_at: new Date().toISOString(),
			total_accounts: completeAccounts.length,
			accounts: completeAccounts
		};

		return new Response(JSON.stringify(jsonData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="accounts_${new Date().toISOString().split('T')[0]}.json"`
			}
		});
	}
}

async function handleBulkDelete(accountIds: number[], prisma: any) {
	const errors: string[] = [];
	let deleted = 0;

	try {
		// First, get accounts to be deleted to check for device assignments
		const accountsToDelete = await prisma.igAccount.findMany({
			where: { id: { in: accountIds } },
			select: { 
				id: true, 
				instagramUsername: true,
				assignedDeviceId: true, 
				assignedCloneNumber: true 
			}
		});

		await prisma.$transaction(async (tx: PrismaClient) => {
			// Free up clone assignments first  
			const assignedAccounts = accountsToDelete.filter((a: any) => a.assignedDeviceId && a.assignedCloneNumber);
			if (assignedAccounts.length > 0) {
				await tx.cloneInventory.updateMany({
					where: {
						OR: assignedAccounts.map((account: any) => ({
							AND: [
								{ deviceId: account.assignedDeviceId },
								{ cloneNumber: account.assignedCloneNumber }
							]
						}))
					},
					data: {
						cloneStatus: 'Available',
						currentAccount: null,
						updatedAt: new Date()
					}
				});
			}

			// Delete accounts
			const result = await tx.igAccount.deleteMany({
				where: { id: { in: accountIds } }
			});

			deleted = result.count;
		});

	} catch (deleteError) {
		console.error('Delete error:', deleteError);
		errors.push('Failed to delete some accounts');
	}

	return json({
		deleted,
		errors,
		message: deleted > 0 ? `Successfully deleted ${deleted} accounts` : 'No accounts were deleted'
	});
}

// Assignment strategy functions
interface AssignmentOptions {
	assignmentMode: 'auto' | 'specific';
	deviceId?: string;
	strategy: 'round-robin' | 'fill-first' | 'capacity-based' | 'balanced-load' | 'optimal-distribution';
	preferredDeviceIds?: string[];
	excludeDeviceIds?: string[];
	maxAccountsPerDevice?: number;
	allowPartialAssignment?: boolean;
}

async function getAssignments(
	accounts: any[], 
	options: AssignmentOptions,
	prisma: any
): Promise<Array<{account: any, clone: any}>> {
	const { assignmentMode, deviceId, strategy, preferredDeviceIds = [], excludeDeviceIds = [], maxAccountsPerDevice } = options;
	// Get available clones based on assignment mode and preferences
	const whereClause: any = {
		cloneStatus: 'Available'
	};
	
	if (assignmentMode === 'specific' && deviceId) {
		whereClause.deviceId = deviceId;
	} else if (preferredDeviceIds.length > 0) {
		whereClause.deviceId = { in: preferredDeviceIds };
	}
	
	// Exclude specific devices if specified
	if (excludeDeviceIds.length > 0) {
		if (whereClause.deviceId) {
			if (typeof whereClause.deviceId === 'string') {
				// Single device specified - check if it's not excluded
				if (excludeDeviceIds.includes(whereClause.deviceId)) {
					throw new Error('Specified device is in exclusion list');
				}
			} else if (whereClause.deviceId.in) {
				// Filter out excluded devices from preferred list
				whereClause.deviceId.in = whereClause.deviceId.in.filter((id: string) => !excludeDeviceIds.includes(id));
				if (whereClause.deviceId.in.length === 0) {
					throw new Error('All preferred devices are excluded');
				}
			}
		} else {
			whereClause.deviceId = { notIn: excludeDeviceIds };
		}
	}

	const availableClones = await prisma.cloneInventory.findMany({
		where: whereClause,
		orderBy: [
			{ deviceId: 'asc' },
			{ cloneNumber: 'asc' }
		]
	});

	if (availableClones.length === 0) {
		throw new Error('No available clones found');
	}

	// Apply maxAccountsPerDevice filter if specified
	let filteredClones = availableClones;
	if (maxAccountsPerDevice) {
		filteredClones = await applyDeviceCapacityLimits(availableClones, maxAccountsPerDevice, prisma);
	}

	if (filteredClones.length < accounts.length) {
		throw new Error(`Insufficient capacity. Need ${accounts.length} slots, but only ${filteredClones.length} available`);
	}

	// Apply assignment strategy
	switch (strategy) {
		case 'round-robin':
			return getRoundRobinAssignments(accounts, filteredClones, prisma);
		case 'fill-first':
			return getFillFirstAssignments(accounts, filteredClones, prisma);
		case 'capacity-based':
			return getCapacityBasedAssignments(accounts, filteredClones, prisma);
		case 'balanced-load':
			return getBalancedLoadAssignments(accounts, filteredClones, prisma);
		case 'optimal-distribution':
			return getOptimalDistributionAssignments(accounts, filteredClones, prisma);
		default:
			return getRoundRobinAssignments(accounts, filteredClones, prisma);
	}
}

// Round-robin strategy: Distribute accounts evenly across devices
async function getRoundRobinAssignments(accounts: any[], availableClones: any[], prisma: any): Promise<Array<{account: any, clone: any}>> {
	// Group clones by device
	const deviceClones = new Map<string, any[]>();
	for (const clone of availableClones) {
		if (!deviceClones.has(clone.deviceId)) {
			deviceClones.set(clone.deviceId, []);
		}
		deviceClones.get(clone.deviceId)!.push(clone);
	}

	const assignments: Array<{account: any, clone: any}> = [];
	const devices = Array.from(deviceClones.keys());
	let deviceIndex = 0;

	for (const account of accounts) {
		// Find next device with available clones
		let attempts = 0;
		while (attempts < devices.length) {
			const currentDevice = devices[deviceIndex];
			const availableDeviceClones = deviceClones.get(currentDevice)!;
			
			if (availableDeviceClones.length > 0) {
				const clone = availableDeviceClones.shift()!;
				assignments.push({ account, clone });
				break;
			}
			
			// Move to next device
			deviceIndex = (deviceIndex + 1) % devices.length;
			attempts++;
		}
		
		// Move to next device for next account
		deviceIndex = (deviceIndex + 1) % devices.length;
	}

	return assignments;
}

// Fill-first strategy: Fill up each device completely before moving to the next
async function getFillFirstAssignments(accounts: any[], availableClones: any[], prisma: any): Promise<Array<{account: any, clone: any}>> {
	const assignments: Array<{account: any, clone: any}> = [];
	const clonesCopy = [...availableClones];

	for (let i = 0; i < accounts.length && i < clonesCopy.length; i++) {
		assignments.push({
			account: accounts[i],
			clone: clonesCopy[i]
		});
	}

	return assignments;
}

// Capacity-based strategy: Prefer devices with more available capacity
async function getCapacityBasedAssignments(accounts: any[], availableClones: any[], prisma: any): Promise<Array<{account: any, clone: any}>> {
	// Group clones by device and sort by capacity
	const deviceClones = new Map<string, any[]>();
	for (const clone of availableClones) {
		if (!deviceClones.has(clone.deviceId)) {
			deviceClones.set(clone.deviceId, []);
		}
		deviceClones.get(clone.deviceId)!.push(clone);
	}

	// Sort devices by available capacity (descending)
	const sortedDevices = Array.from(deviceClones.entries())
		.sort((a, b) => b[1].length - a[1].length)
		.map(([deviceId, clones]) => ({ deviceId, clones }));

	const assignments: Array<{account: any, clone: any}> = [];
	let deviceIndex = 0;

	for (const account of accounts) {
		// Find device with most available clones
		while (deviceIndex < sortedDevices.length) {
			const device = sortedDevices[deviceIndex];
			if (device.clones.length > 0) {
				const clone = device.clones.shift()!;
				assignments.push({ account, clone });
				
				// Re-sort devices if needed (simple optimization: only if this device is now empty)
				if (device.clones.length === 0) {
					deviceIndex++;
				}
				break;
			}
			deviceIndex++;
		}
	}

	return assignments;
}

// New assignment strategies

// Balanced-load strategy: Consider current device load and distribute accordingly
async function getBalancedLoadAssignments(accounts: any[], availableClones: any[], prisma: any): Promise<Array<{account: any, clone: any}>> {
	// Get current device loads
	const deviceLoadMap = new Map<string, number>();
	
	// Count current assignments per device
	for (const clone of availableClones) {
		if (!deviceLoadMap.has(clone.deviceId)) {
			const currentLoad = await prisma.cloneInventory.count({
				where: {
					deviceId: clone.deviceId,
					cloneStatus: { in: ['Assigned', 'Logged In'] }
				}
			});
			deviceLoadMap.set(clone.deviceId, currentLoad);
		}
	}

	// Group clones by device and sort by current load (ascending)
	const deviceClones = new Map<string, any[]>();
	for (const clone of availableClones) {
		if (!deviceClones.has(clone.deviceId)) {
			deviceClones.set(clone.deviceId, []);
		}
		deviceClones.get(clone.deviceId)!.push(clone);
	}

	// Sort devices by current load (prefer less loaded devices)
	const sortedDevices = Array.from(deviceClones.entries())
		.sort((a, b) => (deviceLoadMap.get(a[0]) || 0) - (deviceLoadMap.get(b[0]) || 0))
		.map(([deviceId, clones]) => ({ deviceId, clones, currentLoad: deviceLoadMap.get(deviceId) || 0 }));

	const assignments: Array<{account: any, clone: any}> = [];
	let deviceIndex = 0;

	for (const account of accounts) {
		// Find device with lowest load that has available clones
		while (deviceIndex < sortedDevices.length) {
			const device = sortedDevices[deviceIndex];
			if (device.clones.length > 0) {
				const clone = device.clones.shift()!;
				assignments.push({ account, clone });
				
				// Update load and re-sort if needed
				device.currentLoad++;
				
				// Simple re-sort: move to correct position
				let newIndex = deviceIndex;
				while (newIndex > 0 && sortedDevices[newIndex - 1].currentLoad > device.currentLoad) {
					[sortedDevices[newIndex], sortedDevices[newIndex - 1]] = [sortedDevices[newIndex - 1], sortedDevices[newIndex]];
					newIndex--;
				}
				while (newIndex < sortedDevices.length - 1 && sortedDevices[newIndex + 1].currentLoad < device.currentLoad) {
					[sortedDevices[newIndex], sortedDevices[newIndex + 1]] = [sortedDevices[newIndex + 1], sortedDevices[newIndex]];
					newIndex++;
				}
				deviceIndex = newIndex;
				break;
			}
			deviceIndex++;
		}
	}

	return assignments;
}

// Optimal-distribution strategy: Mathematically optimal distribution considering device capabilities
async function getOptimalDistributionAssignments(accounts: any[], availableClones: any[], prisma: any): Promise<Array<{account: any, clone: any}>> {
	// Get device capabilities and current usage
	const deviceInfo = new Map<string, {
		totalCapacity: number;
		currentUsage: number;
		availableClones: any[];
		efficiency: number;
	}>();

	// Build device info map
	for (const clone of availableClones) {
		if (!deviceInfo.has(clone.deviceId)) {
			const totalCapacity = await prisma.cloneInventory.count({
				where: { deviceId: clone.deviceId }
			});
			
			const currentUsage = await prisma.cloneInventory.count({
				where: {
					deviceId: clone.deviceId,
					cloneStatus: { in: ['Assigned', 'Logged In'] }
				}
			});

			// Calculate efficiency (available capacity ratio)
			const efficiency = totalCapacity > 0 ? (totalCapacity - currentUsage) / totalCapacity : 0;

			deviceInfo.set(clone.deviceId, {
				totalCapacity,
				currentUsage,
				availableClones: [],
				efficiency
			});
		}
		deviceInfo.get(clone.deviceId)!.availableClones.push(clone);
	}

	// Calculate optimal distribution using weighted round-robin
	const assignments: Array<{account: any, clone: any}> = [];
	const deviceList = Array.from(deviceInfo.entries())
		.filter(([_, info]) => info.availableClones.length > 0)
		.sort((a, b) => b[1].efficiency - a[1].efficiency); // Sort by efficiency (descending)

	// Assign accounts using weighted distribution
	let totalWeight = deviceList.reduce((sum, [_, info]) => sum + info.efficiency, 0);
	let accountIndex = 0;

	for (const account of accounts) {
		if (deviceList.length === 0) break;

		// Select device based on weighted efficiency
		let remainingWeight = Math.random() * totalWeight;
		let selectedDeviceIndex = 0;

		for (let i = 0; i < deviceList.length; i++) {
			remainingWeight -= deviceList[i][1].efficiency;
			if (remainingWeight <= 0 || deviceList[i][1].availableClones.length > 0) {
				selectedDeviceIndex = i;
				break;
			}
		}

		// Assign to selected device
		const [deviceId, deviceData] = deviceList[selectedDeviceIndex];
		if (deviceData.availableClones.length > 0) {
			const clone = deviceData.availableClones.shift()!;
			assignments.push({ account, clone });

			// Update efficiency and resort if needed
			deviceData.currentUsage++;
			deviceData.efficiency = deviceData.totalCapacity > 0 ? 
				(deviceData.totalCapacity - deviceData.currentUsage) / deviceData.totalCapacity : 0;

			// Remove device if no more clones available
			if (deviceData.availableClones.length === 0) {
				deviceList.splice(selectedDeviceIndex, 1);
				totalWeight -= deviceData.efficiency;
			}
		}
	}

	return assignments;
}

// Helper function to apply device capacity limits
async function applyDeviceCapacityLimits(clones: any[], maxAccountsPerDevice: number, prisma: any): Promise<any[]> {
	const deviceUsage = new Map<string, number>();
	
	// Get current usage for all devices
	for (const clone of clones) {
		if (!deviceUsage.has(clone.deviceId)) {
			const currentUsage = await prisma.cloneInventory.count({
				where: {
					deviceId: clone.deviceId,
					cloneStatus: { in: ['Assigned', 'Logged In'] }
				}
			});
			deviceUsage.set(clone.deviceId, currentUsage);
		}
	}

	// Filter clones based on device capacity limits
	const filteredClones: any[] = [];
	const deviceCloneCounts = new Map<string, number>();

	for (const clone of clones) {
		const currentDeviceCount = deviceCloneCounts.get(clone.deviceId) || 0;
		const currentUsage = deviceUsage.get(clone.deviceId) || 0;
		
		if (currentUsage + currentDeviceCount < maxAccountsPerDevice) {
			filteredClones.push(clone);
			deviceCloneCounts.set(clone.deviceId, currentDeviceCount + 1);
		}
	}

	return filteredClones;
}

// Helper function for partial assignments
async function getPartialAssignments(
	accounts: any[], 
	options: Omit<AssignmentOptions, 'allowPartialAssignment'>,
	prisma: any
): Promise<Array<{account: any, clone: any}>> {
	// Get available capacity
	const whereClause: any = { cloneStatus: 'Available' };
	
	if (options.assignmentMode === 'specific' && options.deviceId) {
		whereClause.deviceId = options.deviceId;
	} else if (options.preferredDeviceIds && options.preferredDeviceIds.length > 0) {
		whereClause.deviceId = { in: options.preferredDeviceIds };
	}
	
	if (options.excludeDeviceIds && options.excludeDeviceIds.length > 0) {
		if (whereClause.deviceId) {
			if (typeof whereClause.deviceId === 'string') {
				if (options.excludeDeviceIds.includes(whereClause.deviceId)) {
					throw new Error('Specified device is excluded');
				}
			} else if (whereClause.deviceId.in) {
				whereClause.deviceId.in = whereClause.deviceId.in.filter(
					(id: string) => !options.excludeDeviceIds!.includes(id)
				);
			}
		} else {
			whereClause.deviceId = { notIn: options.excludeDeviceIds };
		}
	}

	const availableClones = await prisma.cloneInventory.findMany({
		where: whereClause,
		orderBy: [
			{ deviceId: 'asc' },
			{ cloneNumber: 'asc' }
		]
	});

	// Apply device capacity limits if specified
	let filteredClones = availableClones;
	if (options.maxAccountsPerDevice) {
		filteredClones = await applyDeviceCapacityLimits(availableClones, options.maxAccountsPerDevice, prisma);
	}

	// Assign as many as possible
	const accountsToAssign = accounts.slice(0, filteredClones.length);
	
	// Use the specified strategy for partial assignment
	switch (options.strategy) {
		case 'round-robin':
			return getRoundRobinAssignments(accountsToAssign, filteredClones, prisma);
		case 'fill-first':
			return getFillFirstAssignments(accountsToAssign, filteredClones, prisma);
		case 'capacity-based':
			return getCapacityBasedAssignments(accountsToAssign, filteredClones, prisma);
		case 'balanced-load':
			return getBalancedLoadAssignments(accountsToAssign, filteredClones, prisma);
		case 'optimal-distribution':
			return getOptimalDistributionAssignments(accountsToAssign, filteredClones, prisma);
		default:
			return getRoundRobinAssignments(accountsToAssign, filteredClones, prisma);
	}
}