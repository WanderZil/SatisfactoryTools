import data from '@src/Data/Data';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {ITransitionObject} from '@src/Types/ITransitionObject';
import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IBuildingSchema, IManufacturerSchema} from '@src/Schema/IBuildingSchema';
import {ISchematicSchema} from '@src/Schema/ISchematicSchema';
import {RecentlyVisitedItemsService} from '@src/Module/Services/RecentlyVisitedItemsService';
import {IScope} from 'angular';
import {ItemFiltersService} from '@src/Module/Services/ItemFiltersService';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';

export class ItemController
{

	public item: IItemSchema;
	public recipes: IRecipeSchema[];
	public usagesAsIngredient: IRecipeSchema[];
	public usagesForBuilding: IRecipeSchema[];
	public usagesForSchematics: ISchematicSchema[];
	public relatedRecipe: ISchematicSchema|null = null;

	public static $inject = ['$state', '$transition$', 'RecentlyVisitedItemsService', 'ItemFiltersService', '$scope'];

	public constructor(
		$state: any, $transition$: ITransitionObject<{item: string}>, recentlyVisitedItemsService: RecentlyVisitedItemsService, private itemFilterService: ItemFiltersService, private $scope: IScope,
	)
	{
		const item = data.getItemBySlug($transition$.params().item);
		if (item === null) {
			$state.go($state.current.parent);
			return;
		}
		this.itemFilterService.filter.query = item.name;
		recentlyVisitedItemsService.addVisited(item.className);
		this.item = item;
		this.recipes = Object.values(data.getRecipesForItem(item));
		this.usagesAsIngredient = Object.values(data.getUsagesAsIngredientForItem(item));
		this.usagesForBuilding = Object.values(data.getUsagesForBuildingForItem(item));
		this.usagesForSchematics = Object.values(data.getUsagesForSchematicsForItem(item));
		// 查找对应的 Recipe（通过 outputItem 匹配）
		this.relatedRecipe = this.getRecipeForItem(item);
		this.$scope.$watch(() => {
			return this.itemFilterService.filter.query;
		}, (newValue) => {
			if (newValue !== item.name) {
				$state.go($state.current.parent);
			}
		});
	}

	public getItem(className: string): IItemSchema|null
	{
		return data.getRawData().items[className];
	}

	public getRecipe(className: string): IRecipeSchema|null
	{
		return data.getRawData().recipes[className];
	}

	public getBuilding(className: string): IBuildingSchema|null
	{
		return data.getRawData().buildings[className];
	}

	public getMachine(recipe: IRecipeSchema): IManufacturerSchema|null
	{
		return data.getManufacturerByClassName(recipe.producedIn[0]);
	}

	public getRecipeForItem(item: IItemSchema): ISchematicSchema|null
	{
		const allSchematics = data.getAllSchematics();
		for (const key in allSchematics) {
			const schematic = allSchematics[key];
			if (schematic.outputItem && schematic.outputItem.item === item.className) {
				return schematic;
			}
		}
		return null;
	}

	public getSchematic(className: string): ISchematicSchema|null
	{
		return data.getSchematicByClassName(className);
	}

	public isRecipeItem(itemClassName: string): boolean
	{
		// 检查该物品是否是一个 Recipe（通过检查是否在 schematics 数据中存在，其 className 就是该物品）
		const schematic = data.getSchematicByClassName(itemClassName);
		return schematic !== null;
	}

	public getRecipeForItemByClassName(itemClassName: string): ISchematicSchema|null
	{
		// 通过物品的 className 查找对应的 Recipe（如果该物品本身就是一个 Recipe）
		return data.getSchematicByClassName(itemClassName);
	}

	public isCraftingMaterial(): boolean
	{
		return !!(this.item.description && this.item.description.includes('Crafting Material'));
	}

	public canBeExported(): boolean
	{
		return !!(this.item.description && this.item.description.includes('Can be exported'));
	}

	public hasSinkPoints(): boolean
	{
		return this.item.sinkPoints !== undefined && this.item.sinkPoints !== null && this.item.sinkPoints > 0;
	}

	public hasForm(): boolean
	{
		// 只有当 liquid 属性存在且有意义时才显示
		// 如果所有物品都是同一个值（都是 Solid 或都是 Liquid），则不需要显示
		// 检查是否有不同值的物品
		const allItems = Object.values(data.getRawData().items);
		const hasLiquid = allItems.some((item: IItemSchema) => item.liquid === true);
		const hasSolid = allItems.some((item: IItemSchema) => item.liquid === false);
		// 只有当同时存在 Liquid 和 Solid 物品时才显示
		return hasLiquid && hasSolid;
	}

	public hasRadioactive(): boolean
	{
		return this.item.radioactiveDecay !== undefined && this.item.radioactiveDecay !== null && this.item.radioactiveDecay > 0;
	}

	public resetFilter(): void
	{
		this.itemFilterService.resetFilters();
	}

	public getCorporationByName(name: string): ICorporationSchema|null
	{
		const allCorporations = data.getAllCorporations();
		for (const key in allCorporations) {
			const corp = allCorporations[key];
			if (corp.name === name) {
				return corp;
			}
		}
		return null;
	}

	public getExportDataForCorporation(corpName: string): Array<{level: number, buildTime: number, value: number}> | null
	{
		if (!this.item.export) {
			return null;
		}
		let exportField: string | null = null;
		if (corpName === 'Selenian Corporation') {
			exportField = 'selenian';
		} else if (corpName === 'Clever Robotics') {
			exportField = 'clever';
		} else if (corpName === 'Future Health Solutions') {
			exportField = 'future';
		} else if (corpName === 'Griffith Blue Corporation') {
			exportField = 'griffiths';
		} else if (corpName === 'Moon Energy Corporation') {
			exportField = 'moon';
		}
		if (!exportField) {
			return null;
		}
		return (this.item.export as any)[exportField] || null;
	}

	public getAllExportCorporations(): Array<{corporation: ICorporationSchema, exportData: Array<{level: number, buildTime: number, value: number}>}> {
		const result: Array<{corporation: ICorporationSchema, exportData: Array<{level: number, buildTime: number, value: number}>}> = [];
		const corporationNames = [
			'Selenian Corporation',
			'Clever Robotics',
			'Future Health Solutions',
			'Griffith Blue Corporation',
			'Moon Energy Corporation',
		];
		for (const corpName of corporationNames) {
			const corporation = this.getCorporationByName(corpName);
			if (corporation) {
				const exportData = this.getExportDataForCorporation(corpName);
				// 即使exportData为null或空数组，也要显示（value为0的情况）
				// 如果exportData为空，创建一个默认的value为0的条目
				if (!exportData || exportData.length === 0) {
					result.push({
						corporation: corporation,
						exportData: [{level: 0, buildTime: 0, value: 0}],
					});
				} else {
					result.push({
						corporation: corporation,
						exportData: exportData,
					});
				}
			}
		}
		return result;
	}

}
