import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { prisma } from '$lib/server/database.js';

/**
 * Bulk Account Info API Endpoint
 * 
 * Retrieves comprehensive account information for multiple accounts including automation eligibility.
 * Used by the BulkAutomationModal to validate account eligibility and plan operations.
 * 
 * @route POST /api/accounts/bulk-info
 */

interface BulkInfoRequest {
	accountIds: number[];
	includeAutomationEligibility?: boolean;
	includeActiveSessions?: boolean;
	operationType?: 'login' | 'warmup' | 'both';
}

interface AccountInfo {
	id: number;
	instagramUsername: string;
	status: string;
	assignedDeviceId: string | null;
	assignedCloneNumber: number | null;
	assignedPackageName: string | null;
	loginTimestamp: string | null;
	assignmentTimestamp: string | null;
	createdAt: string;
	updatedAt: string;
	imapStatus: string;
	// Enhanced automation information
	automationEligibility?: {
		canLogin: boolean;
		canWarmup: boolean;
		loginReason: string;
		warmupReason: string;
		recommendedOperation?: 'login' | 'warmup' | 'both' | 'none';
	};
	activeSessions?: Array<{
		id: string;
		sessionType: string;
		status: string;
		progress: number;
		startTime: string | null;
	}>;
	deviceInfo?: {
		deviceName: string | null;
		cloneHealth: string | null;
		cloneStatus: string | null;
	};
}

interface BulkInfoResponse {
	success: boolean;
	data?: {
		accounts: AccountInfo[];
		found: number;
		notFound: number[];
		// Enhanced summary information
		eligibilitySummary?: {
			canLogin: number;
			canWarmup: number;
			canBoth: number;
			ineligible: number;
			hasActiveSessions: number;
		};
	};
	error?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: BulkInfoRequest = await request.json();
		
		// Validate request
		if (!body.accountIds || !Array.isArray(body.accountIds) || body.accountIds.length === 0) {
			return json({ 
				success: false, 
				error: 'Account IDs are required' 
			} satisfies BulkInfoResponse, { status: 400 });
		}

		if (body.accountIds.length > 100) {
			return json({ 
				success: false, 
				error: 'Maximum 100 accounts allowed per request' 
			} satisfies BulkInfoResponse, { status: 400 });
		}

		console.log(`Fetching bulk account info for ${body.accountIds.length} accounts`);

		// Build include clause based on request parameters
		const includeClause: any = {
			account: {
				select: {
					id: true,
					instagramUsername: true,
					status: true,
					assignedDeviceId: true,
					assignedCloneNumber: true,
					assignedPackageName: true,
					loginTimestamp: true,
					assignmentTimestamp: true,
					createdAt: true,
					updatedAt: true,
					imapStatus: true
				}
			}
		};

		if (body.includeActiveSessions) {
			includeClause.automationSessions = {
				where: {
					status: {
						in: ['STARTING', 'RUNNING', 'STOPPING']
					}
				},
				select: {
					id: true,
					sessionType: true,
					status: true,
					progress: true,
					startTime: true
				}
			};
		}

		// Fetch account information
		const accounts = await prisma.igAccount.findMany({
			where: {
				id: {
					in: body.accountIds
				}
			},
			select: {
				id: true,
				instagramUsername: true,
				status: true,
				assignedDeviceId: true,
				assignedCloneNumber: true,
				assignedPackageName: true,
				loginTimestamp: true,
				assignmentTimestamp: true,
				createdAt: true,
				updatedAt: true,
				imapStatus: true,
				automationSessions: body.includeActiveSessions ? {
					where: {
						status: {
							in: ['STARTING', 'RUNNING', 'STOPPING']
						}
					},
					select: {
						id: true,
						sessionType: true,
						status: true,
						progress: true,
						startTime: true
					}
				} : false
			},
			orderBy: {
				instagramUsername: 'asc'
			}
		});

		// Fetch device information if needed
		let deviceInfoMap: Map<string, any> = new Map();
		if (body.includeAutomationEligibility) {
			const deviceIds = accounts
				.map((acc: any) => acc.assignedDeviceId)
				.filter(Boolean) as string[];
			
			if (deviceIds.length > 0) {
				const cloneInventory = await prisma.cloneInventory.findMany({
					where: {
						deviceId: { in: deviceIds }
					},
					select: {
						deviceId: true,
						cloneNumber: true,
						deviceName: true,
						cloneHealth: true,
						cloneStatus: true
					}
				});

				for (const clone of cloneInventory) {
					const key = `${clone.deviceId}_${clone.cloneNumber}`;
					deviceInfoMap.set(key, {
						deviceName: clone.deviceName,
						cloneHealth: clone.cloneHealth,
						cloneStatus: clone.cloneStatus
					});
				}
			}
		}

		/**
		 * Evaluate automation eligibility for an account
		 */
		function evaluateAutomationEligibility(account: any) {
			const canLogin = account.status === 'Assigned' && !!account.assignedDeviceId;
			const canWarmup = account.status === 'Logged In';
			
			let loginReason = '';
			let warmupReason = '';
			let recommendedOperation: 'login' | 'warmup' | 'both' | 'none' = 'none';

			// Login eligibility
			if (account.status !== 'Assigned') {
				loginReason = `Account status must be 'Assigned' (current: '${account.status}')`;
			} else if (!account.assignedDeviceId) {
				loginReason = 'Account must be assigned to a device';
			} else {
				loginReason = 'Ready for login automation';
			}

			// Warmup eligibility
			if (account.status !== 'Logged In') {
				warmupReason = `Account status must be 'Logged In' (current: '${account.status}')`;
			} else {
				warmupReason = 'Ready for warmup automation';
			}

			// Determine recommended operation
			if (canLogin && canWarmup) {
				// This shouldn't normally happen, but handle gracefully
				recommendedOperation = 'warmup'; // Prefer warmup if already logged in
			} else if (canLogin) {
				recommendedOperation = body.operationType === 'both' ? 'both' : 'login';
			} else if (canWarmup) {
				recommendedOperation = 'warmup';
			}

			return {
				canLogin,
				canWarmup,
				loginReason,
				warmupReason,
				recommendedOperation
			};
		}

		// Transform data to match interface
		const accountData: AccountInfo[] = accounts.map((account: any) => {
			const baseData: AccountInfo = {
				id: account.id,
				instagramUsername: account.instagramUsername,
				status: account.status,
				assignedDeviceId: account.assignedDeviceId,
				assignedCloneNumber: account.assignedCloneNumber,
				assignedPackageName: account.assignedPackageName,
				loginTimestamp: account.loginTimestamp ? account.loginTimestamp.toISOString() : null,
				assignmentTimestamp: account.assignmentTimestamp ? account.assignmentTimestamp.toISOString() : null,
				createdAt: account.createdAt.toISOString(),
				updatedAt: account.updatedAt.toISOString(),
				imapStatus: account.imapStatus
			};

			// Add automation eligibility if requested
			if (body.includeAutomationEligibility) {
				baseData.automationEligibility = evaluateAutomationEligibility(account);
			}

			// Add active sessions if requested and available
			if (body.includeActiveSessions && account.automationSessions) {
				baseData.activeSessions = account.automationSessions.map((session: any) => ({
					id: session.id,
					sessionType: session.sessionType,
					status: session.status,
					progress: session.progress,
					startTime: session.startTime ? session.startTime.toISOString() : null
				}));
			}

			// Add device information if available
			if (body.includeAutomationEligibility && account.assignedDeviceId && account.assignedCloneNumber !== null) {
				const deviceKey = `${account.assignedDeviceId}_${account.assignedCloneNumber}`;
				const deviceInfo = deviceInfoMap.get(deviceKey);
				if (deviceInfo) {
					baseData.deviceInfo = deviceInfo;
				}
			}

			return baseData;
		});

		// Find accounts that were not found
		const foundAccountIds = new Set(accounts.map((account: any) => account.id));
		const notFound = body.accountIds.filter(id => !foundAccountIds.has(id));

		// Calculate eligibility summary if requested
		let eligibilitySummary;
		if (body.includeAutomationEligibility) {
			const summary = {
				canLogin: 0,
				canWarmup: 0,
				canBoth: 0,
				ineligible: 0,
				hasActiveSessions: 0
			};

			for (const account of accountData) {
				if (account.automationEligibility) {
					const { canLogin, canWarmup } = account.automationEligibility;
					
					if (canLogin && canWarmup) {
						summary.canBoth++;
					} else if (canLogin) {
						summary.canLogin++;
					} else if (canWarmup) {
						summary.canWarmup++;
					} else {
						summary.ineligible++;
					}
				}

				if (account.activeSessions && account.activeSessions.length > 0) {
					summary.hasActiveSessions++;
				}
			}

			eligibilitySummary = summary;
		}

		console.log(`Bulk account info retrieved: ${accounts.length} found, ${notFound.length} not found`);
		if (eligibilitySummary) {
			console.log(`Eligibility summary: ${eligibilitySummary.canLogin} can login, ${eligibilitySummary.canWarmup} can warmup, ${eligibilitySummary.canBoth} can both, ${eligibilitySummary.ineligible} ineligible, ${eligibilitySummary.hasActiveSessions} have active sessions`);
		}

		const response: BulkInfoResponse = {
			success: true,
			data: {
				accounts: accountData,
				found: accounts.length,
				notFound
			}
		};

		if (eligibilitySummary) {
			response.data!.eligibilitySummary = eligibilitySummary;
		}

		return json(response);

	} catch (error) {
		console.error('Bulk account info error:', error);
		
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Failed to fetch account information'
		} satisfies BulkInfoResponse, { status: 500 });
	}
};