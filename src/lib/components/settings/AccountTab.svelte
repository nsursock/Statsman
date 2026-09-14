<script lang="ts">
	import InstallButton from '../InstallButton.svelte';
	import type { Usage } from './types';

	let {
		isCloud = false,
		billingEnabled = false,
		userEmail = null,
		usage = null,
		onCheckout,
		onPortal
	}: {
		isCloud?: boolean;
		billingEnabled?: boolean;
		userEmail?: string | null;
		usage?: Usage;
		onCheckout: (plan: 'indie' | 'creator') => void;
		onPortal: () => void | Promise<void>;
	} = $props();
</script>

<div class="account-card">
	<p class="text-[0.65rem] uppercase tracking-[0.14em] text-scifi-muted m-0 mb-1">
		{isCloud ? 'Signed in' : 'Access mode'}
	</p>
	<p class="text-base font-bold text-scifi-cyan m-0 break-all">
		{userEmail ?? (isCloud ? '—' : 'Self-host operator')}
	</p>
	<p class="text-xs text-scifi-muted m-0 mt-1">
		{#if isCloud}
			Cloud account · email + password
		{:else}
			Local console · STATSMAN_ADMIN_TOKEN / access cookie
		{/if}
	</p>
</div>

{#if usage}
	<div class="usage-card">
		<div class="flex items-baseline justify-between gap-2 mb-2">
			<span class="label-kicker m-0">Plan · {usage.plan}</span>
			{#if usage.overCap}
				<span class="badge badge-error">Over cap</span>
			{/if}
		</div>
		<p class="text-sm text-scifi-muted m-0 mb-2">
			{usage.used.toLocaleString()} / {usage.limit.toLocaleString()} pageviews ·
			{usage.sitesUsed}/{usage.sitesLimit} sites
		</p>
		<div class="usage-meter">
			<div
				class="usage-fill {usage.overCap ? 'is-over' : ''}"
				style="width: {usage.pct}%"
			></div>
		</div>
		<div class="flex flex-wrap gap-2 mt-4">
			{#if usage.plan === 'founder'}
				<p class="text-xs text-scifi-muted m-0">
					Founder seat — full cloud access, no billing.
				</p>
			{:else if usage.plan === 'beta'}
				<p class="text-xs text-scifi-muted m-0">
					Free beta — 1 site, 3,000 views/mo.
				</p>
			{:else if billingEnabled && usage.plan === 'free'}
			<a href="/subscribe?plan=starter" class="btn btn-primary btn-sm">Subscribe Starter $3</a>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => onCheckout('indie')}>
				Indie $9
			</button>
			<button type="button" class="btn btn-ghost btn-sm" onclick={() => onCheckout('creator')}>
				Creator $19
			</button>
			{:else if billingEnabled && usage.plan === 'indie'}
				<button type="button" class="btn btn-primary btn-sm" onclick={onPortal}>
					Upgrade Creator $19
				</button>
				<button type="button" class="btn btn-ghost btn-sm" onclick={onPortal}>
					Manage billing
				</button>
			{:else if billingEnabled}
				<button type="button" class="btn btn-ghost btn-sm" onclick={onPortal}>
					Manage billing
				</button>
			{:else}
				<a class="btn btn-ghost btn-sm" href="/pricing">View plans</a>
			{/if}
		</div>
	</div>
{:else if !isCloud}
	<p class="text-sm text-scifi-muted m-0 mt-4 leading-relaxed">
		Self-host has no plan caps. Your data stays on this machine.
	</p>
{/if}

<a class="btn btn-ghost btn-sm mt-4" href="/auth/logout">Log out</a>

<div class="install-row">
	<div class="min-w-0">
		<p class="m-0 text-sm font-semibold">Install app</p>
		<p class="m-0 mt-1 text-[0.7rem] text-scifi-muted leading-relaxed">
			Add Statsman to your home screen — it opens full-screen, like a native app.
		</p>
	</div>
	<InstallButton />
</div>
