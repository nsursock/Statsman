<script lang="ts">
	import { untrack } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { PLANS } from '$lib/plans';

	type Site = { id: string; name: string; domain: string };

	let {
		open = true,
		isCloud,
		billingEnabled,
		userEmail = null,
		plan = 'free',
		publicOrigin,
		initialSite = null,
		billingFlash = null,
		onComplete
	}: {
		open?: boolean;
		isCloud: boolean;
		billingEnabled: boolean;
		userEmail?: string | null;
		plan?: string;
		publicOrigin: string;
		initialSite?: Site | null;
		billingFlash?: string | null;
		onComplete?: () => void;
	} = $props();

	function initialStep(
		flash: string | null | undefined,
		cloud: boolean,
		userPlan: string,
		billingOn: boolean
	): 'plan' | 'site' | 'install' {
		if (flash === 'success') return 'site';
		if (!cloud) return 'site';
		// Beta / already paid / founder — skip the Stripe upsell.
		if (!billingOn || (userPlan && userPlan !== 'free')) return 'site';
		return 'plan';
	}

	// Capture mount-time props once (onboarding isn't remounted mid-session).
	let step = $state<'plan' | 'site' | 'install'>(
		untrack(() => initialStep(billingFlash, isCloud, plan, billingEnabled))
	);
	let name = $state('');
	let domain = $state('');
	let busy = $state(false);
	let errorMsg = $state('');
	let copied = $state(false);
	let site = $state<Site | null>(untrack(() => initialSite));

	$effect(() => {
		if (initialSite) site = initialSite;
	});

	const steps = $derived(
		isCloud && billingEnabled
			? [
					{ id: 'plan' as const, label: 'Plan' },
					{ id: 'site' as const, label: 'Site' },
					{ id: 'install' as const, label: 'Install' }
				]
			: [
					{ id: 'site' as const, label: 'Site' },
					{ id: 'install' as const, label: 'Install' }
				]
	);
	const stepIndex = $derived(Math.max(0, steps.findIndex((s) => s.id === step)));
	const plans = [PLANS.starter, PLANS.indie, PLANS.creator];

	async function createSite(e: Event) {
		e.preventDefault();
		busy = true;
		errorMsg = '';
		try {
			const res = await fetch('/api/sites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, domain })
			});
			const payload = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(payload.message || 'Could not create site');
			site = payload.site;
			await invalidateAll();
			step = 'install';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Create failed';
		} finally {
			busy = false;
		}
	}

	async function copySnippet() {
		if (!site) return;
		const snippet =
			`<script defer src="${publicOrigin}/tracker.js" data-site="${site.id}"></scr` + 'ipt>';
		try {
			await navigator.clipboard.writeText(snippet);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			/* ignore */
		}
	}

	async function finish() {
		await invalidateAll();
		onComplete?.();
		if (site) await goto(`/dashboard?site=${site.id}`, { replaceState: true });
		else await goto('/dashboard', { replaceState: true });
	}

	async function skipForNow() {
		await goto('/dashboard?skip_onboarding=1', { replaceState: true });
		onComplete?.();
	}
</script>

{#if open}
	<div class="modal-backdrop" role="presentation">
		<div
			class="modal max-w-lg w-full"
			role="dialog"
			aria-modal="true"
			aria-labelledby="onboard-title"
		>
			<div class="flex items-start justify-between gap-3 mb-1">
				<p class="label-kicker text-scifi-primary m-0">// First-time setup</p>
				<button type="button" class="btn btn-xs btn-ghost" onclick={skipForNow}>Skip for now</button>
			</div>
			<h2 id="onboard-title" class="modal-title text-xl mb-1">
				{#if step === 'plan'}
					Pick your orbit
				{:else if step === 'site'}
					Add your first site
				{:else}
					Install the tracker
				{/if}
			</h2>
			{#if userEmail}
				<p class="text-xs text-scifi-muted mb-4">
					Signed in as <span class="text-scifi-cyan">{userEmail}</span>
					· plan <span class="text-scifi-primary">{plan}</span>
				</p>
			{:else}
				<p class="text-xs text-scifi-muted mb-4">Self-host setup — your console, your disk.</p>
			{/if}

			<ol class="steps mb-5">
				{#each steps as s, i}
					<li class="step {i <= stepIndex ? 'step-primary' : ''}">{s.label}</li>
				{/each}
			</ol>

			{#if billingFlash === 'success'}
				<p class="text-sm text-scifi-success mb-3">Billing confirmed. Continue with your site.</p>
			{:else if billingFlash === 'cancel'}
				<p class="text-sm text-scifi-muted mb-3">Checkout canceled — Free still works.</p>
			{/if}

			{#if step === 'plan' && isCloud}
				<div class="space-y-2 max-h-72 overflow-y-auto pr-1">
					{#each plans as p}
						<div class="pane p-3">
							<div class="flex items-baseline justify-between gap-2 mb-1">
								<span class="label-kicker text-scifi-text m-0">{p.label}</span>
								<span class="text-sm font-bold">
									{#if p.priceMonthly === 0}$0{:else}${p.priceMonthly}/mo{/if}
								</span>
							</div>
							<p class="text-xs text-scifi-muted m-0 mb-2 leading-relaxed">{p.description}</p>
							<p class="text-[0.65rem] text-scifi-muted mb-2">
								{p.sites} site{p.sites === 1 ? '' : 's'} · {p.pageviews.toLocaleString()} views/mo
							</p>
							{#if p.id === 'free'}
								<button type="button" class="btn btn-primary btn-sm w-full" onclick={() => (step = 'site')}>
									Continue free
								</button>
							{:else if billingEnabled}
								<a
									class="btn btn-primary btn-sm w-full text-center"
									href="/subscribe?plan={p.id}&next={encodeURIComponent('/dashboard?billing=success')}"
								>
									Subscribe · ${p.priceMonthly}/mo
								</a>
							{:else}
								<button type="button" class="btn btn-ghost btn-sm w-full" onclick={() => (step = 'site')}>
									Continue on Free (billing unset)
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{:else if step === 'site'}
				<form class="space-y-3" onsubmit={createSite}>
					<label class="block space-y-1">
						<span class="label-kicker">Site name</span>
						<input class="input" bind:value={name} required placeholder="My indie blog" />
					</label>
					<label class="block space-y-1">
						<span class="label-kicker">Domain</span>
						<input class="input" bind:value={domain} required placeholder="example.com" />
					</label>
					{#if errorMsg}
						<p class="text-sm text-[var(--scifi-error)] m-0">{errorMsg}</p>
					{/if}
					<div class="modal-actions !justify-between">
						{#if isCloud}
							<button type="button" class="btn btn-ghost" onclick={() => (step = 'plan')}>← Plan</button>
						{:else}
							<span></span>
						{/if}
						<button class="btn btn-primary" type="submit" disabled={busy}>
							{busy ? 'Creating…' : 'Create site'}
						</button>
					</div>
				</form>
			{:else}
				<div class="space-y-3">
					{#if site}
						<p class="text-sm text-scifi-muted m-0">
							Paste into your site’s custom code / header-footer setting (WordPress, Ghost,
							etc.) for <strong>{site.name}</strong> ({site.domain}).
						</p>
						<pre
							class="glass rounded-lg p-3 text-xs text-scifi-cyan overflow-x-auto"
						>&lt;script defer src="{publicOrigin}/tracker.js" data-site="{site.id}"&gt;&lt;/script&gt;</pre>
						<button type="button" class="btn btn-xs btn-ghost" onclick={copySnippet}>
							{copied ? '✓ copied' : 'Copy snippet'}
						</button>
					{:else}
						<p class="text-sm text-scifi-muted m-0">No site yet.</p>
						<button type="button" class="btn btn-primary btn-sm" onclick={() => (step = 'site')}>
							Add site
						</button>
					{/if}
					<div class="modal-actions !justify-between pt-2">
						<button type="button" class="btn btn-ghost" onclick={() => (step = 'site')}>← Site</button>
						<button type="button" class="btn-cta" onclick={finish}>Open dashboard</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
