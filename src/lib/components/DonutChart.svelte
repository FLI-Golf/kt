<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface ChartData {
		label: string;
		value: number;
	}

	interface Props {
		data: ChartData[];
		width?: number;
		height?: number;
		title?: string;
	}

	let { data, width = 300, height = 300, title = '' }: Props = $props();

	let svgEl: SVGSVGElement;

	const COLORS = [
		'#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
		'#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
		'#a855f7', '#d946ef', '#f59e0b', '#10b981',
	];

	const drawChart = () => {
		if (!svgEl || data.length === 0) return;

		const svg = d3.select(svgEl);
		svg.selectAll('*').remove();

		const margin = 10;
		const radius = Math.min(width, height) / 2 - margin;
		const innerRadius = radius * 0.55;

		const g = svg
			.attr('width', width)
			.attr('height', height)
			.append('g')
			.attr('transform', `translate(${width / 2},${height / 2})`);

		const pie = d3.pie<ChartData>()
			.value(d => d.value)
			.sort(null);

		const arc = d3.arc<d3.PieArcDatum<ChartData>>()
			.innerRadius(innerRadius)
			.outerRadius(radius);

		const hoverArc = d3.arc<d3.PieArcDatum<ChartData>>()
			.innerRadius(innerRadius)
			.outerRadius(radius + 6);

		const color = d3.scaleOrdinal<string>()
			.domain(data.map(d => d.label))
			.range(COLORS);

		const total = data.reduce((sum, d) => sum + d.value, 0);

		// Center total
		g.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '-0.2em')
			.attr('class', 'fill-gray-500')
			.style('font-size', '12px')
			.text('Total');

		g.append('text')
			.attr('text-anchor', 'middle')
			.attr('dy', '1.1em')
			.attr('class', 'fill-gray-900')
			.style('font-size', '18px')
			.style('font-weight', '700')
			.text(`$${total.toFixed(0)}`);

		// Tooltip div (created before slices so event handlers can reference it)
		const container = d3.select(svgEl.parentElement);
		container.selectAll('.chart-tooltip').remove();
		const tooltip = container
			.append('div')
			.attr('class', 'chart-tooltip')
			.style('position', 'absolute')
			.style('opacity', 0)
			.style('background', 'rgba(0,0,0,0.85)')
			.style('color', 'white')
			.style('padding', '6px 10px')
			.style('border-radius', '6px')
			.style('font-size', '12px')
			.style('pointer-events', 'none')
			.style('white-space', 'nowrap')
			.style('z-index', '10');

		// Slices
		const slices = g.selectAll('.slice')
			.data(pie(data))
			.enter()
			.append('g')
			.attr('class', 'slice');

		slices.append('path')
			.attr('d', arc)
			.attr('fill', d => color(d.data.label))
			.attr('stroke', 'white')
			.attr('stroke-width', 2)
			.style('cursor', 'pointer')
			.style('transition', 'opacity 0.15s')
			.on('mouseenter', function (event, d) {
				d3.select(this).transition().duration(150).attr('d', hoverArc);
				tooltip
					.style('opacity', 1)
					.html(`<strong>${d.data.label}</strong><br/>$${d.data.value.toFixed(2)} (${((d.data.value / total) * 100).toFixed(1)}%)`);
			})
			.on('mousemove', function (event) {
				const [x, y] = d3.pointer(event, svgEl);
				tooltip
					.style('left', `${x + 15}px`)
					.style('top', `${y - 10}px`);
			})
			.on('mouseleave', function () {
				d3.select(this).transition().duration(150).attr('d', arc);
				tooltip.style('opacity', 0);
			});

	};

	onMount(() => {
		drawChart();
	});

	$effect(() => {
		// Re-draw when data changes
		if (data && svgEl) drawChart();
	});
</script>

<div class="relative inline-block">
	{#if title}
		<p class="mb-2 text-center text-sm font-medium text-gray-600">{title}</p>
	{/if}
	{#if data.length === 0}
		<div class="flex items-center justify-center" style="width: {width}px; height: {height}px;">
			<p class="text-sm text-gray-400">No data</p>
		</div>
	{:else}
		<svg bind:this={svgEl}></svg>
	{/if}
</div>
