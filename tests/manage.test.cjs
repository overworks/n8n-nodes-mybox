const assert = require('node:assert/strict');
const test = require('node:test');
const { setup } = require('./helpers.cjs');

test('creates folders at the root or under a specified parent', async () => {
	for (const parentId of ['', 'parent/+=']) {
		const response = { resourceId: 'new-folder', name: '업무 자료' };
		const h = setup(
			{ resource: 'folder', operation: 'create', folderName: '업무 자료', parentId },
			{ api: async () => response },
		);
		assert.deepEqual((await h.run())[0][0].json, response);
		assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/folders');
		assert.deepEqual(h.calls[0].body, {
			folderName: '업무 자료',
			...(parentId ? { parentId } : {}),
		});
	}
});

test('copies retain the new resource ID and do not overwrite by default', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'copy', resourceId: 'source' },
		{
			api: async () => ({ resourceId: 'copy', name: 'document.pdf' }),
		},
	);
	assert.equal((await h.run())[0][0].json.resourceId, 'copy');
	assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/resources/source/copy');
	assert.deepEqual(h.calls[0].body, { isOverwrite: false });
	const named = setup({
		resource: 'fileFolder',
		operation: 'copy',
		resourceId: 'source',
		parentId: 'target',
		copyName: '복사본.pdf',
		isOverwrite: true,
	});
	await named.run();
	assert.deepEqual(named.calls[0].body, {
		isOverwrite: true,
		parentId: 'target',
		name: '복사본.pdf',
	});
});

test('moves require a destination and produce output for an empty successful response', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'move', resourceId: 'a/b', parentId: 'target' },
		{ api: async () => '' },
	);
	assert.deepEqual((await h.run())[0][0].json, { success: true, resourceId: 'a/b' });
	assert.match(h.calls[0].url, /resources\/a%2Fb\/move$/);
	assert.deepEqual(h.calls[0].body, { parentId: 'target', isOverwrite: false });
	const invalid = setup({ resource: 'fileFolder', operation: 'move', resourceId: 'source' });
	await assert.rejects(invalid.run(), /Parent Folder ID/);
	assert.equal(invalid.calls.length, 0);
});

test('renames keep the resource ID and include the requested file extension', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'rename', resourceId: 'source', newName: '새 이름.pdf' },
		{ api: async () => ({ name: '새 이름.pdf' }) },
	);
	assert.deepEqual((await h.run())[0][0].json, { resourceId: 'source', name: '새 이름.pdf' });
	assert.equal(h.calls[0].method, 'POST');
	assert.match(h.calls[0].url, /source\/rename$/);
	assert.deepEqual(h.calls[0].body, { name: '새 이름.pdf' });
});

test('delete moves to trash using the resources endpoint and handles HTTP 204', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'delete', resourceId: 'file' },
		{ api: async () => undefined },
	);
	assert.deepEqual(await h.run(), [
		[{ json: { success: true, resourceId: 'file' }, pairedItem: { item: 0 } }],
	]);
	assert.equal(h.calls[0].method, 'DELETE');
	assert.equal(h.calls[0].url, 'https://open-api.mybox.naver.com/v1/drive/resources/file');
	assert.equal(h.calls[0].body, undefined);
});

test('favorite and unfavorite use their respective POST endpoints', async () => {
	for (const operation of ['favorite', 'unfavorite']) {
		const response = { resourceId: 'file', isFavorite: operation === 'favorite' };
		const h = setup(
			{ resource: 'fileFolder', operation, resourceId: 'file' },
			{ api: async () => response },
		);
		assert.deepEqual((await h.run())[0][0].json, response);
		assert.equal(h.calls[0].method, 'POST');
		assert.equal(
			h.calls[0].url,
			`https://open-api.mybox.naver.com/v1/drive/resources/file/${operation}`,
		);
		assert.equal(h.calls[0].body, undefined);
	}
});

test('rejects missing names before creating or renaming resources', async () => {
	for (const params of [
		{ resource: 'folder', operation: 'create', folderName: '   ' },
		{ resource: 'fileFolder', operation: 'rename', resourceId: 'source', newName: '' },
		{ resource: 'fileFolder', operation: 'copy', resourceId: 'source', copyName: '  ' },
	]) {
		const h = setup(params);
		await assert.rejects(h.run(), /must not be empty/);
		assert.equal(h.calls.length, 0);
	}
});

test('does not retry a mutation after a server error', async () => {
	const h = setup(
		{ resource: 'fileFolder', operation: 'copy', resourceId: 'source' },
		{
			api: async () => {
				throw { statusCode: 503, message: 'Service unavailable' };
			},
		},
	);
	await assert.rejects(h.run());
	assert.equal(h.calls.length, 1);
});
