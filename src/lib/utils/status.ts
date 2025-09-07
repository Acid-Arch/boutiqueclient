// Shared status utility functions that can be used on both client and server

// Account status constants and types
export const ACCOUNT_STATUSES = [
	'Unused',
	'Assigned',
	'Logged In',
	'Banned',
	'Login Error',
	'Password Error',
	'Login In Progress',
	'Critical Error'
] as const;

export type AccountStatus = typeof ACCOUNT_STATUSES[number];

// Clone status constants and types
export const CLONE_STATUSES = [
	'Available',
	'Assigned',
	'Logged In',
	'Login Error',
	'Maintenance',
	'Broken'
] as const;

export const DEVICE_STATUSES = [
	'Available',
	'Logged In',
	'Maintenance',
	'Broken'
] as const;

export const CLONE_HEALTH = [
	'Working',
	'Broken',
	'Unknown'
] as const;

export type CloneStatus = typeof CLONE_STATUSES[number];
export type DeviceStatus = typeof DEVICE_STATUSES[number];
export type CloneHealth = typeof CLONE_HEALTH[number];

// Helper function to get status color class
export function getStatusClass(status: string): string {
	const statusClassMap: Record<string, string> = {
		'Unused': 'status-unused',
		'Assigned': 'status-assigned',
		'Logged In': 'status-logged-in',
		'Login Error': 'status-login-error',
		'Password Error': 'status-password-error',
		'Banned': 'status-banned',
		'Login In Progress': 'status-login-in-progress',
		'Critical Error': 'status-critical-error'
	};
	
	return statusClassMap[status] || 'status-unused';
}

// Helper function to get clone status color class
export function getCloneStatusClass(status: CloneStatus): string {
	const statusClassMap: Record<CloneStatus, string> = {
		'Available': 'status-unused',
		'Assigned': 'status-assigned', 
		'Logged In': 'status-logged-in',
		'Login Error': 'status-login-error',
		'Maintenance': 'status-password-error',
		'Broken': 'status-banned'
	};
	return statusClassMap[status] || 'status-unused';
}

// Helper function to get device status color class
export function getDeviceStatusClass(status: DeviceStatus): string {
	const statusClassMap: Record<DeviceStatus, string> = {
		'Available': 'status-unused',
		'Logged In': 'status-logged-in',
		'Maintenance': 'status-password-error', 
		'Broken': 'status-banned'
	};
	return statusClassMap[status] || 'status-unused';
}