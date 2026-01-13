import {IJsonSchema} from '@src/Schema/IJsonSchema';
import model from '@src/Data/Model';
declare const require: any;

export class DataProvider
{

	public static version: string;
	private static data: IJsonSchema;
	private static readyPromise: Promise<void> = Promise.resolve();
	private static lastDebug: any = null;

	public static get(): IJsonSchema
	{
		return DataProvider.data;
	}

	public static whenReady(): Promise<void>
	{
		return DataProvider.readyPromise;
	}

	public static getLastDebug(): any
	{
		return DataProvider.lastDebug;
	}

	public static change(version: string)
	{
		DataProvider.version = version;
		DataProvider.lastDebug = {
			version: version,
			startedAt: Date.now(),
			state: 'loading',
		};

		// Always expose a promise that resolves when data is actually loaded and Model has been rebuilt.
		// This lets the UI show a loading state and prevents routes/controllers from accessing undefined data.
		let resolveReady: () => void = () => {};
		let rejectReady: (e: any) => void = () => {};
		DataProvider.readyPromise = new Promise<void>((resolve, reject) => {
			resolveReady = resolve;
			rejectReady = reject;
		});

		const finish = (mod: any) => {
			try {
				DataProvider.lastDebug.state = 'parsing';
				DataProvider.data = (mod.default || mod) as unknown as IJsonSchema;
				model.change(DataProvider.data);
				DataProvider.lastDebug.state = 'ready';
				DataProvider.lastDebug.finishedAt = Date.now();
				resolveReady();
			} catch (e) {
				DataProvider.lastDebug.state = 'error';
				DataProvider.lastDebug.error = DataProvider.summarizeError(e);
				rejectReady(e);
			}
		};

		const fail = (e: any) => {
			DataProvider.lastDebug.state = 'error';
			DataProvider.lastDebug.error = DataProvider.summarizeError(e);
			rejectReady(e);
		};

		// Lazy-load ALL datasets (including 0.8) so they don't inflate initial bundle size / main-thread eval time.
		// IMPORTANT: Use webpack's `require.ensure` syntax (webpack will transform this into chunk loading).
		// Do NOT gate on `require.ensure` existing; in webpack bundles `require` may not be a normal global.
		if (version === '0.8') {
			DataProvider.lastDebug.chunkName = 'data-0.8';
			try {
				// NOTE: do NOT use the callback parameter as a "require" function.
				// It is webpack's internal __webpack_require__ which expects numeric module IDs.
				// Using `require('<string>')` lets webpack rewrite the string at build time.
				require.ensure(['@data/data.json'], () => {
					const mod = require('@data/data.json');
					finish(mod);
				}, 'data-0.8');
			} catch (e) {
				fail(e);
			}
			return;
		} else if (version === '1.0') {
			DataProvider.lastDebug.chunkName = 'data-1.0';
			try {
				require.ensure(['@data/data1.0.json'], () => {
					const mod = require('@data/data1.0.json');
					finish(mod);
				}, 'data-1.0');
			} catch (e) {
				fail(e);
			}
			return;
		} else if (version === '1.0-ficsmas') {
			DataProvider.lastDebug.chunkName = 'data-1.0-ficsmas';
			try {
				require.ensure(['@data/data1.0-ficsmas.json'], () => {
					const mod = require('@data/data1.0-ficsmas.json');
					finish(mod);
				}, 'data-1.0-ficsmas');
			} catch (e) {
				fail(e);
			}
			return;
		}

		fail(new Error('Unknown data version: ' + version));
	}

	private static summarizeError(e: any): any
	{
		if (!e) {
			return {message: 'Unknown error'};
		}
		return {
			name: e.name,
			message: e.message || String(e),
			type: e.type,
			request: e.request,
			stack: e.stack,
		};
	}

}
