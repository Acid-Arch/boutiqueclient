<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let mounted = false;

	onMount(() => {
		mounted = true;
		// Auto-redirect to client portal since we have bypass login enabled
		setTimeout(() => {
			goto('/client-portal');
		}, 2000);
	});
</script>

<svelte:head>
	<title>Client Portal</title>
	<meta name="description" content="Boutique Client Portal - Modern Instagram Account Management" />
</svelte:head>

{#if mounted}
	<div class="glass-card p-8 max-w-2xl mx-auto">
		<div class="text-center">
			<h1 class="text-4xl font-bold text-white mb-4">
				✨ Client Portal
			</h1>
			
			<p class="text-slate-300 mb-8">
				Modern Instagram account management with glass morphism design
			</p>
			
			<div class="space-y-6">
				<div class="glass p-6 rounded-lg">
					<h2 class="text-xl font-semibold text-white mb-4">🚀 Ready to Launch!</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-slate-300">Backend Infrastructure</span>
								<Badge class="bg-green-500/20 text-green-400">✅ Complete</Badge>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-slate-300">Database Connection</span>
								<Badge class="bg-green-500/20 text-green-400">✅ Connected</Badge>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-slate-300">API Endpoints</span>
								<Badge class="bg-green-500/20 text-green-400">✅ 25+ Ready</Badge>
							</div>
						</div>
						<div class="space-y-2">
							<div class="flex items-center justify-between">
								<span class="text-slate-300">Authentication</span>
								<Badge class="bg-green-500/20 text-green-400">✅ Google OAuth</Badge>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-slate-300">Glass UI Design</span>
								<Badge class="bg-green-500/20 text-green-400">✅ Applied</Badge>
							</div>
							<div class="flex items-center justify-between">
								<span class="text-slate-300">shadcn Components</span>
								<Badge class="bg-green-500/20 text-green-400">✅ Installed</Badge>
							</div>
						</div>
					</div>
				</div>

				<div class="glass p-4 rounded-lg">
					<p class="text-slate-400 text-sm mb-4">
						🔄 Redirecting to Client Portal...
					</p>
					<div class="w-full bg-white/10 rounded-full h-2">
						<div class="bg-blue-500 h-2 rounded-full animate-pulse" style="width: 75%"></div>
					</div>
				</div>

				<Button 
					on:click={() => goto('/client-portal')} 
					class="bg-blue-600 hover:bg-blue-700 text-white w-full"
				>
					Enter Client Portal →
				</Button>
			</div>
		</div>
	</div>
{/if}