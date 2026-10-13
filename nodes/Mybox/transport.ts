import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError, sleep } from 'n8n-workflow';

export const API_BASE_URL = 'https://open-api.mybox.naver.com/v1';

function record(value: unknown): Record<string, unknown> {
	return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function httpStatus(error: unknown): number | undefined {
	for (const source of [record(error), record(record(error).cause)]) {
		const response = record(source.response);
		const status = Number(
			source.statusCode ?? source.httpCode ?? response.status ?? response.statusCode,
		);
		if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
	}
	return undefined;
}

export function retryDelay(error: unknown, now = Date.now()): number {
	for (const source of [record(error), record(record(error).cause)]) {
		const headers = record(record(source.response).headers ?? source.headers);
		const value = headers['retry-after'] ?? headers['Retry-After'];
		const header = Array.isArray(value) ? value[0] : value;
		if ((typeof header !== 'string' && typeof header !== 'number') || String(header).trim() === '')
			continue;
		const seconds = Number(header);
		if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : 60000;
		const deadline = Date.parse(String(header));
		if (!Number.isNaN(deadline)) return Math.max(0, deadline - now);
	}
	// MYBOX's per-minute quotas reset each minute.
	return 60000;
}

async function waitForRetry(context: IExecuteFunctions, milliseconds: number): Promise<void> {
	const signal = context.getExecutionCancelSignal?.();
	if (signal?.aborted) throw new NodeOperationError(context.getNode(), 'Execution was cancelled');
	try {
		await sleep(milliseconds, signal);
	} catch {
		throw new NodeOperationError(context.getNode(), 'Execution was cancelled');
	}
}

export async function apiRequest(
	context: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	options: { body?: IDataObject; qs?: IDataObject } = {},
): Promise<IDataObject> {
	const signal = context.getExecutionCancelSignal?.();
	let response: unknown;
	for (let attempt = 0; ; attempt++) {
		if (signal?.aborted) throw new NodeOperationError(context.getNode(), 'Execution was cancelled');
		try {
			response = await context.helpers.httpRequestWithAuthentication.call(context, 'myboxApi', {
				method,
				url: `${API_BASE_URL}${path}`,
				...options,
				headers: { Accept: 'application/json' },
				json: true,
				timeout: 60000,
				disableFollowRedirect: true,
				...(signal ? { abortSignal: signal } : {}),
			});
			break;
		} catch (error) {
			if (signal?.aborted)
				throw new NodeOperationError(context.getNode(), 'Execution was cancelled');
			const status = httpStatus(error);
			const delay = status === 429 ? retryDelay(error) : 0;
			// Never retry earlier than the server asks, or replay a write/transfer.
			if (method !== 'GET' || status !== 429 || attempt >= 2 || delay > 60000) {
				throw new NodeApiError(context.getNode(), error as JsonObject, {
					...(status ? { httpCode: String(status) } : {}),
				});
			}
			await waitForRetry(context, delay);
		}
	}
	if (response === undefined || response === null || response === '') return {};
	if (typeof response !== 'object' || Array.isArray(response)) {
		throw new NodeOperationError(context.getNode(), 'MYBOX returned an unexpected response');
	}
	return response as IDataObject;
}

export function booleanParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
): boolean {
	const value = context.getNodeParameter(name, itemIndex, false);
	if (typeof value !== 'boolean')
		throw new NodeOperationError(context.getNode(), `${name} must be a boolean`);
	return value;
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
	const returnAll = booleanParameter(context, 'returnAll', itemIndex);
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
		const resources = page.resources ?? (search ? [] : undefined);
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
