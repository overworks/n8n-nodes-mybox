const assert = require('node:assert/strict');
const test = require('node:test');
const { Readable } = require('node:stream');
const { setup } = require('./helpers.cjs');

function uploader(buffer, parameters = {}, overrides = {}) {
	return setup(
		{ resource: 'file', operation: 'upload', ...parameters },
		{
			api: async () => ({
				uploadUrl: 'https://storage.example.com/upload?stoken=secret',
				offset: 0,
			}),
			request: async () => ({ resourceId: 'uploaded' }),
			helpers: {
				assertBinaryData: () => ({
					fileName: '한글 "파일".txt',
					mimeType: 'text/plain',
					fileSize: 'wrong metadata',
				}),
				getBinaryDataBuffer: async () => buffer,
			},
			...overrides,
		},
	);
}

test('uploads the exact bytes as Filedata with correct size and no PAT on the storage request', async () => {
	const buffer = Buffer.from('한글 내용\n\x00binary');
	const h = uploader(buffer, { parentId: 'folder', isOverwrite: true });
	const [[result]] = await h.run();
	assert.deepEqual(h.calls[0].body, {
		fileName: '한글 "파일".txt',
		fileSize: buffer.length,
		parentId: 'folder',
		isOverwrite: true,
	});
	assert.equal(h.calls[0].method, 'POST');
	assert.equal(h.transfers.length, 1);
	const request = h.transfers[0];
	assert.equal(request.method, 'POST');
	assert.equal(request.headers.Authorization, undefined);
	assert.equal(request.headers['Content-Length'], request.body.length);
	const form = await new Request(request.url, {
		method: 'POST',
		headers: request.headers,
		body: request.body,
	}).formData();
	assert.deepEqual([...form.keys()], ['Filedata']);
	assert.deepEqual(Buffer.from(await form.get('Filedata').arrayBuffer()), buffer);
	assert.equal(result.json.uploadResponse.resourceId, 'uploaded');
	assert.equal(JSON.stringify(result).includes('stoken'), false);
});

test('uploads empty files and omits a blank parent ID', async () => {
	const h = uploader(Buffer.alloc(0), { fileName: 'empty.txt' });
	await h.run();
	assert.equal(h.calls[0].body.fileSize, 0);
	assert.equal(h.calls[0].body.parentId, undefined);
	assert.equal(h.calls[0].body.isOverwrite, false);
	assert.ok(h.transfers[0].body.length > 0);
});

test('requires binary input before creating an upload URL', async () => {
	const h = uploader(
		Buffer.alloc(0),
		{},
		{
			helpers: {
				assertBinaryData() {
					throw new Error('Missing binary data');
				},
			},
		},
	);
	await assert.rejects(h.run());
	assert.equal(h.calls.length, 0);
});

test('validates transfer URLs and rejects unexpected resume offsets', async () => {
	for (const ticket of [
		{ uploadUrl: 'http://storage.example.com/' },
		{ uploadUrl: 'https://user:password@storage.example.com/' },
		{ uploadUrl: 'https://storage.example.com/', offset: 3 },
	]) {
		const h = uploader(Buffer.from('test'), {}, { api: async () => ticket });
		await assert.rejects(h.run());
		assert.equal(h.transfers.length, 0);
	}
});

test('validates manual upload sizes and resume timestamps before calling MYBOX', async () => {
	for (const params of [
		{ fileSize: -1 },
		{ fileSize: 0.5 },
		{ resume: true },
		{ resume: true, modifiedTime: 'bad date' },
	]) {
		const h = setup({
			resource: 'file',
			operation: 'getUploadUrl',
			fileName: 'file.txt',
			...params,
		});
		await assert.rejects(h.run());
		assert.equal(h.calls.length, 0);
	}
	const h = setup(
		{
			resource: 'file',
			operation: 'getUploadUrl',
			fileName: 'file.txt',
			fileSize: 100,
			resume: true,
			modifiedTime: '2026-10-13T09:00:00+09:00',
		},
		{
			api: async () => ({ uploadUrl: 'https://storage.example.com/upload', offset: 25 }),
		},
	);
	const [[result]] = await h.run();
	assert.equal(h.calls[0].body.modifiedTime, '2026-10-13T00:00:00.000Z');
	assert.equal(h.calls[0].body.resume, true);
	assert.equal(result.json.offset, 25);
	assert.equal(h.transfers.length, 0);
});

test('downloads a stream using a fresh URL and preserves other binary fields and item linking', async () => {
	const buffer = Buffer.from('downloaded content');
	const prior = { data: 'old', mimeType: 'text/plain' };
	let prepared = false;
	const h = setup(
		{
			resource: 'file',
			operation: 'download',
			fileId: 'file/+=',
			outputDataFieldName: 'attachment',
		},
		{
			items: [{ json: {}, binary: { existing: prior } }],
			api: async (_request, index) =>
				index === 0
					? { resourceId: 'file/+=', name: '문서.txt', size: buffer.length }
					: { downloadUrl: 'https://storage.example.com/download?atoken=secret', expiresIn: 600 },
			request: async () => ({
				body: Readable.from([buffer]),
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			}),
			helpers: {
				async prepareBinaryData(stream, fileName, mimeType) {
					assert.equal(fileName, '문서.txt');
					assert.equal(mimeType, 'text/plain');
					const chunks = [];
					for await (const chunk of stream) chunks.push(chunk);
					assert.deepEqual(Buffer.concat(chunks), buffer);
					prepared = true;
					return { data: 'binary-store-id', fileName, mimeType };
				},
			},
		},
	);
	const [[result]] = await h.run();
	assert.match(h.calls[0].url, /resources\/file%2F%2B%3D$/);
	assert.match(h.calls[1].url, /files\/file%2F%2B%3D\/download$/);
	assert.equal(h.transfers[0].encoding, 'stream');
	assert.equal(h.transfers[0].headers, undefined);
	assert.equal(prepared, true);
	assert.deepEqual(result.binary.existing, prior);
	assert.equal(result.binary.attachment.data, 'binary-store-id');
	assert.deepEqual(result.pairedItem, { item: 0 });
	assert.equal(JSON.stringify(result).includes('atoken'), false);
});

test('download URL operation returns the ticket without consuming the one-time URL', async () => {
	const ticket = { downloadUrl: 'https://storage.example.com/download', expiresIn: 600 };
	const h = setup(
		{ resource: 'file', operation: 'getDownloadUrl', fileId: 'a' },
		{ api: async () => ticket },
	);
	assert.deepEqual((await h.run())[0][0].json, ticket);
	assert.equal(h.calls.length, 1);
	assert.equal(h.transfers.length, 0);
});

test('stream and binary storage errors do not expose the signed download URL', async () => {
	const h = setup(
		{ resource: 'file', operation: 'download', fileId: 'a' },
		{
			continueOnFail: true,
			api: async (_request, index) =>
				index === 0
					? { name: 'test.txt' }
					: { downloadUrl: 'https://storage.example.com/?atoken=secret' },
			request: async () => ({ body: Buffer.from('test'), headers: {} }),
			helpers: {
				async prepareBinaryData() {
					throw new Error('Stream failed at https://storage.example.com/?atoken=secret');
				},
			},
		},
	);
	const result = await h.run();
	assert.match(result[0][0].json.error, /could not be read or stored/);
	assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('transfer failures do not expose signed URLs or silently retry single-use requests', async () => {
	const h = uploader(
		Buffer.from('test'),
		{},
		{
			continueOnFail: true,
			request: async () => {
				throw { statusCode: 403, message: 'https://storage.example.com/?stoken=secret' };
			},
		},
	);
	const [[result]] = await h.run();
	assert.match(result.json.error, /transfer failed/);
	assert.equal(JSON.stringify(result).includes('secret'), false);
	assert.equal(h.transfers.length, 1);
});

test('cancelling before or during an upload aborts the transfer even with continue-on-fail', async () => {
	const before = new AbortController();
	const cancelled = uploader(
		Buffer.from('test'),
		{},
		{
			cancelSignal: before.signal,
			continueOnFail: true,
			api: async () => {
				before.abort();
				return { uploadUrl: 'https://storage.example.com/upload', offset: 0 };
			},
		},
	);
	await assert.rejects(cancelled.run(), /cancelled/);
	assert.equal(cancelled.transfers.length, 0);
	const during = new AbortController();
	const active = uploader(
		Buffer.from('test'),
		{},
		{
			cancelSignal: during.signal,
			continueOnFail: true,
			request: async (options) => {
				assert.equal(options.abortSignal, during.signal);
				during.abort();
				throw new Error('Transfer aborted');
			},
		},
	);
	await assert.rejects(active.run(), /cancelled/);
	assert.equal(active.transfers.length, 1);
});
