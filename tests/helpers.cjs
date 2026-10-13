const { Mybox } = require('../dist/nodes/Mybox/Mybox.node.js');

function setup(
	parameters,
	{
		items = [{ json: {} }],
		api = async () => ({}),
		request = async () => ({}),
		continueOnFail = false,
		cancelSignal,
		helpers = {},
	} = {},
) {
	const calls = [];
	const transfers = [];
	const context = {
		getInputData: () => items,
		getNode: () => ({
			id: 'test',
			name: 'NAVER MYBOX',
			type: '@overworks/n8n-nodes-mybox.mybox',
			typeVersion: 1,
			position: [0, 0],
			parameters,
		}),
		getNodeParameter(name, index, fallback) {
			const value = parameters[name] ?? fallback;
			return typeof value === 'function' ? value(index) : value;
		},
		continueOnFail: () => continueOnFail,
		getExecutionCancelSignal: () => cancelSignal,
		helpers: {
			async httpRequestWithAuthentication(credential, options) {
				calls.push({ credential, ...options });
				return await api(options, calls.length - 1);
			},
			async httpRequest(options) {
				transfers.push(options);
				return await request(options, transfers.length - 1);
			},
			...helpers,
		},
	};
	return { context, calls, transfers, run: () => Mybox.prototype.execute.call(context) };
}

module.exports = { setup };
