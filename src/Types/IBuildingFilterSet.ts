export interface IBuildingFilterSet
{

	query: string;
	showAdvanced: boolean;
	buildingType?: string; // 建筑类型过滤，如 "Crafting", "Transport", "Power" 等

}
