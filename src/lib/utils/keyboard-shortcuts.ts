/**
 * Comprehensive keyboard shortcuts system for BoutiquePortal
 * Manages global shortcuts, table navigation, and accessibility features
 */

export interface KeyboardShortcut {
	id: string;
	key: string;
	modifiers: Array<'ctrl' | 'alt' | 'shift' | 'meta'>;
	description: string;
	category: string;
	action: string;
	context?: Array<'global' | 'table' | 'modal' | 'form'>;
	preventDefault?: boolean;
	stopPropagation?: boolean;
	disabled?: boolean;
}

export interface KeyboardShortcutConfig {
	shortcuts: Record<string, KeyboardShortcut>;
	categories: Record<string, { label: string; icon?: string; priority?: number }>;
}

// Default keyboard shortcuts configuration
export const defaultShortcuts: KeyboardShortcutConfig = {
	shortcuts: {
		// Global Navigation
		'global.new-account': {
			id: 'global.new-account',
			key: 'n',
			modifiers: ['ctrl'],
			description: 'Create new account',
			category: 'navigation',
			action: 'navigate-to-create',
			context: ['global'],
			preventDefault: true
		},
		'global.search': {
			id: 'global.search',
			key: 'f',
			modifiers: ['ctrl'],
			description: 'Focus search field',
			category: 'navigation',
			action: 'focus-search',
			context: ['global'],
			preventDefault: true
		},
		'global.command-palette': {
			id: 'global.command-palette',
			key: 'k',
			modifiers: ['ctrl'],
			description: 'Open command palette',
			category: 'navigation',
			action: 'show-command-palette',
			context: ['global'],
			preventDefault: true
		},
		'global.help': {
			id: 'global.help',
			key: '/',
			modifiers: ['ctrl'],
			description: 'Show help overlay',
			category: 'navigation',
			action: 'show-help',
			context: ['global'],
			preventDefault: true
		},
		'global.refresh': {
			id: 'global.refresh',
			key: 'r',
			modifiers: ['ctrl'],
			description: 'Refresh data',
			category: 'actions',
			action: 'refresh-data',
			context: ['global'],
			preventDefault: true
		},
		'global.export': {
			id: 'global.export',
			key: 'e',
			modifiers: ['ctrl'],
			description: 'Export data',
			category: 'actions',
			action: 'show-export-modal',
			context: ['global'],
			preventDefault: true
		},

		// Table Navigation
		'table.select-all': {
			id: 'table.select-all',
			key: 'a',
			modifiers: ['ctrl'],
			description: 'Select all rows',
			category: 'table',
			action: 'select-all-rows',
			context: ['table'],
			preventDefault: true
		},
		'table.clear-selection': {
			id: 'table.clear-selection',
			key: 'Escape',
			modifiers: [],
			description: 'Clear selection',
			category: 'table',
			action: 'clear-selection',
			context: ['table'],
			preventDefault: false
		},
		'table.delete-selected': {
			id: 'table.delete-selected',
			key: 'Delete',
			modifiers: [],
			description: 'Delete selected rows',
			category: 'table',
			action: 'delete-selected',
			context: ['table'],
			preventDefault: true
		},
		'table.first-row': {
			id: 'table.first-row',
			key: 'Home',
			modifiers: [],
			description: 'Go to first row',
			category: 'table',
			action: 'navigate-first',
			context: ['table'],
			preventDefault: true
		},
		'table.last-row': {
			id: 'table.last-row',
			key: 'End',
			modifiers: [],
			description: 'Go to last row',
			category: 'table',
			action: 'navigate-last',
			context: ['table'],
			preventDefault: true
		},
		'table.page-up': {
			id: 'table.page-up',
			key: 'PageUp',
			modifiers: [],
			description: 'Previous page',
			category: 'table',
			action: 'page-up',
			context: ['table'],
			preventDefault: true
		},
		'table.page-down': {
			id: 'table.page-down',
			key: 'PageDown',
			modifiers: [],
			description: 'Next page',
			category: 'table',
			action: 'page-down',
			context: ['table'],
			preventDefault: true
		},
		'table.navigate-up': {
			id: 'table.navigate-up',
			key: 'ArrowUp',
			modifiers: [],
			description: 'Navigate to previous row',
			category: 'table',
			action: 'navigate-up',
			context: ['table'],
			preventDefault: true
		},
		'table.navigate-down': {
			id: 'table.navigate-down',
			key: 'ArrowDown',
			modifiers: [],
			description: 'Navigate to next row',
			category: 'table',
			action: 'navigate-down',
			context: ['table'],
			preventDefault: true
		},
		'table.navigate-left': {
			id: 'table.navigate-left',
			key: 'ArrowLeft',
			modifiers: [],
			description: 'Navigate to previous column',
			category: 'table',
			action: 'navigate-left',
			context: ['table'],
			preventDefault: true
		},
		'table.navigate-right': {
			id: 'table.navigate-right',
			key: 'ArrowRight',
			modifiers: [],
			description: 'Navigate to next column',
			category: 'table',
			action: 'navigate-right',
			context: ['table'],
			preventDefault: true
		},
		'table.activate-cell': {
			id: 'table.activate-cell',
			key: 'Enter',
			modifiers: [],
			description: 'Activate/edit selected cell',
			category: 'table',
			action: 'activate-cell',
			context: ['table'],
			preventDefault: true
		},
		'table.toggle-selection': {
			id: 'table.toggle-selection',
			key: ' ',
			modifiers: [],
			description: 'Toggle row selection',
			category: 'table',
			action: 'toggle-selection',
			context: ['table'],
			preventDefault: true
		},

		// Filter & Search
		'filter.clear-all': {
			id: 'filter.clear-all',
			key: 'l',
			modifiers: ['ctrl'],
			description: 'Clear all filters',
			category: 'filters',
			action: 'clear-filters',
			context: ['global'],
			preventDefault: true
		},
		'filter.advanced': {
			id: 'filter.advanced',
			key: 'f',
			modifiers: ['ctrl', 'shift'],
			description: 'Open advanced filters',
			category: 'filters',
			action: 'show-advanced-filters',
			context: ['global'],
			preventDefault: true
		},
		'filter.status': {
			id: 'filter.status',
			key: 's',
			modifiers: ['alt'],
			description: 'Apply status filter',
			category: 'filters',
			action: 'focus-status-filter',
			context: ['global'],
			preventDefault: true
		},
		'filter.device': {
			id: 'filter.device',
			key: 'd',
			modifiers: ['alt'],
			description: 'Apply device filter',
			category: 'filters',
			action: 'focus-device-filter',
			context: ['global'],
			preventDefault: true
		},
		'search.next': {
			id: 'search.next',
			key: 'F3',
			modifiers: [],
			description: 'Find next',
			category: 'filters',
			action: 'search-next',
			context: ['global'],
			preventDefault: true
		},
		'search.previous': {
			id: 'search.previous',
			key: 'F3',
			modifiers: ['shift'],
			description: 'Find previous',
			category: 'filters',
			action: 'search-previous',
			context: ['global'],
			preventDefault: true
		},

		// Modal & Form Navigation
		'modal.close': {
			id: 'modal.close',
			key: 'Escape',
			modifiers: [],
			description: 'Close modal',
			category: 'modal',
			action: 'close-modal',
			context: ['modal'],
			preventDefault: false
		},
		'modal.confirm': {
			id: 'modal.confirm',
			key: 'Enter',
			modifiers: ['ctrl'],
			description: 'Confirm action',
			category: 'modal',
			action: 'confirm-modal',
			context: ['modal'],
			preventDefault: true
		},
		'form.save': {
			id: 'form.save',
			key: 's',
			modifiers: ['ctrl'],
			description: 'Save form',
			category: 'form',
			action: 'save-form',
			context: ['form'],
			preventDefault: true
		},

		// Special actions
		'undo': {
			id: 'undo',
			key: 'z',
			modifiers: ['ctrl'],
			description: 'Undo last action',
			category: 'actions',
			action: 'undo',
			context: ['global'],
			preventDefault: true
		},
		'redo': {
			id: 'redo',
			key: 'y',
			modifiers: ['ctrl'],
			description: 'Redo last action',
			category: 'actions',
			action: 'redo',
			context: ['global'],
			preventDefault: true
		}
	},

	categories: {
		navigation: {
			label: 'Navigation',
			icon: 'Navigation',
			priority: 1
		},
		table: {
			label: 'Table',
			icon: 'Table',
			priority: 2
		},
		filters: {
			label: 'Filters & Search',
			icon: 'Filter',
			priority: 3
		},
		actions: {
			label: 'Actions',
			icon: 'Zap',
			priority: 4
		},
		modal: {
			label: 'Modals',
			icon: 'Square',
			priority: 5
		},
		form: {
			label: 'Forms',
			icon: 'Edit',
			priority: 6
		}
	}
};

/**
 * Utility functions for keyboard shortcut handling
 */

// Detect if running on macOS for Cmd vs Ctrl
export const isMac = typeof window !== 'undefined' && 
	/Mac|iPod|iPhone|iPad/.test(window.navigator.platform);

// Get display key for a shortcut
export function getShortcutDisplay(shortcut: KeyboardShortcut): string {
	const modifierMap: Record<string, string> = {
		ctrl: isMac ? '⌘' : 'Ctrl',
		alt: isMac ? '⌥' : 'Alt',
		shift: isMac ? '⇧' : 'Shift',
		meta: '⌘'
	};

	const modifiers = shortcut.modifiers.map(mod => modifierMap[mod]).join('+');
	const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
	
	return modifiers ? `${modifiers}+${key}` : key;
}

// Check if a keyboard event matches a shortcut
export function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
	// Check key match with null safety
	if (!event.key || !shortcut.key) return false;
	
	const keyMatch = event.key === shortcut.key || 
		event.code === shortcut.key ||
		event.key.toLowerCase() === shortcut.key.toLowerCase();
	
	if (!keyMatch) return false;

	// Check modifiers
	const hasCtrl = shortcut.modifiers.includes('ctrl') || shortcut.modifiers.includes('meta');
	const hasAlt = shortcut.modifiers.includes('alt');
	const hasShift = shortcut.modifiers.includes('shift');
	
	const eventCtrl = event.ctrlKey || (isMac && event.metaKey);
	const eventAlt = event.altKey;
	const eventShift = event.shiftKey;

	return (hasCtrl === eventCtrl) && 
		   (hasAlt === eventAlt) && 
		   (hasShift === eventShift);
}

// Get shortcuts for a specific context
export function getShortcutsForContext(
	shortcuts: Record<string, KeyboardShortcut>, 
	context: string
): KeyboardShortcut[] {
	return Object.values(shortcuts).filter(shortcut => 
		!shortcut.disabled && 
		(!shortcut.context || shortcut.context.includes(context as any))
	);
}

// Create a keyboard event handler for shortcuts
export function createShortcutHandler(
	shortcuts: Record<string, KeyboardShortcut>,
	context: string,
	handlers: Record<string, (shortcut: KeyboardShortcut, event: KeyboardEvent) => void>
) {
	const contextShortcuts = getShortcutsForContext(shortcuts, context);
	
	return (event: KeyboardEvent) => {
		// Skip if user is typing in input fields (unless explicitly allowed)
		const target = event.target as HTMLElement;
		if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
			// Only allow certain shortcuts in input fields
			const allowedInInputs = ['global.search', 'modal.close', 'form.save'];
			const matched = contextShortcuts.find(shortcut => 
				matchesShortcut(event, shortcut) && allowedInInputs.includes(shortcut.id)
			);
			if (!matched) return;
		}

		for (const shortcut of contextShortcuts) {
			if (matchesShortcut(event, shortcut)) {
				const handler = handlers[shortcut.action];
				if (handler) {
					if (shortcut.preventDefault) {
						event.preventDefault();
					}
					if (shortcut.stopPropagation) {
						event.stopPropagation();
					}
					handler(shortcut, event);
					break; // Only handle first match
				}
			}
		}
	};
}

// Validate shortcut configuration
export function validateShortcut(shortcut: KeyboardShortcut): string[] {
	const errors: string[] = [];
	
	if (!shortcut.id) errors.push('Shortcut must have an id');
	if (!shortcut.key) errors.push('Shortcut must have a key');
	if (!shortcut.description) errors.push('Shortcut must have a description');
	if (!shortcut.category) errors.push('Shortcut must have a category');
	if (!shortcut.action) errors.push('Shortcut must have an action');
	
	// Check for invalid modifier combinations
	if (shortcut.modifiers.includes('ctrl') && shortcut.modifiers.includes('meta')) {
		errors.push('Cannot have both ctrl and meta modifiers');
	}
	
	return errors;
}

// Get grouped shortcuts for display
export function getGroupedShortcuts(
	shortcuts: Record<string, KeyboardShortcut>,
	categories: Record<string, { label: string; icon?: string; priority?: number }>,
	context?: string
): Array<{ category: string; label: string; icon?: string; shortcuts: KeyboardShortcut[] }> {
	const filtered = context ? 
		getShortcutsForContext(shortcuts, context) : 
		Object.values(shortcuts).filter(s => !s.disabled);
	
	const grouped = filtered.reduce((acc, shortcut) => {
		if (!acc[shortcut.category]) {
			acc[shortcut.category] = [];
		}
		acc[shortcut.category].push(shortcut);
		return acc;
	}, {} as Record<string, KeyboardShortcut[]>);

	return Object.entries(grouped)
		.map(([category, shortcuts]) => ({
			category,
			label: categories[category]?.label || category,
			icon: categories[category]?.icon,
			shortcuts: shortcuts.sort((a, b) => a.description.localeCompare(b.description))
		}))
		.sort((a, b) => 
			(categories[a.category]?.priority || 999) - (categories[b.category]?.priority || 999)
		);
}