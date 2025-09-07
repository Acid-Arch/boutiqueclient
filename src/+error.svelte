<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { logger, LogLevel } from '$lib/server/logging/logger.js';

	export let error: App.Error;
	export let message: string;

	let errorId = '';
	let showDetails = false;
	let reportSent = false;

	onMount(() => {
		// Generate unique error ID for tracking
		errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		
		// Log the client-side error
		console.error('Client error occurred:', {
			errorId,
			message: error?.message || message,
			stack: error?.stack,
			url: window.location.href,
			userAgent: navigator.userAgent,
			timestamp: new Date().toISOString()
		});

		// Report to backend if it's a critical error
		if (error?.message?.includes('500') || error?.message?.includes('database') || error?.message?.includes('auth')) {
			reportError();
		}
	});

	async function reportError() {
		try {
			await fetch('/api/errors/report', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					errorId,
					message: error?.message || message,
					stack: error?.stack,
					url: window.location.href,
					userAgent: navigator.userAgent,
					timestamp: new Date().toISOString()
				})
			});
			reportSent = true;
		} catch (e) {
			console.error('Failed to report error:', e);
		}
	}

	function goHome() {
		window.location.href = '/';
	}

	function goBack() {
		window.history.back();
	}

	function retry() {
		window.location.reload();
	}

	function toggleDetails() {
		showDetails = !showDetails;
	}
</script>

<svelte:head>
	<title>Error - Client Portal</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
	<div class="glass-panel max-w-lg w-full text-center text-white">
		<div class="text-6xl mb-6 opacity-80">⚠️</div>
		
		<h1 class="text-3xl font-bold mb-4">Something went wrong</h1>
		
		<p class="text-lg mb-6 opacity-90">
			We apologize for the inconvenience. An unexpected error has occurred.
		</p>

		<div class="glass-card p-4 mb-6 text-sm font-mono text-left">
			<div class="flex justify-between items-center mb-2">
				<span class="font-semibold">Error Details</span>
				<button 
					on:click={toggleDetails}
					class="text-xs opacity-70 hover:opacity-100 transition-opacity"
				>
					{showDetails ? 'Hide' : 'Show'}
				</button>
			</div>
			
			<div class="space-y-1">
				<div><strong>ID:</strong> {errorId}</div>
				<div><strong>Status:</strong> {$page.status || 'Unknown'}</div>
				{#if showDetails}
					<div><strong>Message:</strong> {error?.message || message || 'Unknown error'}</div>
					<div><strong>Page:</strong> {$page.url.pathname}</div>
					{#if error?.stack}
						<div class="mt-2 p-2 bg-black/20 rounded text-xs overflow-auto max-h-32">
							<strong>Stack:</strong><br>
							{error.stack}
						</div>
					{/if}
				{/if}
			</div>
		</div>

		{#if reportSent}
			<div class="glass-card p-3 mb-6 bg-green-500/20 border-green-500/30">
				<div class="flex items-center justify-center gap-2 text-green-100">
					<span class="text-xl">✓</span>
					<span class="text-sm">Error report sent to our team</span>
				</div>
			</div>
		{/if}

		<div class="flex flex-wrap gap-3 justify-center">
			<button on:click={goHome} class="btn btn-primary">
				Go Home
			</button>
			<button on:click={goBack} class="btn">
				Go Back
			</button>
			<button on:click={retry} class="btn">
				Retry
			</button>
		</div>

		<div class="mt-6 text-xs opacity-60">
			If this problem persists, please contact support with Error ID: {errorId}
		</div>
	</div>
</div>

<style>
	.glass-panel {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 20px;
		padding: 3rem 2rem;
		box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
	}

	.glass-card {
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(5px);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 10px;
	}

	.btn {
		background: rgba(255, 255, 255, 0.2);
		border: 1px solid rgba(255, 255, 255, 0.3);
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		font-weight: 500;
		transition: all 0.3s ease;
		cursor: pointer;
	}

	.btn:hover {
		background: rgba(255, 255, 255, 0.3);
		transform: translateY(-2px);
	}

	.btn-primary {
		background: rgba(103, 126, 234, 0.3);
		border-color: rgba(103, 126, 234, 0.5);
	}

	.btn-primary:hover {
		background: rgba(103, 126, 234, 0.5);
	}

	@media (max-width: 600px) {
		.glass-panel {
			padding: 2rem 1.5rem;
		}
		
		.btn {
			width: 100%;
			max-width: 200px;
		}
	}
</style>