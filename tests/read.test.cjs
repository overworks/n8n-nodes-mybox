const assert = require('node:assert/strict');
const test = require('node:test');
const { setup } = require('./helpers.cjs');

test('lists root pages with opaque cursors and retains item links', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'getMany', returnAll: true },
		{
			api: async (_options, index) =>
				index === 0
					? { resources: [{ resourceId: 'a' }], responseMetaData: { nextCursor: 'opaque+/=' } }
					: { resources: [{ resourceId: 'b' }] },
		},
	);
	assert.deepEqual(await h.run(), [
		[
			{ json: { resourceId: 'a' }, pairedItem: { item: 0 } },
			{ json: { resourceId: 'b' }, pairedItem: { item: 0 } },
		],
	]);
	assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/resources');
	assert.equal(h.calls[1].qs.cursor, 'opaque+/=');
	assert.equal(h.calls[0].credential, 'myboxApi');
});

test('encodes a folder ID and stops fetching as soon as Limit is met', async () => {
	const h = setup(
		{
			resource: 'fileFolder',
			operation: 'getMany',
			folderId: 'folder/+=',
			limit: 2,
			options: { sort: 'modifiedAt,desc' },
		},
		{
			api: async () => ({
				resources: [{ resourceId: 'a' }, { resourceId: 'b' }, { resourceId: 'c' }],
				responseMetaData: { nextCursor: 'unused' },
			}),
		},
	);
	assert.equal((await h.run())[0].length, 2);
	assert.equal(h.calls.length, 1);
	assert.match(h.calls[0].url, /folders\/folder%2F%2B%3D\/resources$/);
	assert.deepEqual(h.calls[0].qs, { sort: 'modifiedAt,desc', count: 2 });
});

test('search requests at least 20 entries even when Limit is smaller', async () => {
	const h = setup(
		{ resource: 'file', operation: 'search', query: '회의록 pdf', limit: 1 },
		{
			api: async () => ({ resources: [{ name: 'first.pdf' }, { name: 'second.pdf' }] }),
		},
	);
	assert.equal((await h.run())[0].length, 1);
	assert.deepEqual(h.calls[0].qs, { q: '회의록 pdf', count: 20 });
});

test('search caps page size and permits a category without a query', async () => {
	const h = setup({
		resource: 'file',
		operation: 'search',
		returnAll: true,
		filters: { category: 'image' },
		options: { pageSize: 1000 },
	});
	assert.deepEqual(await h.run(), [[]]);
	assert.equal(h.calls[0].qs.count, 200);
	assert.equal(h.calls[0].qs.category, 'image');
});

test('exact folder path overrides conflicting and invalid search filters', async () => {
	const h = setup({
		resource: 'folder',
		operation: 'search',
		query: 'ignored',
		filters: { path: '/사진/', startDate: 'invalid', parentPath: '/ignored/' },
	});
	await h.run();
	assert.deepEqual(h.calls[0].qs, { path: '/사진/', count: 50 });
	assert.match(h.calls[0].url, /search\/resources\/folders$/);
});

test('normalizes date filters and rejects incomplete or reversed searches before making a call', async () => {
	const h = setup({
		resource: 'file',
		operation: 'search',
		filters: { startDate: '2026-10-13T09:00:00+09:00', dateField: 'modified' },
	});
	await h.run();
	assert.equal(h.calls[0].qs.startDate, '2026-10-13T00:00:00.000Z');
	assert.equal(h.calls[0].qs.dateField, 'modified');
	for (const filters of [
		{},
		{ parentPath: '/alone/' },
		{ startDate: 'invalid' },
		{ startDate: '2026-10-14', endDate: '2026-10-13' },
	]) {
		const invalid = setup({ resource: 'folder', operation: 'search', filters });
		await assert.rejects(invalid.run());
		assert.equal(invalid.calls.length, 0);
	}
});

test('continues across empty pages with a cursor and detects cursor loops', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'getMany', returnAll: true },
		{
			api: async () => ({ resources: [], responseMetaData: { nextCursor: 'same' } }),
		},
	);
	await assert.rejects(h.run(), /repeated cursor/);
	assert.equal(h.calls.length, 2);
});

test('rejects invalid limits and path traversal resource IDs', async () => {
	for (const limit of [0, -1, 1.5]) {
		const h = setup({ resource: 'fileFolder', operation: 'getMany', limit });
		await assert.rejects(h.run(), /positive integer/);
		assert.equal(h.calls.length, 0);
	}
	for (const id of ['', '  ', '..', '.']) {
		const h = setup({ resource: 'fileFolder', operation: 'get', resourceId: id });
		await assert.rejects(h.run());
		assert.equal(h.calls.length, 0);
	}
});

test('preserves item indices when an error is followed by a successful item', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'get', resourceId: (i) => ['missing', 'found'][i] },
		{
			items: [{ json: { original: 1 } }, { json: { original: 2 } }],
			continueOnFail: true,
			api: async (_options, index) => {
				if (index === 0) throw { statusCode: 404, message: 'NOT_FOUND' };
				return { resourceId: 'found' };
			},
		},
	);
	const [result] = await h.run();
	assert.equal(typeof result[0].json.error, 'string');
	assert.deepEqual(result[0].pairedItem, { item: 0 });
	assert.deepEqual(result[1], { json: { resourceId: 'found' }, pairedItem: { item: 1 } });
});
