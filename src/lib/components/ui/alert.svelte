<script lang="ts">
	import { cn } from '$lib/utils';
	import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-svelte';

	let className: string = '';
	export { className as class };
	export let variant: 'default' | 'destructive' | 'warning' | 'success' | 'info' = 'default';
	export let dismissible: boolean = false;
	export let title: string = '';
	export let visible: boolean = true;

	$: variantStyles = {
		default: {
			container: 'bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-100',
			icon: 'text-slate-500 dark:text-slate-400',
			IconComponent: Info
		},
		destructive: {
			container: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100',
			icon: 'text-red-500 dark:text-red-400',
			IconComponent: AlertCircle
		},
		warning: {
			container: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-100',
			icon: 'text-yellow-500 dark:text-yellow-400',
			IconComponent: AlertTriangle
		},
		success: {
			container: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100',
			icon: 'text-green-500 dark:text-green-400',
			IconComponent: CheckCircle
		},
		info: {
			container: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-100',
			icon: 'text-blue-500 dark:text-blue-400',
			IconComponent: Info
		}
	};

	$: styles = variantStyles[variant];

	function dismiss() {
		visible = false;
	}
</script>

{#if visible}
	<div
		class={cn(
			'relative w-full rounded-lg border px-4 py-3 text-sm transition-all duration-200',
			styles.container,
			className
		)}
		role="alert"
		{...$$restProps}
	>
		<div class="flex items-start gap-3">
			<!-- Icon -->
			<svelte:component this={styles.IconComponent} class={cn('h-5 w-5 flex-shrink-0 mt-0.5', styles.icon)} />
			
			<!-- Content -->
			<div class="flex-1 min-w-0">
				{#if title}
					<div class="font-medium mb-1">
						{title}
					</div>
				{/if}
				
				<div class="leading-relaxed">
					<slot />
				</div>
			</div>
			
			<!-- Dismiss Button -->
			{#if dismissible}
				<button
					type="button"
					class={cn('flex-shrink-0 p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors', styles.icon)}
					on:click={dismiss}
					aria-label="Dismiss alert"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>
{/if}