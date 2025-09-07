import { json } from '@sveltejs/kit';
import { 
	assignAccountToUser, 
	unassignAccountFromUser, 
	convertAccountToML,
	getAccountOwnershipSummary,
	getAccountsForUser
} from '$lib/server/database.js';
import type { RequestHandler } from './$types';

// GET /api/accounts/ownership - Get account ownership summary and stats
export const GET: RequestHandler = async ({ url }) => {
	try {
		const action = url.searchParams.get('action');

		switch (action) {
			case 'summary':
				// Get ownership summary for admin dashboard
				const summary = await getAccountOwnershipSummary();
				return json({
					success: true,
					data: summary
				});

			case 'user-accounts':
				// Get accounts for a specific user
				const userId = parseInt(url.searchParams.get('userId') || '0');
				const userRole = url.searchParams.get('userRole') as 'ADMIN' | 'CLIENT' | 'VIEWER' | 'UNAUTHORIZED' || 'UNAUTHORIZED';
				const limit = parseInt(url.searchParams.get('limit') || '20');
				const offset = parseInt(url.searchParams.get('offset') || '0');

				if (!userId || !userRole) {
					return json({
						success: false,
						error: 'userId and userRole are required for user-accounts action'
					}, { status: 400 });
				}

				const userAccountsData = await getAccountsForUser(userId, userRole, limit, offset);
				return json({
					success: true,
					data: userAccountsData
				});

			default:
				// Default: return ownership summary
				const defaultSummary = await getAccountOwnershipSummary();
				return json({
					success: true,
					data: defaultSummary
				});
		}
	} catch (error) {
		console.error('Failed to get account ownership data:', error);
		return json({
			success: false,
			error: 'Failed to retrieve account ownership data'
		}, { status: 500 });
	}
};

// POST /api/accounts/ownership - Manage account ownership operations
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { action, accountId, userId, visibility } = data;

		// Validation
		if (!action || !accountId) {
			return json({
				success: false,
				error: 'action and accountId are required'
			}, { status: 400 });
		}

		switch (action) {
			case 'assign':
				// Assign account to user
				if (!userId) {
					return json({
						success: false,
						error: 'userId is required for assign action'
					}, { status: 400 });
				}

				const assignedAccount = await assignAccountToUser(
					parseInt(accountId), 
					parseInt(userId), 
					visibility || 'PRIVATE'
				);

				return json({
					success: true,
					data: assignedAccount,
					message: `Account assigned to user ${userId}`
				});

			case 'unassign':
				// Unassign account from user (make it unassigned)
				const unassignedAccount = await unassignAccountFromUser(parseInt(accountId));

				return json({
					success: true,
					data: unassignedAccount,
					message: 'Account unassigned from user'
				});

			case 'convert-to-ml':
				// Convert account to ML trend finder account
				const mlAccount = await convertAccountToML(parseInt(accountId));

				return json({
					success: true,
					data: mlAccount,
					message: 'Account converted to ML trend finder'
				});

			default:
				return json({
					success: false,
					error: 'Invalid action. Supported actions: assign, unassign, convert-to-ml'
				}, { status: 400 });
		}
	} catch (error) {
		console.error('Failed to manage account ownership:', error);
		return json({
			success: false,
			error: 'Failed to manage account ownership'
		}, { status: 500 });
	}
};