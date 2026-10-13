import type { INodeProperties } from 'n8n-workflow';
import { fileProperties } from './fileDescriptions';
import { managementProperties } from './managementDescriptions';
import { trashProperties } from './trashDescriptions';

const dateFilters: INodeProperties[] = [
	{
		displayName: 'Date Field',
		name: 'dateField',
		type: 'options',
		options: [
			{ name: 'Created', value: 'created' },
			{ name: 'Modified', value: 'modified' },
		],
		default: 'created',
		description: 'The timestamp to use for date filtering',
	},
	{ displayName: 'End Date', name: 'endDate', type: 'dateTime', default: '' },
	{
		displayName: 'Parent Path',
		name: 'parentPath',
		type: 'string',
		default: '',
		placeholder: '/Documents/',
		description: 'Search within this folder and its descendants',
	},
	{ displayName: 'Start Date', name: 'startDate', type: 'dateTime', default: '' },
];

const definitions: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'File', value: 'file' },
			{ name: 'File or Folder', value: 'fileFolder' },
			{ name: 'Folder', value: 'folder' },
			{ name: 'Storage', value: 'storage' },
			{ name: 'Trash', value: 'trash' },
		],
		default: 'storage',
	},
	...fileProperties,
	...managementProperties,
	...trashProperties,
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['storage'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Get storage usage, file counts, and upload limits',
				action: 'Get storage information',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Set the trash auto-delete interval',
				action: 'Update storage settings',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['fileFolder'] } },
		options: [
			{
				name: 'Copy',
				value: 'copy',
				description: 'Copy a file or folder',
				action: 'Copy a file or folder',
			},
			{
				name: 'Favorite',
				value: 'favorite',
				description: 'Mark a file or folder as a favorite',
				action: 'Favorite a file or folder',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get file or folder properties',
				action: 'Get a file or folder',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				description: 'List files and folders',
				action: 'Get many files and folders',
			},
			{
				name: 'Move',
				value: 'move',
				description: 'Move a file or folder',
				action: 'Move a file or folder',
			},
			{
				name: 'Move to Trash',
				value: 'delete',
				description: 'Delete a file or folder by moving it to the trash',
				action: 'Move a file or folder to trash',
			},
			{
				name: 'Rename',
				value: 'rename',
				description: 'Rename a file or folder',
				action: 'Rename a file or folder',
			},
			{
				name: 'Unfavorite',
				value: 'unfavorite',
				description: 'Remove a file or folder from favorites',
				action: 'Unfavorite a file or folder',
			},
		],
		default: 'getMany',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['folder'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description: 'Create a folder',
				action: 'Create a folder',
			},
			{
				name: 'Search',
				value: 'search',
				description: 'Search by name, path, or date',
				action: 'Search folders',
			},
		],
		default: 'search',
	},
	{
		displayName: 'Resource ID',
		name: 'resourceId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['fileFolder'],
				operation: ['copy', 'delete', 'favorite', 'get', 'move', 'rename', 'unfavorite'],
			},
		},
		description: 'The ID returned by a list or search operation',
	},
	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['fileFolder'], operation: ['getMany'] } },
		description: 'The folder to list. Leave empty to list the root folder.',
	},
	{
		displayName: 'Search Query',
		name: 'query',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['file', 'folder'], operation: ['search'] } },
		description:
			'Search terms separated by spaces are combined with AND. May be empty when using filters.',
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['file'], operation: ['search'] } },
		options: [
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				default: 'document',
				options: [
					{ name: 'Archive', value: 'archive' },
					{ name: 'Audio', value: 'audio' },
					{ name: 'Document', value: 'document' },
					{ name: 'Executable', value: 'executable' },
					{ name: 'Image', value: 'image' },
					{ name: 'Other', value: 'etc' },
					{ name: 'Video', value: 'video' },
				],
			},
			...dateFilters,
		],
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: { resource: ['folder'], operation: ['search'] } },
		options: [
			...dateFilters,
			{
				displayName: 'Exact Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: '/Documents/',
				description: 'Find this folder by path. Overrides all other search filters.',
			},
		],
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['file', 'folder'], operation: ['search'] } },
		options: [
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				default: 100,
				typeOptions: { minValue: 20, maxValue: 200 },
				description: 'Number of results requested per search page',
			},
		],
	},
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: { show: { operation: ['getMany', 'search'] } },
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		typeOptions: { minValue: 1 },
		displayOptions: { show: { operation: ['getMany', 'search'], returnAll: [false] } },
		description: 'Max number of results to return',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['fileFolder'], operation: ['getMany'] } },
		options: [
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				default: 100,
				typeOptions: { minValue: 1, maxValue: 1000 },
				description: 'Number of results requested per page',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				default: 'name,asc',
				description: 'The sort order for folder listings',
				options: [
					{ name: 'Accessed At (Ascending)', value: 'accessedAt,asc' },
					{ name: 'Accessed At (Descending)', value: 'accessedAt,desc' },
					{ name: 'Created At (Ascending)', value: 'createdAt,asc' },
					{ name: 'Created At (Descending)', value: 'createdAt,desc' },
					{ name: 'Modified At (Ascending)', value: 'modifiedAt,asc' },
					{ name: 'Modified At (Descending)', value: 'modifiedAt,desc' },
					{ name: 'Name (Ascending)', value: 'name,asc' },
					{ name: 'Name (Descending)', value: 'name,desc' },
				],
			},
		],
	},
];

// Keep the selectors above operation-specific fields from all resource modules.
export const properties: INodeProperties[] = [
	...definitions.filter((property) => property.name === 'resource'),
	...definitions.filter((property) => property.name === 'operation'),
	...definitions.filter((property) => !['resource', 'operation'].includes(property.name)),
];
