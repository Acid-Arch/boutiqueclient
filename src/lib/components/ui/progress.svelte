<script lang="ts">
	import { cn } from '$lib/utils';

	let className: string = '';
	export { className as class };
	export let value: number = 0;
	export let max: number = 100;
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let variant: 'default' | 'primary' | 'secondary' | 'destructive' | 'success' = 'default';
	export let showLabel: boolean = false;
	export let animated: boolean = false;
	export let striped: boolean = false;

	$: percentage = Math.min(Math.max((value / max) * 100, 0), 100);

	$: sizeClass = {
		sm: 'h-1',
		md: 'h-2',
		lg: 'h-4'
	}[size];

	$: variantClass = {
		default: 'bg-slate-600',
		primary: 'bg-blue-600',
		secondary: 'bg-blue-600',
		destructive: 'bg-red-600',
		success: 'bg-green-600'
	}[variant];
</script>

<div class={cn('w-full', className)} {...$$restProps}>
	{#if showLabel}
		<div class="flex justify-between mb-1">
			<span class="text-sm font-medium text-slate-700 dark:text-slate-300">
				<slot name="label">Progress</slot>
			</span>
			<span class="text-sm font-medium text-slate-700 dark:text-slate-300">
				{Math.round(percentage)}%
			</span>
		</div>
	{/if}
	
	<div
		class={cn(
			'w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden',
			sizeClass
		)}
	>
		<div
			class={cn(
				'transition-all duration-300 ease-in-out rounded-full',
				variantClass,
				animated && 'animate-pulse',
				striped && 'bg-stripes'
			)}
			style="width: {percentage}%"
		></div>
	</div>
	
	{#if $$slots.description}
		<div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
			<slot name="description" />
		</div>
	{/if}
</div>

<style>
	@keyframes stripe-animation {
		0% {
			background-position: 0 0;
		}
		100% {
			background-position: 40px 0;
		}
	}
	
	.bg-stripes {
		background-image: linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.2) 25%,
			transparent 25%,
			transparent 50%,
			rgba(255, 255, 255, 0.2) 50%,
			rgba(255, 255, 255, 0.2) 75%,
			transparent 75%,
			transparent
		);
		background-size: 40px 40px;
		animation: stripe-animation 1s linear infinite;
	}
</style>