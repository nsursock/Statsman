<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '@fontsource/jetbrains-mono/400.css';
	import '@fontsource/jetbrains-mono/500.css';
	import '@fontsource/jetbrains-mono/700.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Statsman</title>
</svelte:head>

{@render children()}
