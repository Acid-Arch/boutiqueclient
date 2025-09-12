<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { 
		TrendingUp,
		Instagram,
		Play,
		Activity,
		AlertCircle,
		CheckCircle
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	let mounted = false;
	// Use real stats from server-side data
	$: stats = data.stats || {
		totalAccounts: 0,
		activeAccounts: 0,
		assignedDevices: 0,
		totalFollowers: 0
	};

	// Use real recent activity data from the server
	$: recentActivity = data.recentActivity || [];

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>Dashboard - Client Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Welcome Section -->
	<div class="glass-card p-6 rounded-xl">
		<div class="flex items-center justify-between">
			<div>
				<h1 class="text-2xl font-bold text-white mb-2">
					Welcome back, {data.user?.name?.split(' ')[0] || 'User'}! 👋
				</h1>
				<p class="text-slate-300">
					Here's what's happening with your Instagram accounts today.
				</p>
			</div>
			<div class="hidden md:block">
				<Button class="bg-blue-600 hover:bg-blue-700 text-white">
					<Play class="w-4 h-4 mr-2" />
					Start Automation
				</Button>
			</div>
		</div>
	</div>

	<!-- Stats Grid -->
	{#if mounted}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Total Accounts -->
			<Card class="glass-card border-white/10">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium text-slate-300">
						Total Accounts
					</CardTitle>
					<Instagram class="h-4 w-4 text-blue-400" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-white">{stats.totalAccounts}</div>
				</CardContent>
			</Card>

			<!-- Total Followers -->
			<Card class="glass-card border-white/10">
				<CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle class="text-sm font-medium text-slate-300">
						Total Followers
					</CardTitle>
					<TrendingUp class="h-4 w-4 text-blue-400" />
				</CardHeader>
				<CardContent>
					<div class="text-2xl font-bold text-white">
						{stats.totalFollowers.toLocaleString()}
					</div>
				</CardContent>
			</Card>
		</div>
	{/if}

	<!-- Main Content Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Recent Activity -->
		<div class="lg:col-span-2">
			<Card class="glass-card border-white/10">
				<CardHeader>
					<CardTitle class="text-white flex items-center">
						<Activity class="w-5 h-5 mr-2 text-blue-400" />
						Recent Activity
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						{#if recentActivity.length > 0}
							{#each recentActivity as activity}
								<div class="flex items-center justify-between p-3 glass rounded-lg">
									<div class="flex items-center space-x-3">
										<div class="flex-shrink-0">
											{#if activity.status === 'success' || activity.status === 'completed'}
												<CheckCircle class="w-5 h-5 text-green-400" />
											{:else}
												<AlertCircle class="w-5 h-5 text-yellow-400" />
											{/if}
										</div>
										<div>
											<p class="text-sm font-medium text-white">
												{#if activity.type === 'accountlogin'}
													Account login: <span class="text-blue-300">{activity.account}</span>
												{:else if activity.type === 'deviceassignment'}
													Device assigned: <span class="text-slate-300">{activity.device || 'Device'}</span> → <span class="text-blue-300">{activity.account}</span>
												{:else if activity.type === 'scrapingsession'}
													Scraping completed: <span class="text-blue-300">{activity.account}</span>
												{:else if activity.type === 'userlogin'}
													User login: <span class="text-blue-300">{activity.account}</span>
												{:else}
													Activity: <span class="text-blue-300">{activity.type}</span>
												{/if}
											</p>
											<p class="text-xs text-slate-400">{activity.time}</p>
										</div>
									</div>
									<Badge 
										variant="outline"
										class={activity.status === 'success' || activity.status === 'completed' 
											? 'border-green-500 text-green-400'
											: activity.status === 'error'
											? 'border-red-500 text-red-400'
											: 'border-yellow-500 text-yellow-400'
										}
									>
										{activity.status}
									</Badge>
								</div>
							{/each}
						{:else}
							<!-- Empty state -->
							<div class="text-center py-8">
								<Activity class="w-12 h-12 mx-auto text-slate-500 mb-4" />
								<p class="text-slate-400 text-sm">No recent activity found</p>
								<p class="text-slate-500 text-xs mt-1">Account activities will appear here when available</p>
							</div>
						{/if}
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Account Status -->
		<div>
			<Card class="glass-card border-white/10">
				<CardHeader>
					<CardTitle class="text-white text-sm">Account Status</CardTitle>
				</CardHeader>
				<CardContent class="space-y-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-slate-300">Subscription</span>
						<Badge class="bg-blue-500/20 text-blue-300">{data.user?.subscription || 'Basic'}</Badge>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-slate-300">Account Limit</span>
						<span class="text-sm text-white">{data.stats?.totalAccounts || 0} / {data.user?.accountsLimit || 10}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-sm text-slate-300">Status</span>
						<Badge class="bg-green-500/20 text-green-300">{data.user?.isActive ? 'Active' : 'Inactive'}</Badge>
					</div>
				</CardContent>
			</Card>
		</div>
	</div>
</div>