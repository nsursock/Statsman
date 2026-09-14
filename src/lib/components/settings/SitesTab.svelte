<script lang="ts">
	import type { Site } from './types';

	let {
		sites,
		activeSiteId = null,
		deletingId = null,
		name = $bindable(''),
		domain = $bindable(''),
		creating = false,
		message = '',
		onClose,
		onCreateSite,
		onAskRemove,
		onSwitchSite
	}: {
		sites: Site[];
		activeSiteId?: string | null;
		deletingId?: string | null;
		name?: string;
		domain?: string;
		creating?: boolean;
		message?: string;
		onClose: () => void;
		onCreateSite: (e: Event) => void | Promise<void>;
		onAskRemove: (site: Site, e: MouseEvent) => void;
		onSwitchSite: (id: string) => void;
	} = $props();
</script>

{#if sites.length}
	<ul class="site-list">
		{#each sites as s (s.id)}
			<li class="site-card {activeSiteId === s.id ? 'is-active' : ''}">
				<button
					type="button"
					class="site-main"
					onclick={() => {
						onSwitchSite(s.id);
						onClose();
					}}
				>
					<span class="site-signal" aria-hidden="true"></span>
					<span class="min-w-0 text-left">
						<span class="block font-semibold truncate">{s.name}</span>
						<span class="block text-[0.7rem] text-scifi-muted truncate">{s.domain}</span>
					</span>
					{#if activeSiteId === s.id}
						<span class="badge badge-primary shrink-0">active</span>
					{/if}
				</button>
				<button
					type="button"
					class="site-remove"
					title="Stop tracking {s.name}"
					aria-label="Stop tracking {s.name}"
					disabled={deletingId === s.id}
					onclick={(e) => onAskRemove(s, e)}
				>
					{deletingId === s.id ? '…' : 'Remove'}
				</button>
			</li>
		{/each}
	</ul>
{:else}
	<div class="empty-pane">
		<p class="m-0 text-sm text-scifi-muted">
			No sites yet. Add your first property to start collecting telemetry.
		</p>
	</div>
{/if}

<form class="add-site" onsubmit={onCreateSite}>
	<p class="label-kicker mb-2">Add site</p>
	<div class="grid gap-2 sm:grid-cols-2">
		<label class="block space-y-1">
			<span class="text-[0.65rem] uppercase tracking-[0.12em] text-scifi-muted">Name</span>
			<input class="input" bind:value={name} required placeholder="My indie blog" autocomplete="off" />
		</label>
		<label class="block space-y-1">
			<span class="text-[0.65rem] uppercase tracking-[0.12em] text-scifi-muted">Domain</span>
			<input class="input" bind:value={domain} required placeholder="example.com" autocomplete="off" />
		</label>
	</div>
	{#if message}
		<p class="text-xs text-scifi-cyan m-0 mt-2">{message}</p>
	{/if}
	<button class="btn btn-primary w-full sm:w-auto mt-3" type="submit" disabled={creating}>
		{creating ? 'Creating…' : 'Create site'}
	</button>
</form>
