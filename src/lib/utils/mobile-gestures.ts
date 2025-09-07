import { browser } from '$app/environment';

export interface GestureEvent {
	type: 'swipe' | 'tap' | 'longpress' | 'pinch' | 'pan';
	direction?: 'left' | 'right' | 'up' | 'down';
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	deltaX: number;
	deltaY: number;
	distance: number;
	duration: number;
	scale?: number;
	target: HTMLElement;
	originalEvent: TouchEvent | PointerEvent;
}

export interface GestureConfig {
	swipeThreshold: number;
	tapThreshold: number;
	longPressDelay: number;
	pinchThreshold: number;
	panThreshold: number;
	preventDefault: boolean;
	enablePinch: boolean;
	enablePan: boolean;
}

const defaultConfig: GestureConfig = {
	swipeThreshold: 50,
	tapThreshold: 10,
	longPressDelay: 500,
	pinchThreshold: 0.1,
	panThreshold: 10,
	preventDefault: true,
	enablePinch: false,
	enablePan: true
};

export class MobileGestureHandler {
	private element: HTMLElement;
	private config: GestureConfig;
	private callbacks: Map<string, (event: GestureEvent) => void> = new Map();
	
	// Touch tracking
	private touchStartTime = 0;
	private touchStartX = 0;
	private touchStartY = 0;
	private touchEndX = 0;
	private touchEndY = 0;
	private longPressTimer: number | null = null;
	private isLongPressed = false;
	
	// Multi-touch tracking
	private touches: Touch[] = [];
	private initialDistance = 0;
	private initialScale = 1;
	
	// Pan tracking
	private isPanning = false;
	private panStartX = 0;
	private panStartY = 0;

	constructor(element: HTMLElement, config: Partial<GestureConfig> = {}) {
		this.element = element;
		this.config = { ...defaultConfig, ...config };
		
		if (browser) {
			this.attachEventListeners();
		}
	}

	private attachEventListeners() {
		// Use both touch and pointer events for broader compatibility
		if ('ontouchstart' in window) {
			this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
			this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
			this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
			this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this));
		} else {
			this.element.addEventListener('pointerdown', this.handlePointerDown.bind(this));
			this.element.addEventListener('pointermove', this.handlePointerMove.bind(this));
			this.element.addEventListener('pointerup', this.handlePointerUp.bind(this));
			this.element.addEventListener('pointercancel', this.handlePointerCancel.bind(this));
		}
	}

	private handleTouchStart(event: TouchEvent) {
		if (this.config.preventDefault) {
			event.preventDefault();
		}

		this.touches = Array.from(event.touches);
		const touch = event.touches[0];
		
		this.touchStartTime = Date.now();
		this.touchStartX = touch.clientX;
		this.touchStartY = touch.clientY;
		this.panStartX = touch.clientX;
		this.panStartY = touch.clientY;
		
		this.isLongPressed = false;
		this.isPanning = false;

		// Multi-touch handling
		if (event.touches.length === 2 && this.config.enablePinch) {
			this.initialDistance = this.getDistance(event.touches[0], event.touches[1]);
			this.initialScale = 1;
		}

		// Start long press timer
		this.clearLongPressTimer();
		this.longPressTimer = window.setTimeout(() => {
			this.isLongPressed = true;
			this.triggerGesture('longpress', {
				startX: this.touchStartX,
				startY: this.touchStartY,
				endX: this.touchStartX,
				endY: this.touchStartY,
				deltaX: 0,
				deltaY: 0,
				distance: 0,
				duration: Date.now() - this.touchStartTime,
				target: event.target as HTMLElement,
				originalEvent: event
			});
		}, this.config.longPressDelay);
	}

	private handleTouchMove(event: TouchEvent) {
		if (this.config.preventDefault) {
			event.preventDefault();
		}

		const touch = event.touches[0];
		this.touchEndX = touch.clientX;
		this.touchEndY = touch.clientY;

		const deltaX = this.touchEndX - this.touchStartX;
		const deltaY = this.touchEndY - this.touchStartY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Cancel long press if moved too much
		if (distance > this.config.tapThreshold) {
			this.clearLongPressTimer();
		}

		// Handle pinch gesture
		if (event.touches.length === 2 && this.config.enablePinch) {
			const currentDistance = this.getDistance(event.touches[0], event.touches[1]);
			const scale = currentDistance / this.initialDistance;
			
			if (Math.abs(scale - this.initialScale) > this.config.pinchThreshold) {
				this.triggerGesture('pinch', {
					startX: this.touchStartX,
					startY: this.touchStartY,
					endX: this.touchEndX,
					endY: this.touchEndY,
					deltaX,
					deltaY,
					distance,
					duration: Date.now() - this.touchStartTime,
					scale,
					target: event.target as HTMLElement,
					originalEvent: event
				});
				this.initialScale = scale;
			}
		}

		// Handle pan gesture
		if (event.touches.length === 1 && this.config.enablePan) {
			const panDeltaX = touch.clientX - this.panStartX;
			const panDeltaY = touch.clientY - this.panStartY;
			const panDistance = Math.sqrt(panDeltaX * panDeltaX + panDeltaY * panDeltaY);

			if (panDistance > this.config.panThreshold) {
				if (!this.isPanning) {
					this.isPanning = true;
				}

				this.triggerGesture('pan', {
					startX: this.panStartX,
					startY: this.panStartY,
					endX: touch.clientX,
					endY: touch.clientY,
					deltaX: panDeltaX,
					deltaY: panDeltaY,
					distance: panDistance,
					duration: Date.now() - this.touchStartTime,
					target: event.target as HTMLElement,
					originalEvent: event
				});
			}
		}
	}

	private handleTouchEnd(event: TouchEvent) {
		this.clearLongPressTimer();

		const deltaX = this.touchEndX - this.touchStartX;
		const deltaY = this.touchEndY - this.touchStartY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const duration = Date.now() - this.touchStartTime;

		// Don't trigger other gestures if long press was triggered
		if (this.isLongPressed) {
			return;
		}

		// Tap gesture
		if (distance <= this.config.tapThreshold && duration < this.config.longPressDelay) {
			this.triggerGesture('tap', {
				startX: this.touchStartX,
				startY: this.touchStartY,
				endX: this.touchEndX,
				endY: this.touchEndY,
				deltaX,
				deltaY,
				distance,
				duration,
				target: event.target as HTMLElement,
				originalEvent: event
			});
		}
		// Swipe gesture
		else if (distance > this.config.swipeThreshold) {
			const direction = this.getSwipeDirection(deltaX, deltaY);
			this.triggerGesture('swipe', {
				startX: this.touchStartX,
				startY: this.touchStartY,
				endX: this.touchEndX,
				endY: this.touchEndY,
				deltaX,
				deltaY,
				distance,
				duration,
				direction,
				target: event.target as HTMLElement,
				originalEvent: event
			});
		}

		this.isPanning = false;
	}

	private handleTouchCancel(event: TouchEvent) {
		this.clearLongPressTimer();
		this.isPanning = false;
	}

	// Pointer events (for mouse/stylus on touch devices)
	private handlePointerDown(event: PointerEvent) {
		this.touchStartTime = Date.now();
		this.touchStartX = event.clientX;
		this.touchStartY = event.clientY;
		this.panStartX = event.clientX;
		this.panStartY = event.clientY;
		
		this.isLongPressed = false;
		this.isPanning = false;

		// Start long press timer for pointer events
		this.clearLongPressTimer();
		this.longPressTimer = window.setTimeout(() => {
			this.isLongPressed = true;
			this.triggerGesture('longpress', {
				startX: this.touchStartX,
				startY: this.touchStartY,
				endX: this.touchStartX,
				endY: this.touchStartY,
				deltaX: 0,
				deltaY: 0,
				distance: 0,
				duration: Date.now() - this.touchStartTime,
				target: event.target as HTMLElement,
				originalEvent: event
			});
		}, this.config.longPressDelay);
	}

	private handlePointerMove(event: PointerEvent) {
		this.touchEndX = event.clientX;
		this.touchEndY = event.clientY;

		const deltaX = this.touchEndX - this.touchStartX;
		const deltaY = this.touchEndY - this.touchStartY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

		// Cancel long press if moved too much
		if (distance > this.config.tapThreshold) {
			this.clearLongPressTimer();
		}

		// Handle pan gesture
		if (this.config.enablePan) {
			const panDeltaX = event.clientX - this.panStartX;
			const panDeltaY = event.clientY - this.panStartY;
			const panDistance = Math.sqrt(panDeltaX * panDeltaX + panDeltaY * panDeltaY);

			if (panDistance > this.config.panThreshold) {
				if (!this.isPanning) {
					this.isPanning = true;
				}

				this.triggerGesture('pan', {
					startX: this.panStartX,
					startY: this.panStartY,
					endX: event.clientX,
					endY: event.clientY,
					deltaX: panDeltaX,
					deltaY: panDeltaY,
					distance: panDistance,
					duration: Date.now() - this.touchStartTime,
					target: event.target as HTMLElement,
					originalEvent: event
				});
			}
		}
	}

	private handlePointerUp(event: PointerEvent) {
		this.clearLongPressTimer();

		const deltaX = this.touchEndX - this.touchStartX;
		const deltaY = this.touchEndY - this.touchStartY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const duration = Date.now() - this.touchStartTime;

		// Don't trigger other gestures if long press was triggered
		if (this.isLongPressed) {
			return;
		}

		// Tap gesture
		if (distance <= this.config.tapThreshold && duration < this.config.longPressDelay) {
			this.triggerGesture('tap', {
				startX: this.touchStartX,
				startY: this.touchStartY,
				endX: this.touchEndX,
				endY: this.touchEndY,
				deltaX,
				deltaY,
				distance,
				duration,
				target: event.target as HTMLElement,
				originalEvent: event
			});
		}
		// Swipe gesture
		else if (distance > this.config.swipeThreshold) {
			const direction = this.getSwipeDirection(deltaX, deltaY);
			this.triggerGesture('swipe', {
				startX: this.touchStartX,
				startY: this.touchStartY,
				endX: this.touchEndX,
				endY: this.touchEndY,
				deltaX,
				deltaY,
				distance,
				duration,
				direction,
				target: event.target as HTMLElement,
				originalEvent: event
			});
		}

		this.isPanning = false;
	}

	private handlePointerCancel(event: PointerEvent) {
		this.clearLongPressTimer();
		this.isPanning = false;
	}

	private getDistance(touch1: Touch, touch2: Touch): number {
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private getSwipeDirection(deltaX: number, deltaY: number): 'left' | 'right' | 'up' | 'down' {
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			return deltaX > 0 ? 'right' : 'left';
		} else {
			return deltaY > 0 ? 'down' : 'up';
		}
	}

	private clearLongPressTimer() {
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
	}

	private triggerGesture(type: GestureEvent['type'], data: Partial<GestureEvent>) {
		const callback = this.callbacks.get(type);
		if (callback) {
			const gestureEvent: GestureEvent = {
				type,
				startX: 0,
				startY: 0,
				endX: 0,
				endY: 0,
				deltaX: 0,
				deltaY: 0,
				distance: 0,
				duration: 0,
				target: this.element,
				originalEvent: data.originalEvent as TouchEvent | PointerEvent,
				...data
			} as GestureEvent;

			callback(gestureEvent);
		}
	}

	// Public API
	on(eventType: GestureEvent['type'], callback: (event: GestureEvent) => void) {
		this.callbacks.set(eventType, callback);
	}

	off(eventType: GestureEvent['type']) {
		this.callbacks.delete(eventType);
	}

	destroy() {
		this.clearLongPressTimer();
		
		// Remove event listeners
		if ('ontouchstart' in window) {
			this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
			this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
			this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
			this.element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
		} else {
			this.element.removeEventListener('pointerdown', this.handlePointerDown.bind(this));
			this.element.removeEventListener('pointermove', this.handlePointerMove.bind(this));
			this.element.removeEventListener('pointerup', this.handlePointerUp.bind(this));
			this.element.removeEventListener('pointercancel', this.handlePointerCancel.bind(this));
		}

		this.callbacks.clear();
	}
}

// Svelte action for easy use in components
export function gesture(
	element: HTMLElement,
	config: Partial<GestureConfig> & { 
		handlers?: Partial<Record<GestureEvent['type'], (event: GestureEvent) => void>> 
	} = {}
) {
	const { handlers, ...gestureConfig } = config;
	const gestureHandler = new MobileGestureHandler(element, gestureConfig);

	// Register handlers
	if (handlers) {
		Object.entries(handlers).forEach(([eventType, handler]) => {
			if (handler) {
				gestureHandler.on(eventType as GestureEvent['type'], handler);
			}
		});
	}

	return {
		destroy() {
			gestureHandler.destroy();
		}
	};
}

// Utility functions for common gesture patterns
export const gestureUtils = {
	// Check if device has touch support
	isTouchDevice(): boolean {
		return browser && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
	},

	// Get viewport dimensions for gesture calculations
	getViewportDimensions() {
		if (!browser) return { width: 0, height: 0 };
		return {
			width: window.innerWidth,
			height: window.innerHeight
		};
	},

	// Calculate gesture velocity
	calculateVelocity(distance: number, duration: number): number {
		return duration > 0 ? distance / duration : 0;
	},

	// Check if gesture crosses viewport threshold
	isSignificantGesture(distance: number, threshold: number = 50): boolean {
		return distance > threshold;
	},

	// Normalize coordinates to percentage of viewport
	normalizeCoordinates(x: number, y: number): { x: number; y: number } {
		const { width, height } = this.getViewportDimensions();
		return {
			x: width > 0 ? (x / width) * 100 : 0,
			y: height > 0 ? (y / height) * 100 : 0
		};
	}
};