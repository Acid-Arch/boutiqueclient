import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: true,
		host: true,
		allowedHosts: ["all", "silentsignal.io", "www.silentsignal.io", "5.78.147.68", "localhost"],
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin"
		}
	},
	preview: {
		port: 4874,
		strictPort: true,
		host: true
	},
	optimizeDeps: {
		include: [
			"@auth/sveltekit",
			"@auth/core/providers/google",
			"@auth/core/providers/credentials",
			"chart.js",
			"chart.js/auto",
			"chartjs-adapter-date-fns",
			"clsx",
			"tailwind-merge",
			"lucide-svelte",
			"bcrypt",
			"pg"
		],
		force: true
	},
	define: {
		global: "globalThis"
	},
	build: {
		target: "es2022",
		rollupOptions: {
			external: ["bcrypt", "pg"]
		}
	},
	worker: {
		format: "es"
	},
	ssr: {
		noExternal: ["@auth/sveltekit", "@auth/core"]
	}
});
