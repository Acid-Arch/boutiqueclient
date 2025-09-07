<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string = '';
	export { className as class };
	export let width: string = '100%';
	export let height: string = '20px';
	export let rounded: 'none' | 'sm' | 'md' | 'lg' | 'full' = 'md';
	export let variant: 'default' | 'circular' | 'rectangular' | 'text' = 'default';

	$: roundedClass = {
		none: 'rounded-none',
		sm: 'rounded-sm',
		md: 'rounded-md',
		lg: 'rounded-lg',
		full: 'rounded-full'
	}[rounded];

	$: variantStyles = {
		default: 'h-4 w-full',
		circular: 'rounded-full',
		rectangular: 'w-full',
		text: 'h-4 w-3/4'
	}[variant];
</script>

<div
	class={cn(
		'animate-pulse bg-slate-200 dark:bg-slate-800',
		roundedClass,
		variant === 'circular' ? 'rounded-full' : '',
		variantStyles,
		className
	)}
	style="width: {width}; height: {height};"
	{...$$restProps}
></div>

<style>
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: .5;
		}
	}
	
	.animate-pulse {
		animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}
</style>