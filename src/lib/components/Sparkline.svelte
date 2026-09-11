<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from '@scifiui/core/js';

	let {
		data
	}: {
		data: { date: string; pageviews: number; visitors: number }[];
	} = $props();

	let svg: SVGSVGElement;
	const gid = $props.id(); // SSR-safe unique id — no gradient collisions between instances
	const max = $derived(Math.max(1, ...data.map((d) => d.pageviews)));
	const w = 640;
	const h = 180;
	const pad = 12;

	const toPoints = (key: 'pageviews' | 'visitors') =>
		data
			.map((d, i) => {
				const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2);
				const y = h - pad - (d[key] / max) * (h - pad * 2);
				return `${x},${y}`;
			})
			.join(' ');

	const points = $derived(toPoints('pageviews'));
	const visitorPoints = $derived(toPoints('visitors'));

	onMount(() => {
		const lines = svg.querySelectorAll('.line');
		for (const line of lines) {
			if ('getTotalLength' in line) {
				const length = (line as SVGGeometryElement).getTotalLength();
				gsap.fromTo(
					line,
					{ strokeDasharray: length, strokeDashoffset: length },
					{ strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }
				);
			}
		}
		const area = svg.querySelector('.area');
		if (area) {
			gsap.fromTo(area, { opacity: 0 }, { opacity: 1, duration: 1, delay: 0.4 });
		}
	});
</script>

<svg
	bind:this={svg}
	viewBox="0 0 {w} {h}"
	class="chart w-full h-auto block"
	role="img"
	aria-label="Pageviews and visitors over time"
>
	<defs>
		<linearGradient id="{gid}-fill" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0%" stop-color="var(--scifi-primary)" stop-opacity="0.35" />
			<stop offset="100%" stop-color="var(--scifi-primary)" stop-opacity="0" />
		</linearGradient>
	</defs>
	<polyline
		class="area"
		fill="url(#{gid}-fill)"
		stroke="none"
		points={`${pad},${h - pad} ${points} ${w - pad},${h - pad}`}
	/>
	<polyline
		class="line"
		fill="none"
		stroke="var(--scifi-cyan)"
		stroke-width="1.5"
		stroke-opacity="0.85"
		points={visitorPoints}
	/>
	<polyline
		class="line"
		fill="none"
		stroke="var(--scifi-primary)"
		stroke-width="2"
		points={points}
	/>
</svg>
