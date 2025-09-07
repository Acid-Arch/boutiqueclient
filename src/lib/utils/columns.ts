// Column configuration types and utilities for table customization
import { browser } from '$app/environment';

// Column definition interface
export interface ColumnDefinition {
	id: string;
	label: string;
	key: string;
	visible: boolean;
	order: number;
	required: boolean; // Cannot be hidden
	width?: string;
	align?: 'left' | 'center' | 'right';
	sortable?: boolean;
	responsive?: {
		hideOnMobile?: boolean;
		hideOnTablet?: boolean;
	};
}

// Column preset interface
export interface ColumnPreset {
	id: string;
	name: string;
	description: string;
	columns: ColumnDefinition[];
	isDefault?: boolean;
	isBuiltIn?: boolean;
}

// Column configuration interface
export interface ColumnConfiguration {
	columns: ColumnDefinition[];
	activePresetId: string | null;
	customPresets: ColumnPreset[];
}

// Default column definitions for accounts table
export const DEFAULT_COLUMNS: ColumnDefinition[] = [
	{
		id: 'account',
		label: 'Account',
		key: 'account',
		visible: true,
		order: 0,
		required: true, // Always visible
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: false,
			hideOnTablet: false
		}
	},
	{
		id: 'status',
		label: 'Status',
		key: 'status',
		visible: true,
		order: 1,
		required: false,
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: false,
			hideOnTablet: false
		}
	},
	{
		id: 'device',
		label: 'Device',
		key: 'device',
		visible: true,
		order: 2,
		required: false,
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: false
		}
	},
	{
		id: 'email',
		label: 'Email',
		key: 'email',
		visible: false,
		order: 3,
		required: false,
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: true
		}
	},
	{
		id: 'deviceId',
		label: 'Device ID',
		key: 'deviceId',
		visible: false,
		order: 4,
		required: false,
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: true
		}
	},
	{
		id: 'cloneNumber',
		label: 'Clone #',
		key: 'cloneNumber',
		visible: false,
		order: 5,
		required: false,
		align: 'center',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: true
		}
	},
	{
		id: 'automation',
		label: 'Automation',
		key: 'automation',
		visible: true,
		order: 6,
		required: false,
		align: 'center',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: false
		}
	},
	{
		id: 'lastLogin',
		label: 'Last Login',
		key: 'lastLogin',
		visible: true,
		order: 7,
		required: false,
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: false
		}
	},
	{
		id: 'created',
		label: 'Created',
		key: 'created',
		visible: true,
		order: 8,
		required: false,
		align: 'left',
		sortable: true,
		responsive: {
			hideOnMobile: true,
			hideOnTablet: true
		}
	},
	{
		id: 'actions',
		label: 'Actions',
		key: 'actions',
		visible: true,
		order: 9,
		required: true, // Always visible
		align: 'right',
		sortable: false,
		responsive: {
			hideOnMobile: false,
			hideOnTablet: false
		}
	}
];

// Built-in column presets
export const BUILT_IN_PRESETS: ColumnPreset[] = [
	{
		id: 'basic',
		name: 'Basic View',
		description: 'Essential columns only - Account, Status, Actions',
		isBuiltIn: true,
		columns: DEFAULT_COLUMNS.map(col => ({
			...col,
			visible: ['account', 'status', 'actions'].includes(col.id)
		}))
	},
	{
		id: 'standard',
		name: 'Standard View',
		description: 'Default view - Account, Status, Device, Automation, Last Login, Actions',
		isBuiltIn: true,
		isDefault: true,
		columns: DEFAULT_COLUMNS.map(col => ({
			...col,
			visible: ['account', 'status', 'device', 'automation', 'lastLogin', 'actions'].includes(col.id)
		}))
	},
	{
		id: 'detailed',
		name: 'Detailed View',
		description: 'All available columns for comprehensive data view',
		isBuiltIn: true,
		columns: DEFAULT_COLUMNS.map(col => ({
			...col,
			visible: !col.responsive?.hideOnMobile // Show all except mobile-hidden
		}))
	},
	{
		id: 'mobile',
		name: 'Mobile View',
		description: 'Optimized for mobile devices - Account, Status, Actions only',
		isBuiltIn: true,
		columns: DEFAULT_COLUMNS.map(col => ({
			...col,
			visible: !col.responsive?.hideOnMobile
		}))
	},
	{
		id: 'management',
		name: 'Management View',
		description: 'Focus on device management - Account, Status, Device, Clone, Actions',
		isBuiltIn: true,
		columns: DEFAULT_COLUMNS.map(col => ({
			...col,
			visible: ['account', 'status', 'device', 'cloneNumber', 'actions'].includes(col.id)
		}))
	}
];

// Storage keys
const COLUMN_CONFIG_KEY = 'boutiqueportal_column_config';
const COLUMN_PRESETS_KEY = 'boutiqueportal_column_presets';

// Utility functions
export function createDefaultColumnConfig(): ColumnConfiguration {
	const standardPreset = BUILT_IN_PRESETS.find(p => p.isDefault) || BUILT_IN_PRESETS[1];
	return {
		columns: [...standardPreset.columns],
		activePresetId: standardPreset.id,
		customPresets: []
	};
}

export function getVisibleColumns(columns: ColumnDefinition[]): ColumnDefinition[] {
	return columns
		.filter(col => col.visible)
		.sort((a, b) => a.order - b.order);
}

export function getColumnByKey(columns: ColumnDefinition[], key: string): ColumnDefinition | undefined {
	return columns.find(col => col.key === key);
}

export function updateColumnVisibility(
	columns: ColumnDefinition[], 
	columnId: string, 
	visible: boolean
): ColumnDefinition[] {
	return columns.map(col => 
		col.id === columnId ? { ...col, visible } : col
	);
}

export function updateColumnOrder(
	columns: ColumnDefinition[], 
	columnId: string, 
	newOrder: number
): ColumnDefinition[] {
	const updatedColumns = [...columns];
	const column = updatedColumns.find(col => col.id === columnId);
	
	if (!column) return columns;
	
	const oldOrder = column.order;
	
	// Update the moved column's order
	column.order = newOrder;
	
	// Adjust other columns' orders
	updatedColumns.forEach(col => {
		if (col.id === columnId) return;
		
		if (newOrder > oldOrder) {
			// Moving right - shift columns left
			if (col.order > oldOrder && col.order <= newOrder) {
				col.order--;
			}
		} else {
			// Moving left - shift columns right
			if (col.order >= newOrder && col.order < oldOrder) {
				col.order++;
			}
		}
	});
	
	return updatedColumns;
}

export function reorderColumns(
	columns: ColumnDefinition[], 
	fromIndex: number, 
	toIndex: number
): ColumnDefinition[] {
	const visibleColumns = getVisibleColumns(columns);
	const fromColumn = visibleColumns[fromIndex];
	const toColumn = visibleColumns[toIndex];
	
	if (!fromColumn || !toColumn) return columns;
	
	return updateColumnOrder(columns, fromColumn.id, toColumn.order);
}

export function applyColumnPreset(
	currentColumns: ColumnDefinition[], 
	preset: ColumnPreset
): ColumnDefinition[] {
	const presetColumnMap = new Map(preset.columns.map(col => [col.id, col]));
	
	return currentColumns.map(col => {
		const presetCol = presetColumnMap.get(col.id);
		return presetCol ? { ...col, ...presetCol } : col;
	});
}

export function createCustomPreset(
	columns: ColumnDefinition[], 
	name: string, 
	description: string
): ColumnPreset {
	return {
		id: `custom_${Date.now()}`,
		name,
		description,
		columns: [...columns],
		isBuiltIn: false
	};
}

export function getResponsiveColumns(
	columns: ColumnDefinition[], 
	breakpoint: 'mobile' | 'tablet' | 'desktop'
): ColumnDefinition[] {
	return columns.filter(col => {
		if (!col.visible) return false;
		
		if (breakpoint === 'mobile' && col.responsive?.hideOnMobile) {
			return false;
		}
		
		if (breakpoint === 'tablet' && col.responsive?.hideOnTablet) {
			return false;
		}
		
		return true;
	});
}

export function exportColumnConfiguration(config: ColumnConfiguration): string {
	return JSON.stringify(config, null, 2);
}

export function importColumnConfiguration(jsonString: string): ColumnConfiguration | null {
	try {
		const imported = JSON.parse(jsonString);
		
		// Validate the structure
		if (!imported.columns || !Array.isArray(imported.columns)) {
			throw new Error('Invalid column configuration');
		}
		
		// Merge with default columns to ensure all required columns exist
		const defaultConfig = createDefaultColumnConfig();
		const mergedColumns = defaultConfig.columns.map(defaultCol => {
			const importedCol = imported.columns.find((col: ColumnDefinition) => col.id === defaultCol.id);
			return importedCol ? { ...defaultCol, ...importedCol } : defaultCol;
		});
		
		return {
			columns: mergedColumns,
			activePresetId: imported.activePresetId || null,
			customPresets: imported.customPresets || []
		};
	} catch (error) {
		console.error('Failed to import column configuration:', error);
		return null;
	}
}

// LocalStorage utilities
export function saveColumnConfiguration(config: ColumnConfiguration): void {
	if (!browser) return;
	
	try {
		localStorage.setItem(COLUMN_CONFIG_KEY, JSON.stringify(config));
	} catch (error) {
		console.error('Failed to save column configuration:', error);
	}
}

export function loadColumnConfiguration(): ColumnConfiguration | null {
	if (!browser) return null;
	
	try {
		const saved = localStorage.getItem(COLUMN_CONFIG_KEY);
		if (!saved) return null;
		
		const parsed = JSON.parse(saved);
		return importColumnConfiguration(JSON.stringify(parsed));
	} catch (error) {
		console.error('Failed to load column configuration:', error);
		return null;
	}
}

export function clearColumnConfiguration(): void {
	if (!browser) return;
	
	try {
		localStorage.removeItem(COLUMN_CONFIG_KEY);
	} catch (error) {
		console.error('Failed to clear column configuration:', error);
	}
}

// URL parameter utilities
export function columnsToUrlParams(columns: ColumnDefinition[]): URLSearchParams {
	const params = new URLSearchParams();
	const visibleColumns = getVisibleColumns(columns);
	const columnOrder = visibleColumns.map(col => col.id).join(',');
	
	if (columnOrder) {
		params.set('columns', columnOrder);
	}
	
	return params;
}

export function urlParamsToColumns(
	params: URLSearchParams, 
	defaultColumns: ColumnDefinition[]
): ColumnDefinition[] {
	const columnsParam = params.get('columns');
	if (!columnsParam) return defaultColumns;
	
	const columnIds = columnsParam.split(',').filter(Boolean);
	if (columnIds.length === 0) return defaultColumns;
	
	// Create a map of current columns
	const columnMap = new Map(defaultColumns.map(col => [col.id, col]));
	
	// Update visibility and order based on URL params
	const updatedColumns = defaultColumns.map(col => ({
		...col,
		visible: columnIds.includes(col.id) || col.required,
		order: columnIds.includes(col.id) ? columnIds.indexOf(col.id) : col.order
	}));
	
	return updatedColumns;
}