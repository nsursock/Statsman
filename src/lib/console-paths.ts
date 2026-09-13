/** Statsman product UI — never dogfood these into analytics. */
export const STATSMAN_CONSOLE_PREFIXES = [
	'/dashboard',
	'/login',
	'/signup',
	'/subscribe',
	'/billing',
	'/auth',
	'/onboarding',
	'/demo/console'
] as const;

export function isStatsmanConsolePath(pathname: string): boolean {
	const path = pathname.split('?')[0] || '/';
	return STATSMAN_CONSOLE_PREFIXES.some(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`)
	);
}

export function statsmanConsoleIgnoreAttr(): string {
	return STATSMAN_CONSOLE_PREFIXES.join(',');
}
