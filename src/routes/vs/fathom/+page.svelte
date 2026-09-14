<script lang="ts">
	import ComparisonView from '$lib/components/ComparisonView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<ComparisonView
	competitor={data.competitor}
	demoAvailable={data.demoAvailable}
	billingEnabled={data.billingEnabled}
/>
