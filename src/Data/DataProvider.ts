import rawData08 from '@data/data.json';
import {IJsonSchema} from '@src/Schema/IJsonSchema';
import model from '@src/Data/Model';

declare const require: any;

export class DataProvider
{

	public static version: string;
	private static data: IJsonSchema;

	public static get(): IJsonSchema
	{
		return DataProvider.data;
	}

	public static change(version: string)
	{
		DataProvider.version = version;
		if (version === '0.8') {
			DataProvider.data = rawData08 as unknown as IJsonSchema; // Added type assertion with unknown
		} else if (version === '1.0') {
			// Lazy-load large datasets so they don't inflate initial bundle size / main-thread eval time.
			if (require && require.ensure) {
				require.ensure(['@data/data1.0.json'], () => {
					const mod = require('@data/data1.0.json');
					DataProvider.data = (mod.default || mod) as unknown as IJsonSchema;
					model.change(DataProvider.data);
				}, 'data-1.0');
				return;
			}
			// Fallback: if code-splitting isn't available, keep behavior explicit.
			throw new Error('Dynamic loading not available for version 1.0 (require.ensure missing)');
		} else if (version === '1.0-ficsmas') {
			if (require && require.ensure) {
				require.ensure(['@data/data1.0-ficsmas.json'], () => {
					const mod = require('@data/data1.0-ficsmas.json');
					DataProvider.data = (mod.default || mod) as unknown as IJsonSchema;
					model.change(DataProvider.data);
				}, 'data-1.0-ficsmas');
				return;
			}
			throw new Error('Dynamic loading not available for version 1.0-ficsmas (require.ensure missing)');
		}

		model.change(DataProvider.data);
	}

}
