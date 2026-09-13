<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/jetbrains-mono/500.css';
	import '@fontsource/jetbrains-mono/700.css';
	import '../app.css';
	import type { LayoutData } from './$types';

	let { children, data }: { children: import('svelte').Snippet; data: LayoutData } = $props();
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
