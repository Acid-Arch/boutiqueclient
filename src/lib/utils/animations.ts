/**
 * Comprehensive Animation Utilities for BoutiquePortal
 * 
 * This module provides a complete animation system with:
 * - Motion presets and easing functions
 * - Performance-optimized 60fps animations
 * - Accessibility compliance (respects prefers-reduced-motion)
 * - Hardware acceleration where appropriate
 * - Reusable animation components and utilities
 */

import { cubicOut, quartOut, quintOut, expoOut, elasticOut } from 'svelte/easing';

// ========================================
// Animation Presets and Configuration
// ========================================

export const ANIMATION_DURATIONS = {
	instant: 0,
	fast: 150,
	normal: 300,
	slow: 500,
	slowest: 750
} as const;

export const EASING_PRESETS = {
	// Natural motion
	ease: cubicOut,
	bouncy: elasticOut,
	smooth: quartOut,
	sharp: quintOut,
	expo: expoOut,
	
	// CSS equivalents
	linear: (t: number) => t,
	easeIn: (t: number) => t * t,
	easeOut: (t: number) => 1 - Math.pow(1 - t, 2),
	easeInOut: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
} as const;

// ========================================
// Motion Presets for Common Animations
// ========================================

export const MOTION_PRESETS = {
	// Page transitions
	pageTransition: {
		duration: ANIMATION_DURATIONS.normal,
		easing: EASING_PRESETS.ease,
		opacity: [0, 1],
		scale: [0.95, 1],
		y: [20, 0]
	},
	
	// Modal animations
	modalEntry: {
		duration: ANIMATION_DURATIONS.normal,
		easing: EASING_PRESETS.ease,
		opacity: [0, 1],
		scale: [0.9, 1],
		backdropOpacity: [0, 1]
	},
	
	modalExit: {
		duration: ANIMATION_DURATIONS.fast,
		easing: EASING_PRESETS.sharp,
		opacity: [1, 0],
		scale: [1, 0.95],
		backdropOpacity: [1, 0]
	},
	
	// Card hover effects
	cardHover: {
		duration: ANIMATION_DURATIONS.fast,
		easing: EASING_PRESETS.ease,
		y: [0, -8],
		scale: [1, 1.02],
		shadowBlur: [10, 20]
	},
	
	// Button interactions
	buttonPress: {
		duration: ANIMATION_DURATIONS.fast,
		easing: EASING_PRESETS.ease,
		scale: [1, 0.95],
		opacity: [1, 0.8]
	},
	
	buttonHover: {
		duration: ANIMATION_DURATIONS.fast,
		easing: EASING_PRESETS.ease,
		y: [0, -2],
		shadowBlur: [5, 15]
	},
	
	// Loading states
	pulse: {
		duration: ANIMATION_DURATIONS.slow,
		easing: EASING_PRESETS.easeInOut,
		opacity: [0.6, 1],
		iterationCount: Infinity,
		direction: 'alternate'
	},
	
	spin: {
		duration: ANIMATION_DURATIONS.slow,
		easing: EASING_PRESETS.linear,
		rotate: [0, 360],
		iterationCount: Infinity
	},
	
	// Status transitions
	statusChange: {
		duration: ANIMATION_DURATIONS.normal,
		easing: EASING_PRESETS.bouncy,
		scale: [1, 1.1, 1],
		opacity: [1, 0.8, 1]
	},
	
	// List item animations
	listItemEntry: {
		duration: ANIMATION_DURATIONS.normal,
		easing: EASING_PRESETS.ease,
		x: [-50, 0],
		opacity: [0, 1]
	},
	
	listItemExit: {
		duration: ANIMATION_DURATIONS.fast,
		easing: EASING_PRESETS.sharp,
		x: [0, 50],
		opacity: [1, 0],
		height: ['auto', 0]
	}
} as const;

// ========================================
// Accessibility and Performance Utilities
// ========================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get animation duration respecting user preferences
 */
export function getAnimationDuration(duration: number): number {
	return prefersReducedMotion() ? 0 : duration;
}

/**
 * Apply hardware acceleration to an element
 */
export function enableHardwareAcceleration(element: HTMLElement): void {
	element.style.transform = element.style.transform || 'translateZ(0)';
	element.style.willChange = 'transform, opacity';
}

/**
 * Remove hardware acceleration from an element
 */
export function disableHardwareAcceleration(element: HTMLElement): void {
	element.style.willChange = 'auto';
}

// ========================================
// Animation Utility Functions
// ========================================

/**
 * Create a debounced animation function to prevent rapid-fire animations
 */
export function debounceAnimation(fn: Function, delay: number = 100) {
	let timeoutId: number;
	return function (this: any, ...args: any[]) {
		clearTimeout(timeoutId);
		timeoutId = window.setTimeout(() => fn.apply(this, args), delay);
	};
}

/**
 * Animate element with Web Animations API
 */
export function animateElement(
	element: HTMLElement,
	keyframes: Keyframe[],
	options: KeyframeAnimationOptions = {}
): Animation {
	// Apply default options
	const animationOptions: KeyframeAnimationOptions = {
		duration: getAnimationDuration(ANIMATION_DURATIONS.normal),
		easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
		fill: 'both',
		...options
	};
	
	// Skip animation if reduced motion is preferred
	if (prefersReducedMotion()) {
		animationOptions.duration = 0;
	}
	
	// Enable hardware acceleration for transform animations
	const hasTransform = keyframes.some(frame => 
		'transform' in frame || 'scale' in frame || 'translateX' in frame || 'translateY' in frame
	);
	
	if (hasTransform) {
		enableHardwareAcceleration(element);
	}
	
	const animation = element.animate(keyframes, animationOptions);
	
	// Clean up hardware acceleration when animation completes
	animation.addEventListener('finish', () => {
		if (hasTransform) {
			disableHardwareAcceleration(element);
		}
	});
	
	return animation;
}

/**
 * Create staggered animations for multiple elements
 */
export function staggeredAnimation(
	elements: HTMLElement[],
	keyframes: Keyframe[],
	options: KeyframeAnimationOptions = {},
	staggerDelay: number = 100
): Animation[] {
	return elements.map((element, index) => {
		const staggeredOptions = {
			...options,
			delay: (options.delay || 0) + (index * staggerDelay)
		};
		return animateElement(element, keyframes, staggeredOptions);
	});
}

/**
 * Ripple effect animation
 */
export function createRippleEffect(
	element: HTMLElement,
	event: MouseEvent | TouchEvent,
	color: string = 'rgba(255, 255, 255, 0.3)'
): Animation {
	const rect = element.getBoundingClientRect();
	const size = Math.max(rect.width, rect.height);
	const radius = size / 2;
	
	// Get click position
	let x: number, y: number;
	if (event instanceof MouseEvent) {
		x = event.clientX - rect.left;
		y = event.clientY - rect.top;
	} else {
		const touch = event.touches[0] || event.changedTouches[0];
		x = touch.clientX - rect.left;
		y = touch.clientY - rect.top;
	}
	
	// Create ripple element
	const ripple = document.createElement('div');
	ripple.style.position = 'absolute';
	ripple.style.borderRadius = '50%';
	ripple.style.background = color;
	ripple.style.transform = 'scale(0)';
	ripple.style.left = x - radius + 'px';
	ripple.style.top = y - radius + 'px';
	ripple.style.width = size + 'px';
	ripple.style.height = size + 'px';
	ripple.style.pointerEvents = 'none';
	ripple.style.zIndex = '1000';
	
	// Ensure parent is positioned
	const parentPosition = getComputedStyle(element).position;
	if (parentPosition === 'static') {
		element.style.position = 'relative';
	}
	
	element.appendChild(ripple);
	
	// Animate ripple
	const animation = animateElement(ripple, [
		{ transform: 'scale(0)', opacity: 0.7 },
		{ transform: 'scale(1)', opacity: 0 }
	], {
		duration: getAnimationDuration(600),
		easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
	});
	
	// Clean up ripple element
	animation.addEventListener('finish', () => {
		ripple.remove();
	});
	
	return animation;
}

/**
 * Parallax scroll effect
 */
export function createParallaxEffect(
	element: HTMLElement,
	speed: number = 0.5,
	direction: 'vertical' | 'horizontal' = 'vertical'
): () => void {
	let isScrolling = false;
	
	const updateParallax = () => {
		if (!isScrolling) {
			requestAnimationFrame(() => {
				const scrolled = window.pageYOffset;
				const parallax = scrolled * speed;
				
				if (direction === 'vertical') {
					element.style.transform = `translateY(${parallax}px)`;
				} else {
					element.style.transform = `translateX(${parallax}px)`;
				}
				
				isScrolling = false;
			});
		}
		isScrolling = true;
	};
	
	// Don't apply parallax if reduced motion is preferred
	if (prefersReducedMotion()) {
		return () => {};
	}
	
	window.addEventListener('scroll', updateParallax, { passive: true });
	
	// Return cleanup function
	return () => {
		window.removeEventListener('scroll', updateParallax);
	};
}

/**
 * Intersection observer for reveal animations
 */
export function createRevealObserver(
	callback: (entry: IntersectionObserverEntry) => void,
	options: IntersectionObserverInit = {}
): IntersectionObserver {
	const defaultOptions: IntersectionObserverInit = {
		root: null,
		rootMargin: '0px 0px -100px 0px',
		threshold: 0.1,
		...options
	};
	
	return new IntersectionObserver((entries) => {
		entries.forEach(callback);
	}, defaultOptions);
}

/**
 * Animate number counter
 */
export function animateCounter(
	element: HTMLElement,
	start: number,
	end: number,
	duration: number = 1000,
	formatter?: (value: number) => string
): Animation {
	let startTime: number | null = null;
	
	const step = (timestamp: number) => {
		if (!startTime) startTime = timestamp;
		const progress = Math.min((timestamp - startTime) / duration, 1);
		
		const current = start + (end - start) * EASING_PRESETS.ease(progress);
		const formattedValue = formatter ? formatter(current) : Math.round(current).toString();
		element.textContent = formattedValue;
		
		if (progress < 1) {
			requestAnimationFrame(step);
		}
	};
	
	// Return a pseudo-animation object for consistency
	const animation = {
		cancel: () => {},
		finish: () => {
			const formattedValue = formatter ? formatter(end) : end.toString();
			element.textContent = formattedValue;
		}
	} as Animation;
	
	if (!prefersReducedMotion()) {
		requestAnimationFrame(step);
	} else {
		animation.finish();
	}
	
	return animation;
}

// ========================================
// CSS Animation Classes
// ========================================

/**
 * Add CSS animation class with cleanup
 */
export function addAnimationClass(
	element: HTMLElement,
	className: string,
	duration?: number
): Promise<void> {
	return new Promise((resolve) => {
		const cleanup = () => {
			element.classList.remove(className);
			element.removeEventListener('animationend', cleanup);
			resolve();
		};
		
		element.addEventListener('animationend', cleanup);
		element.classList.add(className);
		
		// Fallback timeout in case animationend doesn't fire
		if (duration) {
			setTimeout(cleanup, duration + 100);
		}
	});
}

/**
 * Trigger CSS animation with promise
 */
export function triggerAnimation(
	element: HTMLElement,
	animationName: string,
	duration: number = ANIMATION_DURATIONS.normal
): Promise<void> {
	if (prefersReducedMotion()) {
		return Promise.resolve();
	}
	
	return new Promise((resolve) => {
		const cleanup = () => {
			element.style.animation = '';
			resolve();
		};
		
		element.addEventListener('animationend', cleanup, { once: true });
		element.style.animation = `${animationName} ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
		
		// Fallback timeout
		setTimeout(cleanup, duration + 100);
	});
}

// ========================================
// Performance Monitoring
// ========================================

/**
 * Monitor animation performance
 */
export class AnimationPerformanceMonitor {
	private frameCount = 0;
	private lastTime = 0;
	private fps = 0;
	
	start() {
		this.frameCount = 0;
		this.lastTime = performance.now();
		this.measureFrame();
	}
	
	private measureFrame = () => {
		this.frameCount++;
		const currentTime = performance.now();
		
		if (currentTime - this.lastTime >= 1000) {
			this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
			this.frameCount = 0;
			this.lastTime = currentTime;
			
			// Log performance warning if FPS is low
			if (this.fps < 55 && this.fps > 0) {
				console.warn(`Animation performance warning: ${this.fps} FPS`);
			}
		}
		
		requestAnimationFrame(this.measureFrame);
	};
	
	getFPS(): number {
		return this.fps;
	}
}

// ========================================
// Type Definitions
// ========================================

export type AnimationPreset = keyof typeof MOTION_PRESETS;
export type EasingPreset = keyof typeof EASING_PRESETS;
export type AnimationDuration = keyof typeof ANIMATION_DURATIONS;

export interface AnimationConfig {
	duration?: number;
	easing?: string | ((t: number) => number);
	delay?: number;
	fill?: FillMode;
	direction?: PlaybackDirection;
	iterationCount?: number;
}

export interface MotionPreset {
	duration: number;
	easing: (t: number) => number;
	[key: string]: any;
}