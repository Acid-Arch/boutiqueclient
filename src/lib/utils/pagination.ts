/**
 * Pagination utility functions for enhanced pagination controls
 */

export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
}

export interface PageRange {
	start: number;
	end: number;
	showFirstEllipsis: boolean;
	showLastEllipsis: boolean;
	pages: number[];
}

/**
 * Generate page range for pagination display with smart truncation
 * Shows up to 7 page numbers with ellipsis where appropriate
 */
export function generatePageRange(currentPage: number, totalPages: number, maxVisible: number = 7): PageRange {
	if (totalPages <= maxVisible) {
		// Show all pages if total is less than max visible
		return {
			start: 1,
			end: totalPages,
			showFirstEllipsis: false,
			showLastEllipsis: false,
			pages: Array.from({ length: totalPages }, (_, i) => i + 1)
		};
	}

	const sidePages = Math.floor((maxVisible - 3) / 2); // -3 for first, last, and current page
	let start = Math.max(1, currentPage - sidePages);
	let end = Math.min(totalPages, currentPage + sidePages);

	// Adjust if we're near the beginning
	if (start <= 3) {
		start = 1;
		end = Math.min(maxVisible - 1, totalPages);
	}

	// Adjust if we're near the end
	if (end >= totalPages - 2) {
		end = totalPages;
		start = Math.max(1, totalPages - maxVisible + 2);
	}

	const pages: number[] = [];
	const showFirstEllipsis = start > 2;
	const showLastEllipsis = end < totalPages - 1;

	// Always show first page
	if (start > 1) {
		pages.push(1);
	}

	// Add ellipsis if needed
	if (showFirstEllipsis) {
		// Add pages between first and start if there's only one gap
		if (start === 3) {
			pages.push(2);
		}
		// Otherwise, ellipsis will be shown in the component
	}

	// Add the range of pages
	for (let i = start; i <= end; i++) {
		if (i !== 1 && i !== totalPages) {
			pages.push(i);
		}
	}

	// Add ellipsis if needed
	if (showLastEllipsis) {
		// Add pages between end and last if there's only one gap
		if (end === totalPages - 2) {
			pages.push(totalPages - 1);
		}
		// Otherwise, ellipsis will be shown in the component
	}

	// Always show last page
	if (end < totalPages) {
		pages.push(totalPages);
	}

	return {
		start,
		end,
		showFirstEllipsis: showFirstEllipsis && start > 2,
		showLastEllipsis: showLastEllipsis && end < totalPages - 1,
		pages: [...new Set(pages)].sort((a, b) => a - b)
	};
}

/**
 * Validate page number input
 */
export function validatePageNumber(pageStr: string, totalPages: number): number | null {
	const page = parseInt(pageStr.trim());
	
	if (isNaN(page) || page < 1 || page > totalPages) {
		return null;
	}
	
	return page;
}

/**
 * Generate URL with updated pagination parameters
 */
export function buildPaginationUrl(
	basePath: string,
	searchParams: URLSearchParams,
	updates: { page?: number; limit?: number }
): string {
	const newParams = new URLSearchParams(searchParams);
	
	if (updates.page !== undefined) {
		newParams.set('page', updates.page.toString());
	}
	
	if (updates.limit !== undefined) {
		newParams.set('limit', updates.limit.toString());
	}
	
	return `${basePath}?${newParams.toString()}`;
}

/**
 * Get pagination info display text
 */
export function getPaginationInfoText(pagination: PaginationInfo): string {
	const start = ((pagination.page - 1) * pagination.limit) + 1;
	const end = Math.min(pagination.page * pagination.limit, pagination.total);
	
	if (pagination.total === 0) {
		return 'No results found';
	}
	
	if (pagination.total === 1) {
		return 'Showing 1 result';
	}
	
	return `Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${pagination.total.toLocaleString()} results`;
}

/**
 * Calculate pagination progress (0-100)
 */
export function getPaginationProgress(pagination: PaginationInfo): number {
	if (pagination.totalPages <= 1) {
		return 100;
	}
	
	return Math.round((pagination.page / pagination.totalPages) * 100);
}

/**
 * Standard per-page options
 */
export const PER_PAGE_OPTIONS = [
	{ value: 10, label: '10 per page' },
	{ value: 25, label: '25 per page' },
	{ value: 50, label: '50 per page' },
	{ value: 100, label: '100 per page' },
	{ value: 200, label: '200 per page' }
];

/**
 * Get default per-page value
 */
export function getDefaultPerPage(): number {
	return 25;
}

/**
 * Validate per-page value
 */
export function validatePerPage(limit: number): boolean {
	return PER_PAGE_OPTIONS.some(option => option.value === limit);
}