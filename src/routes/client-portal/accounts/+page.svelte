<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { connectionStatus, accountUpdates, sendWebSocketMessage } from '$lib/api/websocket';
	import { ConnectionStatus, NotificationToast } from '$lib/components/shared';
	import { 
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow 
	} from '$lib/components/ui/table';
	import { 
		Plus,
		Instagram,
		Smartphone,
		Activity,
		Eye,
		EyeOff,
		Settings,
		Search,
		RefreshCw,
		Download,
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight
	} from 'lucide-svelte';
	import { AddAccountForm } from '$lib/components/forms';
	import type { PageData } from './$types';

	export let data: PageData;

	let mounted = false;
	let showAddAccountForm = false;
	
	// State for enhanced table functionality
	let searchTerm = '';
	let sortColumn = '';
	let sortDirection = 'asc';
	let currentPage = 0;
	let pageSize = 10;
	
	// Reactive WebSocket data
	$: wsConnectionStatus = $connectionStatus;
	$: liveAccountUpdates = $accountUpdates;

	// Use real data from server-side load function
	$: baseAccounts = data.accounts || [];
	$: stats = data.stats || {
		totalAccounts: 0,
		activeAccounts: 0,
		assignedDevices: 0,
		totalFollowers: 0
	};

	// Merge base accounts with live WebSocket updates
	$: accounts = baseAccounts.map(account => {
		const liveUpdate = liveAccountUpdates[account.id];
		if (liveUpdate) {
			return {
				...account,
				status: liveUpdate.status,
				followers: liveUpdate.followers || account.followers,
				lastLogin: liveUpdate.lastLogin || account.lastLogin,
				assignedDevice: liveUpdate.assignedDevice || account.assignedDevice
			};
		}
		return account;
	});

	// Column definitions for AdvancedDataTable
	const columns = [
		{
			id: 'account',
			title: 'Account',
			accessor: 'username',
			cell: (value, row) => `
				<div class="flex items-center space-x-3">
					<div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-slate-500 rounded-full flex items-center justify-center">
						<svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
						</svg>
					</div>
					<div>
						<div class="font-medium text-white">@${value}</div>
						<div class="text-sm text-slate-400">${row.email}</div>
					</div>
				</div>
			`
		},
		{
			id: 'status',
			title: 'Status',
			accessor: 'status',
			cell: (value) => {
				const color = value === 'Active' 
					? 'bg-green-500/20 text-green-400 border-green-500/50'
					: 'bg-gray-500/20 text-gray-400 border-gray-500/50';
				return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color}">${value}</span>`;
			}
		},
		{
			id: 'device',
			title: 'Device',
			accessor: 'assignedDevice',
			cell: (value) => {
				if (value) {
					return `
						<div class="flex items-center text-blue-300">
							<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
								<path d="M7 1C5.9 1 5 1.9 5 3v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2H7zm0 2h10v16H7V3z"/>
							</svg>
							${value}
						</div>
					`;
				}
				return '<span class="text-slate-500">Not assigned</span>';
			}
		},
		{
			id: 'lastLogin',
			title: 'Last Login',
			accessor: 'lastLogin'
		},
		{
			id: 'followers',
			title: 'Followers',
			accessor: 'followers',
			cell: (value) => `<span class="text-white font-medium">${value.toLocaleString()}</span>`
		},
		{
			id: 'visibility',
			title: 'Visibility',
			accessor: 'visibility',
			cell: (value) => {
				const icon = value === 'Private' ? 'eye' : 'eye-off';
				return `
					<div class="flex items-center">
						<svg class="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							${value === 'Private' 
								? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>'
								: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>'
							}
						</svg>
						<span class="text-slate-300 text-sm">${value}</span>
					</div>
				`;
			}
		},
		{
			id: 'actions',
			title: 'Actions',
			accessor: 'id',
			sortable: false,
			cell: () => `
				<button class="text-slate-400 hover:text-white hover:bg-white/10 p-1 rounded">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
					</svg>
				</button>
			`
		}
	];

	// Computed values for enhanced table functionality
	$: filteredAccounts = accounts.filter(account => {
		if (!searchTerm) return true;
		return account.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
		       account.email.toLowerCase().includes(searchTerm.toLowerCase());
	});

	$: sortedAccounts = [...filteredAccounts].sort((a, b) => {
		if (!sortColumn) return 0;
		
		const aVal = a[sortColumn];
		const bVal = b[sortColumn];
		
		// Handle different data types
		let result = 0;
		if (typeof aVal === 'number' && typeof bVal === 'number') {
			result = aVal - bVal;
		} else {
			result = String(aVal).localeCompare(String(bVal));
		}
		
		return sortDirection === 'asc' ? result : -result;
	});

	$: totalPages = Math.ceil(sortedAccounts.length / pageSize);
	$: paginatedAccounts = sortedAccounts.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

	// Functions for enhanced table functionality
	function handleSort(columnId) {
		if (sortColumn === columnId) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = columnId;
			sortDirection = 'asc';
		}
		currentPage = 0; // Reset to first page when sorting
	}

	function getSortIcon(columnId) {
		if (sortColumn !== columnId) return ArrowUpDown;
		return sortDirection === 'asc' ? ArrowUp : ArrowDown;
	}

	function goToPage(page) {
		currentPage = Math.max(0, Math.min(page, totalPages - 1));
	}

	function getStatusColor(status) {
		return status === 'Active' 
			? 'bg-green-500/20 text-green-400 border-green-500/50'
			: 'bg-gray-500/20 text-gray-400 border-gray-500/50';
	}

	function getVisibilityIcon(visibility) {
		return visibility === 'Private' ? Eye : EyeOff;
	}

	function refreshData() {
		// Reset search and sorting
		searchTerm = '';
		sortColumn = '';
		sortDirection = 'asc';
		currentPage = 0;
		
		// Request fresh account data via WebSocket
		sendWebSocketMessage('account:refresh', {
			accountIds: baseAccounts.map(a => a.id)
		});
		
		// In real app, this would refetch data from API
		console.log('Refreshing accounts data via WebSocket...');
	}

	function exportToCSV() {
		const csvData = filteredAccounts.map(account => 
			[account.username, account.email, account.status, account.assignedDevice || '', 
			 account.lastLogin, account.followers, account.visibility].join(',')
		);
		const csvContent = [
			'Username,Email,Status,Device,Last Login,Followers,Visibility',
			...csvData
		].join('\n');
		
		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'instagram-accounts-export.csv';
		a.click();
		window.URL.revokeObjectURL(url);
	}

	async function handleAddAccount(event) {
		const { username, email, password, visibility, assignedDevice, notes } = event.detail;
		console.log('Adding new account:', username, email);
		
		try {
			// Call the API to create the account
			const response = await fetch('/api/accounts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					instagramUsername: username,
					instagramPassword: password || 'tempPassword123',
					emailAddress: email,
					emailPassword: 'tempEmailPass123',
					ownerId: data.user?.id || 1,
					visibility: visibility || 'PRIVATE',
					assignedDeviceId: assignedDevice || null,
					accountType: 'CLIENT',
					isShared: false,
					status: 'Unused',
					imapStatus: 'On',
					recordId: `account_${Date.now()}`
				})
			});

			if (response.ok) {
				const result = await response.json();
				console.log('✅ Account created successfully:', result);
				
				// Send WebSocket message to notify about new account
				sendWebSocketMessage('account:created', {
					id: result.data.id,
					username: result.data.instagramUsername,
					status: result.data.status
				});
				
				// Refresh the page to show the new account
				window.location.reload();
			} else {
				const error = await response.json();
				console.error('❌ Failed to create account:', error);
				alert(`Failed to create account: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error('❌ Network error creating account:', error);
			alert('Network error occurred while creating account. Please try again.');
		} finally {
			// Reset form and close modal
			showAddAccountForm = false;
		}
	}

	function openAddAccountForm() {
		showAddAccountForm = true;
	}

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>Instagram Accounts - Client Portal</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-center justify-between relative z-10">
		<div>
			<div class="flex items-center gap-4">
				<div>
					<h1 class="text-3xl font-bold text-white">Instagram Accounts</h1>
					<p class="text-slate-300 mt-1">Manage your Instagram accounts and their assignments</p>
				</div>
				<div class="hidden sm:block">
					<ConnectionStatus />
				</div>
			</div>
		</div>
		<Button 
			class="bg-blue-600 hover:bg-blue-700 text-white relative z-20"
			onclick={openAddAccountForm}
		>
			<Plus class="w-4 h-4 mr-2" />
			Add Account
		</Button>
	</div>

	<!-- Stats Cards -->
	{#if mounted}
		<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
			<Card class="glass-card border-white/10">
				<CardContent class="p-6">
					<div class="flex items-center">
						<Instagram class="h-8 w-8 text-blue-400 mr-3" />
						<div>
							<p class="text-2xl font-bold text-white">{stats.totalAccounts}</p>
							<p class="text-xs text-slate-400">Total Accounts</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card class="glass-card border-white/10">
				<CardContent class="p-6">
					<div class="flex items-center">
						<Activity class="h-8 w-8 text-green-400 mr-3" />
						<div>
							<p class="text-2xl font-bold text-white">{stats.activeAccounts}</p>
							<p class="text-xs text-slate-400">Active</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card class="glass-card border-white/10">
				<CardContent class="p-6">
					<div class="flex items-center">
						<Smartphone class="h-8 w-8 text-blue-400 mr-3" />
						<div>
							<p class="text-2xl font-bold text-white">{stats.assignedDevices}</p>
							<p class="text-xs text-slate-400">Assigned</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card class="glass-card border-white/10">
				<CardContent class="p-6">
					<div class="flex items-center">
						<div class="h-8 w-8 text-orange-400 mr-3 flex items-center justify-center">
							<span class="text-lg font-bold">K</span>
						</div>
						<div>
							<p class="text-2xl font-bold text-white">
								{stats.totalFollowers > 1000 ? Math.round(stats.totalFollowers / 1000) + 'K' : stats.totalFollowers}
							</p>
							<p class="text-xs text-slate-400">Total Followers</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	{/if}

	<!-- Enhanced Accounts Table -->
	{#if mounted}
		<div class="space-y-4">
			<!-- Controls -->
			<Card class="glass-card border-white/10">
				<CardContent class="p-4">
					<div class="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
						<!-- Search -->
						<div class="flex-1 min-w-0">
							<div class="relative">
								<Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
								<Input
									bind:value={searchTerm}
									placeholder="Search accounts by username or email..."
									class="pl-10 bg-white/5 border-white/20 text-white placeholder:text-gray-400"
								/>
							</div>
						</div>

						<!-- Action buttons -->
						<div class="flex items-center gap-2">
							<Button 
								variant="outline" 
								size="sm" 
								onclick={refreshData}
								class="border-white/20 text-white hover:bg-white/10 bg-transparent"
							>
								<RefreshCw class="w-4 h-4 mr-2" />
								Refresh
							</Button>
							<Button 
								variant="outline" 
								size="sm" 
								onclick={exportToCSV}
								class="border-white/20 text-white hover:bg-white/10 bg-transparent"
							>
								<Download class="w-4 h-4 mr-2" />
								Export CSV
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Enhanced Data Table -->
			<Card class="glass-card border-white/10">
				<CardHeader>
					<div class="flex items-center justify-between">
						<div>
							<CardTitle class="text-white">Your Instagram Accounts</CardTitle>
							<p class="text-sm text-slate-400 mt-1">Manage and monitor all your Instagram automation accounts</p>
						</div>
						<Badge variant="secondary" class="bg-blue-500/20 text-blue-200">
							{filteredAccounts.length} accounts
						</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<div class="rounded-lg border border-white/10 overflow-hidden">
						<Table>
							<TableHeader>
								<TableRow class="border-white/10 hover:bg-white/5">
									<TableHead class="text-slate-300">
										<Button
											variant="ghost"
											size="sm"
											class="h-auto p-0 text-slate-300 hover:text-white font-medium bg-transparent"
											onclick={() => handleSort('username')}
										>
											Account
											<svelte:component 
												this={getSortIcon('username')} 
												class="w-4 h-4 ml-1"
											/>
										</Button>
									</TableHead>
									<TableHead class="text-slate-300">
										<Button
											variant="ghost"
											size="sm"
											class="h-auto p-0 text-slate-300 hover:text-white font-medium bg-transparent"
											onclick={() => handleSort('status')}
										>
											Status
											<svelte:component 
												this={getSortIcon('status')} 
												class="w-4 h-4 ml-1"
											/>
										</Button>
									</TableHead>
									<TableHead class="text-slate-300">Device</TableHead>
									<TableHead class="text-slate-300">
										<Button
											variant="ghost"
											size="sm"
											class="h-auto p-0 text-slate-300 hover:text-white font-medium bg-transparent"
											onclick={() => handleSort('lastLogin')}
										>
											Last Login
											<svelte:component 
												this={getSortIcon('lastLogin')} 
												class="w-4 h-4 ml-1"
											/>
										</Button>
									</TableHead>
									<TableHead class="text-slate-300">
										<Button
											variant="ghost"
											size="sm"
											class="h-auto p-0 text-slate-300 hover:text-white font-medium bg-transparent"
											onclick={() => handleSort('followers')}
										>
											Followers
											<svelte:component 
												this={getSortIcon('followers')} 
												class="w-4 h-4 ml-1"
											/>
										</Button>
									</TableHead>
									<TableHead class="text-slate-300">Visibility</TableHead>
									<TableHead class="text-slate-300">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{#if paginatedAccounts.length > 0}
									{#each paginatedAccounts as account, index}
										<TableRow class="border-white/10 hover:bg-white/5 transition-colors animate-fade-in" style="animation-delay: {index * 0.05}s;">
											<TableCell>
												<div class="flex items-center space-x-3">
													<div class="w-10 h-10 bg-gradient-to-r from-blue-500 to-slate-500 rounded-full flex items-center justify-center">
														<Instagram class="w-5 h-5 text-white" />
													</div>
													<div>
														<div class="font-medium text-white">@{account.username}</div>
														<div class="text-sm text-slate-400">{account.email}</div>
													</div>
												</div>
											</TableCell>
											<TableCell>
												<div class="flex items-center gap-2">
													<Badge variant="outline" class={getStatusColor(account.status)}>
														{account.status}
													</Badge>
													{#if liveAccountUpdates[account.id]}
														<div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Live data"></div>
													{/if}
												</div>
											</TableCell>
											<TableCell>
												{#if account.assignedDevice}
													<div class="flex items-center text-blue-300">
														<Smartphone class="w-4 h-4 mr-1" />
														{account.assignedDevice}
													</div>
												{:else}
													<span class="text-slate-500">Not assigned</span>
												{/if}
											</TableCell>
											<TableCell class="text-slate-300">{account.lastLogin}</TableCell>
											<TableCell class="text-white font-medium">{account.followers.toLocaleString()}</TableCell>
											<TableCell>
												<div class="flex items-center">
													<svelte:component this={getVisibilityIcon(account.visibility)} class="w-4 h-4 mr-1 text-slate-400" />
													<span class="text-slate-300 text-sm">{account.visibility}</span>
												</div>
											</TableCell>
											<TableCell>
												<Button variant="ghost" size="sm" class="text-slate-400 hover:text-white hover:bg-white/10 glass-hover bg-transparent">
													<Settings class="w-4 h-4" />
												</Button>
											</TableCell>
										</TableRow>
									{/each}
								{:else}
									<TableRow>
										<TableCell colspan="7" class="text-center py-12">
											<div class="flex flex-col items-center space-y-4">
												<Instagram class="w-12 h-12 text-slate-500" />
												<div class="space-y-2">
													<p class="text-slate-400 text-sm">No Instagram accounts found</p>
													<p class="text-slate-500 text-xs">
														{searchTerm ? `No accounts match "${searchTerm}"` : 'Add your first Instagram account to get started'}
													</p>
												</div>
												{#if !searchTerm}
													<Button 
														class="bg-blue-600 hover:bg-blue-700 text-white"
														onclick={openAddAccountForm}
													>
														<Plus class="w-4 h-4 mr-2" />
														Add Your First Account
													</Button>
												{/if}
											</div>
										</TableCell>
									</TableRow>
								{/if}
							</TableBody>
						</Table>
					</div>

					<!-- Pagination -->
					{#if totalPages > 1}
						<div class="flex items-center justify-between mt-4">
							<div class="text-sm text-slate-400">
								Showing {currentPage * pageSize + 1} to 
								{Math.min((currentPage + 1) * pageSize, filteredAccounts.length)} of 
								{filteredAccounts.length} accounts
							</div>
							
							<div class="flex items-center space-x-2">
								<Button
									variant="outline"
									size="sm"
									onclick={() => goToPage(0)}
									disabled={currentPage === 0}
									class="border-white/20 text-white hover:bg-white/10 bg-transparent disabled:opacity-50"
								>
									<ChevronsLeft class="w-4 h-4" />
								</Button>
								
								<Button
									variant="outline"
									size="sm"
									onclick={() => goToPage(currentPage - 1)}
									disabled={currentPage === 0}
									class="border-white/20 text-white hover:bg-white/10 bg-transparent disabled:opacity-50"
								>
									<ChevronLeft class="w-4 h-4" />
								</Button>
								
								<div class="flex items-center space-x-1">
									{#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
										const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
										return start + i;
									}) as pageNum}
										<Button
											variant={pageNum === currentPage ? "default" : "outline"}
											size="sm"
											onclick={() => goToPage(pageNum)}
											class={pageNum === currentPage 
												? "bg-blue-600 text-white" 
												: "border-white/20 text-white hover:bg-white/10 bg-transparent"
											}
										>
											{pageNum + 1}
										</Button>
									{/each}
								</div>
								
								<Button
									variant="outline"
									size="sm"
									onclick={() => goToPage(currentPage + 1)}
									disabled={currentPage === totalPages - 1}
									class="border-white/20 text-white hover:bg-white/10 bg-transparent disabled:opacity-50"
								>
									<ChevronRight class="w-4 h-4" />
								</Button>
								
								<Button
									variant="outline"
									size="sm"
									onclick={() => goToPage(totalPages - 1)}
									disabled={currentPage === totalPages - 1}
									class="border-white/20 text-white hover:bg-white/10 bg-transparent disabled:opacity-50"
								>
									<ChevronsRight class="w-4 h-4" />
								</Button>
							</div>
						</div>
					{/if}
				</CardContent>
			</Card>
		</div>
	{/if}

	<!-- Add Account Form Modal -->
	<AddAccountForm 
		bind:open={showAddAccountForm}
		on:submit={handleAddAccount}
		on:close={() => showAddAccountForm = false}
	/>

	<!-- Notification System -->
	<NotificationToast />
</div>