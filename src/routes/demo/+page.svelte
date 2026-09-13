<script lang="ts">
	import { onMount } from 'svelte';
	import { enterShell } from '@scifiui/core/js';
	import { DEMO_BLOG_NAME, DEMO_BLOG_TAGLINE } from '$lib/demo-posts';
	import ThemePicker from '$lib/components/ThemePicker.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let root: HTMLElement;

	onMount(() => {
		enterShell(root);
	});
</script>

<svelte:head>
	<title>{DEMO_BLOG_NAME} — a fake blog, really tracked</title>
	<meta
		name="description"
		content="A fictional indie blog, tracked for real by this Statsman instance. Every click fires an actual event."
	/>
	<!-- Dogfood: fake blog → real tracker. Skip if layout already injects the same site. -->
	{#if !data.analytics || data.analytics.siteId !== data.siteId}
		<script defer src="/tracker.js" data-site={data.siteId} data-allow-localhost></script>
	{/if}
</svelte:head>

<main bind:this={root} class="relative min-h-screen bg-[var(--scifi-bg)] text-[var(--scifi-text)] pb-36">
	<!-- Blog masthead -->
	<header class="border-b border-[var(--scifi-border)]" data-enter>
		<div class="mx-auto max-w-2xl px-5 py-6 flex items-baseline justify-between gap-4 flex-wrap">
			<div>
				<a href="/demo" data-sveltekit-reload class="no-underline">
					<span class="brand-mark text-lg">{DEMO_BLOG_NAME}</span>
				</a>
				<p class="text-scifi-muted text-xs mt-1">{DEMO_BLOG_TAGLINE}</p>
			</div>
			<nav class="flex gap-4 text-xs text-scifi-muted items-center">
				<a href="/demo" data-sveltekit-reload class="hover:text-scifi-primary transition-colors no-underline">Essays</a>
				<a href="/demo?p=goodbye-google-analytics" data-sveltekit-reload class="hover:text-scifi-primary transition-colors no-underline">About</a>
				<a href="/demo?p=indie-infra-zero-budget" data-sveltekit-reload class="hover:text-scifi-primary transition-colors no-underline">Now</a>
				<ThemePicker compact />
			</nav>
		</div>
	</header>

	<div class="mx-auto max-w-2xl px-5 pt-10">
		{#if data.post}
			<article data-enter>
				<a href="/demo" data-sveltekit-reload class="text-xs text-scifi-cyan no-underline hover:text-scifi-primary transition-colors">← all essays</a>
				<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mt-3 mb-2">
					{data.post.title}
				</h1>
				<p class="text-scifi-muted text-xs tracking-[0.14em] uppercase mb-8">{data.post.date} · 4 min read</p>
				{#each data.post.body as paragraph}
					<p class="text-sm sm:text-[0.95rem] leading-[1.85] text-[var(--scifi-text)]/85 mb-5">{paragraph}</p>
				{/each}
			</article>

			{#if data.next}
				<nav class="mt-12 pt-6 border-t border-[var(--scifi-border)]" data-enter>
					<p class="label-kicker mb-2">Next essay</p>
					<a
						href="/demo?p={data.next.slug}"
						data-sveltekit-reload
						class="no-underline group"
					>
						<span class="text-lg font-bold group-hover:text-scifi-primary transition-colors">
							{data.next.title} →
						</span>
					</a>
				</nav>
			{/if}
		{:else}
			<section data-enter>
				<p class="label-kicker text-scifi-primary mb-2">Latest essays</p>
				<h1 class="text-3xl font-extrabold tracking-tight mb-8">
					Signal, minus the surveillance.
				</h1>
				<ul class="space-y-5 list-none p-0 m-0">
					{#each data.posts as post (post.slug)}
						<li>
							<a href="/demo?p={post.slug}" data-sveltekit-reload class="no-underline group block">
								<div
									class="pane p-4 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-[var(--scifi-border-accent)]"
								>
									<div class="flex items-baseline justify-between gap-3 mb-1.5">
										<span class="font-bold text-sm group-hover:text-scifi-primary transition-colors">
											{post.title}
										</span>
										<span class="text-[0.65rem] text-scifi-muted whitespace-nowrap">{post.date}</span>
									</div>
									<p class="text-scifi-muted text-xs leading-relaxed m-0">{post.excerpt}</p>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<!-- Demo HUD: top = status + Enter/Exit; bottom = helper copy -->
	<aside
		class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
		data-enter
		aria-label="Demo controls"
	>
		<div class="console-panel px-4 py-3 flex flex-col gap-3">
			<div class="flex items-center justify-between gap-3 flex-wrap">
				<span class="status-chip shrink-0"><span class="dot"></span> demo site · tracked live</span>
				<div class="flex gap-2 shrink-0">
					<a href="/demo/console" class="btn btn-xs btn-primary">Enter</a>
					<a href="/" class="btn btn-xs btn-ghost">Exit demo</a>
				</div>
			</div>
			<p class="text-[0.68rem] text-scifi-muted leading-snug m-0">
				This fake blog is instrumented with the real tracker — every click you make just fired an actual
				event into this Statsman instance.
			</p>
		</div>
	</aside>
</main>
