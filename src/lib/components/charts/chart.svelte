<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables, type ChartConfiguration } from 'chart.js';

	export let config: ChartConfiguration;
	export let width: number = 400;
	export let height: number = 200;
	export let className: string = '';

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	// Register Chart.js components
	Chart.register(...registerables);

	onMount(() => {
		if (canvas) {
			// Apply glass morphism styling to chart
			const glassConfig: ChartConfiguration = {
				...config,
				options: {
					...config.options,
					responsive: true,
					maintainAspectRatio: false,
					interaction: {
						intersect: false,
						mode: 'index'
					},
					plugins: {
						...config.options?.plugins,
						legend: {
							...config.options?.plugins?.legend,
							labels: {
								...config.options?.plugins?.legend?.labels,
								color: 'rgb(203, 213, 225)', // slate-300
								font: {
									family: 'Inter, system-ui, sans-serif',
									size: 12
								}
							}
						},
						tooltip: {
							...config.options?.plugins?.tooltip,
							backgroundColor: 'rgba(0, 0, 0, 0.8)',
							titleColor: 'rgb(248, 250, 252)', // slate-50
							bodyColor: 'rgb(203, 213, 225)', // slate-300
							borderColor: 'rgba(255, 255, 255, 0.1)',
							borderWidth: 1
						}
					},
					scales: config.options?.scales ? {
						...config.options.scales,
						x: {
							...config.options.scales.x,
							ticks: {
								...config.options.scales.x?.ticks,
								color: 'rgb(148, 163, 184)' // slate-400
							},
							grid: {
								...config.options.scales.x?.grid,
								color: 'rgba(255, 255, 255, 0.1)'
							}
						},
						y: {
							...config.options.scales.y,
							ticks: {
								...config.options.scales.y?.ticks,
								color: 'rgb(148, 163, 184)' // slate-400
							},
							grid: {
								...config.options.scales.y?.grid,
								color: 'rgba(255, 255, 255, 0.1)'
							}
						}
					} : undefined
				}
			};

			chart = new Chart(canvas, glassConfig);
		}
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});

	// Update chart when config changes
	$: if (chart && config) {
		chart.data = config.data;
		chart.options = {
			...config.options,
			// Reapply glass styling
			plugins: {
				...config.options?.plugins,
				legend: {
					...config.options?.plugins?.legend,
					labels: {
						...config.options?.plugins?.legend?.labels,
						color: 'rgb(203, 213, 225)',
						font: {
							family: 'Inter, system-ui, sans-serif',
							size: 12
						}
					}
				}
			}
		};
		chart.update();
	}
</script>

<div class={`chart-container glass-card border-white/10 p-6 ${className}`}>
	<canvas 
		bind:this={canvas} 
		{width} 
		{height}
		class="max-w-full h-auto"
	></canvas>
</div>

<style>
	.chart-container {
		position: relative;
		background: rgba(255, 255, 255, 0.05);
		backdrop-filter: blur(12px);
		border-radius: 0.75rem;
		box-shadow: 
			0 10px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04),
			inset 0 0 20px rgba(255, 255, 255, 0.05);
	}
</style>