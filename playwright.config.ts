import { defineConfig, devices } from '@playwright/test';

const clearDatabaseEnv = { DATABASE_URL: '', PGHOST: '', PGUSER: '', PGPASSWORD: '' };

export default defineConfig({
	testDir: './tests/e2e/specs',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [
		['list'],
		['html', { open: 'never', outputFolder: '.e2e/playwright-report' }]
	],
	outputDir: '.e2e/test-results',
	use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: [
		{
			command: 'node build/index.js',
			url: 'http://localhost:4173/api/health',
			timeout: 120_000,
			reuseExistingServer: !process.env.CI,
			stdout: 'pipe',
			env: {
				...process.env,
				...clearDatabaseEnv,
				STATSMAN_MODE: 'selfhost', PORT: '4173', HOST: '127.0.0.1',
				PUBLIC_ORIGIN: 'http://localhost:4173', STATSMAN_DATABASE_PATH: '.e2e/selfhost.db',
				STATSMAN_SESSION_SECRET: 'e2e-secret', STATSMAN_DEMO: '0', STATSMAN_DEMO_SEED: '0',
				STATSMAN_ADMIN_TOKEN: ''
			}
		},
		{
			command: 'node build/index.js',
			url: 'http://localhost:4174/api/health',
			timeout: 120_000,
			reuseExistingServer: !process.env.CI,
			stdout: 'pipe',
			env: {
				...process.env,
				...clearDatabaseEnv,
				STATSMAN_MODE: 'cloud', PORT: '4174', HOST: '127.0.0.1',
				PUBLIC_ORIGIN: 'https://statsman.test', STATSMAN_DATABASE_PATH: '.e2e/cloud.db',
				STATSMAN_SESSION_SECRET: 'e2e-secret', STATSMAN_BILLING: 'beta',
				STATSMAN_DEMO: '0', STATSMAN_DEMO_SEED: '0', SUPABASE_URL: '',
				SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_ANON_KEY: '', STRIPE_SECRET_KEY: '',
				STRIPE_WEBHOOK_SECRET: '', PUBLIC_STRIPE_PUBLISHABLE_KEY: ''
			}
		},
		{
			command: 'node tests/e2e/helpers/static-server.mjs',
			url: 'http://127.0.0.1:4183/index.html',
			timeout: 30_000,
			reuseExistingServer: !process.env.CI
		}
	]
});
