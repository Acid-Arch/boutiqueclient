import { goto } from '$app/navigation';
import { showSuccess, showError, showInfo } from '$lib/stores/notifications';

export interface FormSubmissionOptions {
	loadingMessage?: string;
	successMessage?: string;
	errorMessage?: string;
	successRedirect?: string;
	showLoadingToast?: boolean;
	onSuccess?: (result: any) => void | Promise<void>;
	onError?: (error: any) => void | Promise<void>;
	onFinally?: () => void | Promise<void>;
}

/**
 * Enhanced form submission handler with loading states and notifications
 */
export async function handleFormSubmission(
	action: string,
	formData: FormData,
	options: FormSubmissionOptions = {}
): Promise<{ success: boolean; result?: any; error?: any }> {
	const {
		loadingMessage = 'Processing...',
		successMessage = 'Operation completed successfully',
		errorMessage = 'Operation failed',
		successRedirect,
		showLoadingToast = true,
		onSuccess,
		onError,
		onFinally
	} = options;

	let loadingToastId: string | undefined;

	try {
		// Show loading toast
		if (showLoadingToast) {
			showInfo('Processing', loadingMessage);
			loadingToastId = 'loading'; // Simple placeholder since showInfo returns void
		}

		// Submit form
		const response = await fetch(action, {
			method: 'POST',
			body: formData,
			headers: {
				'Accept': 'application/json'
			}
		});

		const result = await response.json();

		// Remove loading toast
		if (loadingToastId) {
			// We'd need to implement removeToast in the notifications store
			// For now, the toast will auto-dismiss
		}

		if (response.ok && !result.errors) {
			// Success
			showSuccess('Success', successMessage);
			
			await onSuccess?.(result);
			
			if (successRedirect) {
				await goto(successRedirect);
			}
			
			return { success: true, result };
		} else {
			// Form validation errors or other errors
			const error = result.errors || result.error || 'Unknown error';
			
			if (typeof error === 'object') {
				// Multiple field errors
				const errorMessages = Object.values(error as Record<string, string>).join(', ');
				showError('Validation Error', errorMessages);
			} else {
				// Single error message
				showError('Error', error);
			}
			
			await onError?.(error);
			
			return { success: false, error };
		}
	} catch (error) {
		console.error('Form submission error:', error);
		
		// Remove loading toast
		if (loadingToastId) {
			// Auto-dismiss will handle this
		}
		
		showError('Network Error', errorMessage);
		await onError?.(error);
		
		return { success: false, error };
	} finally {
		await onFinally?.();
	}
}

/**
 * Create loading state manager for forms
 */
export function createLoadingState() {
	let loading = $state(false);
	let progress = $state(0);
	let message = $state('');

	return {
		get loading() { return loading; },
		get progress() { return progress; },
		get message() { return message; },
		
		start(msg = 'Loading...') {
			loading = true;
			progress = 0;
			message = msg;
		},
		
		update(newProgress: number, msg?: string) {
			progress = Math.min(Math.max(newProgress, 0), 100);
			if (msg) message = msg;
		},
		
		finish() {
			loading = false;
			progress = 100;
			message = '';
		},
		
		reset() {
			loading = false;
			progress = 0;
			message = '';
		}
	};
}

/**
 * Debounced form validation
 */
export function createValidator<T>(
	validateFn: (data: T) => Record<string, string> | null,
	debounceMs = 300
) {
	let errors = $state<Record<string, string>>({});
	let isValidating = $state(false);
	let timeoutId: NodeJS.Timeout;

	return {
		get errors() { return errors; },
		get isValidating() { return isValidating; },
		get isValid() { return Object.keys(errors).length === 0; },
		
		validate(data: T, immediate = false) {
			if (!immediate) {
				isValidating = true;
				clearTimeout(timeoutId);
				
				timeoutId = setTimeout(() => {
					const result = validateFn(data);
					errors = result || {};
					isValidating = false;
				}, debounceMs);
			} else {
				const result = validateFn(data);
				errors = result || {};
				isValidating = false;
			}
		},
		
		clearErrors() {
			errors = {};
		},
		
		setError(field: string, message: string) {
			errors = { ...errors, [field]: message };
		},
		
		clearError(field: string) {
			const newErrors = { ...errors };
			delete newErrors[field];
			errors = newErrors;
		}
	};
}

/**
 * CRUD operation helpers
 */
export const createCrudHandlers = (entityName: string, baseUrl: string) => {
	return {
		async create(formData: FormData, options: Partial<FormSubmissionOptions> = {}) {
			return handleFormSubmission(`${baseUrl}`, formData, {
				loadingMessage: `Creating ${entityName}...`,
				successMessage: `${entityName} created successfully`,
				errorMessage: `Failed to create ${entityName}`,
				...options
			});
		},

		async update(id: string, formData: FormData, options: Partial<FormSubmissionOptions> = {}) {
			return handleFormSubmission(`${baseUrl}/${id}`, formData, {
				loadingMessage: `Updating ${entityName}...`,
				successMessage: `${entityName} updated successfully`,
				errorMessage: `Failed to update ${entityName}`,
				...options
			});
		},

		async delete(id: string, options: Partial<FormSubmissionOptions> = {}) {
			const formData = new FormData();
			formData.append('_method', 'DELETE');
			
			return handleFormSubmission(`${baseUrl}/${id}`, formData, {
				loadingMessage: `Deleting ${entityName}...`,
				successMessage: `${entityName} deleted successfully`,
				errorMessage: `Failed to delete ${entityName}`,
				...options
			});
		}
	};
};

/**
 * Bulk operations helper
 */
export async function handleBulkOperation<T>(
	items: T[],
	operation: (item: T) => Promise<any>,
	options: {
		batchSize?: number;
		onProgress?: (completed: number, total: number) => void;
		onItemSuccess?: (item: T, result: any) => void;
		onItemError?: (item: T, error: any) => void;
		continueOnError?: boolean;
	} = {}
) {
	const {
		batchSize = 5,
		onProgress,
		onItemSuccess,
		onItemError,
		continueOnError = true
	} = options;

	const results: { item: T; success: boolean; result?: any; error?: any }[] = [];
	const batches = [];
	
	// Create batches
	for (let i = 0; i < items.length; i += batchSize) {
		batches.push(items.slice(i, i + batchSize));
	}

	let completed = 0;

	for (const batch of batches) {
		const promises = batch.map(async (item) => {
			try {
				const result = await operation(item);
				const itemResult = { item, success: true, result };
				results.push(itemResult);
				onItemSuccess?.(item, result);
				return itemResult;
			} catch (error) {
				const itemResult = { item, success: false, error };
				results.push(itemResult);
				onItemError?.(item, error);
				
				if (!continueOnError) {
					throw error;
				}
				
				return itemResult;
			} finally {
				completed++;
				onProgress?.(completed, items.length);
			}
		});

		await Promise.all(promises);
	}

	const successful = results.filter(r => r.success);
	const failed = results.filter(r => !r.success);

	return {
		results,
		successful,
		failed,
		successCount: successful.length,
		failureCount: failed.length,
		totalCount: items.length
	};
}