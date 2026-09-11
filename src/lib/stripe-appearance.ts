/** Build Stripe Elements appearance from live ScifiUI CSS variables. */
export function scifiStripeAppearance(): {
	theme: 'night';
	variables: Record<string, string>;
	rules: Record<string, Record<string, string>>;
} {
	const css = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: string) =>
		(css.getPropertyValue(name).trim() || fallback);

	const bg = read('--scifi-bg', '#050010');
	const surface = read('--scifi-surface-solid', '#160a35');
	const text = read('--scifi-text', '#e8e6ff');
	const muted = read('--scifi-muted', '#7a6aa8');
	const primary = read('--scifi-primary', '#ff2e9a');
	const border = read('--scifi-border', 'rgba(122, 106, 168, 0.3)');
	const danger = read('--scifi-error', '#ff5555');
	const radius = read('--scifi-radius', '6px');
	const font = read('--scifi-font', 'JetBrains Mono, ui-monospace, monospace');

	return {
		theme: 'night',
		variables: {
			colorPrimary: primary,
			colorBackground: surface,
			colorText: text,
			colorTextSecondary: muted,
			colorDanger: danger,
			colorTextPlaceholder: muted,
			borderRadius: radius,
			fontFamily: font,
			spacingUnit: '4px',
			gridRowSpacing: '12px'
		},
		rules: {
			'.Input': {
				backgroundColor: bg,
				border: `1px solid ${border}`,
				boxShadow: 'none',
				padding: '10px 12px'
			},
			'.Input:focus': {
				border: `1px solid ${primary}`,
				boxShadow: `0 0 0 1px ${primary}`
			},
			'.Label': {
				color: muted,
				fontSize: '11px',
				fontWeight: '700',
				letterSpacing: '0.12em',
				textTransform: 'uppercase'
			},
			'.Tab': {
				backgroundColor: bg,
				border: `1px solid ${border}`,
				color: muted
			},
			'.Tab--selected': {
				backgroundColor: surface,
				borderColor: primary,
				color: text
			},
			'.Tab:hover': {
				color: text
			},
			'.Error': {
				color: danger
			}
		}
	};
}
