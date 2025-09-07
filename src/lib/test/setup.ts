import { vi } from 'vitest';

// Mock SvelteKit environment
vi.mock('$app/environment', () => ({
	dev: true,
	building: false,
	version: 'test'
}));

// Mock SvelteKit stores
vi.mock('$app/stores', () => ({
	page: {
		subscribe: vi.fn(() => () => {})
	},
	navigating: {
		subscribe: vi.fn(() => () => {})
	},
	updated: {
		subscribe: vi.fn(() => () => {})
	}
}));

// Mock database connection
vi.mock('$lib/server/db-loader', () => ({
	query: vi.fn(),
	getPrisma: vi.fn(() => ({
		user: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		igAccount: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		},
		loginAttempt: {
			create: vi.fn(),
			findMany: vi.fn()
		}
	}))
}));

// Mock authentication service
vi.mock('$lib/server/auth-direct', () => ({
	AuthService: {
		authenticateUser: vi.fn(),
		getUserById: vi.fn(),
		createUser: vi.fn(),
		generateSessionToken: vi.fn(() => 'mock-session-token'),
		isValidSessionToken: vi.fn(() => true),
		getSessionCookieOptions: vi.fn(() => ({
			httpOnly: true,
			secure: false,
			sameSite: 'lax',
			maxAge: 7 * 24 * 60 * 60
		}))
	}
}));

// Mock IP whitelist service
vi.mock('$lib/server/ip-whitelist', () => ({
	validateIPAccess: vi.fn(() => ({
		allowed: true,
		publicIP: '127.0.0.1',
		reason: 'test'
	})),
	recordFailedAttempt: vi.fn()
}));

// Mock rate limiter
vi.mock('$lib/server/rate-limiter', () => ({
	RateLimiter: {
		checkLoginAttempt: vi.fn(() => ({
			allowed: true,
			remainingAttempts: 5,
			resetTime: new Date(),
			totalAttempts: 0
		})),
		recordLoginAttempt: vi.fn(),
		clearFailedAttempts: vi.fn()
	}
}));

// Setup DOM globals
Object.defineProperty(window, 'location', {
	value: {
		href: 'http://localhost:5173',
		origin: 'http://localhost:5173',
		pathname: '/',
		search: '',
		hash: ''
	},
	writable: true
});

// Mock crypto for Node.js environment
Object.defineProperty(globalThis, 'crypto', {
	value: {
		randomUUID: () => 'test-uuid-1234-5678-9012-345678901234',
		getRandomValues: (arr: Uint8Array) => {
			for (let i = 0; i < arr.length; i++) {
				arr[i] = Math.floor(Math.random() * 256);
			}
			return arr;
		}
	}
});

// Console spy setup for testing
global.console = {
	...console,
	log: vi.fn(),
	warn: vi.fn(),
	error: vi.fn()
};