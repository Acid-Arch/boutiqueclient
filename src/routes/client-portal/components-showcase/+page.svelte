<script lang="ts">
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import Spinner from '$lib/components/ui/spinner.svelte';
	import Progress from '$lib/components/ui/progress.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Alert from '$lib/components/ui/alert.svelte';
	import { Play, Pause, RotateCcw } from 'lucide-svelte';

	let skeletonDemo = true;
	let progressValue = 45;
	let showModal = false;
	let showAlerts = {
		default: true,
		success: true,
		warning: true,
		error: true,
		info: true
	};

	function toggleSkeleton() {
		skeletonDemo = !skeletonDemo;
	}

	function animateProgress() {
		progressValue = 0;
		const interval = setInterval(() => {
			progressValue += 5;
			if (progressValue >= 100) {
				clearInterval(interval);
			}
		}, 100);
	}

	function resetProgress() {
		progressValue = 45;
	}
</script>

<svelte:head>
	<title>UI Components Showcase - Client Portal</title>
</svelte:head>

<div class="space-y-8">
	<!-- Page Header -->
	<div>
		<h1 class="text-3xl font-bold text-white">UI Components Showcase</h1>
		<p class="text-slate-300 mt-1">Preview and test all available UI components</p>
	</div>

	<!-- Skeleton Components -->
	<Card class="glass-card border-white/10">
		<CardHeader>
			<div class="flex items-center justify-between">
				<CardTitle class="text-white">Skeleton Loading Components</CardTitle>
				<Button 
					variant="outline" 
					size="sm" 
					on:click={toggleSkeleton}
					class="border-white/20 text-white hover:bg-white/10"
				>
					{skeletonDemo ? 'Hide' : 'Show'} Skeletons
				</Button>
			</div>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if skeletonDemo}
				<!-- Skeleton Variants -->
				<div class="space-y-3">
					<div>
						<Badge variant="secondary" class="mb-2">Default Skeleton</Badge>
						<Skeleton width="100%" height="20px" />
					</div>
					
					<div>
						<Badge variant="secondary" class="mb-2">Text Skeleton</Badge>
						<Skeleton variant="text" width="75%" height="16px" />
						<Skeleton variant="text" width="60%" height="16px" class="mt-2" />
					</div>
					
					<div>
						<Badge variant="secondary" class="mb-2">Circular Skeleton</Badge>
						<Skeleton variant="circular" width="60px" height="60px" />
					</div>
					
					<div>
						<Badge variant="secondary" class="mb-2">Rectangular Skeleton</Badge>
						<Skeleton variant="rectangular" width="200px" height="120px" />
					</div>
				</div>
			{:else}
				<!-- Actual Content -->
				<div class="space-y-3">
					<div>
						<Badge variant="secondary" class="mb-2">Default Content</Badge>
						<p class="text-white">This is actual content that would replace the skeleton.</p>
					</div>
					
					<div>
						<Badge variant="secondary" class="mb-2">Text Content</Badge>
						<p class="text-white">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
						<p class="text-white">Sed do eiusmod tempor incididunt ut labore.</p>
					</div>
					
					<div>
						<Badge variant="secondary" class="mb-2">Avatar Content</Badge>
						<div class="w-15 h-15 bg-gradient-to-r from-blue-500 to-slate-500 rounded-full flex items-center justify-center">
							<span class="text-white font-bold">JD</span>
						</div>
					</div>
					
					<div>
						<Badge variant="secondary" class="mb-2">Image Content</Badge>
						<div class="w-50 h-30 bg-gradient-to-r from-blue-500 to-slate-500 rounded-lg flex items-center justify-center">
							<span class="text-white">Image Placeholder</span>
						</div>
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<!-- Spinner Components -->
	<Card class="glass-card border-white/10">
		<CardHeader>
			<CardTitle class="text-white">Spinner Components</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-6">
				<div class="text-center">
					<Badge variant="secondary" class="mb-2">Small</Badge>
					<div class="flex justify-center mb-2">
						<Spinner size="sm" />
					</div>
				</div>
				
				<div class="text-center">
					<Badge variant="secondary" class="mb-2">Medium</Badge>
					<div class="flex justify-center mb-2">
						<Spinner size="md" variant="primary" />
					</div>
				</div>
				
				<div class="text-center">
					<Badge variant="secondary" class="mb-2">Large</Badge>
					<div class="flex justify-center mb-2">
						<Spinner size="lg" variant="secondary" />
					</div>
				</div>
				
				<div class="text-center">
					<Badge variant="secondary" class="mb-2">X-Large</Badge>
					<div class="flex justify-center mb-2">
						<Spinner size="xl" variant="destructive" />
					</div>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Progress Components -->
	<Card class="glass-card border-white/10">
		<CardHeader>
			<div class="flex items-center justify-between">
				<CardTitle class="text-white">Progress Bar Components</CardTitle>
				<div class="flex gap-2">
					<Button 
						variant="outline" 
						size="sm" 
						on:click={animateProgress}
						class="border-white/20 text-white hover:bg-white/10"
					>
						<Play class="h-4 w-4 mr-1" />
						Animate
					</Button>
					<Button 
						variant="outline" 
						size="sm" 
						on:click={resetProgress}
						class="border-white/20 text-white hover:bg-white/10"
					>
						<RotateCcw class="h-4 w-4 mr-1" />
						Reset
					</Button>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-6">
			<div>
				<Badge variant="secondary" class="mb-2">Default Progress</Badge>
				<Progress value={progressValue} showLabel />
			</div>
			
			<div>
				<Badge variant="secondary" class="mb-2">Primary Progress</Badge>
				<Progress value={progressValue * 0.8} variant="primary" showLabel />
			</div>
			
			<div>
				<Badge variant="secondary" class="mb-2">Success Progress</Badge>
				<Progress value={progressValue * 1.2} variant="success" showLabel />
			</div>
			
			<div>
				<Badge variant="secondary" class="mb-2">Large Striped Progress</Badge>
				<Progress value={progressValue} variant="primary" size="lg" striped animated showLabel>
					<div slot="label">Upload Progress</div>
					<div slot="description">Uploading files to server...</div>
				</Progress>
			</div>
		</CardContent>
	</Card>

	<!-- Alert Components -->
	<Card class="glass-card border-white/10">
		<CardHeader>
			<CardTitle class="text-white">Alert Components</CardTitle>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if showAlerts.default}
				<Alert title="Default Alert" dismissible bind:visible={showAlerts.default}>
					This is a default alert with some important information.
				</Alert>
			{/if}
			
			{#if showAlerts.success}
				<Alert variant="success" title="Success Alert" dismissible bind:visible={showAlerts.success}>
					Your operation completed successfully! All changes have been saved.
				</Alert>
			{/if}
			
			{#if showAlerts.warning}
				<Alert variant="warning" title="Warning Alert" dismissible bind:visible={showAlerts.warning}>
					Please be careful. This action may have unexpected consequences.
				</Alert>
			{/if}
			
			{#if showAlerts.error}
				<Alert variant="destructive" title="Error Alert" dismissible bind:visible={showAlerts.error}>
					Something went wrong. Please try again or contact support.
				</Alert>
			{/if}
			
			{#if showAlerts.info}
				<Alert variant="info" title="Information Alert" dismissible bind:visible={showAlerts.info}>
					Here's some helpful information about this feature.
				</Alert>
			{/if}

			<!-- Restore Alerts Button -->
			{#if Object.values(showAlerts).every(v => !v)}
				<Button 
					variant="outline" 
					on:click={() => showAlerts = { default: true, success: true, warning: true, error: true, info: true }}
					class="border-white/20 text-white hover:bg-white/10"
				>
					Restore All Alerts
				</Button>
			{/if}
		</CardContent>
	</Card>

	<!-- Modal Component -->
	<Card class="glass-card border-white/10">
		<CardHeader>
			<CardTitle class="text-white">Modal Component</CardTitle>
		</CardHeader>
		<CardContent>
			<Button 
				class="bg-blue-600 hover:bg-blue-700 text-white"
				on:click={() => showModal = true}
			>
				Open Modal
			</Button>
			
			<Modal bind:open={showModal} size="md">
				<div slot="header">
					<h3 class="text-xl font-bold text-white">Example Modal</h3>
					<p class="text-slate-400 text-sm mt-1">This is a demonstration of the modal component</p>
				</div>
				
				<div class="space-y-4">
					<p class="text-white">
						This modal demonstrates the reusable Modal component with glass morphism styling.
						It includes a backdrop blur, smooth transitions, and proper accessibility features.
					</p>
					
					<div class="grid grid-cols-2 gap-4">
						<div class="text-center p-4 bg-white/5 rounded-lg">
							<Spinner size="md" variant="primary" />
							<p class="text-white text-sm mt-2">Loading...</p>
						</div>
						
						<div class="space-y-2">
							<Progress value={75} variant="success" showLabel />
							<p class="text-slate-400 text-xs">Sample progress bar</p>
						</div>
					</div>
				</div>
				
				<div slot="footer" class="flex justify-end gap-2">
					<Button 
						variant="outline" 
						on:click={() => showModal = false}
						class="border-white/20 text-white hover:bg-white/10"
					>
						Cancel
					</Button>
					<Button 
						class="bg-blue-600 hover:bg-blue-700 text-white"
						on:click={() => showModal = false}
					>
						Confirm
					</Button>
				</div>
			</Modal>
		</CardContent>
	</Card>
</div>