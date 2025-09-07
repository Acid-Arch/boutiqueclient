<script lang="ts">
	import { connectionStatus, reconnectWebSocket } from '$lib/api/websocket';
	import { Button } from '$lib/components/ui/button';
	import { Wifi, WifiOff, RefreshCw } from 'lucide-svelte';
	
	$: status = $connectionStatus;
</script>

<div class="flex items-center space-x-2">
	{#if status.connected}
		<div class="flex items-center text-green-400">
			<Wifi class="h-4 w-4 mr-1" />
			<span class="text-sm font-medium">Online</span>
			<div class="ml-2 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
		</div>
	{:else if status.reconnecting}
		<div class="flex items-center text-yellow-400">
			<RefreshCw class="h-4 w-4 mr-1 animate-spin" />
			<span class="text-sm font-medium">Reconnecting...</span>
		</div>
	{:else}
		<div class="flex items-center text-red-400">
			<WifiOff class="h-4 w-4 mr-1" />
			<span class="text-sm font-medium">Offline</span>
			<Button
				variant="ghost"
				size="sm"
				class="ml-2 h-6 text-xs hover:bg-red-500/20"
				on:click={reconnectWebSocket}
			>
				Retry
			</Button>
		</div>
	{/if}
</div>

{#if status.error && !status.connected}
	<div class="text-xs text-red-300 opacity-75 mt-1">
		{status.error}
	</div>
{/if}

{#if status.lastConnected && !status.connected}
	<div class="text-xs text-slate-400 opacity-75 mt-1">
		Last: {status.lastConnected.toLocaleTimeString()}
	</div>
{/if}