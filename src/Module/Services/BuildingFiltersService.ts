import data from '@src/Data/Data';
import {IFilterService} from '@src/Types/IFilterService';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import {IBuildingFilterSet} from '@src/Types/IBuildingFilterSet';

export class BuildingFiltersService implements IFilterService<IBuildingSchema>
{

	public filter: IBuildingFilterSet;
	public entities: IBuildingSchema[] = Object.values(data.getAllBuildings()); // 显示所有建筑

	private defaultFilterState: IBuildingFilterSet = {
		query: '',
		showAdvanced: false,
		buildingType: undefined,
	};

	public constructor()
	{
		this.filter = {...this.defaultFilterState};
	}

	public resetFilters(): void
	{
		// keep advanced filters open state, and reset everything else
		this.filter = {...this.defaultFilterState, showAdvanced: this.filter.showAdvanced};
	}

	public filterEntities(): IBuildingSchema[]
	{
		// Copy instead of working on original collection
		let itemsToFilter = [...this.entities];

		if (this.filter.query) {
			itemsToFilter = itemsToFilter.filter((item) => {
				return item.name.toLowerCase().indexOf(this.filter.query.toLowerCase()) !== -1;
			});
		}

		// 按建筑类型过滤
		if (this.filter.buildingType) {
			itemsToFilter = itemsToFilter.filter((item) => {
				return item.buildingType === this.filter.buildingType;
			});
		}

		return itemsToFilter;
	}

}
