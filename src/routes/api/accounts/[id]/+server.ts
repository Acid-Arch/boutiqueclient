import { json } from '@sveltejs/kit';
import { getAccountById, updateAccount, deleteAccount, checkUsernameExists, ACCOUNT_STATUSES } from '$lib/server/db-loader.js';
import type { RequestHandler } from './$types';

// GET /api/accounts/[id] - Get account by ID
export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		
		if (isNaN(id)) {
			return json({
				success: false,
				error: 'Invalid account ID'
			}, { status: 400 });
		}

		const account = await getAccountById(id);
		
		if (!account) {
			return json({
				success: false,
				error: 'Account not found'
			}, { status: 404 });
		}

		return json({
			success: true,
			data: account
		});

	} catch (error) {
		console.error('Failed to get account:', error);
		return json({
			success: false,
			error: 'Failed to retrieve account'
		}, { status: 500 });
	}
};

// PUT /api/accounts/[id] - Update account
export const PUT: RequestHandler = async ({ params, request }) => {
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

		const data = await request.json();
		
		const {
			recordId,
			instagramUsername,
			instagramPassword,
			emailAddress,
			emailPassword,
			status,
			imapStatus,
			assignedDeviceId,
			assignedCloneNumber,
			assignedPackageName
		} = data;

		// Validation
		const errors: Record<string, string> = {};

		if (instagramUsername !== undefined) {
			if (!instagramUsername) {
				errors.instagramUsername = 'Instagram username is required';
			} else if (instagramUsername.length < 3) {
				errors.instagramUsername = 'Instagram username must be at least 3 characters';
			} else {
				// Check if username already exists (excluding current account)
				const usernameExists = await checkUsernameExists(instagramUsername, id);
				if (usernameExists) {
					errors.instagramUsername = 'This Instagram username is already registered';
				}
			}
		}

		if (instagramPassword !== undefined) {
			if (!instagramPassword) {
				errors.instagramPassword = 'Instagram password is required';
			} else if (instagramPassword.length < 6) {
				errors.instagramPassword = 'Instagram password must be at least 6 characters';
			}
		}

		if (emailAddress !== undefined) {
			if (!emailAddress) {
				errors.emailAddress = 'Email address is required';
			} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
				errors.emailAddress = 'Please enter a valid email address';
			}
		}

		if (emailPassword !== undefined) {
			if (!emailPassword) {
				errors.emailPassword = 'Email password is required';
			} else if (emailPassword.length < 6) {
				errors.emailPassword = 'Email password must be at least 6 characters';
			}
		}

		if (status !== undefined && !ACCOUNT_STATUSES.includes(status)) {
			errors.status = 'Please select a valid status';
		}

		if (imapStatus !== undefined && !['On', 'Off'].includes(imapStatus)) {
			errors.imapStatus = 'IMAP status must be On or Off';
		}

		if (Object.keys(errors).length > 0) {
			return json({
				success: false,
				errors
			}, { status: 400 });
		}

		// Only update fields that were provided
		const updateData: any = {};
		
		if (recordId !== undefined) updateData.recordId = recordId;
		if (instagramUsername !== undefined) updateData.instagramUsername = instagramUsername;
		if (instagramPassword !== undefined) updateData.instagramPassword = instagramPassword;
		if (emailAddress !== undefined) updateData.emailAddress = emailAddress;
		if (emailPassword !== undefined) updateData.emailPassword = emailPassword;
		if (status !== undefined) updateData.status = status;
		if (imapStatus !== undefined) updateData.imapStatus = imapStatus;
		if (assignedDeviceId !== undefined) updateData.assignedDeviceId = assignedDeviceId;
		if (assignedCloneNumber !== undefined) updateData.assignedCloneNumber = assignedCloneNumber;
		if (assignedPackageName !== undefined) updateData.assignedPackageName = assignedPackageName;

		const updatedAccount = await updateAccount(id, updateData);

		return json({
			success: true,
			data: updatedAccount
		});

	} catch (error) {
		console.error('Failed to update account:', error);
		return json({
			success: false,
			error: 'Failed to update account'
		}, { status: 500 });
	}
};

// DELETE /api/accounts/[id] - Delete account
export const DELETE: RequestHandler = async ({ params }) => {
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

		await deleteAccount(id);

		return json({
			success: true,
			message: 'Account deleted successfully'
		});

	} catch (error) {
		console.error('Failed to delete account:', error);
		return json({
			success: false,
			error: 'Failed to delete account'
		}, { status: 500 });
	}
};

// PATCH /api/accounts/[id] - Partial update account (alternative to PUT)
export const PATCH: RequestHandler = async ({ params, request }) => {
	// Use the same logic as PUT for partial updates
	return PUT({ params, request } as any);
};