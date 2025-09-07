<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import {
		ArrowUpDown,
		ArrowUp,
		ArrowDown,
		Search,
		Download,
		RefreshCw,
		ChevronLeft,
		ChevronRight,
		ChevronsLeft,
		ChevronsRight
	} from 'lucide-svelte';

	// Props
	export let data: any[] = [];
	export let columns: Array<{
		id: string;
		title: string;
		accessor: string;
		sortable?: boolean;
		cell?: (value: any, row: any) => any;
	}> = [];
	export let title: string = 'Data Table';
	export let description: string = '';
	export let searchPlaceholder: string = 'Search...';
	export let enableRowSelection: boolean = false;
	export let enableExport: boolean = true;
	export let itemsPerPage: number = 10;

	// State
	let searchTerm = '';
	let sortColumn = '';
	let sortDirection: 'asc' | 'desc' = 'asc';
	let currentPage = 0;
	let pageSize = itemsPerPage;
	let selectedRows = new Set<number>();

	// Computed values
	$: filteredData = data.filter(row => {
		if (!searchTerm) return true;
		return columns.some(col => 
			String(row[col.accessor]).toLowerCase().includes(searchTerm.toLowerCase())
		);
	});

	$: sortedData = [...filteredData].sort((a, b) => {
		if (!sortColumn) return 0;
		
		const aVal = a[sortColumn];
		const bVal = b[sortColumn];
		
		if (aVal === bVal) return 0;
		
		const result = aVal < bVal ? -1 : 1;
		return sortDirection === 'asc' ? result : -result;
	});

	$: totalPages = Math.ceil(sortedData.length / pageSize);
	$: paginatedData = sortedData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
	
	// Functions
	function handleSort(columnId: string) {
		if (sortColumn === columnId) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = columnId;
			sortDirection = 'asc';
		}
	}

	function getSortIcon(columnId: string) {
		if (sortColumn !== columnId) return ArrowUpDown;
		return sortDirection === 'asc' ? ArrowUp : ArrowDown;
	}

	function toggleRowSelection(index: number) {
		const globalIndex = currentPage * pageSize + index;
		if (selectedRows.has(globalIndex)) {
			selectedRows.delete(globalIndex);
		} else {
			selectedRows.add(globalIndex);
		}
		selectedRows = new Set(selectedRows);
	}

	function toggleAllRows() {
		if (selectedRows.size === paginatedData.length) {
			selectedRows.clear();
		} else {
			selectedRows.clear();
			paginatedData.forEach((_, index) => {
				selectedRows.add(currentPage * pageSize + index);
			});
		}
		selectedRows = new Set(selectedRows);
	}

	function exportToCSV() {
		const csvData = filteredData.map(row => 
			columns.map(col => String(row[col.accessor]).replace(/,/g, ';')).join(',')
		);
		const csvContent = [
			columns.map(col => col.title).join(','),
			...csvData
		].join('\n');
		
		const blob = new Blob([csvContent], { type: 'text/csv' });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-export.csv`;
		a.click();
		window.URL.revokeObjectURL(url);
	}

	function refreshData() {
		// Reset state
		searchTerm = '';
		sortColumn = '';
		currentPage = 0;
		selectedRows.clear();
		selectedRows = new Set(selectedRows);
	}

	function goToPage(page: number) {
		currentPage = Math.max(0, Math.min(page, totalPages - 1));
	}
</script>

<div class="space-y-4">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-semibold text-white">{title}</h2>
			{#if description}
				<p class="text-sm text-slate-400 mt-1">{description}</p>
			{/if}
		</div>
		
		<div class="flex items-center gap-2">
			<Button 
				variant="outline" 
				size="sm" 
				on:click={refreshData}
				class="border-white/20 text-white hover:bg-white/10"
			>
				<RefreshCw class="w-4 h-4 mr-2" />
				Refresh
			</Button>
			
			{#if enableExport}
				<Button 
					variant="outline" 
					size="sm" 
					on:click={exportToCSV}
					class="border-white/20 text-white hover:bg-white/10"
				>
					<Download class="w-4 h-4 mr-2" />
					Export CSV
				</Button>
			{/if}
		</div>
	</div>

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
							placeholder={searchPlaceholder}
							class="pl-10 bg-white/5 border-white/20 text-white placeholder:text-gray-400"
						/>
					</div>
				</div>

				<!-- Row selection info -->
				{#if enableRowSelection && selectedRows.size > 0}
					<Badge variant="secondary" class="bg-blue-500/20 text-blue-200">
						{selectedRows.size} selected
					</Badge>
				{/if}

				<!-- Page size selector -->
				<div class="flex items-center gap-2 text-sm text-slate-300">
					<span>Show:</span>
					<select 
						bind:value={pageSize}
						class="bg-white/5 border border-white/20 rounded text-white px-2 py-1"
					>
						<option value={10}>10</option>
						<option value={25}>25</option>
						<option value={50}>50</option>
						<option value={100}>100</option>
					</select>
					<span>rows</span>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Data Table -->
	<Card class="glass-card border-white/10">
		<CardContent class="p-0">
			<div class="rounded-lg border border-white/10 overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow class="border-white/10 hover:bg-white/5">
							{#if enableRowSelection}
								<TableHead class="text-slate-300 w-12">
									<Checkbox
										checked={selectedRows.size === paginatedData.length && paginatedData.length > 0}
										onCheckedChange={toggleAllRows}
									/>
								</TableHead>
							{/if}
							{#each columns as column}
								<TableHead class="text-slate-300">
									{#if column.sortable !== false}
										<Button
											variant="ghost"
											size="sm"
											class="h-auto p-0 text-slate-300 hover:text-white font-medium"
											on:click={() => handleSort(column.accessor)}
										>
											{column.title}
											<svelte:component 
												this={getSortIcon(column.accessor)} 
												class="w-4 h-4 ml-1"
											/>
										</Button>
									{:else}
										{column.title}
									{/if}
								</TableHead>
							{/each}
						</TableRow>
					</TableHeader>
					<TableBody>
						{#each paginatedData as row, index}
							<TableRow class="border-white/10 hover:bg-white/5">
								{#if enableRowSelection}
									<TableCell>
										<Checkbox
											checked={selectedRows.has(currentPage * pageSize + index)}
											onCheckedChange={() => toggleRowSelection(index)}
										/>
									</TableCell>
								{/if}
								{#each columns as column}
									<TableCell class="text-slate-200">
										{#if column.cell}
											{@html column.cell(row[column.accessor], row)}
										{:else}
											{row[column.accessor]}
										{/if}
									</TableCell>
								{/each}
							</TableRow>
						{/each}
					</TableBody>
				</Table>
			</div>
		</CardContent>
	</Card>

	<!-- Pagination -->
	{#if totalPages > 1}
		<Card class="glass-card border-white/10">
			<CardContent class="p-4">
				<div class="flex items-center justify-between">
					<div class="text-sm text-slate-400">
						Showing {currentPage * pageSize + 1} to 
						{Math.min((currentPage + 1) * pageSize, filteredData.length)} of 
						{filteredData.length} entries
					</div>
					
					<div class="flex items-center space-x-2">
						<Button
							variant="outline"
							size="sm"
							on:click={() => goToPage(0)}
							disabled={currentPage === 0}
							class="border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
						>
							<ChevronsLeft class="w-4 h-4" />
						</Button>
						
						<Button
							variant="outline"
							size="sm"
							on:click={() => goToPage(currentPage - 1)}
							disabled={currentPage === 0}
							class="border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
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
									on:click={() => goToPage(pageNum)}
									class={pageNum === currentPage 
										? "bg-blue-600 text-white" 
										: "border-white/20 text-white hover:bg-white/10"
									}
								>
									{pageNum + 1}
								</Button>
							{/each}
						</div>
						
						<Button
							variant="outline"
							size="sm"
							on:click={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages - 1}
							class="border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
						>
							<ChevronRight class="w-4 h-4" />
						</Button>
						
						<Button
							variant="outline"
							size="sm"
							on:click={() => goToPage(totalPages - 1)}
							disabled={currentPage === totalPages - 1}
							class="border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
						>
							<ChevronsRight class="w-4 h-4" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>