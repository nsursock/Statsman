<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';

	let canvas = $state<HTMLCanvasElement | undefined>();
	let reduced = $state(false);

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced || !canvas) return;

		const readPrimary = () => {
			const raw = (
				getComputedStyle(document.documentElement).getPropertyValue('--scifi-primary') || '#ff2a6d'
			).trim();
			return new THREE.Color(raw);
		};

		let color = readPrimary();
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
		camera.position.z = 6;

		const renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			alpha: true
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		const grid = new THREE.GridHelper(
			24,
			48,
			color.getHex(),
			color.clone().multiplyScalar(0.25).getHex()
		);
		grid.rotation.x = Math.PI / 2.4;
		grid.position.y = -1.8;
		scene.add(grid);

		const count = 420;
		const positions = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			positions[i * 3] = (Math.random() - 0.5) * 18;
			positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
			positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
		}
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		const material = new THREE.PointsMaterial({
			color,
			size: 0.035,
			transparent: true,
			opacity: 0.75
		});
		const points = new THREE.Points(geometry, material);
		scene.add(points);

		const applyThemeColor = () => {
			color = readPrimary();
			material.color.copy(color);
			const mats = grid.material;
			const list = Array.isArray(mats) ? mats : [mats];
			if (list[0]) (list[0] as THREE.LineBasicMaterial).color.copy(color);
			if (list[1]) (list[1] as THREE.LineBasicMaterial).color.copy(color.clone().multiplyScalar(0.25));
		};

		const el = canvas;
		const resize = () => {
			const { clientWidth: w, clientHeight: h } = el.parentElement ?? el;
			renderer.setSize(w, h, false);
			camera.aspect = w / Math.max(h, 1);
			camera.updateProjectionMatrix();
		};
		resize();
		window.addEventListener('resize', resize);
		document.documentElement.addEventListener('statsman:theme', applyThemeColor);

		let frame = 0;
		let raf = 0;
		const tick = () => {
			frame += 0.0035;
			grid.rotation.z = Math.sin(frame) * 0.08;
			points.rotation.y = frame * 0.35;
			points.rotation.x = Math.sin(frame * 0.5) * 0.12;
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};
		tick();

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
			document.documentElement.removeEventListener('statsman:theme', applyThemeColor);
			geometry.dispose();
			material.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="scene absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
	{#if !reduced}
		<canvas class="block w-full h-full" bind:this={canvas}></canvas>
	{:else}
		<div
			class="w-full h-full"
			style="background: radial-gradient(ellipse at 30% 20%, color-mix(in oklab, var(--scifi-primary) 18%, transparent), transparent 50%), var(--scifi-bg);"
		></div>
	{/if}
</div>
