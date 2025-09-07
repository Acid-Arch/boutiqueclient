<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { createErrorBoundary } from '$lib/server/error-handler.js';

	export let fallback: string = 'Something went wrong';
	export let componentName: string = 'Unknown Component';
	export let showRetry: boolean = true;
	export let showDetails: boolean = false;

	const dispatch = createEventDispatcher<{
		error: { error: Error; componentName: string };
		retry: void;
	}>();

	let hasError = false;
	let error: Error | null = null;
	let errorDetails = '';
	let showErrorDetails = false;

	const errorBoundary = createErrorBoundary(componentName);

	// Handle uncaught errors in child components
	function handleError(event: ErrorEvent | PromiseRejectionEvent) {
		let errorObj: Error;
		
		if ('error' in event) {
			errorObj = event.error instanceof Error ? event.error : new Error(event.error);
		} else {
			errorObj = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
		}

		error = errorObj;
		hasError = true;
		errorDetails = `${errorObj.name}: ${errorObj.message}`;
		
		// Log through error boundary
		errorBoundary.onError(errorObj);
		
		// Dispatch to parent
		dispatch('error', { error: errorObj, componentName });
		
		// Prevent default error handling
		event.preventDefault();
		event.stopPropagation();
	}

	function retry() {
		hasError = false;
		error = null;
		errorDetails = '';
		showErrorDetails = false;
		dispatch('retry');
	}

	function toggleDetails() {
		showErrorDetails = !showErrorDetails;
	}

	onMount(() => {
		// Catch unhandled errors and promise rejections
		window.addEventListener('error', handleError);
		window.addEventListener('unhandledrejection', handleError);

		return () => {
			window.removeEventListener('error', handleError);
			window.removeEventListener('unhandledrejection', handleError);
		};
	});
</script>

{#if hasError}
	<div class="error-boundary glass-panel" role="alert" aria-live="assertive">
		<div class="error-icon">⚠️</div>
		
		<h3 class="error-title">Component Error</h3>
		
		<p class="error-message">
			{fallback}
		</p>

		{#if showDetails && errorDetails}
			<div class="error-details">
				<button 
					class="details-toggle"
					on:click={toggleDetails}
					aria-expanded={showErrorDetails}
				>
					{showErrorDetails ? 'Hide' : 'Show'} Details
				</button>
				
				{#if showErrorDetails}
					<div class="details-content">
						<div class="detail-item">
							<strong>Component:</strong> {componentName}
						</div>
						<div class="detail-item">
							<strong>Error:</strong> {errorDetails}
						</div>
						{#if error?.stack}
							<div class="detail-item">
								<strong>Stack Trace:</strong>
								<pre class="stack-trace">{error.stack}</pre>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		{#if showRetry}
			<div class="error-actions">
				<button class="btn btn-primary" on:click={retry}>
					Try Again
				</button>
			</div>
		{/if}
	</div>
{:else}
	<slot />
{/if}

<style>
	.error-boundary {
		background: rgba(239, 68, 68, 0.1);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 12px;
		padding: 2rem;
		margin: 1rem 0;
		text-align: center;
		color: rgb(239, 68, 68);
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
	}

	.error-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.8;
	}

	.error-title {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: rgb(239, 68, 68);
	}

	.error-message {
		font-size: 1rem;
		margin-bottom: 1.5rem;
		opacity: 0.9;
		line-height: 1.5;
	}

	.error-details {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1.5rem;
		text-align: left;
	}

	.details-toggle {
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: rgb(239, 68, 68);
		padding: 0.25rem 0.75rem;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: all 0.2s ease;
		margin-bottom: 1rem;
	}

	.details-toggle:hover {
		background: rgba(239, 68, 68, 0.3);
	}

	.details-content {
		font-size: 0.875rem;
	}

	.detail-item {
		margin-bottom: 0.75rem;
	}

	.detail-item strong {
		display: inline-block;
		min-width: 80px;
		font-weight: 600;
	}

	.stack-trace {
		font-family: 'Monaco', 'Consolas', monospace;
		font-size: 0.75rem;
		background: rgba(0, 0, 0, 0.2);
		padding: 0.5rem;
		border-radius: 4px;
		overflow-x: auto;
		max-height: 200px;
		overflow-y: auto;
		margin-top: 0.5rem;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.error-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}

	.btn {
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.3);
		color: rgb(239, 68, 68);
		padding: 0.5rem 1rem;
		border-radius: 8px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.btn:hover {
		background: rgba(239, 68, 68, 0.3);
		transform: translateY(-1px);
	}

	.btn-primary {
		background: rgba(239, 68, 68, 0.3);
	}

	.btn-primary:hover {
		background: rgba(239, 68, 68, 0.4);
	}

	@media (max-width: 640px) {
		.error-boundary {
			margin: 0.5rem;
			padding: 1.5rem;
		}

		.error-icon {
			font-size: 2.5rem;
		}

		.error-title {
			font-size: 1.25rem;
		}

		.stack-trace {
			font-size: 0.7rem;
		}
	}
</style>