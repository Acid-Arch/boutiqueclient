import { json } from '@sveltejs/kit';
import { updateAccount, ACCOUNT_STATUSES, prisma } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// PATCH /api/accounts/bulk-field - Update a single field for multiple accounts
export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const { accountIds, field, value } = await request.json();
		
		if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
			return json({
				success: false,
				error: 'Account IDs array is required'
			}, { status: 400 });
		}

		if (!field) {
			return json({
				success: false,
				error: 'Field name is required'
			}, { status: 400 });
		}

		// Validate field and value
		let validationError: string | null = null;

		switch (field) {
			case 'status':
				if (!ACCOUNT_STATUSES.includes(value)) {
					validationError = 'Invalid status value';
				}
				break;

			case 'assignedDeviceId':
				// Device ID validation can be added here if needed
				break;

			case 'assignedCloneNumber':
				if (value !== null && (isNaN(value) || value < 1 || value > 32)) {
					validationError = 'Clone number must be between 1 and 32';
				}
				break;

			case 'imapStatus':
				if (!['On', 'Off'].includes(value)) {
					validationError = 'IMAP status must be On or Off';
				}
				break;

			default:
				validationError = `Field '${field}' is not allowed for bulk updates`;
		}

		if (validationError) {
			return json({
				success: false,
				error: validationError
			}, { status: 400 });
		}

		// Check if accounts exist
		const existingAccounts = await (prisma as any).igAccount.findMany({
			where: {
				id: { in: accountIds.map(id => parseInt(id)) }
			},
			select: { id: true }
		});

		const foundIds = existingAccounts.map((acc: any) => acc.id);
		const missingIds = accountIds.filter((id: any) => !foundIds.includes(parseInt(id)));

		if (missingIds.length > 0) {
			return json({
				success: false,
				error: `Accounts not found: ${missingIds.join(', ')}`
			}, { status: 404 });
		}

		// Prepare update data
		const updateData: any = {};
		
		switch (field) {
			case 'status':
				updateData.status = value;
				if (value === 'Logged In') {
					updateData.loginTimestamp = new Date();
				}
				break;

			case 'assignedDeviceId':
				updateData.assignedDeviceId = value || null;
				if (value) {
					updateData.assignmentTimestamp = new Date();
				} else {
					updateData.assignedCloneNumber = null;
					updateData.assignedPackageName = null;
					updateData.assignmentTimestamp = null;
				}
				break;

			case 'assignedCloneNumber':
				updateData.assignedCloneNumber = value;
				break;

			case 'imapStatus':
				updateData.imapStatus = value;
				break;
		}

		updateData.updatedAt = new Date();

		// Perform bulk update
		const result = await (prisma as any).igAccount.updateMany({
			where: {
				id: { in: accountIds.map(id => parseInt(id)) }
			},
			data: updateData
		});

		return json({
			success: true,
			updatedCount: result.count,
			field,
			value,
			accountIds
		});

	} catch (error) {
		console.error('Failed to bulk update account field:', error);
		return json({
			success: false,
			error: 'Failed to bulk update account field'
		}, { status: 500 });
	}
};