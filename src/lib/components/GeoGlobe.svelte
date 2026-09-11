<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

	type City = {
		city: string;
		country: string;
		lat: number;
		lng: number;
		views: number;
	};

	let {
		cities = [],
		height = 360
	}: {
		cities?: City[];
		height?: number;
	} = $props();

	let canvas = $state<HTMLCanvasElement | undefined>();
	let reduced = $state(false);
	let hoverLabel = $state('');
	let status = $state('Loading Earth…');

	/** NASA Blue Marble via jsDelivr (three-globe example assets). */
	const EARTH_DAY =
		'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg';
	const EARTH_TOPOLOGY =
		'https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png';

	function latLngToVec(lat: number, lng: number, r: number) {
		const phi = ((90 - lat) * Math.PI) / 180;
		const theta = ((lng + 180) * Math.PI) / 180;
		return new THREE.Vector3(
			-r * Math.sin(phi) * Math.cos(theta),
			r * Math.cos(phi),
			r * Math.sin(phi) * Math.sin(theta)
		);
	}

	function cssColor(name: string, fallback: string) {
		const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		try {
			return new THREE.Color(raw || fallback);
		} catch {
			return new THREE.Color(fallback);
		}
	}

	onMount(() => {
		reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (!canvas) return;

		const el = canvas;
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
		camera.position.set(0, 0.35, 3.6);

		const renderer = new THREE.WebGLRenderer({
			canvas: el,
			antialias: true,
			alpha: true
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.outputColorSpace = THREE.SRGBColorSpace;

		const controls = new OrbitControls(camera, el);
		controls.enableDamping = true;
		controls.dampingFactor = 0.06;
		controls.enablePan = false;
		controls.minDistance = 1.85;
		controls.maxDistance = 7.5;
		controls.rotateSpeed = 0.55;
		controls.zoomSpeed = 0.85;
		controls.autoRotate = !reduced;
		controls.autoRotateSpeed = 0.45;
		// User interaction pauses auto-spin briefly, then resumes.
		let resumeTimer: ReturnType<typeof setTimeout> | null = null;
		const bumpInteraction = () => {
			controls.autoRotate = false;
			if (resumeTimer) clearTimeout(resumeTimer);
			if (reduced) return;
			resumeTimer = setTimeout(() => {
				controls.autoRotate = true;
			}, 4000);
		};
		controls.addEventListener('start', bumpInteraction);

		const root = new THREE.Group();
		root.rotation.y = Math.PI;
		scene.add(root);

		scene.add(new THREE.AmbientLight(0xffffff, 0.45));
		const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
		sun.position.set(5, 2.5, 3);
		scene.add(sun);
		const fill = new THREE.DirectionalLight(0x88aaff, 0.35);
		fill.position.set(-4, -1, -2);
		scene.add(fill);

		const globeR = 1.28;
		let primary = cssColor('--scifi-primary', '#ff2a6d');
		let cyan = cssColor('--scifi-cyan', '#2ee6ff');

		const sphereGeo = new THREE.SphereGeometry(globeR, 72, 72);
		const globeMat = new THREE.MeshPhongMaterial({
			color: 0x8899aa,
			shininess: 12,
			specular: new THREE.Color(0x222233)
		});
		const globe = new THREE.Mesh(sphereGeo, globeMat);
		root.add(globe);

		const atmos = new THREE.Mesh(
			new THREE.SphereGeometry(globeR * 1.04, 48, 48),
			new THREE.MeshBasicMaterial({
				color: cyan,
				transparent: true,
				opacity: 0.12,
				side: THREE.BackSide
			})
		);
		root.add(atmos);

		const loader = new THREE.TextureLoader();
		loader.setCrossOrigin('anonymous');

		const loadTex = (url: string) =>
			new Promise<THREE.Texture>((resolve, reject) => {
				loader.load(
					url,
					(tex) => {
						tex.colorSpace = THREE.SRGBColorSpace;
						tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
						resolve(tex);
					},
					undefined,
					reject
				);
			});

		let dayTex: THREE.Texture | null = null;
		let bumpTex: THREE.Texture | null = null;

		void (async () => {
			try {
				dayTex = await loadTex(EARTH_DAY);
				globeMat.map = dayTex;
				globeMat.color.set(0xffffff);
				globeMat.needsUpdate = true;
				status = 'Drag to orbit · scroll to zoom';
				try {
					bumpTex = await loadTex(EARTH_TOPOLOGY);
					globeMat.bumpMap = bumpTex;
					globeMat.bumpScale = 0.035;
					globeMat.needsUpdate = true;
				} catch {
					/* bump optional */
				}
			} catch {
				status = 'Earth texture failed — pins still geo-located';
				globeMat.color.copy(cyan.clone().multiplyScalar(0.25));
			}
		})();

		const markers = new THREE.Group();
		root.add(markers);

		const placed = cities.filter(
			(c) => Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90
		);
		const maxViews = Math.max(1, ...placed.map((c) => c.views));
		const hitSpheres: { mesh: THREE.Mesh; label: string }[] = [];
		const markerMats: THREE.MeshBasicMaterial[] = [];

		for (const c of placed) {
			const pos = latLngToVec(c.lat, c.lng, globeR * 1.012);
			const t = Math.sqrt(c.views / maxViews);
			const size = 0.02 + t * 0.05;

			const coreMat = new THREE.MeshBasicMaterial({ color: primary });
			const core = new THREE.Mesh(new THREE.SphereGeometry(size, 14, 14), coreMat);
			core.position.copy(pos);
			markers.add(core);
			markerMats.push(coreMat);

			const haloMat = new THREE.MeshBasicMaterial({
				color: cyan,
				transparent: true,
				opacity: 0.3
			});
			const halo = new THREE.Mesh(new THREE.SphereGeometry(size * 2.3, 12, 12), haloMat);
			halo.position.copy(pos);
			markers.add(halo);
			markerMats.push(haloMat);

			const spikeH = 0.08 + t * 0.28;
			const spikeMat = new THREE.MeshBasicMaterial({
				color: cyan,
				transparent: true,
				opacity: 0.92
			});
			const spike = new THREE.Mesh(
				new THREE.CylinderGeometry(0.0045, 0.0045, spikeH, 6),
				spikeMat
			);
			spike.position.copy(pos.clone().normalize().multiplyScalar(globeR + spikeH / 2 + 0.008));
			spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize());
			markers.add(spike);
			markerMats.push(spikeMat);

			const coords = `${c.lat.toFixed(2)}°, ${c.lng.toFixed(2)}°`;
			hitSpheres.push({
				mesh: core,
				label: `${c.city}, ${c.country} · ${coords} · ${c.views.toLocaleString()}`
			});
		}

		if (placed.length === 0) {
			status = 'No lat/lng pins yet';
		}

		const applyTheme = () => {
			primary = cssColor('--scifi-primary', '#ff2a6d');
			cyan = cssColor('--scifi-cyan', '#2ee6ff');
			(atmos.material as THREE.MeshBasicMaterial).color.copy(cyan);
			for (const m of markerMats) {
				if (m.opacity < 1) m.color.copy(cyan);
				else m.color.copy(primary);
			}
		};

		const resize = () => {
			const parent = el.parentElement ?? el;
			const w = parent.clientWidth;
			const h = parent.clientHeight || height;
			renderer.setSize(w, h, false);
			camera.aspect = w / Math.max(h, 1);
			camera.updateProjectionMatrix();
		};
		resize();
		window.addEventListener('resize', resize);
		document.documentElement.addEventListener('statsman:theme', applyTheme);

		const raycaster = new THREE.Raycaster();
		const pointer = new THREE.Vector2(-10, -10);
		const onMove = (e: PointerEvent) => {
			const rect = el.getBoundingClientRect();
			pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
		};
		el.addEventListener('pointermove', onMove);
		el.addEventListener('pointerleave', () => {
			pointer.set(-10, -10);
			hoverLabel = '';
		});

		let raf = 0;
		const tick = () => {
			controls.update();
			raycaster.setFromCamera(pointer, camera);
			const hits = raycaster.intersectObjects(hitSpheres.map((h) => h.mesh));
			hoverLabel = hits[0]
				? (hitSpheres.find((h) => h.mesh === hits[0].object)?.label ?? '')
				: '';
			renderer.render(scene, camera);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);

		return () => {
			cancelAnimationFrame(raf);
			if (resumeTimer) clearTimeout(resumeTimer);
			controls.dispose();
			window.removeEventListener('resize', resize);
			document.documentElement.removeEventListener('statsman:theme', applyTheme);
			el.removeEventListener('pointermove', onMove);
			dayTex?.dispose();
			bumpTex?.dispose();
			sphereGeo.dispose();
			globeMat.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="globe-shell" style="--globe-h: {height}px">
	<canvas bind:this={canvas} class="globe-canvas" aria-label="Interactive Earth map"></canvas>
	{#if hoverLabel}
		<p class="globe-hover">{hoverLabel}</p>
	{:else}
		<p class="globe-hint">{status}</p>
	{/if}
</div>

<style>
	.globe-shell {
		position: relative;
		height: var(--globe-h);
		min-height: 260px;
		border-radius: 12px;
		overflow: hidden;
		background: rgba(var(--scifi-bg-deep-rgb), 0.55);
	}
	.globe-canvas {
		display: block;
		width: 100%;
		height: 100%;
		cursor: grab;
		touch-action: none;
	}
	.globe-canvas:active {
		cursor: grabbing;
	}
	.globe-hover,
	.globe-hint {
		position: absolute;
		left: 0.85rem;
		right: 0.85rem;
		bottom: 0.75rem;
		margin: 0;
		font-size: 0.68rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--scifi-cyan);
		pointer-events: none;
	}
	.globe-hint {
		color: var(--scifi-muted);
	}
</style>
