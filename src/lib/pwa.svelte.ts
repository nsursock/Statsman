/// Shared PWA install state.
///
/// The `beforeinstallprompt` event can fire at any time — often before the
/// settings modal is opened — so we capture it globally from the root layout
/// and expose it here. The InstallButton component reads from this store
/// whenever it mounts, so it never misses an event that already fired.
///
/// iOS Safari does not fire `beforeinstallprompt` (Apple offers no programmatic
/// install API); iOS users must use Share → Add to Home Screen. We detect iOS
/// so the InstallButton can show step-by-step instructions instead.

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export const pwa = $state({
	/** Captured `beforeinstallprompt` event, or null if not yet installable / already used. */
	deferred: null as BeforeInstallPromptEvent | null,
	/** True when the app is already running as an installed PWA (standalone display mode). */
	installed: false,
	/** True on iOS Safari, where there is no programmatic install prompt. */
	isIOS: false
});

/**
 * Register global PWA listeners. Call once from the root layout onMount.
 * Returns a cleanup function.
 */
export function initPwa(): () => void {
	if (typeof window === 'undefined') return () => {};

	// Already running as an installed PWA?
	const standalone =
		window.matchMedia('(display-mode: standalone)').matches ||
		(navigator as unknown as { standalone?: boolean }).standalone === true;
	if (standalone) pwa.installed = true;

	// iOS detection. iPadOS 13+ reports as MacIntel with touch — check that too.
	const ua = navigator.userAgent;
	const nav = navigator as unknown as { platform?: string; maxTouchPoints?: number };
	pwa.isIOS =
		/iPad|iPhone|iPod/.test(ua) ||
		(nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);

	const onBIP = (e: Event) => {
		// Prevent the browser's default mini-infobar; we show our own button instead.
		e.preventDefault();
		pwa.deferred = e as BeforeInstallPromptEvent;
	};
	const onInstalled = () => {
		pwa.installed = true;
		pwa.deferred = null;
	};

	window.addEventListener('beforeinstallprompt', onBIP);
	window.addEventListener('appinstalled', onInstalled);

	return () => {
		window.removeEventListener('beforeinstallprompt', onBIP);
		window.removeEventListener('appinstalled', onInstalled);
	};
}

/**
 * Trigger the native install prompt (Chrome/Android/desktop Chrome).
 * No-op if no deferred event is available.
 */
export async function promptInstall(): Promise<void> {
	if (!pwa.deferred) return;
	const ev = pwa.deferred;
	await ev.prompt();
	const choice = await ev.userChoice;
	if (choice.outcome === 'accepted') pwa.installed = true;
	// The event can only be used once; clear it regardless of outcome.
	pwa.deferred = null;
}
