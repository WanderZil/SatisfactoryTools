import data from '@src/Data/Data';
import {IFilterService} from '@src/Types/IFilterService';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';
import {ICorporationFilterSet} from '@src/Types/ICorporationFilterSet';

// NOTE: IFilterService generic constraint currently excludes ICorporationSchema.
// Keep the same shape (filter/entities/reset/filterEntities) but don't implement the interface to satisfy TS.
export class CorporationFiltersService
{

	public filter: ICorporationFilterSet;
	public entities: ICorporationSchema[] = Object.values(data.getAllCorporations()).filter((corporation: ICorporationSchema) => {
		// 过滤掉隐藏的公司
		return !corporation.bHidden;
	});

	private defaultFilterState: ICorporationFilterSet = {
		query: '',
		showAdvanced: false,
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

	public filterEntities(): ICorporationSchema[]
	{
		// Copy instead of working on original collection
		let itemsToFilter = [...this.entities];

		if (this.filter.query) {
			itemsToFilter = itemsToFilter.filter((item) => {
				return item.name.toLowerCase().indexOf(this.filter.query.toLowerCase()) !== -1;
			});
		}

		return itemsToFilter;
	}

}


