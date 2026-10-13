const assert = require('node:assert/strict');
const test = require('node:test');
const { setup } = require('./helpers.cjs');
const { httpStatus, retryDelay } = require('../dist/nodes/Mybox/transport.js');

test('interprets Retry-After seconds and dates and uses the per-minute quota as fallback', () => {
	const error = (value) => ({ response: { headers: { 'retry-after': value } } });
	const now = Date.parse('2026-10-13T00:00:00Z');
	assert.equal(retryDelay(error('5'), now), 5000);
	assert.equal(retryDelay(error('0'), now), 0);
	assert.equal(retryDelay(error('Tue, 13 Oct 2026 00:00:30 GMT'), now), 30000);
	assert.equal(retryDelay(error('Tue, 13 Oct 2026 00:00:00 GMT'), now + 1000), 0);
	assert.equal(retryDelay(error('invalid'), now), 60000);
	assert.equal(retryDelay(error('-1'), now), 60000);
	assert.equal(retryDelay({}, now), 60000);
	assert.equal(httpStatus({ cause: { response: { status: 429 } } }), 429);
	assert.equal(httpStatus({ httpCode: '401' }), 401);
	assert.equal(httpStatus(new Error('Network error')), undefined);
});

test('retries rate-limited reads up to twice without losing the successful result', async () => {
	const storage = { quotaBytes: 1000, usedBytes: 25, fileCounts: { total: 2 } };
	const h = setup(
		{ resource: 'storage', operation: 'get' },
		{
			api: async (_request, index) => {
				if (index < 2) throw { statusCode: 429, response: { headers: { 'retry-after': '0' } } };
				return storage;
			},
		},
	);
	assert.deepEqual((await h.run())[0][0].json, storage);
	assert.equal(h.calls.length, 3);
	assert.equal(h.calls[0].disableFollowRedirect, true);
});

test('persistent rate limits stop after three total requests and retain the failed item index', async () => {
	const h = setup(
		{ resource: 'storage', operation: 'get' },
		{
			api: async () => {
				throw { statusCode: 429, headers: { 'Retry-After': 0 } };
			},
		},
	);
	await assert.rejects(
		h.run(),
		(error) => error.httpCode === '429' && error.context.itemIndex === 0,
	);
	assert.equal(h.calls.length, 3);
});

test('never shortens a long Retry-After value', async () => {
	const h = setup(
		{ resource: 'storage', operation: 'get' },
		{
			api: async () => {
				throw { statusCode: 429, headers: { 'retry-after': '120' } };
			},
		},
	);
	await assert.rejects(h.run());
	assert.equal(h.calls.length, 1);
});

test('does not automatically retry authentication errors, server errors, or rate-limited writes', async () => {
	for (const [params, statusCode] of [
		[{ resource: 'storage', operation: 'get' }, 401],
		[{ resource: 'storage', operation: 'get' }, 503],
		[{ resource: 'fileFolder', operation: 'copy', resourceId: 'source' }, 429],
		[{ resource: 'trash', operation: 'empty' }, 429],
	]) {
		const h = setup(params, {
			api: async () => {
				throw { statusCode, headers: { 'retry-after': '0' } };
			},
		});
		await assert.rejects(h.run());
		assert.equal(h.calls.length, 1);
	}
});

test('cancellation interrupts a quota wait and prevents another request', async () => {
	const controller = new AbortController();
	const h = setup(
		{ resource: 'storage', operation: 'get' },
		{
			cancelSignal: controller.signal,
			continueOnFail: true,
			api: async () => {
				setTimeout(() => controller.abort(), 10);
				throw { statusCode: 429, headers: { 'retry-after': '60' } };
			},
		},
	);
	await assert.rejects(h.run(), /cancelled/);
	assert.equal(h.calls.length, 1);
	assert.equal(h.calls[0].abortSignal, controller.signal);
});

test('invalid payloads fail explicitly instead of looking like empty listings', async () => {
	for (const response of [{}, { resources: 'bad' }, { resources: [null] }, [], 'server error']) {
		const h = setup(
			{ resource: 'fileFolder', operation: 'getMany' },
			{ api: async () => response },
		);
		await assert.rejects(h.run(), /invalid resource list|unexpected response/);
	}
});

test('rejects non-boolean overwrite, resume, and Return All expressions before making requests', async () => {
	for (const params of [
		{ resource: 'fileFolder', operation: 'copy', resourceId: 'source', isOverwrite: 'false' },
		{ resource: 'trash', operation: 'restore', resourceId: 'source', isOverwrite: 'true' },
		{ resource: 'file', operation: 'getUploadUrl', fileName: 'test', resume: 'true' },
		{ resource: 'fileFolder', operation: 'getMany', returnAll: 'false' },
	]) {
		const h = setup(params);
		await assert.rejects(h.run(), /must be a boolean/);
		assert.equal(h.calls.length, 0);
	}
});
