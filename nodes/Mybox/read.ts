import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { apiRequest, getMany, resourceId } from './transport';

function searchQuery(context: IExecuteFunctions, itemIndex: number, resource: string): IDataObject {
	const filters = context.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	// An exact folder path overrides every other search filter in the MYBOX API.
	if (resource === 'folder' && typeof filters.path === 'string' && filters.path.trim()) {
		return { path: filters.path };
	}
	const query = context.getNodeParameter('query', itemIndex, '') as string;
	const qs: IDataObject = {};
	if (query.trim()) qs.q = query.trim();
	if (typeof filters.parentPath === 'string' && filters.parentPath.trim()) {
		qs.parentPath = filters.parentPath;
	}
	if (resource === 'file' && filters.category) qs.category = filters.category;
	for (const field of ['startDate', 'endDate']) {
		if (!filters[field]) continue;
		const date = new Date(filters[field] as string);
		if (Number.isNaN(date.getTime())) {
			throw new NodeOperationError(context.getNode(), `${field} must be a valid date`);
		}
		qs[field] = date.toISOString();
	}
	if (qs.startDate && qs.endDate && (qs.startDate as string) > (qs.endDate as string)) {
		throw new NodeOperationError(context.getNode(), 'Start Date must be before End Date');
	}
	if (qs.startDate || qs.endDate) qs.dateField = filters.dateField ?? 'created';
	if (!qs.q && !qs.category && !qs.startDate && !qs.endDate) {
		throw new NodeOperationError(
			context.getNode(),
			'Enter a search query, date filter, or a file category (or an exact folder path)',
		);
	}
	return qs;
}

export async function readOperation(
	context: IExecuteFunctions,
	resource: string,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[] | undefined> {
	if (resource === 'storage' && operation === 'get') {
		return [{ json: await apiRequest(context, 'GET', '/drive/storage') }];
	}
	if (resource === 'fileFolder' && operation === 'get') {
		const id = resourceId(context, context.getNodeParameter('resourceId', itemIndex));
		return [{ json: await apiRequest(context, 'GET', `/drive/resources/${id}`) }];
	}
	if (resource === 'fileFolder' && operation === 'getMany') {
		const folderId = (context.getNodeParameter('folderId', itemIndex, '') as string).trim();
		const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;
		const path = folderId
			? `/drive/folders/${resourceId(context, folderId)}/resources`
			: '/drive/resources';
		const rows = await getMany(
			context,
			itemIndex,
			path,
			options.sort ? { sort: options.sort } : {},
		);
		return rows.map((json) => ({ json }));
	}
	if ((resource === 'file' || resource === 'folder') && operation === 'search') {
		const rows = await getMany(
			context,
			itemIndex,
			`/search/resources/${resource === 'file' ? 'files' : 'folders'}`,
			searchQuery(context, itemIndex, resource),
			true,
		);
		return rows.map((json) => ({ json }));
	}
	return undefined;
}
