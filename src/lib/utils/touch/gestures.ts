/**
 * Touch Gesture Utilities
 * Handles touch events and gesture recognition for mobile interfaces
 */

export interface TouchPoint {
	x: number;
	y: number;
	timestamp: number;
}

export interface SwipeEvent {
	direction: 'left' | 'right' | 'up' | 'down';
	distance: number;
	velocity: number;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	duration: number;
}

export interface TapEvent {
	x: number;
	y: number;
	timestamp: number;
}

export interface LongPressEvent {
	x: number;
	y: number;
	duration: number;
}

export interface PinchEvent {
	scale: number;
	centerX: number;
	centerY: number;
}

export type GestureEventHandler<T> = (event: T) => void;

export interface GestureOptions {
	// Swipe detection options
	swipeThreshold: number; // Minimum distance for swipe (px)
	swipeVelocityThreshold: number; // Minimum velocity for swipe (px/ms)
	
	// Tap detection options
	tapThreshold: number; // Maximum movement for tap (px)
	tapTimeout: number; // Maximum duration for tap (ms)
	
	// Long press detection options
	longPressThreshold: number; // Minimum duration for long press (ms)
	longPressMovementThreshold: number; // Maximum movement during long press (px)
	
	// Pinch detection options
	pinchThreshold: number; // Minimum scale change for pinch
	
	// General options
	preventDefault: boolean; // Prevent default touch events
	stopPropagation: boolean; // Stop event propagation
}

export const DEFAULT_GESTURE_OPTIONS: GestureOptions = {
	swipeThreshold: 50,
	swipeVelocityThreshold: 0.3,
	tapThreshold: 10,
	tapTimeout: 300,
	longPressThreshold: 500,
	longPressMovementThreshold: 10,
	pinchThreshold: 0.1,
	preventDefault: true,
	stopPropagation: false,
};

export class TouchGestureRecognizer {
	private element: HTMLElement;
	private options: GestureOptions;
	private isTracking = false;
	private startTouch: TouchPoint | null = null;
	private currentTouch: TouchPoint | null = null;
	private longPressTimer: number | null = null;
	private initialDistance: number | null = null;
	private lastScale = 1;

	// Event handlers
	private onSwipe: GestureEventHandler<SwipeEvent> | null = null;
	private onTap: GestureEventHandler<TapEvent> | null = null;
	private onLongPress: GestureEventHandler<LongPressEvent> | null = null;
	private onPinch: GestureEventHandler<PinchEvent> | null = null;

	constructor(element: HTMLElement, options: Partial<GestureOptions> = {}) {
		this.element = element;
		this.options = { ...DEFAULT_GESTURE_OPTIONS, ...options };
		this.setupEventListeners();
	}

	private setupEventListeners() {
		this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: !this.options.preventDefault });
		this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: !this.options.preventDefault });
		this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: !this.options.preventDefault });
		this.element.addEventListener('touchcancel', this.handleTouchCancel.bind(this), { passive: !this.options.preventDefault });
	}

	private getTouchPoint(touch: Touch): TouchPoint {
		return {
			x: touch.clientX,
			y: touch.clientY,
			timestamp: Date.now(),
		};
	}

	private getDistance(touch1: Touch, touch2: Touch): number {
		const dx = touch1.clientX - touch2.clientX;
		const dy = touch1.clientY - touch2.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private handleTouchStart(event: TouchEvent) {
		if (this.options.preventDefault) {
			event.preventDefault();
		}
		if (this.options.stopPropagation) {
			event.stopPropagation();
		}

		const touches = event.touches;
		
		if (touches.length === 1) {
			// Single touch - start tracking for tap, long press, and swipe
			this.isTracking = true;
			this.startTouch = this.getTouchPoint(touches[0]);
			this.currentTouch = this.startTouch;
			
			// Start long press timer
			this.longPressTimer = window.setTimeout(() => {
				if (this.isTracking && this.startTouch && this.currentTouch) {
					const distance = this.calculateDistance(this.startTouch, this.currentTouch);
					if (distance <= this.options.longPressMovementThreshold) {
						this.triggerLongPress();
					}
				}
			}, this.options.longPressThreshold);
		} else if (touches.length === 2) {
			// Two touches - start tracking for pinch
			this.initialDistance = this.getDistance(touches[0], touches[1]);
			this.lastScale = 1;
		}
	}

	private handleTouchMove(event: TouchEvent) {
		if (this.options.preventDefault) {
			event.preventDefault();
		}
		if (this.options.stopPropagation) {
			event.stopPropagation();
		}

		const touches = event.touches;

		if (touches.length === 1 && this.isTracking) {
			// Single touch movement
			this.currentTouch = this.getTouchPoint(touches[0]);
		} else if (touches.length === 2 && this.initialDistance) {
			// Two touch movement - handle pinch
			const currentDistance = this.getDistance(touches[0], touches[1]);
			const scale = currentDistance / this.initialDistance;
			
			if (Math.abs(scale - this.lastScale) > this.options.pinchThreshold) {
				this.triggerPinch(scale, touches);
				this.lastScale = scale;
			}
		}
	}

	private handleTouchEnd(event: TouchEvent) {
		if (this.options.preventDefault) {
			event.preventDefault();
		}
		if (this.options.stopPropagation) {
			event.stopPropagation();
		}

		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}

		if (this.isTracking && this.startTouch && this.currentTouch) {
			const distance = this.calculateDistance(this.startTouch, this.currentTouch);
			const duration = this.currentTouch.timestamp - this.startTouch.timestamp;

			if (distance <= this.options.tapThreshold && duration <= this.options.tapTimeout) {
				// Tap detected
				this.triggerTap();
			} else if (distance >= this.options.swipeThreshold) {
				// Swipe detected
				const velocity = distance / duration;
				if (velocity >= this.options.swipeVelocityThreshold) {
					this.triggerSwipe();
				}
			}
		}

		this.resetTracking();
	}

	private handleTouchCancel(event: TouchEvent) {
		if (this.options.preventDefault) {
			event.preventDefault();
		}
		if (this.options.stopPropagation) {
			event.stopPropagation();
		}

		this.resetTracking();
	}

	private resetTracking() {
		this.isTracking = false;
		this.startTouch = null;
		this.currentTouch = null;
		this.initialDistance = null;
		this.lastScale = 1;
		
		if (this.longPressTimer) {
			clearTimeout(this.longPressTimer);
			this.longPressTimer = null;
		}
	}

	private calculateDistance(point1: TouchPoint, point2: TouchPoint): number {
		const dx = point2.x - point1.x;
		const dy = point2.y - point1.y;
		return Math.sqrt(dx * dx + dy * dy);
	}

	private getSwipeDirection(start: TouchPoint, end: TouchPoint): 'left' | 'right' | 'up' | 'down' {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		
		if (Math.abs(dx) > Math.abs(dy)) {
			return dx > 0 ? 'right' : 'left';
		} else {
			return dy > 0 ? 'down' : 'up';
		}
	}

	private triggerSwipe() {
		if (!this.onSwipe || !this.startTouch || !this.currentTouch) return;

		const distance = this.calculateDistance(this.startTouch, this.currentTouch);
		const duration = this.currentTouch.timestamp - this.startTouch.timestamp;
		const velocity = distance / duration;
		const direction = this.getSwipeDirection(this.startTouch, this.currentTouch);

		this.onSwipe({
			direction,
			distance,
			velocity,
			startX: this.startTouch.x,
			startY: this.startTouch.y,
			endX: this.currentTouch.x,
			endY: this.currentTouch.y,
			duration,
		});
	}

	private triggerTap() {
		if (!this.onTap || !this.currentTouch) return;

		this.onTap({
			x: this.currentTouch.x,
			y: this.currentTouch.y,
			timestamp: this.currentTouch.timestamp,
		});
	}

	private triggerLongPress() {
		if (!this.onLongPress || !this.startTouch || !this.currentTouch) return;

		const duration = this.currentTouch.timestamp - this.startTouch.timestamp;
		
		this.onLongPress({
			x: this.startTouch.x,
			y: this.startTouch.y,
			duration,
		});
	}

	private triggerPinch(scale: number, touches: TouchList) {
		if (!this.onPinch) return;

		const centerX = (touches[0].clientX + touches[1].clientX) / 2;
		const centerY = (touches[0].clientY + touches[1].clientY) / 2;

		this.onPinch({
			scale,
			centerX,
			centerY,
		});
	}

	// Public API for setting event handlers
	public setSwipeHandler(handler: GestureEventHandler<SwipeEvent>) {
		this.onSwipe = handler;
		return this;
	}

	public setTapHandler(handler: GestureEventHandler<TapEvent>) {
		this.onTap = handler;
		return this;
	}

	public setLongPressHandler(handler: GestureEventHandler<LongPressEvent>) {
		this.onLongPress = handler;
		return this;
	}

	public setPinchHandler(handler: GestureEventHandler<PinchEvent>) {
		this.onPinch = handler;
		return this;
	}

	public destroy() {
		this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
		this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
		this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
		this.element.removeEventListener('touchcancel', this.handleTouchCancel.bind(this));
		this.resetTracking();
	}
}

/**
 * Utility function to create a gesture recognizer with common settings
 */
export function createGestureRecognizer(
	element: HTMLElement,
	options: Partial<GestureOptions> = {}
): TouchGestureRecognizer {
	return new TouchGestureRecognizer(element, options);
}

/**
 * Utility function to detect if device supports touch
 */
export function isTouchDevice(): boolean {
	return (
		'ontouchstart' in window ||
		navigator.maxTouchPoints > 0 ||
		// @ts-ignore
		navigator.msMaxTouchPoints > 0
	);
}

/**
 * Utility function to get screen size category
 */
export function getScreenSize(): 'mobile' | 'tablet' | 'desktop' {
	const width = window.innerWidth;
	if (width < 768) return 'mobile';
	if (width < 1024) return 'tablet';
	return 'desktop';
}

/**
 * Utility function to determine if mobile layout should be used
 */
export function shouldUseMobileLayout(): boolean {
	return getScreenSize() === 'mobile' || (getScreenSize() === 'tablet' && isTouchDevice());
}