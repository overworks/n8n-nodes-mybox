import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class MyboxApi implements ICredentialType {
	name = 'myboxApi';

	displayName = 'NAVER MYBOX API';

	icon: Icon = {
		light: 'file:../nodes/Mybox/mybox.svg',
		dark: 'file:../nodes/Mybox/mybox.svg',
	};

	documentationUrl = 'https://developers.mybox.naver.com/getting-started';

	properties: INodeProperties[] = [
		{
			displayName: 'Personal Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description: 'The personal access token generated in your MYBOX account settings',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://open-api.mybox.naver.com/v1',
			url: '/drive/storage',
			method: 'GET',
		},
	};
}
