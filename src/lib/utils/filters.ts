// Advanced filtering types and utilities for accounts table

export interface DateRange {
	from?: Date;
	to?: Date;
}

export interface AccountFilters {
	search?: string;
	statuses?: string[];
	deviceAssignment?: 'all' | 'assigned' | 'unassigned' | 'specific';
	specificDevice?: string;
	createdDateRange?: DateRange;
	loginDateRange?: DateRange;
	imapStatus?: 'all' | 'On' | 'Off';
}

export interface FilterPreset {
	id: string;
	name: string;
	description: string;
	filters: AccountFilters;
	isDefault?: boolean;
}

// Predefined filter presets
export const FILTER_PRESETS: FilterPreset[] = [
	{
		id: 'problem-accounts',
		name: 'Problem Accounts',
		description: 'Accounts with login errors, password errors, or banned status',
		filters: {
			statuses: ['Login Error', 'Password Error', 'Banned', 'Critical Error']
		}
	},
	{
		id: 'available-accounts',
		name: 'Available Accounts',
		description: 'Unused accounts not assigned to any device',
		filters: {
			statuses: ['Unused'],
			deviceAssignment: 'unassigned'
		}
	},
	{
		id: 'active-accounts',
		name: 'Active Accounts',
		description: 'Currently logged in accounts',
		filters: {
			statuses: ['Logged In', 'Login In Progress']
		}
	},
	{
		id: 'need-attention',
		name: 'Need Attention',
		description: 'Critical errors and long-term unused accounts',
		filters: {
			statuses: ['Critical Error'],
			createdDateRange: {
				to: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
			}
		}
	},
	{
		id: 'assigned-accounts',
		name: 'Assigned Accounts',
		description: 'Accounts assigned to devices',
		filters: {
			statuses: ['Assigned', 'Logged In'],
			deviceAssignment: 'assigned'
		}
	},
	{
		id: 'recent-accounts',
		name: 'Recent Accounts',
		description: 'Accounts created in the last 7 days',
		filters: {
			createdDateRange: {
				from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
			}
		}
	}
];

// Status options for filtering
export const STATUS_OPTIONS = [
	'Unused',
	'Assigned',
	'Logged In',
	'Banned',
	'Login Error',
	'Password Error',
	'Login In Progress',
	'Critical Error'
];

// Device assignment options
export const DEVICE_ASSIGNMENT_OPTIONS = [
	{ value: 'all', label: 'All Accounts' },
	{ value: 'assigned', label: 'Assigned to Device' },
	{ value: 'unassigned', label: 'Not Assigned' },
	{ value: 'specific', label: 'Specific Device' }
];

// IMAP status options
export const IMAP_STATUS_OPTIONS = [
	{ value: 'all', label: 'All' },
	{ value: 'On', label: 'On' },
	{ value: 'Off', label: 'Off' }
];

// Utility function to check if filters are empty
export function areFiltersEmpty(filters: AccountFilters): boolean {
	return (
		!filters.search &&
		(!filters.statuses || filters.statuses.length === 0) &&
		(!filters.deviceAssignment || filters.deviceAssignment === 'all') &&
		!filters.specificDevice &&
		!filters.createdDateRange?.from &&
		!filters.createdDateRange?.to &&
		!filters.loginDateRange?.from &&
		!filters.loginDateRange?.to &&
		(!filters.imapStatus || filters.imapStatus === 'all')
	);
}

// Utility function to count active filters
export function countActiveFilters(filters: AccountFilters): number {
	let count = 0;
	
	if (filters.search) count++;
	if (filters.statuses && filters.statuses.length > 0) count++;
	if (filters.deviceAssignment && filters.deviceAssignment !== 'all') count++;
	if (filters.specificDevice) count++;
	if (filters.createdDateRange?.from || filters.createdDateRange?.to) count++;
	if (filters.loginDateRange?.from || filters.loginDateRange?.to) count++;
	if (filters.imapStatus && filters.imapStatus !== 'all') count++;
	
	return count;
}

// Utility function to create filter chips data
export interface FilterChip {
	id: string;
	label: string;
	value: string;
	type: 'search' | 'status' | 'device' | 'date' | 'imap';
}

export function createFilterChips(filters: AccountFilters): FilterChip[] {
	const chips: FilterChip[] = [];
	
	// Search chip
	if (filters.search) {
		chips.push({
			id: 'search',
			label: 'Search',
			value: filters.search,
			type: 'search'
		});
	}
	
	// Status chips
	if (filters.statuses && filters.statuses.length > 0) {
		if (filters.statuses.length === 1) {
			chips.push({
				id: 'status',
				label: 'Status',
				value: filters.statuses[0],
				type: 'status'
			});
		} else {
			chips.push({
				id: 'status',
				label: 'Statuses',
				value: `${filters.statuses.length} selected`,
				type: 'status'
			});
		}
	}
	
	// Device assignment chip
	if (filters.deviceAssignment && filters.deviceAssignment !== 'all') {
		const deviceOption = DEVICE_ASSIGNMENT_OPTIONS.find(opt => opt.value === filters.deviceAssignment);
		chips.push({
			id: 'device',
			label: 'Device',
			value: deviceOption?.label || filters.deviceAssignment,
			type: 'device'
		});
	}
	
	// Specific device chip
	if (filters.specificDevice) {
		chips.push({
			id: 'specific-device',
			label: 'Device ID',
			value: filters.specificDevice,
			type: 'device'
		});
	}
	
	// Created date range chip
	if (filters.createdDateRange?.from || filters.createdDateRange?.to) {
		const from = filters.createdDateRange.from?.toLocaleDateString();
		const to = filters.createdDateRange.to?.toLocaleDateString();
		let value = 'Created: ';
		if (from && to) {
			value += `${from} - ${to}`;
		} else if (from) {
			value += `After ${from}`;
		} else if (to) {
			value += `Before ${to}`;
		}
		chips.push({
			id: 'created-date',
			label: 'Created Date',
			value,
			type: 'date'
		});
	}
	
	// Login date range chip
	if (filters.loginDateRange?.from || filters.loginDateRange?.to) {
		const from = filters.loginDateRange.from?.toLocaleDateString();
		const to = filters.loginDateRange.to?.toLocaleDateString();
		let value = 'Last Login: ';
		if (from && to) {
			value += `${from} - ${to}`;
		} else if (from) {
			value += `After ${from}`;
		} else if (to) {
			value += `Before ${to}`;
		}
		chips.push({
			id: 'login-date',
			label: 'Login Date',
			value,
			type: 'date'
		});
	}
	
	// IMAP status chip
	if (filters.imapStatus && filters.imapStatus !== 'all') {
		chips.push({
			id: 'imap',
			label: 'IMAP',
			value: filters.imapStatus,
			type: 'imap'
		});
	}
	
	return chips;
}

// Utility function to convert filters to URL search params
export function filtersToSearchParams(filters: AccountFilters): URLSearchParams {
	const params = new URLSearchParams();
	
	if (filters.search) {
		params.set('search', filters.search);
	}
	
	if (filters.statuses && filters.statuses.length > 0) {
		params.set('statuses', filters.statuses.join(','));
	}
	
	if (filters.deviceAssignment && filters.deviceAssignment !== 'all') {
		params.set('deviceAssignment', filters.deviceAssignment);
	}
	
	if (filters.specificDevice) {
		params.set('specificDevice', filters.specificDevice);
	}
	
	if (filters.createdDateRange?.from) {
		params.set('createdFrom', filters.createdDateRange.from.toISOString());
	}
	
	if (filters.createdDateRange?.to) {
		params.set('createdTo', filters.createdDateRange.to.toISOString());
	}
	
	if (filters.loginDateRange?.from) {
		params.set('loginFrom', filters.loginDateRange.from.toISOString());
	}
	
	if (filters.loginDateRange?.to) {
		params.set('loginTo', filters.loginDateRange.to.toISOString());
	}
	
	if (filters.imapStatus && filters.imapStatus !== 'all') {
		params.set('imapStatus', filters.imapStatus);
	}
	
	return params;
}

// Utility function to parse filters from URL search params
export function searchParamsToFilters(searchParams: URLSearchParams): AccountFilters {
	const filters: AccountFilters = {};
	
	const search = searchParams.get('search');
	if (search) {
		filters.search = search;
	}
	
	const statuses = searchParams.get('statuses');
	if (statuses) {
		filters.statuses = statuses.split(',');
	}
	
	const deviceAssignment = searchParams.get('deviceAssignment');
	if (deviceAssignment) {
		filters.deviceAssignment = deviceAssignment as AccountFilters['deviceAssignment'];
	}
	
	const specificDevice = searchParams.get('specificDevice');
	if (specificDevice) {
		filters.specificDevice = specificDevice;
	}
	
	const createdFrom = searchParams.get('createdFrom');
	const createdTo = searchParams.get('createdTo');
	if (createdFrom || createdTo) {
		filters.createdDateRange = {
			from: createdFrom ? new Date(createdFrom) : undefined,
			to: createdTo ? new Date(createdTo) : undefined
		};
	}
	
	const loginFrom = searchParams.get('loginFrom');
	const loginTo = searchParams.get('loginTo');
	if (loginFrom || loginTo) {
		filters.loginDateRange = {
			from: loginFrom ? new Date(loginFrom) : undefined,
			to: loginTo ? new Date(loginTo) : undefined
		};
	}
	
	const imapStatus = searchParams.get('imapStatus');
	if (imapStatus) {
		filters.imapStatus = imapStatus as AccountFilters['imapStatus'];
	}
	
	return filters;
}

// Utility function to format date for input[type="date"]
export function formatDateForInput(date?: Date): string {
	if (!date) return '';
	return date.toISOString().split('T')[0];
}

// Utility function to parse date from input[type="date"]
export function parseDateFromInput(dateString: string): Date | undefined {
	if (!dateString) return undefined;
	return new Date(dateString);
}

// Default empty filters
export function createEmptyFilters(): AccountFilters {
	return {
		search: undefined,
		statuses: [],
		deviceAssignment: 'all',
		specificDevice: undefined,
		createdDateRange: {},
		loginDateRange: {},
		imapStatus: 'all'
	};
}