import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { isSafeObjectProperty, NodeApiError, NodeOperationError } from 'n8n-workflow';
import { apiRequest, booleanParameter, httpStatus, requiredString, resourceId } from './transport';

function transferUrl(context: IExecuteFunctions, value: unknown): string {
	try {
		const url = new URL(typeof value === 'string' ? value : '');
		if (url.protocol === 'https:' && !url.username && !url.password) return url.toString();
	} catch {
		/* Report the invalid response without exposing a signed URL. */
	}
	throw new NodeOperationError(context.getNode(), 'MYBOX returned an invalid transfer URL');
}

async function transfer(
	context: IExecuteFunctions,
	options: IHttpRequestOptions,
): Promise<unknown> {
	try {
		// The URL carries its own authorization. Never attach the PAT to a storage request.
		return await context.helpers.httpRequest({ timeout: 300000, ...options });
	} catch (error) {
		const statusCode = httpStatus(error);
		throw new NodeApiError(
			context.getNode(),
			{
				message: 'MYBOX file transfer failed',
				...(statusCode ? { statusCode } : {}),
			} as JsonObject,
			{
				message: 'MYBOX file transfer failed',
				description:
					'Run the operation again to obtain a fresh transfer URL. Transfer URLs expire and are single-use.',
			},
		);
	}
}

function binaryField(context: IExecuteFunctions, value: unknown): string {
	const field = requiredString(context, value, 'Binary field name').trim();
	if (!isSafeObjectProperty(field))
		throw new NodeOperationError(context.getNode(), 'Invalid binary field name');
	return field;
}

function uploadBody(
	context: IExecuteFunctions,
	itemIndex: number,
	fileName: string,
	fileSize: number,
): IDataObject {
	if (!Number.isSafeInteger(fileSize) || fileSize < 0) {
		throw new NodeOperationError(
			context.getNode(),
			'File Size must be a non-negative integer in bytes',
		);
	}
	const parentId = (context.getNodeParameter('parentId', itemIndex, '') as string).trim();
	return {
		fileName: requiredString(context, fileName, 'File Name'),
		fileSize,
		isOverwrite: booleanParameter(context, 'isOverwrite', itemIndex),
		...(parentId ? { parentId } : {}),
	};
}

export async function fileOperation(
	context: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[] | undefined> {
	if (operation === 'getUploadUrl') {
		const body = uploadBody(
			context,
			itemIndex,
			context.getNodeParameter('fileName', itemIndex, '') as string,
			context.getNodeParameter('fileSize', itemIndex, 0) as number,
		);
		const resume = booleanParameter(context, 'resume', itemIndex);
		if (resume) {
			const modifiedTime = requiredString(
				context,
				context.getNodeParameter('modifiedTime', itemIndex, ''),
				'Modified Time',
			);
			if (Number.isNaN(new Date(modifiedTime).getTime()))
				throw new NodeOperationError(context.getNode(), 'Modified Time must be a valid date');
			body.resume = true;
			body.modifiedTime = new Date(modifiedTime).toISOString();
		}
		const response = await apiRequest(context, 'POST', '/drive/files', { body });
		transferUrl(context, response.uploadUrl);
		return [{ json: response }];
	}
	if (operation === 'upload') {
		const inputField = binaryField(
			context,
			context.getNodeParameter('inputDataFieldName', itemIndex, 'data'),
		);
		const binary = context.helpers.assertBinaryData(itemIndex, inputField);
		const fileName = requiredString(
			context,
			context.getNodeParameter('fileName', itemIndex, '') || binary.fileName,
			'File Name',
		);
		// This helper works with n8n's memory, filesystem, and external binary stores.
		const buffer = await context.helpers.getBinaryDataBuffer(itemIndex, inputField);
		const body = uploadBody(context, itemIndex, fileName, buffer.length);
		const ticket = await apiRequest(context, 'POST', '/drive/files', { body });
		const url = transferUrl(context, ticket.uploadUrl);
		if (ticket.offset !== undefined && ticket.offset !== 0) {
			throw new NodeOperationError(
				context.getNode(),
				'MYBOX returned a resume offset for a new upload',
			);
		}
		const form = new FormData();
		form.append(
			'Filedata',
			new Blob([new Uint8Array(buffer)], { type: binary.mimeType }),
			fileName,
		);
		// Serialize native FormData into a Buffer: older n8n HTTP helpers drop native
		// FormData objects because their enumerable properties are empty.
		const request = new Request(url, { method: 'POST', body: form });
		const multipart = Buffer.from(await request.arrayBuffer());
		const uploadResponse = await transfer(context, {
			method: 'POST',
			url,
			body: multipart,
			json: true,
			disableFollowRedirect: true,
			headers: {
				'Content-Type': request.headers.get('content-type') as string,
				'Content-Length': multipart.length,
			},
		});
		return [
			{
				json: {
					fileName,
					fileSize: buffer.length,
					uploadResponse: (uploadResponse ?? null) as IDataObject | string | null,
				},
			},
		];
	}
	if (operation === 'download' || operation === 'getDownloadUrl') {
		const id = resourceId(context, context.getNodeParameter('fileId', itemIndex));
		if (operation === 'getDownloadUrl') {
			const ticket = await apiRequest(context, 'GET', `/drive/files/${id}/download`);
			transferUrl(context, ticket.downloadUrl);
			return [{ json: ticket }];
		}
		const outputField = binaryField(
			context,
			context.getNodeParameter('outputDataFieldName', itemIndex, 'data'),
		);
		// Read metadata before creating the short-lived download URL.
		const metadata = await apiRequest(context, 'GET', `/drive/resources/${id}`);
		const ticket = await apiRequest(context, 'GET', `/drive/files/${id}/download`);
		const response = (await transfer(context, {
			method: 'GET',
			url: transferUrl(context, ticket.downloadUrl),
			encoding: 'stream',
			json: false,
			returnFullResponse: true,
		})) as {
			body: Parameters<IExecuteFunctions['helpers']['prepareBinaryData']>[0];
			headers: IDataObject;
		};
		const contentType = response.headers?.['content-type'];
		const fileName = typeof metadata.name === 'string' ? metadata.name : 'download';
		let binary: IBinaryData;
		try {
			binary = await context.helpers.prepareBinaryData(
				response.body,
				fileName,
				typeof contentType === 'string' ? contentType.split(';')[0].trim() : undefined,
			);
		} catch {
			// Stream errors may contain the signed request URL as well.
			throw new NodeOperationError(
				context.getNode(),
				'The downloaded file could not be read or stored',
			);
		}
		return [
			{
				json: metadata,
				binary: { ...context.getInputData()[itemIndex].binary, [outputField]: binary },
			},
		];
	}
	return undefined;
}
