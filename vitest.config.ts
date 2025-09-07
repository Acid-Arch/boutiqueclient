import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		setupFiles: ['./src/lib/test/setup.ts'],
		globals: true,
		coverage: {
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/lib/test/',
				'**/*.d.ts',
				'**/*.config.*',
				'**/build/**',
				'**/dist/**'
			],
			thresholds: {
				global: {
					branches: 80,
					functions: 80,
					lines: 80,
					statements: 80
				}
			}
		},
		// Mock environment variables for tests
		env: {
			NODE_ENV: 'test',
			DATABASE_URL: 'postgresql://test:test@localhost:5432/test_db',
			AUTH_SECRET: 'test-secret-32-bytes-long-for-jwt-signing',
			GOOGLE_CLIENT_ID: 'test-google-client-id',
			GOOGLE_CLIENT_SECRET: 'test-google-client-secret'
		}
	}
});