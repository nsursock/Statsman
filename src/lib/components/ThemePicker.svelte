<script lang="ts">
	import { onMount } from 'svelte';
	import {
		THEME_IDS,
		THEME_META,
		DEFAULT_THEME,
		applyTheme,
		readStoredTheme,
		isThemeId,
		type ThemeId
	} from '$lib/themes';

	let {
		compact = false
	}: {
		compact?: boolean;
	} = $props();

	function initialTheme(): ThemeId {
		if (typeof document !== 'undefined') {
			const attr = document.documentElement.getAttribute('data-theme');
			if (isThemeId(attr)) return attr;
		}
		return DEFAULT_THEME;
	}

	let open = $state(false);
	let theme = $state<ThemeId>(initialTheme());
	let root: HTMLElement;

	onMount(() => {
		theme = readStoredTheme();
		applyTheme(theme);

		const onDoc = (e: MouseEvent) => {
			if (!root.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		document.addEventListener('click', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	});

	function pick(id: ThemeId) {
		theme = id;
		applyTheme(id);
		open = false;
	}
</script>

<div class="dropdown dropdown-end relative" class:open bind:this={root}>
	<button
		type="button"
		class="btn {compact ? 'btn-xs' : 'btn-sm'} btn-ghost"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label="Theme: {THEME_META[theme].label}"
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
	>
		<span class="flex items-center gap-1.5">
			<span class="flex gap-0.5" aria-hidden="true">
				{#each THEME_META[theme].swatch as c}
					<span class="swatch" style="background: {c}"></span>
				{/each}
			</span>
			{#if !compact}
				<span class="hidden sm:inline">{THEME_META[theme].label}</span>
			{/if}
		</span>
	</button>

	{#if open}
		<div class="dropdown-menu open right-0 left-auto w-52 max-h-72 overflow-y-auto" role="listbox">
			<p class="menu-label">Theme</p>
			{#each THEME_IDS as id}
				<button
					type="button"
					class="menu-item {theme === id ? 'active' : ''}"
					role="option"
					aria-selected={theme === id}
					onclick={() => pick(id)}
				>
					<span class="flex gap-0.5 shrink-0" aria-hidden="true">
						{#each THEME_META[id].swatch as c}
							<span class="swatch" style="background: {c}"></span>
						{/each}
					</span>
					<span class="truncate">{THEME_META[id].label}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.swatch {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
	}
</style>
