import data from '@src/Data/Data';
import {ITransitionObject} from '@src/Types/ITransitionObject';
import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import {ISchematicSchema} from '@src/Schema/ISchematicSchema';
import {IScope} from 'angular';
import {BuildingFiltersService} from '@src/Module/Services/BuildingFiltersService';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';

export class BuildingController
{

	public building: IBuildingSchema;
	public buildingRecipe: IRecipeSchema|null;
	public recipes: IRecipeSchema[];
	public usagesForBuilding: IRecipeSchema[];
	public usagesForSchematics: ISchematicSchema[];
	public corporationUnlocks: Array<{corporation: ICorporationSchema, level: number}> | null = null;
	public corporation: ICorporationSchema | null = null;
	public static $inject = ['$state', '$transition$', 'BuildingFiltersService', '$scope'];

	public constructor(
		$state: any, $transition$: ITransitionObject<{item: string}>, private itemFilterService: BuildingFiltersService, private $scope: IScope,
	)
	{
		const building = data.getBuildingBySlug($transition$.params().item);
		if (building === null) {
			$state.go($state.current.parent);
			return;
		}
		this.building = building;
		this.buildingRecipe = this.getRecipeForCurrentBuilding();
		this.itemFilterService.filter.query = this.building.name;
		this.corporationUnlocks = data.getCorporationUnlocksForBuilding(this.building.className);
		
		// 设置 corporation 对象（从 building._bdData.corporation 解析）
		if (building._bdData && building._bdData.corporation) {
			const corpStr = building._bdData.corporation;
			// 解析格式如 "ECrCorporation::SelenianCORP" 或直接是 className
			let corpClassName: string | null = null;
			if (corpStr.includes('::')) {
				// 提取 "SelenianCORP" 部分
				const parts = corpStr.split('::');
				if (parts.length > 1) {
					const corpEnum = parts[1]; // 如 "SelenianCORP", "CleverRobotics"
					
					// 创建映射：ECrCorporation enum -> CD_ className
					const corpMapping: {[key: string]: string} = {
						'SelenianCORP': 'CD_SelenianCorp',
						'SelenianCorporation': 'CD_SelenianCorp',
						'CleverRobotics': 'CD_CleverCorp',
						'FutureHealthSolution': 'CD_FutureCorp',
						'FutureHealthSolutions': 'CD_FutureCorp',
						'GriffithsBlueCorporation': 'CD_GriffithsCorp',
						'GriffithsCorp': 'CD_GriffithsCorp',
						'MoonEnergyCorporation': 'CD_MoonCorp',
						'MoonEnergy': 'CD_MoonCorp',
						'FE_FinalCorporation': 'CD_FE_FinalCorp',
						'StartingCorp': 'CD_StartingCorp',
					};
					
					// 首先尝试直接映射
					corpClassName = corpMapping[corpEnum] || null;
					
					// 如果映射中没有，尝试通过 className 匹配（去掉 CD_ 前缀后比较）
					if (!corpClassName) {
						const allCorps = data.getAllCorporations();
						for (const key in allCorps) {
							// 从 className 中提取核心名称（去掉 CD_ 前缀）
							const corpKeyName = key.replace(/^CD_/, '').toLowerCase();
							// 从 enum 中提取核心名称
							const enumName = corpEnum.toLowerCase().replace(/corp|corporation/gi, '').trim();
							// 尝试匹配
							if (corpKeyName.includes(enumName) || enumName.includes(corpKeyName)) {
								corpClassName = key;
								break;
							}
						}
					}
					
					// 如果仍然没有匹配，尝试通过名称匹配
					if (!corpClassName) {
						const allCorps = data.getAllCorporations();
						for (const key in allCorps) {
							const corp = allCorps[key];
							// 检查名称是否匹配（忽略大小写和特殊字符）
							const normalizedEnum = corpEnum.toLowerCase().replace(/corp|corporation/gi, '').trim();
							const normalizedName = (corp.name || '').toLowerCase().replace(/corp|corporation/gi, '').trim();
							if (normalizedName.includes(normalizedEnum) || normalizedEnum.includes(normalizedName)) {
								corpClassName = key;
								break;
							}
						}
					}
				}
			} else {
				// 直接使用作为 className
				corpClassName = corpStr;
			}
			
			if (corpClassName) {
				this.corporation = data.getCorporationByClassName(corpClassName);
				// 如果仍然没有找到，尝试通过 slug 匹配
				if (!this.corporation && corpClassName.startsWith('CD_')) {
					// 尝试将 className 转换为可能的 slug
					const possibleSlug = corpClassName.replace(/^CD_/, '').toLowerCase().replace(/corp$/, '');
					this.corporation = data.getCorporationBySlug(possibleSlug);
				}
			}
		}
		this.$scope.$watch(() => {
			return this.itemFilterService.filter.query;
		}, (newValue) => {
			if (newValue !== building.name) {
				$state.go($state.current.parent);
			}
		});
	}

	public getItem(className: string): IItemSchema|null
	{
		return data.getItemByClassName(className);
	}

	public getRecipeForCurrentBuilding(): IRecipeSchema|null
	{
		return Object.values(data.getRawData().recipes)
			.find((recipe: IRecipeSchema) => {
				return recipe.products.map((product) => {
					return product.item;
				}).indexOf(this.building.className) >= 0;
			}) || null;
	}

	public resetFilter(): void
	{
		this.itemFilterService.resetFilters();
	}

	public isCraftingBuilding(): boolean
	{
		// 检查建筑的 Type 是否为 Crafting
		const bdData = (this.building as any)._bdData;
		if (bdData && bdData.buildingType) {
			return bdData.buildingType.includes('Crafting');
		}
		return false;
	}


	public getCorporation(corporation: ICorporationSchema): ICorporationSchema
	{
		return corporation;
	}

}
