import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { apiRequest, booleanParameter, requiredString, resourceId } from './transport';

export async function managementOperation(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[] | undefined> {
	if (resource === 'folder' && operation === 'create') {
		const folderName = requiredString(
			context,
			context.getNodeParameter('folderName', itemIndex),
			'Folder Name',
		);
		const parentId = (context.getNodeParameter('parentId', itemIndex, '') as string).trim();
		return [
			{
				json: await apiRequest(context, 'POST', '/drive/folders', {
					body: { folderName, ...(parentId ? { parentId } : {}) },
				}),
			},
		];
	}
	if (
		resource !== 'fileFolder' ||
		!['copy', 'delete', 'favorite', 'move', 'rename', 'unfavorite'].includes(operation)
	) {
		return undefined;
	}
	const rawId = requiredString(
		context,
		context.getNodeParameter('resourceId', itemIndex),
		'Resource ID',
	).trim();
	const path = `/drive/resources/${resourceId(context, rawId)}`;
	if (operation === 'copy' || operation === 'move') {
		const destination = context.getNodeParameter('parentId', itemIndex, '') as string;
		const parentId =
			operation === 'move'
				? requiredString(context, destination, 'Parent Folder ID').trim()
				: destination.trim();
		const body: IDataObject = {
			isOverwrite: booleanParameter(context, 'isOverwrite', itemIndex),
			...(parentId ? { parentId } : {}),
		};
		if (operation === 'copy') {
			const name = context.getNodeParameter('copyName', itemIndex, '') as string;
			if (name !== '') body.name = requiredString(context, name, 'Copy Name');
			return [{ json: await apiRequest(context, 'POST', `${path}/copy`, { body }) }];
		}
		const response = await apiRequest(context, 'POST', `${path}/move`, { body });
		return [{ json: { success: true, resourceId: rawId, ...response } }];
	}
	if (operation === 'rename') {
		const name = requiredString(
			context,
			context.getNodeParameter('newName', itemIndex),
			'New Name',
		);
		const response = await apiRequest(context, 'POST', `${path}/rename`, { body: { name } });
		return [{ json: { resourceId: rawId, ...response } }];
	}
	if (operation === 'delete') {
		await apiRequest(context, 'DELETE', path);
		return [{ json: { success: true, resourceId: rawId } }];
	}
	return [{ json: await apiRequest(context, 'POST', `${path}/${operation}`) }];
}
