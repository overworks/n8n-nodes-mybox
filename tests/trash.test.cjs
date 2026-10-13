const assert = require('node:assert/strict');
const test = require('node:test');
const { setup } = require('./helpers.cjs');

test('trash listings use deletion sorting and follow cursors', async () => {
	const h = setup(
		{ resource: 'trash', operation: 'getMany', returnAll: true },
		{
			api: async (_options, index) =>
				index === 0
					? {
							resources: [{ resourceId: 'a', deletedAt: '2026-10-13T00:00:00Z' }],
							responseMetaData: { nextCursor: 'next' },
						}
					: { resources: [{ resourceId: 'b' }] },
		},
	);
	assert.equal((await h.run())[0].length, 2);
	assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/trash');
	assert.equal(h.calls[0].qs.sort, 'deletedAt,desc');
	assert.equal(h.calls[1].qs.cursor, 'next');
});

test('restores to the original location without overwriting by default', async () => {
	for (const isOverwrite of [undefined, true]) {
		const h = setup(
			{ resource: 'trash', operation: 'restore', resourceId: 'a/b', isOverwrite },
			{ api: async () => '' },
		);
		assert.deepEqual((await h.run())[0][0].json, { success: true, resourceId: 'a/b' });
		assert.equal(h.calls[0].method, 'POST');
		assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/trash/a%2Fb/restore');
		assert.deepEqual(h.calls[0].body, { isOverwrite: isOverwrite ?? false });
	}
});

test('permanent deletion targets one trash resource, while empty targets the entire trash', async () => {
	for (const operation of ['delete', 'empty']) {
		const h = setup(
			{ resource: 'trash', operation, resourceId: 'one' },
			{ api: async () => undefined },
		);
		const [[result]] = await h.run();
		assert.equal(result.json.success, true);
		assert.equal(h.calls[0].method, 'DELETE');
		assert.equal(
			h.calls[0].url,
			`https://open-api.mybox.naver.com/v1/drive/trash${operation === 'delete' ? '/one' : ''}`,
		);
		assert.equal(h.calls[0].body, undefined);
	}
});

test('allows only documented trash retention periods, including zero', async () => {
	for (const days of [0, 5, 15, 30, 50]) {
		const h = setup(
			{ resource: 'storage', operation: 'update', trashAutoDeleteDays: days },
			{ api: async () => ({ trashAutoDeleteDays: days }) },
		);
		assert.deepEqual((await h.run())[0][0].json, { trashAutoDeleteDays: days });
		assert.equal(h.calls[0].method, 'PATCH');
		assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/storage');
		assert.deepEqual(h.calls[0].body, { trashAutoDeleteDays: days });
	}
	for (const days of [-1, 1, 7, 180, '5']) {
		const h = setup({ resource: 'storage', operation: 'update', trashAutoDeleteDays: days });
		await assert.rejects(h.run(), /must be 0, 5, 15, 30, or 50/);
		assert.equal(h.calls.length, 0);
	}
});

test('empty or malformed trash IDs never reach the permanent deletion API', async () => {
	for (const resourceId of ['', ' ', '..']) {
		const h = setup({ resource: 'trash', operation: 'delete', resourceId });
		await assert.rejects(h.run());
		assert.equal(h.calls.length, 0);
	}
});
