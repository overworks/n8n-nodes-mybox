import type { INodeProperties } from 'n8n-workflow';

export const managementProperties: INodeProperties[] = [
	{
		displayName: 'Folder Name',
		name: 'folderName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['folder'], operation: ['create'] } },
		description: 'The name of the folder to create',
	},
	{
		displayName: 'Parent Folder ID',
		name: 'parentId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['folder'], operation: ['create'] } },
		description: 'The parent folder ID. Leave empty to create the folder at the root.',
	},
	{
		displayName: 'Parent Folder ID',
		name: 'parentId',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['fileFolder'], operation: ['copy'] } },
		description: 'The destination folder ID. Leave empty to copy to the root folder.',
	},
	{
		displayName: 'Parent Folder ID',
		name: 'parentId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['fileFolder'], operation: ['move'] } },
		description: 'The destination folder ID. MYBOX requires this value when moving a resource.',
	},
	{
		displayName: 'Copy Name',
		name: 'copyName',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['fileFolder'], operation: ['copy'] } },
		description:
			'The name of the copy, including the file extension. Leave empty to keep the original name.',
	},
	{
		displayName: 'New Name',
		name: 'newName',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['fileFolder'], operation: ['rename'] } },
		description: 'The new name, including the file extension',
	},
	{
		displayName: 'Overwrite',
		name: 'isOverwrite',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['fileFolder'], operation: ['copy', 'move'] } },
		description: 'Whether to overwrite a resource with the same name in the destination folder',
	},
];
