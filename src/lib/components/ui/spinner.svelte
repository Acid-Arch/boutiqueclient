<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string = '';
	export { className as class };
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let variant: 'default' | 'primary' | 'secondary' | 'destructive' = 'default';
	export let speed: 'slow' | 'normal' | 'fast' = 'normal';

	$: sizeClass = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8',
		xl: 'h-12 w-12'
	}[size];

	$: variantClass = {
		default: 'text-slate-600 dark:text-slate-400',
		primary: 'text-blue-600',
		secondary: 'text-blue-600',
		destructive: 'text-red-600'
	}[variant];

	$: speedClass = {
		slow: 'animate-spin-slow',
		normal: 'animate-spin',
		fast: 'animate-spin-fast'
	}[speed];
</script>

<svg
	class={cn(
		'animate-spin',
		sizeClass,
		variantClass,
		speedClass,
		className
	)}
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	viewBox="0 0 24 24"
	{...$$restProps}
>
	<circle
		class="opacity-25"
		cx="12"
		cy="12"
		r="10"
		stroke="currentColor"
		stroke-width="4"
	></circle>
	<path
		class="opacity-75"
		fill="currentColor"
		d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
	></path>
</svg>

<style>
	@keyframes spin-slow {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	
	@keyframes spin-fast {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}
	
	.animate-spin-slow {
		animation: spin-slow 3s linear infinite;
	}
	
	.animate-spin-fast {
		animation: spin-fast 0.75s linear infinite;
	}
</style>