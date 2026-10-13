import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export class Mybox implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'NAVER MYBOX',
		name: 'mybox',
		icon: { light: 'file:mybox.svg', dark: 'file:mybox.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Access your NAVER MYBOX storage',
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
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [{ name: 'Storage', value: 'storage' }],
				default: 'storage',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['storage'] },
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get storage usage, file counts, and upload limits',
						action: 'Get storage information',
					},
				],
				default: 'get',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				if (resource !== 'storage' || operation !== 'get') {
					throw new NodeOperationError(this.getNode(), 'This operation is not supported', {
						itemIndex,
					});
				}

				const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'myboxApi', {
					method: 'GET',
					url: 'https://open-api.mybox.naver.com/v1/drive/storage',
					json: true,
				})) as IDataObject;

				returnData.push({ json: response, pairedItem: { item: itemIndex } });
			} catch (error) {
				const nodeError =
					error instanceof NodeOperationError
						? error
						: new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });

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
