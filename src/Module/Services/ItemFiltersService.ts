import {IItemFilterSet} from '@src/Types/IItemFilterSet';
import {IItemSchema} from '@src/Schema/IItemSchema';
import data from '@src/Data/Data';
import {IFilterService} from '@src/Types/IFilterService';

export class ItemFiltersService implements IFilterService<IItemSchema>
{

	public filter: IItemFilterSet;
	public entities: IItemSchema[] = Object.values(data.getAllItems());

	private defaultFilterState: IItemFilterSet = {
		showAdvanced: false,
		query: '',
		onlyRadioactive: false,
		onlyWithEnergyValue: false,
		stackSize: null,
		physicalState: null,
		itemType: null,
	};

	public constructor()
	{
		this.filter = {...this.defaultFilterState};

		// 调试信息
		console.log('ItemFiltersService 初始化');
		console.log('总物品数:', this.entities.length);
		const srItems = this.entities.filter(item => item.className && item.className.startsWith('I_') && !item.className.includes('BP_') && !item.className.includes('GA_'));
		console.log('StarRupture 物品数:', srItems.length);
		console.log('前10个 StarRupture 物品:', srItems.slice(0, 10).map(item => `${item.name} (${item.className})`));

		// 检查 Aerogel
		const aerogel = this.entities.find(item => item.name && item.name.toLowerCase().includes('aerogel'));
		console.log('找到 Aerogel:', aerogel ? `${aerogel.name} (${aerogel.className})` : '未找到');
		if (aerogel) {
			console.log('Aerogel 详细信息:', aerogel);
		}
	}

	public resetFilters(): void
	{
		// keep advanced filters open state, and reset everything else
		this.filter = {...this.defaultFilterState, showAdvanced: this.filter.showAdvanced};
	}

	public filterEntities(): IItemSchema[]
	{
		// Copy instead of working on original collection
		let itemsToFilter = [...this.entities];

		// 调试信息
		if (this.filter.query && this.filter.query.toLowerCase().includes('aerogel')) {
			console.log('=== 搜索 Aerogel 调试信息 ===');
			console.log('过滤前物品数:', itemsToFilter.length);
			console.log('搜索关键词:', this.filter.query);
			const aerogelItems = itemsToFilter.filter(item => item.name && item.name.toLowerCase().includes('aerogel'));
			console.log('找到的 Aerogel 物品:', aerogelItems.map(item => `${item.name} (${item.className})`));
			if (aerogelItems.length > 0) {
				console.log('第一个 Aerogel 详细信息:', aerogelItems[0]);
			}
		}


		if (this.filter.stackSize) {
			itemsToFilter = itemsToFilter.filter((item) => {
				if (item.liquid) {
					// Liters to m3 conversion
					return parseInt(this.filter.stackSize + '', 10) === (item.stackSize / 1000);
				}
				// parseInt because angular somehow treats option value as string
				return parseInt(this.filter.stackSize + '', 10) === item.stackSize;
			});
		}

		if (this.filter.itemType) {
			itemsToFilter = itemsToFilter.filter((item) => {
				return item.uiItemType === this.filter.itemType;
			});
		}

		if (this.filter.query) {
			const queryLower = this.filter.query.toLowerCase();
			console.log('执行搜索，关键词:', queryLower);
			itemsToFilter = itemsToFilter.filter((item) => {
				const nameMatch = item.name && item.name.toLowerCase().indexOf(queryLower) !== -1;
				const classNameMatch = item.className && item.className.toLowerCase().indexOf(queryLower) !== -1;
				return nameMatch || classNameMatch;
			});

			// 调试信息
			if (queryLower.includes('aerogel')) {
				console.log('搜索 Aerogel - 过滤后物品数:', itemsToFilter.length);
				console.log('匹配的物品:', itemsToFilter.map(item => `${item.name} (${item.className})`));
			}
			console.log('搜索后物品数:', itemsToFilter.length);
		}

		return itemsToFilter;
	}

}
