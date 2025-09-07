import { json, error } from '@sveltejs/kit';
import { prisma, type AccountStatus } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types.js';

interface AutoAssignRequest {
	accountId?: number;
	instagramUsername?: string;
	strategy?: 'round-robin' | 'fill-first' | 'capacity-based';
	deviceId?: string; // For specific device assignment
	preferDeviceIds?: string[]; // Preferred devices (fallback to any if none available)
}

interface AutoAssignResponse {
	success: boolean;
	assignment?: {
		accountId: number;
		instagramUsername: string;
		deviceId: string;
		cloneNumber: number;
		packageName: string;
		strategy: string;
	};
	error?: string;
	availableCapacity?: {
		totalAvailable: number;
		deviceBreakdown: Array<{
			deviceId: string;
			deviceName: string | null;
			availableClones: number;
		}>;
	};
}

// POST /api/devices/auto-assign - Automatically assign single account to optimal clone
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: AutoAssignRequest = await request.json();
		const { accountId, instagramUsername, strategy = 'round-robin', deviceId, preferDeviceIds } = body;

		// Validate input - need either accountId or instagramUsername
		if (!accountId && !instagramUsername) {
			throw error(400, 'Either accountId or instagramUsername is required');
		}

		// Get account information
		let account: any;
		if (accountId) {
			account = await (prisma as any).igAccount.findUnique({
				where: { id: accountId },
				select: {
					id: true,
					instagramUsername: true,
					status: true,
					assignedDeviceId: true,
					assignedCloneNumber: true
				}
			});
		} else {
			account = await (prisma as any).igAccount.findFirst({
				where: { instagramUsername },
				select: {
					id: true,
					instagramUsername: true,
					status: true,
					assignedDeviceId: true,
					assignedCloneNumber: true
				}
			});
		}

		if (!account) {
			throw error(404, 'Account not found');
		}

		// Check if account is already assigned
		if (account.assignedDeviceId && account.assignedCloneNumber) {
			return json({
				success: false,
				error: `Account ${account.instagramUsername} is already assigned to device ${account.assignedDeviceId} clone ${account.assignedCloneNumber}`,
				availableCapacity: await getCapacityInfo()
			} as AutoAssignResponse);
		}

		// Get available clones based on preferences
		const assignment = await findOptimalAssignment(account, strategy, deviceId, preferDeviceIds);

		if (!assignment) {
			return json({
				success: false,
				error: 'No available clones found for assignment',
				availableCapacity: await getCapacityInfo()
			} as AutoAssignResponse);
		}

		// Perform the assignment
		const success = await performAssignment(account, assignment.clone);

		if (success) {
			return json({
				success: true,
				assignment: {
					accountId: account.id,
					instagramUsername: account.instagramUsername,
					deviceId: assignment.clone.deviceId,
					cloneNumber: assignment.clone.cloneNumber,
					packageName: assignment.clone.packageName,
					strategy: strategy
				}
			} as AutoAssignResponse);
		} else {
			return json({
				success: false,
				error: 'Failed to perform assignment due to database error',
				availableCapacity: await getCapacityInfo()
			} as AutoAssignResponse);
		}

	} catch (err) {
		console.error('Auto-assign error:', err);
		if (err instanceof Error) {
			throw error(500, err.message);
		}
		throw error(500, 'Internal server error during auto-assignment');
	}
};

// GET /api/devices/auto-assign - Get assignment preview/capacity info
export const GET: RequestHandler = async ({ url }) => {
	try {
		const accountIdParam = url.searchParams.get('accountId');
		const instagramUsername = url.searchParams.get('instagramUsername');
		const strategy = url.searchParams.get('strategy') as 'round-robin' | 'fill-first' | 'capacity-based' || 'round-robin';
		const deviceId = url.searchParams.get('deviceId') || undefined;

		let account: any = null;

		// Get account info if provided
		if (accountIdParam || instagramUsername) {
			if (accountIdParam) {
				account = await (prisma as any).igAccount.findUnique({
					where: { id: parseInt(accountIdParam) },
					select: {
						id: true,
						instagramUsername: true,
						status: true,
						assignedDeviceId: true,
						assignedCloneNumber: true
					}
				});
			} else if (instagramUsername) {
				account = await (prisma as any).igAccount.findFirst({
					where: { instagramUsername },
					select: {
						id: true,
						instagramUsername: true,
						status: true,
						assignedDeviceId: true,
						assignedCloneNumber: true
					}
				});
			}

			if (!account) {
				throw error(404, 'Account not found');
			}
		}

		// Get capacity info
		const capacityInfo = await getCapacityInfo(deviceId);

		// If account provided, try to find optimal assignment (preview mode)
		let suggestedAssignment = null;
		if (account && !account.assignedDeviceId) {
			const assignment = await findOptimalAssignment(account, strategy, deviceId);
			if (assignment) {
				suggestedAssignment = {
					deviceId: assignment.clone.deviceId,
					cloneNumber: assignment.clone.cloneNumber,
					packageName: assignment.clone.packageName,
					strategy: strategy
				};
			}
		}

		return json({
			success: true,
			availableCapacity: capacityInfo,
			suggestedAssignment,
			accountStatus: account ? {
				id: account.id,
				instagramUsername: account.instagramUsername,
				status: account.status,
				alreadyAssigned: !!(account.assignedDeviceId && account.assignedCloneNumber)
			} : null
		});

	} catch (err) {
		console.error('Auto-assign preview error:', err);
		if (err instanceof Error) {
			throw error(500, err.message);
		}
		throw error(500, 'Internal server error during assignment preview');
	}
};

// Helper function to find optimal assignment based on strategy
async function findOptimalAssignment(
	account: any,
	strategy: 'round-robin' | 'fill-first' | 'capacity-based',
	specificDeviceId?: string,
	preferDeviceIds?: string[]
): Promise<{clone: any} | null> {
	// Build query based on preferences
	const whereClause: any = {
		cloneStatus: 'Available'
	};

	if (specificDeviceId) {
		whereClause.deviceId = specificDeviceId;
	} else if (preferDeviceIds && preferDeviceIds.length > 0) {
		whereClause.deviceId = { in: preferDeviceIds };
	}

	let availableClones = await (prisma as any).cloneInventory.findMany({
		where: whereClause,
		orderBy: [
			{ deviceId: 'asc' },
			{ cloneNumber: 'asc' }
		]
	});

	// If no clones found with preferences, try without preferences (unless specific device requested)
	if (availableClones.length === 0 && !specificDeviceId && preferDeviceIds) {
		availableClones = await (prisma as any).cloneInventory.findMany({
			where: { cloneStatus: 'Available' },
			orderBy: [
				{ deviceId: 'asc' },
				{ cloneNumber: 'asc' }
			]
		});
	}

	if (availableClones.length === 0) {
		return null;
	}

	// Apply strategy for single account
	let selectedClone: any;

	switch (strategy) {
		case 'round-robin':
			selectedClone = selectRoundRobinClone(availableClones);
			break;
		case 'fill-first':
			selectedClone = availableClones[0]; // First available
			break;
		case 'capacity-based':
			selectedClone = await selectCapacityBasedClone(availableClones);
			break;
		default:
			selectedClone = availableClones[0];
	}

	return { clone: selectedClone };
}

// Round-robin selection: Find device with least current assignments
function selectRoundRobinClone(availableClones: any[]): any {
	// Group by device and select from device with most available clones
	const deviceGroups = new Map<string, any[]>();
	
	for (const clone of availableClones) {
		if (!deviceGroups.has(clone.deviceId)) {
			deviceGroups.set(clone.deviceId, []);
		}
		deviceGroups.get(clone.deviceId)!.push(clone);
	}

	// Find device with most available clones (indicating less current load)
	let bestDevice = '';
	let maxAvailable = 0;

	for (const [deviceId, clones] of deviceGroups) {
		if (clones.length > maxAvailable) {
			maxAvailable = clones.length;
			bestDevice = deviceId;
		}
	}

	// Return first clone from best device
	return deviceGroups.get(bestDevice)![0];
}

// Capacity-based selection: Prefer device with highest available capacity
async function selectCapacityBasedClone(availableClones: any[]): Promise<any> {
	// Group by device and get total capacity for each
	const deviceClones = new Map<string, any[]>();
	
	for (const clone of availableClones) {
		if (!deviceClones.has(clone.deviceId)) {
			deviceClones.set(clone.deviceId, []);
		}
		deviceClones.get(clone.deviceId)!.push(clone);
	}

	// Get total clone counts per device
	const deviceCapacities = new Map<string, number>();
	
	for (const deviceId of deviceClones.keys()) {
		const totalClones = await (prisma as any).cloneInventory.count({
			where: { deviceId }
		});
		deviceCapacities.set(deviceId, totalClones);
	}

	// Select device with highest total capacity
	let bestDevice = '';
	let maxCapacity = 0;

	for (const [deviceId, capacity] of deviceCapacities) {
		if (capacity > maxCapacity) {
			maxCapacity = capacity;
			bestDevice = deviceId;
		}
	}

	// Return first available clone from best device
	return deviceClones.get(bestDevice)![0];
}

// Perform the actual assignment in a transaction
async function performAssignment(account: any, clone: any): Promise<boolean> {
	try {
		await (prisma as any).$transaction(async (tx: any) => {
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
		});

		return true;
	} catch (assignmentError) {
		console.error('Assignment transaction error:', assignmentError);
		return false;
	}
}

// Get current capacity information
async function getCapacityInfo(specificDeviceId?: string): Promise<{
	totalAvailable: number;
	deviceBreakdown: Array<{
		deviceId: string;
		deviceName: string | null;
		availableClones: number;
	}>;
}> {
	const whereClause: any = {
		cloneStatus: 'Available'
	};

	if (specificDeviceId) {
		whereClause.deviceId = specificDeviceId;
	}

	const availableClones = await (prisma as any).cloneInventory.findMany({
		where: whereClause,
		select: {
			deviceId: true,
			deviceName: true,
			cloneNumber: true
		}
	});

	// Group by device
	const deviceMap = new Map<string, { deviceName: string | null; count: number }>();
	
	for (const clone of availableClones) {
		if (!deviceMap.has(clone.deviceId)) {
			deviceMap.set(clone.deviceId, {
				deviceName: clone.deviceName,
				count: 0
			});
		}
		deviceMap.get(clone.deviceId)!.count++;
	}

	const deviceBreakdown = Array.from(deviceMap.entries()).map(([deviceId, info]) => ({
		deviceId,
		deviceName: info.deviceName,
		availableClones: info.count
	}));

	return {
		totalAvailable: availableClones.length,
		deviceBreakdown: deviceBreakdown.sort((a, b) => a.deviceId.localeCompare(b.deviceId))
	};
}