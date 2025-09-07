<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';

	let mounted = false;

	onMount(() => {
		mounted = true;
	});
</script>

<svelte:head>
	<title>Design System - Client Portal</title>
</svelte:head>

{#if mounted}
	<div class="space-y-12 pb-12">
		<!-- Header -->
		<div class="text-center space-y-4">
			<h1 class="responsive-heading font-bold text-gradient">Design System Showcase</h1>
			<p class="responsive-text text-slate-300">
				Comprehensive demonstration of our enhanced CSS design system
			</p>
		</div>

		<!-- Glass Morphism Variations -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Glass Morphism Variations</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="grid-responsive-md responsive-gap">
					<div class="glass-subtle rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Subtle Glass</h3>
						<p class="text-slate-300 text-sm">Minimal glass effect</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Medium Glass</h3>
						<p class="text-slate-300 text-sm">Standard glass effect</p>
					</div>
					<div class="glass-intense rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Intense Glass</h3>
						<p class="text-slate-300 text-sm">Strong glass effect</p>
					</div>
					<div class="glass-frosted rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Frosted Glass</h3>
						<p class="text-slate-300 text-sm">Frosted effect with saturation</p>
					</div>
					<div class="glass-crystal rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Crystal Glass</h3>
						<p class="text-slate-300 text-sm">Crystal clear effect</p>
					</div>
					<div class="glass-mirror rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Mirror Glass</h3>
						<p class="text-slate-300 text-sm">Reflective mirror effect</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Colored Glass Effects -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Colored Glass Effects</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="grid-responsive-md responsive-gap">
					<div class="glass-purple rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Purple Glass</h3>
						<p class="text-slate-200 text-sm">Purple tinted glass</p>
					</div>
					<div class="glass-blue rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Blue Glass</h3>
						<p class="text-slate-200 text-sm">Blue tinted glass</p>
					</div>
					<div class="glass-green rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Green Glass</h3>
						<p class="text-slate-200 text-sm">Green tinted glass</p>
					</div>
					<div class="glass-red rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Red Glass</h3>
						<p class="text-slate-200 text-sm">Red tinted glass</p>
					</div>
					<div class="glass-amber rounded-lg responsive-padding">
						<h3 class="font-semibold text-white mb-2">Amber Glass</h3>
						<p class="text-slate-200 text-sm">Amber tinted glass</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Interactive Elements -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Interactive Glass Elements</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="grid-responsive-md responsive-gap">
					<div class="glass-interactive rounded-lg responsive-padding cursor-pointer">
						<h3 class="font-semibold text-white mb-2">Interactive Glass</h3>
						<p class="text-slate-300 text-sm">Hover to see effects</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding hover-lift cursor-pointer">
						<h3 class="font-semibold text-white mb-2">Hover Lift</h3>
						<p class="text-slate-300 text-sm">Lifts on hover</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding hover-glow cursor-pointer">
						<h3 class="font-semibold text-white mb-2">Hover Glow</h3>
						<p class="text-slate-300 text-sm">Glows on hover</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding hover-glass-glow cursor-pointer">
						<h3 class="font-semibold text-white mb-2">Glass Glow</h3>
						<p class="text-slate-300 text-sm">Glass glow effect</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Animation Showcase -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Animation Effects</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="grid-responsive-sm responsive-gap">
					<div class="glass-medium rounded-lg responsive-padding animate-fade-in-up animate-delay-100">
						<h3 class="font-semibold text-white mb-2">Fade In Up</h3>
						<p class="text-slate-300 text-sm">Fades in from bottom</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding animate-fade-in-left animate-delay-200">
						<h3 class="font-semibold text-white mb-2">Fade In Left</h3>
						<p class="text-slate-300 text-sm">Slides in from left</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding animate-fade-in-right animate-delay-300">
						<h3 class="font-semibold text-white mb-2">Fade In Right</h3>
						<p class="text-slate-300 text-sm">Slides in from right</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding animate-scale-in animate-delay-500">
						<h3 class="font-semibold text-white mb-2">Scale In</h3>
						<p class="text-slate-300 text-sm">Scales in smoothly</p>
					</div>
					<div class="glass-medium rounded-lg responsive-padding animate-float">
						<h3 class="font-semibold text-white mb-2">Float</h3>
						<p class="text-slate-300 text-sm">Floating animation</p>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Text Gradients -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Text Gradient Effects</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="space-y-4">
					<h2 class="responsive-subheading font-bold text-gradient">Primary Gradient</h2>
					<h2 class="responsive-subheading font-bold text-gradient-blue">Blue Gradient</h2>
					<h2 class="responsive-subheading font-bold text-gradient-success">Success Gradient</h2>
					<h2 class="responsive-subheading font-bold text-gradient-warning">Warning Gradient</h2>
					<h2 class="responsive-subheading font-bold text-gradient-danger">Danger Gradient</h2>
				</div>
			</CardContent>
		</Card>

		<!-- Responsive Grid System -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Responsive Grid System</CardTitle>
			</CardHeader>
			<CardContent class="space-y-8">
				<div>
					<h3 class="text-lg font-semibold text-white mb-4">Small Responsive Grid</h3>
					<div class="grid-responsive-sm responsive-gap">
						{#each Array(5) as _, i}
							<div class="glass-medium rounded-lg p-4">
								<div class="text-white font-medium">Item {i + 1}</div>
							</div>
						{/each}
					</div>
				</div>
				
				<div>
					<h3 class="text-lg font-semibold text-white mb-4">Card Grid</h3>
					<div class="grid-responsive-cards responsive-gap">
						{#each Array(8) as _, i}
							<div class="glass-blue rounded-lg p-4">
								<div class="text-white font-medium">Card {i + 1}</div>
							</div>
						{/each}
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Button Variations -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Enhanced Buttons</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="flex-responsive responsive-gap items-center">
					<Button class="btn-glass-primary">Glass Primary</Button>
					<Button class="btn-glass-success">Glass Success</Button>
					<Button class="btn-glass-danger">Glass Danger</Button>
					<Button class="bg-gradient-to-r from-slate-600 to-blue-600 hover:from-slate-700 hover:to-blue-700">
						Gradient Button
					</Button>
				</div>
			</CardContent>
		</Card>

		<!-- Status Indicators -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Status Indicators</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="flex-responsive responsive-gap items-center">
					<div class="flex items-center space-x-2">
						<div class="status-dot status-online"></div>
						<span class="text-white">Online</span>
					</div>
					<div class="flex items-center space-x-2">
						<div class="status-dot status-offline"></div>
						<span class="text-white">Offline</span>
					</div>
					<div class="flex items-center space-x-2">
						<div class="status-dot status-warning"></div>
						<span class="text-white">Warning</span>
					</div>
					<div class="flex items-center space-x-2">
						<div class="status-dot status-connecting"></div>
						<span class="text-white">Connecting</span>
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Responsive Typography -->
		<Card class="glass-card border-white/10">
			<CardHeader>
				<CardTitle class="text-white">Responsive Typography</CardTitle>
			</CardHeader>
			<CardContent class="space-y-6">
				<div class="space-y-4">
					<h1 class="responsive-heading font-bold text-white">Responsive Heading</h1>
					<h2 class="responsive-subheading font-semibold text-white">Responsive Subheading</h2>
					<p class="responsive-text text-slate-300">
						This is responsive text that scales appropriately across different screen sizes.
						It maintains readability while adapting to the viewport.
					</p>
				</div>
			</CardContent>
		</Card>
	</div>
{/if}