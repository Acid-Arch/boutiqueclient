<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { RefreshCw, Activity, AlertTriangle, CheckCircle2, Clock, Database, Server, Zap } from 'lucide-svelte';

	interface HealthStatus {
		status: 'healthy' | 'degraded' | 'unhealthy';
		timestamp: string;
		version: string;
		environment: string;
		uptime: number;
		checks: {
			database: { status: string; responseTime: number; message?: string };
			memory: { status: string; responseTime: number; message?: string };
			external?: { status: string; responseTime: number; message?: string };
		};
		performance: {
			responseTime: number;
			memoryUsage: {
				heapUsed: number;
				heapTotal: number;
				rss: number;
			};
		};
	}

	interface AlertData {
		alerts: Array<{
			id: string;
			type: string;
			severity: string;
			title: string;
			message: string;
			timestamp: number;
			resolved: boolean;
		}>;
		count: number;
	}

	let healthStatus: HealthStatus | null = null;
	let activeAlerts: AlertData | null = null;
	let lastUpdated = '';
	let autoRefresh = true;
	let refreshInterval: NodeJS.Timeout;
	let loading = true;
	let error = '';

	async function fetchHealthStatus() {
		try {
			const response = await fetch('/api/health?details=true&cache=false');
			if (response.ok) {
				healthStatus = await response.json();
				error = '';
			} else {
				error = `Health check failed: ${response.status}`;
				healthStatus = null;
			}
		} catch (e) {
			error = `Network error: ${e instanceof Error ? e.message : 'Unknown error'}`;
			healthStatus = null;
		}
	}

	async function fetchAlerts() {
		try {
			const response = await fetch('/api/alerts?action=active');
			if (response.ok) {
				activeAlerts = await response.json();
			} else if (response.status !== 403) {
				// Ignore 403 errors (user not admin)
				console.warn('Failed to fetch alerts:', response.status);
			}
		} catch (e) {
			console.warn('Failed to fetch alerts:', e);
		}
	}

	async function refreshData() {
		loading = true;
		await Promise.all([fetchHealthStatus(), fetchAlerts()]);
		lastUpdated = new Date().toLocaleTimeString();
		loading = false;
	}

	function getStatusIcon(status: string) {
		switch (status) {
			case 'healthy':
			case 'pass':
				return CheckCircle2;
			case 'degraded':
			case 'warn':
				return AlertTriangle;
			case 'unhealthy':
			case 'fail':
				return AlertTriangle;
			default:
				return Activity;
		}
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'healthy':
			case 'pass':
				return 'text-green-600';
			case 'degraded':
			case 'warn':
				return 'text-yellow-600';
			case 'unhealthy':
			case 'fail':
				return 'text-red-600';
			default:
				return 'text-gray-600';
		}
	}

	function getStatusBadgeVariant(status: string) {
		switch (status) {
			case 'healthy':
			case 'pass':
				return 'default';
			case 'degraded':
			case 'warn':
				return 'secondary';
			case 'unhealthy':
			case 'fail':
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function formatUptime(seconds: number): string {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		
		if (days > 0) return `${days}d ${hours}h ${minutes}m`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	}

	function formatBytes(bytes: number): string {
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		if (bytes === 0) return '0 Bytes';
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
	}

	function formatTimestamp(timestamp: number): string {
		return new Date(timestamp).toLocaleString();
	}

	function getSeverityColor(severity: string) {
		switch (severity.toLowerCase()) {
			case 'low': return 'text-blue-600';
			case 'medium': return 'text-yellow-600';
			case 'high': return 'text-orange-600';
			case 'critical': return 'text-red-600';
			default: return 'text-gray-600';
		}
	}

	onMount(async () => {
		await refreshData();
		
		if (autoRefresh) {
			refreshInterval = setInterval(refreshData, 30000); // Refresh every 30 seconds
		}
	});

	onDestroy(() => {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
	});

	$: if (autoRefresh && !refreshInterval) {
		refreshInterval = setInterval(refreshData, 30000);
	} else if (!autoRefresh && refreshInterval) {
		clearInterval(refreshInterval);
		refreshInterval = undefined as any;
	}
</script>

<svelte:head>
	<title>System Status - Client Portal</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
	<div class="max-w-6xl mx-auto space-y-8">
		<!-- Header -->
		<div class="text-center space-y-2">
			<h1 class="text-3xl font-bold tracking-tight">System Status</h1>
			<p class="text-muted-foreground">Real-time monitoring and health information</p>
		</div>

		<!-- Controls -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button on:click={refreshData} disabled={loading} size="sm">
					<RefreshCw class="h-4 w-4 mr-2 {loading ? 'animate-spin' : ''}" />
					Refresh
				</Button>
				
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={autoRefresh} class="rounded">
					Auto-refresh (30s)
				</label>
			</div>

			{#if lastUpdated}
				<div class="text-sm text-muted-foreground flex items-center gap-2">
					<Clock class="h-4 w-4" />
					Last updated: {lastUpdated}
				</div>
			{/if}
		</div>

		{#if error}
			<Card class="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
				<CardContent class="p-6">
					<div class="flex items-center gap-2 text-red-700 dark:text-red-300">
						<AlertTriangle class="h-5 w-5" />
						<span class="font-medium">Error</span>
					</div>
					<p class="mt-2 text-red-600 dark:text-red-400">{error}</p>
				</CardContent>
			</Card>
		{:else if healthStatus}
			<!-- Overall Status -->
			<Card class="border-2 {healthStatus.status === 'healthy' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : healthStatus.status === 'degraded' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'}">
				<CardContent class="p-8">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-4">
							<svelte:component this={getStatusIcon(healthStatus.status)} class="h-12 w-12 {getStatusColor(healthStatus.status)}" />
							<div>
								<h2 class="text-2xl font-bold">System {healthStatus.status === 'healthy' ? 'Operational' : healthStatus.status === 'degraded' ? 'Degraded' : 'Down'}</h2>
								<p class="text-muted-foreground">All systems are {healthStatus.status}</p>
							</div>
						</div>
						
						<div class="text-right space-y-2">
							<div class="text-sm text-muted-foreground">Version: {healthStatus.version}</div>
							<div class="text-sm text-muted-foreground">Environment: {healthStatus.environment}</div>
							<div class="text-sm text-muted-foreground">Uptime: {formatUptime(healthStatus.uptime)}</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- System Components -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<Card>
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2">
							<Database class="h-5 w-5" />
							Database
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex items-center justify-between">
							<Badge variant={getStatusBadgeVariant(healthStatus.checks.database.status)}>
								{healthStatus.checks.database.status}
							</Badge>
							<span class="text-sm text-muted-foreground">
								{healthStatus.checks.database.responseTime}ms
							</span>
						</div>
						{#if healthStatus.checks.database.message}
							<p class="mt-2 text-sm text-muted-foreground">{healthStatus.checks.database.message}</p>
						{/if}
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2">
							<Server class="h-5 w-5" />
							Memory
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="flex items-center justify-between">
							<Badge variant={getStatusBadgeVariant(healthStatus.checks.memory.status)}>
								{healthStatus.checks.memory.status}
							</Badge>
							<span class="text-sm text-muted-foreground">
								{healthStatus.checks.memory.responseTime}ms
							</span>
						</div>
						{#if healthStatus.checks.memory.message}
							<p class="mt-2 text-sm text-muted-foreground">{healthStatus.checks.memory.message}</p>
						{/if}
					</CardContent>
				</Card>

				<Card>
					<CardHeader class="pb-3">
						<CardTitle class="flex items-center gap-2">
							<Zap class="h-5 w-5" />
							Performance
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<div class="flex justify-between">
								<span class="text-sm">Response Time</span>
								<span class="text-sm font-mono">{healthStatus.performance.responseTime}ms</span>
							</div>
							<div class="flex justify-between">
								<span class="text-sm">Memory Usage</span>
								<span class="text-sm font-mono">{formatBytes(healthStatus.performance.memoryUsage.heapUsed)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-sm">Total Heap</span>
								<span class="text-sm font-mono">{formatBytes(healthStatus.performance.memoryUsage.heapTotal)}</span>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<!-- Active Alerts -->
			{#if activeAlerts && activeAlerts.count > 0}
				<Card>
					<CardHeader>
						<CardTitle class="flex items-center gap-2">
							<AlertTriangle class="h-5 w-5 text-red-600" />
							Active Alerts ({activeAlerts.count})
						</CardTitle>
						<CardDescription>System alerts requiring attention</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-4">
							{#each activeAlerts.alerts as alert}
								<div class="border rounded-lg p-4 space-y-2">
									<div class="flex items-center justify-between">
										<h4 class="font-semibold">{alert.title}</h4>
										<div class="flex items-center gap-2">
											<Badge variant="outline" class={getSeverityColor(alert.severity)}>
												{alert.severity}
											</Badge>
											<span class="text-xs text-muted-foreground">
												{formatTimestamp(alert.timestamp)}
											</span>
										</div>
									</div>
									<p class="text-sm text-muted-foreground">{alert.message}</p>
								</div>
							{/each}
						</div>
					</CardContent>
				</Card>
			{:else if activeAlerts}
				<Card>
					<CardContent class="p-8 text-center">
						<CheckCircle2 class="h-12 w-12 text-green-600 mx-auto mb-4" />
						<h3 class="text-lg font-semibold mb-2">No Active Alerts</h3>
						<p class="text-muted-foreground">All systems are operating normally</p>
					</CardContent>
				</Card>
			{/if}

		{:else if loading}
			<div class="text-center py-12">
				<RefreshCw class="h-8 w-8 animate-spin mx-auto mb-4" />
				<p class="text-muted-foreground">Loading system status...</p>
			</div>
		{/if}

		<!-- Footer -->
		<Separator />
		<div class="text-center text-sm text-muted-foreground">
			<p>System monitoring powered by internal health checks and alerting system</p>
		</div>
	</div>
</div>