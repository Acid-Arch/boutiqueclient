<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { cn } from '$lib/utils';
	import { X } from 'lucide-svelte';
	import { fade, scale } from 'svelte/transition';

	let className: string = '';
	export { className as class };
	export let open: boolean = false;
	export let size: 'sm' | 'md' | 'lg' | 'xl' | 'full' = 'md';
	export let showCloseButton: boolean = true;
	export let closeOnBackdropClick: boolean = true;
	export let closeOnEscape: boolean = true;

	const dispatch = createEventDispatcher<{
		close: void;
		open: void;
	}>();

	$: sizeClass = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-2xl',
		xl: 'max-w-4xl',
		full: 'max-w-7xl'
	}[size];

	function handleBackdropClick() {
		if (closeOnBackdropClick) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && closeOnEscape && open) {
			close();
		}
	}

	function close() {
		open = false;
		dispatch('close');
	}

	function handleOpen() {
		dispatch('open');
	}

	$: if (open) {
		handleOpen();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div 
		class="fixed inset-0 z-50 flex items-center justify-center"
		transition:fade={{ duration: 200 }}
	>
		<!-- Backdrop -->
		<div 
			class="fixed inset-0 bg-black/50 backdrop-blur-sm"
			on:click={handleBackdropClick}
			transition:fade={{ duration: 200 }}
		></div>
		
		<!-- Modal Content -->
		<div 
			class={cn(
				'relative w-full mx-4 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl',
				sizeClass,
				className
			)}
			transition:scale={{ duration: 200, start: 0.95 }}
		>
			{#if showCloseButton}
				<button
					type="button"
					class="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg p-2 z-10 transition-colors"
					on:click={close}
					aria-label="Close modal"
				>
					<X class="h-5 w-5" />
				</button>
			{/if}
			
			{#if $$slots.header}
				<div class="px-6 py-4 border-b border-white/10">
					<slot name="header" />
				</div>
			{/if}
			
			<div class="px-6 py-4">
				<slot />
			</div>
			
			{#if $$slots.footer}
				<div class="px-6 py-4 border-t border-white/10">
					<slot name="footer" />
				</div>
			{/if}
		</div>
	</div>
{/if}