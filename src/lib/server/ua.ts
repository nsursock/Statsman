export function parseUserAgent(ua: string): {
	browser: string;
	os: string;
	device: string;
} {
	const browser =
		/Edg\//.test(ua)
			? 'Edge'
			: /Chrome\//.test(ua) && !/Chromium/.test(ua)
				? 'Chrome'
				: /Firefox\//.test(ua)
					? 'Firefox'
					: /Safari\//.test(ua) && !/Chrome\//.test(ua)
						? 'Safari'
						: /Opera|OPR\//.test(ua)
							? 'Opera'
							: 'Other';

	const os = /Windows/i.test(ua)
		? 'Windows'
		: /Mac OS X|Macintosh/i.test(ua)
			? 'macOS'
			: /Android/i.test(ua)
				? 'Android'
				: /iPhone|iPad|iOS/i.test(ua)
					? 'iOS'
					: /Linux/i.test(ua)
						? 'Linux'
						: 'Other';

	const device = /Mobi|Android|iPhone|iPad/i.test(ua)
		? /iPad|Tablet/i.test(ua)
			? 'Tablet'
			: 'Mobile'
		: 'Desktop';

	return { browser, os, device };
}
