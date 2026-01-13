import {IOnInit, ITimeoutService} from 'angular';
import {BuildingFiltersService} from '@src/Module/Services/BuildingFiltersService';
import data from '@src/Data/Data';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';

export class BuildingFilterController implements IOnInit
{

	public filtersService: BuildingFiltersService;
	public buildingTypes: string[] = [];
	public static $inject = ['BuildingFiltersService', '$timeout'];

	public constructor(filtersService: BuildingFiltersService, private $timeout: ITimeoutService)
	{
		this.filtersService = filtersService;
	}

	public $onInit(): void
	{
		this.$timeout(() => {
			document.getElementById('queryInput')?.focus();
		});
		// 获取所有唯一的建筑类型
		const allBuildings = data.getAllBuildings();
		const typeSet = new Set<string>();
		for (const key in allBuildings) {
			const building = allBuildings[key];
			if (building.buildingType) {
				typeSet.add(building.buildingType);
			}
		}
		this.buildingTypes = Array.from(typeSet).sort();
	}

}
