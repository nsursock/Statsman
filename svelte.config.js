import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter(),
		// Tracker beacons POST text/plain from arbitrary blog origins (TilBlog, etc.).
		// SvelteKit's default CSRF treats text/plain as a form type and returns 403
		// without CORS headers — browsers report that as a CORS failure.
		// Real protection is the domain allowlist on POST /api/event.
		csrf: {
			trustedOrigins: ['*']
		}
	}
};

export default config;
