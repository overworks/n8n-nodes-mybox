import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { apiRequest, booleanParameter, getMany, requiredString, resourceId } from './transport';

export async function trashOperation(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[] | undefined> {
	if (resource === 'storage' && operation === 'update') {
		const days = context.getNodeParameter('trashAutoDeleteDays', itemIndex);
		if (typeof days !== 'number' || ![0, 5, 15, 30, 50].includes(days)) {
			throw new NodeOperationError(
				context.getNode(),
				'Trash Auto-Delete Days must be 0, 5, 15, 30, or 50',
			);
		}
		return [
			{
				json: await apiRequest(context, 'PATCH', '/drive/storage', {
					body: { trashAutoDeleteDays: days },
				}),
			},
		];
	}
	if (resource !== 'trash') return undefined;
	if (operation === 'getMany') {
		const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;
		const rows = await getMany(context, itemIndex, '/drive/trash', {
			sort: options.sort ?? 'deletedAt,desc',
		});
		return rows.map((json) => ({ json }));
	}
	if (operation === 'empty') {
		await apiRequest(context, 'DELETE', '/drive/trash');
		return [{ json: { success: true } }];
	}
	if (operation === 'restore' || operation === 'delete') {
		const rawId = requiredString(
			context,
			context.getNodeParameter('resourceId', itemIndex),
			'Resource ID',
		).trim();
		const path = `/drive/trash/${resourceId(context, rawId)}`;
		if (operation === 'restore') {
			const response = await apiRequest(context, 'POST', `${path}/restore`, {
				body: { isOverwrite: booleanParameter(context, 'isOverwrite', itemIndex) },
			});
			return [{ json: { success: true, resourceId: rawId, ...response } }];
		}
		await apiRequest(context, 'DELETE', path);
		return [{ json: { success: true, resourceId: rawId } }];
	}
	return undefined;
}
