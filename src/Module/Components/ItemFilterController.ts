import {Constants} from '@src/Constants';
import {ItemFiltersService} from '@src/Module/Services/ItemFiltersService';
import {IOnInit, ITimeoutService} from 'angular';
import data from '@src/Data/Data';

export class ItemFilterController implements IOnInit
{

	public physicalStates: { key: string, value?: string }[] = [
		{
			key: 'any',
			value: undefined,
		},
		...Object.keys(Constants.PHYSICAL_STATE).map((size) => {
			return {
				key: Constants.PHYSICAL_STATE[size],
				value: Constants.PHYSICAL_STATE[size],
			};
		}),
	];

	public stackSizes: { key: string|number, value?: number }[] = [
		{
			key: 'any',
			value: undefined,
		},
		...Object.keys(Constants.STACK_SIZE).map((size) => {
			return {
				key: Constants.STACK_SIZE[size],
				value: Constants.STACK_SIZE[size],
			};
		}),
	];

	public itemTypes: string[] = [];

	public static $inject = ['ItemFiltersService', '$timeout'];

	public constructor(public filtersService: ItemFiltersService, private $timeout: ITimeoutService)
	{
		this.itemTypes = this.getUniqueItemTypes();
	}

	public $onInit(): void
	{
		this.$timeout(() => {
			document.getElementById('queryInput')?.focus();
		});
	}

	private getUniqueItemTypes(): string[] {
		const types = new Set<string>();
		for (const item of Object.values(data.getAllItems())) {
			if (item.uiItemType) {
				types.add(item.uiItemType);
			}
		}
		return Array.from(types).sort();
	}

}
