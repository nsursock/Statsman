<script lang="ts">
	import { THEME_IDS, THEME_META, applyTheme, readStoredTheme, type ThemeId } from '$lib/themes';

	let theme = $state<ThemeId>('retrowave');

	$effect(() => {
		theme = readStoredTheme();
	});

	function pickTheme(id: ThemeId) {
		theme = id;
		applyTheme(id);
	}
</script>

<p class="text-sm text-scifi-muted m-0 mb-4 leading-relaxed">
	Pick a console skin. Saved on this device — no account required.
</p>
<div class="theme-grid" role="listbox" aria-label="Themes">
	{#each THEME_IDS as id}
		<button
			type="button"
			role="option"
			class="theme-card {theme === id ? 'is-active' : ''}"
			aria-selected={theme === id}
			onclick={() => pickTheme(id)}
		>
			<span class="theme-swatches" aria-hidden="true">
				{#each THEME_META[id].swatch as c}
					<span class="theme-swatch" style="background: {c}"></span>
				{/each}
			</span>
			<span class="theme-label">{THEME_META[id].label}</span>
			{#if theme === id}
				<span class="theme-check" aria-hidden="true">●</span>
			{/if}
		</button>
	{/each}
</div>
