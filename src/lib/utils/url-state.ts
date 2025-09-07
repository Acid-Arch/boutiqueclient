import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { DeviceViewMode, DeviceSortField, SortDirection } from '../stores/device-view.js';

export interface DeviceURLState {
	// View settings
	view?: DeviceViewMode;
	sort?: DeviceSortField;
	direction?: SortDirection;
	
	// Search and filters
	search?: string;
	status?: string[];
	health?: string[];
	capacityMin?: number;
	capacityMax?: number;
	utilizationMin?: number;
	utilizationMax?: number;
	lastActiveHours?: number;
	
	// Pagination
	page?: number;
	limit?: number;
	
	// Selection (for sharing selected items)
	selected?: string[];
	
	// Dashboard settings
	showStats?: boolean;
	showFilters?: boolean;
}

export class DeviceURLStateManager {
	private currentURL: URL | null = null;

	constructor() {
		if (browser) {
			this.currentURL = new URL(window.location.href);
		}
	}

	// Parse URL parameters into state object
	parseURLState(url?: URL): DeviceURLState {
		const searchParams = url?.searchParams || (browser ? new URL(window.location.href).searchParams : new URLSearchParams());
		
		const state: DeviceURLState = {};

		// View settings
		if (searchParams.has('view')) {
			const view = searchParams.get('view') as DeviceViewMode;
			if (['card', 'table'].includes(view)) {
				state.view = view;
			}
		}

		if (searchParams.has('sort')) {
			const sort = searchParams.get('sort') as DeviceSortField;
			const validSorts: DeviceSortField[] = ['deviceId', 'deviceName', 'deviceStatus', 'deviceHealth', 'totalClones', 'availableClones', 'lastScanned'];
			if (validSorts.includes(sort)) {
				state.sort = sort;
			}
		}

		if (searchParams.has('direction')) {
			const direction = searchParams.get('direction') as SortDirection;
			if (['asc', 'desc'].includes(direction)) {
				state.direction = direction;
			}
		}

		// Search and filters
		if (searchParams.has('search')) {
			state.search = searchParams.get('search') || undefined;
		}

		if (searchParams.has('status')) {
			const status = searchParams.getAll('status').filter(Boolean);
			if (status.length > 0) {
				state.status = status;
			}
		}

		if (searchParams.has('health')) {
			const health = searchParams.getAll('health').filter(Boolean);
			if (health.length > 0) {
				state.health = health;
			}
		}

		// Numeric filters
		if (searchParams.has('capacityMin')) {
			const val = parseInt(searchParams.get('capacityMin') || '0', 10);
			if (!isNaN(val) && val >= 0) state.capacityMin = val;
		}

		if (searchParams.has('capacityMax')) {
			const val = parseInt(searchParams.get('capacityMax') || '1000', 10);
			if (!isNaN(val) && val > 0) state.capacityMax = val;
		}

		if (searchParams.has('utilizationMin')) {
			const val = parseInt(searchParams.get('utilizationMin') || '0', 10);
			if (!isNaN(val) && val >= 0 && val <= 100) state.utilizationMin = val;
		}

		if (searchParams.has('utilizationMax')) {
			const val = parseInt(searchParams.get('utilizationMax') || '100', 10);
			if (!isNaN(val) && val >= 0 && val <= 100) state.utilizationMax = val;
		}

		if (searchParams.has('lastActiveHours')) {
			const val = parseInt(searchParams.get('lastActiveHours') || '0', 10);
			if (!isNaN(val) && val >= 0) state.lastActiveHours = val;
		}

		// Pagination
		if (searchParams.has('page')) {
			const val = parseInt(searchParams.get('page') || '1', 10);
			if (!isNaN(val) && val > 0) state.page = val;
		}

		if (searchParams.has('limit')) {
			const val = parseInt(searchParams.get('limit') || '50', 10);
			if (!isNaN(val) && val > 0 && val <= 500) state.limit = val;
		}

		// Selection (for sharing filtered results with selections)
		if (searchParams.has('selected')) {
			const selected = searchParams.getAll('selected').filter(Boolean);
			if (selected.length > 0) {
				state.selected = selected;
			}
		}

		// Dashboard settings
		if (searchParams.has('showStats')) {
			state.showStats = searchParams.get('showStats') === 'true';
		}

		if (searchParams.has('showFilters')) {
			state.showFilters = searchParams.get('showFilters') === 'true';
		}

		return state;
	}

	// Convert state object to URL parameters
	stateToURLParams(state: DeviceURLState): URLSearchParams {
		const params = new URLSearchParams();

		// View settings
		if (state.view && state.view !== 'card') {
			params.set('view', state.view);
		}

		if (state.sort && state.sort !== 'deviceId') {
			params.set('sort', state.sort);
		}

		if (state.direction && state.direction !== 'asc') {
			params.set('direction', state.direction);
		}

		// Search and filters
		if (state.search) {
			params.set('search', state.search);
		}

		if (state.status && state.status.length > 0) {
			state.status.forEach(status => params.append('status', status));
		}

		if (state.health && state.health.length > 0) {
			state.health.forEach(health => params.append('health', health));
		}

		// Numeric filters (only set if different from defaults)
		if (state.capacityMin && state.capacityMin > 0) {
			params.set('capacityMin', state.capacityMin.toString());
		}

		if (state.capacityMax && state.capacityMax < 1000) {
			params.set('capacityMax', state.capacityMax.toString());
		}

		if (state.utilizationMin && state.utilizationMin > 0) {
			params.set('utilizationMin', state.utilizationMin.toString());
		}

		if (state.utilizationMax && state.utilizationMax < 100) {
			params.set('utilizationMax', state.utilizationMax.toString());
		}

		if (state.lastActiveHours && state.lastActiveHours > 0) {
			params.set('lastActiveHours', state.lastActiveHours.toString());
		}

		// Pagination
		if (state.page && state.page > 1) {
			params.set('page', state.page.toString());
		}

		if (state.limit && state.limit !== 50) {
			params.set('limit', state.limit.toString());
		}

		// Selection
		if (state.selected && state.selected.length > 0) {
			state.selected.forEach(id => params.append('selected', id));
		}

		// Dashboard settings
		if (state.showStats === false) {
			params.set('showStats', 'false');
		}

		if (state.showFilters === true) {
			params.set('showFilters', 'true');
		}

		return params;
	}

	// Update URL with new state
	async updateURL(state: DeviceURLState, options: { replace?: boolean } = {}): Promise<void> {
		if (!browser) return;

		const url = new URL(window.location.href);
		const params = this.stateToURLParams(state);
		
		// Clear existing params
		url.search = '';
		
		// Add new params
		params.forEach((value, key) => {
			url.searchParams.append(key, value);
		});

		// Navigate to new URL
		const method = options.replace ? 'replaceState' : 'pushState';
		window.history[method]({}, '', url.toString());
		
		this.currentURL = url;
	}

	// Get current URL state
	getCurrentState(): DeviceURLState {
		return this.parseURLState(this.currentURL || undefined);
	}

	// Generate shareable URL
	generateShareableURL(state: DeviceURLState, baseURL?: string): string {
		const url = new URL(baseURL || (browser ? window.location.origin + window.location.pathname : 'http://localhost'));
		const params = this.stateToURLParams(state);
		
		params.forEach((value, key) => {
			url.searchParams.append(key, value);
		});

		return url.toString();
	}

	// Create preset URLs
	generatePresetURLs() {
		const baseURL = browser ? `${window.location.origin}${window.location.pathname}` : 'http://localhost/devices';
		
		return {
			// Critical devices view
			critical: this.generateShareableURL({
				view: 'table',
				status: ['Broken', 'Maintenance'],
				health: ['Broken'],
				showFilters: true,
				sort: 'lastScanned',
				direction: 'desc'
			}, baseURL),

			// High capacity devices
			highCapacity: this.generateShareableURL({
				view: 'table',
				status: ['Available', 'Logged In'],
				health: ['Working'],
				capacityMin: 50,
				sort: 'totalClones',
				direction: 'desc'
			}, baseURL),

			// Recently active devices
			recentlyActive: this.generateShareableURL({
				view: 'card',
				lastActiveHours: 6,
				sort: 'lastScanned',
				direction: 'desc'
			}, baseURL),

			// Underutilized devices
			underutilized: this.generateShareableURL({
				view: 'table',
				status: ['Available'],
				health: ['Working'],
				utilizationMax: 30,
				capacityMin: 10,
				sort: 'utilizationMax',
				direction: 'asc'
			}, baseURL)
		};
	}

	// Check if current state differs from default
	hasNonDefaultState(state: DeviceURLState): boolean {
		return !!(
			state.view && state.view !== 'card' ||
			state.sort && state.sort !== 'deviceId' ||
			state.direction && state.direction !== 'asc' ||
			state.search ||
			state.status?.length ||
			state.health?.length ||
			state.capacityMin ||
			state.capacityMax && state.capacityMax < 1000 ||
			state.utilizationMin ||
			state.utilizationMax && state.utilizationMax < 100 ||
			state.lastActiveHours ||
			state.page && state.page > 1 ||
			state.limit && state.limit !== 50 ||
			state.selected?.length ||
			state.showStats === false ||
			state.showFilters === true
		);
	}

	// Clear all URL parameters
	async clearURL(options: { replace?: boolean } = {}): Promise<void> {
		if (!browser) return;

		const url = new URL(window.location.href);
		url.search = '';

		const method = options.replace ? 'replaceState' : 'pushState';
		window.history[method]({}, '', url.toString());
		
		this.currentURL = url;
	}

	// Listen for popstate events (back/forward navigation)
	onURLChange(callback: (state: DeviceURLState) => void): () => void {
		if (!browser) return () => {};

		const handler = () => {
			this.currentURL = new URL(window.location.href);
			callback(this.getCurrentState());
		};

		window.addEventListener('popstate', handler);
		
		return () => {
			window.removeEventListener('popstate', handler);
		};
	}

	// Copy current URL to clipboard
	async copyCurrentURL(): Promise<boolean> {
		if (!browser || !navigator.clipboard) return false;

		try {
			await navigator.clipboard.writeText(window.location.href);
			return true;
		} catch (error) {
			console.warn('Failed to copy URL to clipboard:', error);
			return false;
		}
	}

	// Validate URL state integrity
	validateState(state: DeviceURLState): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Validate capacity range
		if (state.capacityMin && state.capacityMax && state.capacityMin > state.capacityMax) {
			errors.push('Capacity minimum cannot be greater than maximum');
		}

		// Validate utilization range
		if (state.utilizationMin && state.utilizationMax && state.utilizationMin > state.utilizationMax) {
			errors.push('Utilization minimum cannot be greater than maximum');
		}

		// Validate pagination
		if (state.page && state.page < 1) {
			errors.push('Page number must be positive');
		}

		if (state.limit && (state.limit < 1 || state.limit > 500)) {
			errors.push('Limit must be between 1 and 500');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}

// Global instance
export const deviceURLState = new DeviceURLStateManager();