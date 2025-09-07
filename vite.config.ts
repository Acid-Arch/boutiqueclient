import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5874, // Custom port to avoid conflicts
		strictPort: true,
		host: true,
		headers: {
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Opener-Policy': 'same-origin'
		}
	},
	preview: {
		port: 4874, // Custom preview port
		strictPort: true,
		host: true
	},
	optimizeDeps: {
		include: [
			'chart.js',
			'chart.js/auto',
			'chartjs-adapter-date-fns',
			'clsx',
			'tailwind-merge'
		]
	},
	define: {
		global: 'globalThis'
	},
	build: {
		target: 'es2022'
	},
	worker: {
		format: 'es'
	}
});