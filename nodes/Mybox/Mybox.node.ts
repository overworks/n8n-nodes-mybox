import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { properties } from './descriptions';
import { readOperation } from './read';
import { fileOperation } from './files';
import { managementOperation } from './manage';

export class Mybox implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NAVER MYBOX',
		name: 'mybox',
		icon: { light: 'file:mybox.svg', dark: 'file:mybox.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage files and folders in NAVER MYBOX',
		defaults: {
			name: 'NAVER MYBOX',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'myboxApi',
				required: true,
			},
		],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				const result =
					(await readOperation(this, resource, operation, itemIndex)) ??
					(resource === 'file' ? await fileOperation(this, operation, itemIndex) : undefined) ??
					(await managementOperation(this, resource, operation, itemIndex));
				if (result === undefined) {
					throw new NodeOperationError(this.getNode(), 'This operation is not supported', {
						itemIndex,
					});
				}

				for (const item of result) {
					returnData.push({ ...item, pairedItem: { item: itemIndex } });
				}
			} catch (error) {
				const nodeError =
					error instanceof NodeOperationError || error instanceof NodeApiError
						? error
						: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
				nodeError.context.itemIndex = itemIndex;

				if (this.continueOnFail()) {
					returnData.push({
						json: { error: nodeError.message },
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw nodeError;
			}
		}

		return [returnData];
	}
}
