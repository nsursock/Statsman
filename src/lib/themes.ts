/** ScifiUI themes available in Statsman. Keep in sync with vendor/scifiui themes.css. */

export const THEME_IDS = [
	'retrowave',
	'synthwave84',
	'fiesta',
	'goldenTwilight',
	'solarizedDark',
	'ghibli',
	'dawn',
	'cottonCandy',
	'brightContrasts'
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const THEME_META: Record<
	ThemeId,
	{ label: string; swatch: [string, string, string] }
> = {
	retrowave: { label: 'Retrowave', swatch: ['#ff2e9a', '#b46bff', '#2ee6ff'] },
	synthwave84: { label: "Synthwave '84", swatch: ['#ff7edb', '#36f9f6', '#fede5d'] },
	fiesta: { label: 'Fiesta', swatch: ['#ff006e', '#fb5607', '#3a86ff'] },
	goldenTwilight: { label: 'Golden Twilight', swatch: ['#ffd60a', '#003566', '#ffc300'] },
	solarizedDark: { label: 'Solarized Dark', swatch: ['#268bd2', '#2aa198', '#b58900'] },
	ghibli: { label: 'Ghibli', swatch: ['#4a8b6f', '#6ba3d6', '#d6a13a'] },
	dawn: { label: 'Dawn', swatch: ['#ff7e6b', '#6b8fd6', '#d4a017'] },
	cottonCandy: { label: 'Cotton Candy', swatch: ['#ff9fb2', '#0acdff', '#60ab9a'] },
	brightContrasts: { label: 'Bright Contrasts', swatch: ['#ef476f', '#1b9aaa', '#06d6a0'] }
};

export const DEFAULT_THEME: ThemeId = 'retrowave';
export const THEME_STORAGE_KEY = 'statsman-theme';

export function isThemeId(value: string | null | undefined): value is ThemeId {
	return Boolean(value && (THEME_IDS as readonly string[]).includes(value));
}

export function readStoredTheme(): ThemeId {
	if (typeof localStorage === 'undefined') return DEFAULT_THEME;
	try {
		const raw = localStorage.getItem(THEME_STORAGE_KEY);
		return isThemeId(raw) ? raw : DEFAULT_THEME;
	} catch {
		return DEFAULT_THEME;
	}
}

export function applyTheme(theme: ThemeId) {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', theme);
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		/* private mode / blocked storage */
	}
	document.documentElement.dispatchEvent(
		new CustomEvent('statsman:theme', { detail: { theme } })
	);
}
