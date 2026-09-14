<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { initPwa } from '$lib/pwa.svelte';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/jetbrains-mono/500.css';
	import '@fontsource/jetbrains-mono/700.css';
	import '../app.css';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();

	onMount(() => {
		// Register the no-op service worker for PWA installability (Chrome/Android).
		// iOS "Add to Home Screen" works without it, but Chrome requires a registered
		// SW with a fetch handler before it will show the install prompt.
		if (
			typeof navigator !== 'undefined' &&
			'serviceWorker' in navigator &&
			// Only register in production builds — avoid stale SW state during dev.
			import.meta.env.PROD
		) {
			navigator.serviceWorker
				.register('/service-worker.js', { scope: '/' })
				.catch(() => {
					// Registration failure is non-fatal: the app still works as a normal site.
				});
		}

		// Capture the beforeinstallprompt event globally so the Settings panel's
		// Install button can trigger it whenever the user opens settings — even if
		// the event fired before the panel was opened.
		return initPwa();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	{#if data.canonical}
		<link rel="canonical" href={data.canonical} />
	{/if}
	<link
		rel="stylesheet"
		href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.34.1/dist/tabler-icons.min.css"
	/>
	<title>Statsman</title>
</svelte:head>

{#if data.analytics}
	<script
		defer
		src={data.analytics.src}
		data-site={data.analytics.siteId}
		data-allow-localhost={data.analytics.allowLocalhost ? '' : undefined}
		data-ignore-prefix={data.analytics.ignorePrefixes}
	></script>
{/if}

{@render children()}
