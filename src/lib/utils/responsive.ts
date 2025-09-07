/**
 * Responsive Utilities
 * Handles responsive breakpoints and layout management
 */

export interface BreakpointConfig {
	mobile: number;
	tablet: number;
	desktop: number;
	wide: number;
}

export const BREAKPOINTS: BreakpointConfig = {
	mobile: 768,
	tablet: 1024,
	desktop: 1280,
	wide: 1536,
};

export type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'wide';
export type LayoutMode = 'card' | 'table' | 'hybrid';

/**
 * Get current screen size category
 */
export function getScreenSize(): ScreenSize {
	if (typeof window === 'undefined') return 'desktop';
	
	const width = window.innerWidth;
	
	if (width < BREAKPOINTS.mobile) return 'mobile';
	if (width < BREAKPOINTS.tablet) return 'tablet';
	if (width < BREAKPOINTS.desktop) return 'desktop';
	return 'wide';
}

/**
 * Check if current screen matches a breakpoint
 */
export function matchesBreakpoint(breakpoint: ScreenSize): boolean {
	if (typeof window === 'undefined') return false;
	
	const width = window.innerWidth;
	
	switch (breakpoint) {
		case 'mobile':
			return width < BREAKPOINTS.mobile;
		case 'tablet':
			return width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
		case 'desktop':
			return width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
		case 'wide':
			return width >= BREAKPOINTS.desktop;
		default:
			return false;
	}
}

/**
 * Check if screen is at least a certain size
 */
export function isAtLeast(breakpoint: ScreenSize): boolean {
	if (typeof window === 'undefined') return false;
	
	const width = window.innerWidth;
	const threshold = BREAKPOINTS[breakpoint];
	
	return width >= threshold;
}

/**
 * Check if screen is at most a certain size
 */
export function isAtMost(breakpoint: ScreenSize): boolean {
	if (typeof window === 'undefined') return false;
	
	const width = window.innerWidth;
	const threshold = BREAKPOINTS[breakpoint];
	
	return width < threshold;
}

/**
 * Determine optimal layout mode based on screen size and device capabilities
 */
export function getOptimalLayoutMode(): LayoutMode {
	const screenSize = getScreenSize();
	const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
	
	if (screenSize === 'mobile') {
		return 'card';
	}
	
	if (screenSize === 'tablet') {
		return isTouchDevice ? 'card' : 'hybrid';
	}
	
	return 'table';
}

/**
 * Calculate optimal number of columns for card layout
 */
export function getOptimalCardColumns(): number {
	const screenSize = getScreenSize();
	
	switch (screenSize) {
		case 'mobile':
			return 1;
		case 'tablet':
			return 2;
		case 'desktop':
			return 3;
		case 'wide':
			return 4;
		default:
			return 1;
	}
}

/**
 * Create a reactive store for screen size
 */
export function createScreenSizeStore() {
	if (typeof window === 'undefined') {
		return {
			subscribe: (fn: (value: ScreenSize) => void) => {
				fn('desktop');
				return () => {};
			}
		};
	}

	let currentSize = getScreenSize();
	const subscribers = new Set<(value: ScreenSize) => void>();

	const handleResize = () => {
		const newSize = getScreenSize();
		if (newSize !== currentSize) {
			currentSize = newSize;
			subscribers.forEach(fn => fn(currentSize));
		}
	};

	window.addEventListener('resize', handleResize);

	return {
		subscribe: (fn: (value: ScreenSize) => void) => {
			subscribers.add(fn);
			fn(currentSize);
			
			return () => {
				subscribers.delete(fn);
				if (subscribers.size === 0) {
					window.removeEventListener('resize', handleResize);
				}
			};
		}
	};
}

/**
 * Media query utilities
 */
export const mediaQueries = {
	mobile: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
	tablet: `(min-width: ${BREAKPOINTS.mobile}px) and (max-width: ${BREAKPOINTS.tablet - 1}px)`,
	desktop: `(min-width: ${BREAKPOINTS.tablet}px) and (max-width: ${BREAKPOINTS.desktop - 1}px)`,
	wide: `(min-width: ${BREAKPOINTS.desktop}px)`,
	
	// Utility queries
	mobileUp: `(min-width: ${BREAKPOINTS.mobile}px)`,
	tabletUp: `(min-width: ${BREAKPOINTS.tablet}px)`,
	desktopUp: `(min-width: ${BREAKPOINTS.desktop}px)`,
	
	mobileDown: `(max-width: ${BREAKPOINTS.mobile - 1}px)`,
	tabletDown: `(max-width: ${BREAKPOINTS.tablet - 1}px)`,
	desktopDown: `(max-width: ${BREAKPOINTS.desktop - 1}px)`,
	
	// Touch device detection
	touch: '(hover: none) and (pointer: coarse)',
	noTouch: '(hover: hover) and (pointer: fine)',
	
	// Orientation
	portrait: '(orientation: portrait)',
	landscape: '(orientation: landscape)',
	
	// High DPI
	retina: '(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)',
};

/**
 * Check if media query matches
 */
export function matchMedia(query: string): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia(query).matches;
}

/**
 * Create a responsive value that changes based on screen size
 */
export function createResponsiveValue<T>(values: {
	mobile?: T;
	tablet?: T;
	desktop?: T;
	wide?: T;
	default: T;
}): T {
	const screenSize = getScreenSize();
	return values[screenSize] ?? values.default;
}

/**
 * Debounced resize observer
 */
export function createResizeObserver(
	callback: (entries: ResizeObserverEntry[]) => void,
	debounceMs = 100
) {
	if (typeof window === 'undefined' || !window.ResizeObserver) {
		return {
			observe: () => {},
			unobserve: () => {},
			disconnect: () => {},
		};
	}

	let timeoutId: number;

	const debouncedCallback = (entries: ResizeObserverEntry[]) => {
		clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => callback(entries), debounceMs);
	};

	return new ResizeObserver(debouncedCallback);
}

/**
 * Viewport utilities
 */
export function getViewportSize() {
	if (typeof window === 'undefined') {
		return { width: 1024, height: 768 };
	}

	return {
		width: window.innerWidth,
		height: window.innerHeight,
	};
}

export function getViewportAspectRatio(): number {
	const { width, height } = getViewportSize();
	return width / height;
}

export function isLandscape(): boolean {
	return getViewportAspectRatio() > 1;
}

export function isPortrait(): boolean {
	return getViewportAspectRatio() <= 1;
}

/**
 * Safe area utilities for mobile devices with notches
 */
export function getSafeAreaInsets() {
	if (typeof window === 'undefined') {
		return { top: 0, right: 0, bottom: 0, left: 0 };
	}

	const style = getComputedStyle(document.documentElement);
	
	return {
		top: parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
		right: parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10),
		bottom: parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
		left: parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
	};
}