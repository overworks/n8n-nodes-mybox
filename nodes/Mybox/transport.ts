import type { IDataObject, IExecuteFunctions, IHttpRequestMethods } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const API_BASE_URL = 'https://open-api.mybox.naver.com/v1';

export async function apiRequest(
	context: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject } = {},
): Promise<IDataObject> {
	const response: unknown = await context.helpers.httpRequestWithAuthentication.call(
		context,
		'myboxApi',
		{
			method,
			url: `${API_BASE_URL}${path}`,
			...options,
			headers: { Accept: 'application/json' },
			json: true,
			timeout: 60000,
			disableFollowRedirect: true,
		},
	);
	if (response === undefined || response === null || response === '') return {};
	if (typeof response !== 'object' || Array.isArray(response)) {
		throw new NodeOperationError(context.getNode(), 'MYBOX returned an unexpected response');
	}
	return response as IDataObject;
}

export function requiredString(context: IExecuteFunctions, value: unknown, label: string): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new NodeOperationError(context.getNode(), `${label} must not be empty`);
	}
	return value;
}

export function resourceId(context: IExecuteFunctions, value: unknown): string {
	const id = requiredString(context, value, 'Resource ID').trim();
	if (id === '.' || id === '..') {
		throw new NodeOperationError(context.getNode(), 'Resource ID is invalid');
	}
	return encodeURIComponent(id);
}

export function positiveInteger(context: IExecuteFunctions, value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
		throw new NodeOperationError(context.getNode(), `${label} must be a positive integer`);
	}
	return value;
}

export async function getMany(
	context: IExecuteFunctions,
	itemIndex: number,
	path: string,
	qs: IDataObject = {},
	search = false,
): Promise<IDataObject[]> {
	const returnAll = context.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll
		? Infinity
		: positiveInteger(context, context.getNodeParameter('limit', itemIndex, 50), 'Limit');
	const options = context.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const requestedPageSize = positiveInteger(context, options.pageSize ?? 100, 'Page Size');
	const pageSize = Math.min(search ? 200 : 1000, Math.max(search ? 20 : 1, requestedPageSize));
	const results: IDataObject[] = [];
	const cursors = new Set<string>();
	let cursor: string | undefined;

	do {
		const count = Math.max(search ? 20 : 1, Math.min(pageSize, limit - results.length));
		const page = await apiRequest(context, 'GET', path, {
			qs: { ...qs, count, ...(cursor ? { cursor } : {}) },
		});
		const resources = page.resources ?? [];
		if (
			!Array.isArray(resources) ||
			resources.some((item) => !item || typeof item !== 'object' || Array.isArray(item))
		) {
			throw new NodeOperationError(context.getNode(), 'MYBOX returned an invalid resource list');
		}
		results.push(...(resources as IDataObject[]).slice(0, limit - results.length));
		if (results.length >= limit) break;
		const nextCursor = (page.responseMetaData as IDataObject | undefined)?.nextCursor;
		if (nextCursor === undefined || nextCursor === null || nextCursor === '') break;
		if (typeof nextCursor !== 'string' || cursors.has(nextCursor)) {
			throw new NodeOperationError(
				context.getNode(),
				'MYBOX returned an invalid or repeated cursor',
			);
		}
		cursors.add(nextCursor);
		cursor = nextCursor;
	} while (cursor);

	return results;
}
