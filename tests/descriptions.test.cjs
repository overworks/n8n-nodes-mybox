const assert = require('node:assert/strict');
const test = require('node:test');
const { NodeHelpers } = require('n8n-workflow');
const { Mybox } = require('../dist/nodes/Mybox/Mybox.node.js');
const description = new Mybox().description;
const node = { typeVersion: 1 };
const operations = {
	file: ['download', 'getDownloadUrl', 'getUploadUrl', 'search', 'upload'],
	fileFolder: ['copy', 'favorite', 'get', 'getMany', 'move', 'delete', 'rename', 'unfavorite'],
	folder: ['create', 'search'],
	storage: ['get', 'update'],
	trash: ['empty', 'getMany', 'delete', 'restore'],
};
function visible(values) {
	return description.properties.filter((property) =>
		NodeHelpers.displayParameter(values, property, node, description),
	);
}

test('every operation has one selector and no overlapping visible fields', () => {
	assert.deepEqual(
		description.properties[0].options.map((option) => option.value).sort(),
		Object.keys(operations).sort(),
	);
	for (const [resource, expectedOperations] of Object.entries(operations)) {
		for (const operation of expectedOperations) {
			const fields = visible({ resource, operation, returnAll: false, resume: false });
			assert.deepEqual(
				fields.slice(0, 2).map((field) => field.name),
				['resource', 'operation'],
			);
			assert.equal(
				new Set(fields.map((field) => field.name)).size,
				fields.length,
				`${resource}/${operation}`,
			);
			assert.deepEqual(
				fields[1].options.map((option) => option.value).sort(),
				[...expectedOperations].sort(),
			);
		}
	}
});

test('searches have no listing sort field, while trash exposes only its supported sorts', () => {
	const searchOptions = visible({ resource: 'file', operation: 'search', returnAll: true }).find(
		(field) => field.name === 'options',
	);
	assert.deepEqual(
		searchOptions.options.map((option) => option.name),
		['pageSize'],
	);
	const trashOptions = visible({ resource: 'trash', operation: 'getMany', returnAll: true }).find(
		(field) => field.name === 'options',
	);
	const sort = trashOptions.options.find((option) => option.name === 'sort');
	assert.equal(sort.default, 'deletedAt,desc');
	assert.equal(
		sort.options.some((option) => option.value.startsWith('createdAt')),
		false,
	);
});

test('n8n resolves binary, overwrite, retention, and resume defaults correctly', () => {
	const initial = NodeHelpers.getNodeParameters(
		description.properties,
		{},
		true,
		false,
		node,
		description,
	);
	assert.equal(initial.resource, 'storage');
	assert.equal(initial.operation, 'get');
	const defaults = (resource, operation, extra = {}) =>
		NodeHelpers.getNodeParameters(
			description.properties,
			{ resource, operation, ...extra },
			true,
			false,
			node,
			description,
		);
	assert.equal(defaults('file', 'upload').inputDataFieldName, 'data');
	assert.equal(defaults('file', 'upload').isOverwrite, false);
	assert.equal(defaults('file', 'download').outputDataFieldName, 'data');
	assert.equal(defaults('storage', 'update').trashAutoDeleteDays, 0);
	assert.equal(defaults('trash', 'restore').isOverwrite, false);
	assert.equal(defaults('file', 'getUploadUrl').modifiedTime, undefined);
	assert.equal(defaults('file', 'getUploadUrl', { resume: true }).modifiedTime, '');
});
