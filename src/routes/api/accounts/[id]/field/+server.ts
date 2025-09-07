import { json } from '@sveltejs/kit';
import { getAccountById, updateAccount, ACCOUNT_STATUSES } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// PATCH /api/accounts/[id]/field - Update a single field
export const PATCH: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		
		if (isNaN(id)) {
			return json({
				success: false,
				error: 'Invalid account ID'
			}, { status: 400 });
		}

		// Check if account exists
		const existingAccount = await getAccountById(id);
		if (!existingAccount) {
			return json({
				success: false,
				error: 'Account not found'
			}, { status: 404 });
		}

		const { field, value } = await request.json();
		
		if (!field) {
			return json({
				success: false,
				error: 'Field name is required'
			}, { status: 400 });
		}

		// Validate field and value
		const updateData: any = {};
		let validationError: string | null = null;

		switch (field) {
			case 'status':
				if (!ACCOUNT_STATUSES.includes(value)) {
					validationError = 'Invalid status value';
				} else {
					updateData.status = value;
					if (value === 'Logged In') {
						updateData.loginTimestamp = new Date();
					}
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
				if (value !== null && (isNaN(value) || value < 1 || value > 32)) {
					validationError = 'Clone number must be between 1 and 32';
				} else {
					updateData.assignedCloneNumber = value;
				}
				break;

			case 'imapStatus':
				if (!['On', 'Off'].includes(value)) {
					validationError = 'IMAP status must be On or Off';
				} else {
					updateData.imapStatus = value;
				}
				break;

			case 'instagramUsername':
				if (!value || value.length < 3) {
					validationError = 'Instagram username must be at least 3 characters';
				} else {
					updateData.instagramUsername = value;
				}
				break;

			case 'emailAddress':
				if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
					validationError = 'Please enter a valid email address';
				} else {
					updateData.emailAddress = value;
				}
				break;

			case 'recordId':
				updateData.recordId = value;
				break;

			default:
				validationError = `Field '${field}' is not allowed for updates`;
		}

		if (validationError) {
			return json({
				success: false,
				error: validationError
			}, { status: 400 });
		}

		// Perform the update
		const updatedAccount = await updateAccount(id, updateData);

		return json({
			success: true,
			data: updatedAccount,
			field,
			value
		});

	} catch (error) {
		console.error('Failed to update account field:', error);
		return json({
			success: false,
			error: 'Failed to update account field'
		}, { status: 500 });
	}
};