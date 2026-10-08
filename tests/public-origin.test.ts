import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalOrigin, pickAuthEmailOrigin } from '../src/lib/server/public-origin.ts';

test('public PUBLIC_ORIGIN wins over the request host', () => {
	assert.equal(
		pickAuthEmailOrigin({
			configured: 'https://statsman.xyz',
			requestOrigin: 'https://statsman-production.up.railway.app',
			adapterOrigin: 'https://other.example',
			dev: false
		}),
		'https://statsman.xyz'
	);
});

test('production ignores a localhost PUBLIC_ORIGIN', () => {
	assert.equal(
		pickAuthEmailOrigin({
			configured: 'http://localhost:5173',
			requestOrigin: 'http://localhost:3000',
			adapterOrigin: 'https://statsman.xyz',
			dev: false
		}),
		'https://statsman.xyz'
	);
	assert.equal(
		pickAuthEmailOrigin({
			configured: 'http://localhost:5173',
			requestOrigin: 'https://statsman.xyz',
			dev: false
		}),
		'https://statsman.xyz'
	);
	assert.equal(
		pickAuthEmailOrigin({
			configured: 'http://127.0.0.1:5173/',
			requestOrigin: 'http://localhost:3000',
			forwardedOrigin: 'https://statsman.xyz',
			dev: false
		}),
		'https://statsman.xyz'
	);
});

test('local dev keeps localhost links', () => {
	assert.equal(
		pickAuthEmailOrigin({
			configured: 'http://localhost:5173',
			requestOrigin: 'http://localhost:5173',
			adapterOrigin: 'https://statsman.xyz',
			dev: true
		}),
		'http://localhost:5173'
	);
});

test('isLocalOrigin', () => {
	assert.equal(isLocalOrigin('http://localhost:5173'), true);
	assert.equal(isLocalOrigin('http://127.0.0.1:3000'), true);
	assert.equal(isLocalOrigin('https://statsman.xyz'), false);
	assert.equal(isLocalOrigin('not a url'), true);
});
