import {IJsonSchema} from '@src/Schema/IJsonSchema';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IBuildingSchema, IManufacturerSchema} from '@src/Schema/IBuildingSchema';
import {ISchematicSchema} from '@src/Schema/ISchematicSchema';
import {IResourceSchema} from '@src/Schema/IResourceSchema';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';
import {BuildingTypes} from '@src/Types/BuildingTypes';
import {Constants} from '@src/Constants';
import {DataProvider} from '@src/Data/DataProvider';

export class Data
{

	public static resourceAmountsU8 = {
		Desc_OreIron_C: 70380,
		Desc_OreCopper_C: 28860,
		Desc_Stone_C: 52860,
		Desc_Coal_C: 30120,
		Desc_OreGold_C: 11040,
		Desc_LiquidOil_C: 11700,
		Desc_RawQuartz_C: 10500,
		Desc_Sulfur_C: 6840,
		Desc_OreBauxite_C: 9780,
		Desc_OreUranium_C: 2100,
		Desc_NitrogenGas_C: 12000,
		Desc_Water_C: Number.MAX_SAFE_INTEGER,
	};

	public static get resourceAmounts()
	{
		return DataProvider.version === '0.8' ? {
			Desc_OreIron_C: 70380,
			Desc_OreCopper_C: 28860,
			Desc_Stone_C: 52860,
			Desc_Coal_C: 30120,
			Desc_OreGold_C: 11040,
			Desc_LiquidOil_C: 11700,
			Desc_RawQuartz_C: 10500,
			Desc_Sulfur_C: 6840,
			Desc_OreBauxite_C: 9780,
			Desc_OreUranium_C: 2100,
			Desc_NitrogenGas_C: 12000,
			Desc_SAM_C: 0,
			Desc_Water_C: Number.MAX_SAFE_INTEGER,
		} : {
			Desc_OreIron_C: 92100,
			Desc_OreCopper_C: 36900,
			Desc_Stone_C: 69900,
			Desc_Coal_C: 42300,
			Desc_OreGold_C: 15000,
			Desc_LiquidOil_C: 12600,
			Desc_RawQuartz_C: 13500,
			Desc_Sulfur_C: 10800,
			Desc_OreBauxite_C: 12300,
			Desc_OreUranium_C: 2100,
			Desc_NitrogenGas_C: 12000,
			Desc_SAM_C: 10200,
			Desc_Water_C: Number.MAX_SAFE_INTEGER,
		};
	}

	public static get resourceWeights()
	{
		return DataProvider.version === '0.8' ? {
			Desc_OreIron_C: 1,
			Desc_OreCopper_C: 2.438669438669439,
			Desc_Stone_C: 1.3314415437003406,
			Desc_Coal_C: 2.277669902912621,
			Desc_OreGold_C: 6.375,
			Desc_LiquidOil_C: 6.015384615384615,
			Desc_RawQuartz_C: 6.702857142857143,
			Desc_Sulfur_C: 10.289473684210526,
			Desc_OreBauxite_C: 7.196319018404908,
			Desc_OreUranium_C: 33.51428571428572,
			Desc_NitrogenGas_C: 5.865,
			Desc_SAM_C: 10000,
			Desc_Water_C: 0,
		} : {
			Desc_OreIron_C: 1,
			Desc_OreCopper_C: 2.4959349593495936,
			Desc_Stone_C: 1.3175965665236051,
			Desc_Coal_C: 2.1773049645390072,
			Desc_OreGold_C: 6.140000000000001,
			Desc_LiquidOil_C: 7.30952380952381,
			Desc_RawQuartz_C: 6.822222222222222,
			Desc_Sulfur_C: 8.527777777777779,
			Desc_OreBauxite_C: 7.487804878048781,
			Desc_OreUranium_C: 43.85714285714286,
			Desc_NitrogenGas_C: 7.675000000000001,
			Desc_SAM_C: 9.029411764705882,
			Desc_Water_C: 0,
		};
	}

	public getRawData(): IJsonSchema
	{
		return DataProvider.get();
	}

	public getAllItems(): {[key: string]: IItemSchema}
	{
		return this.getRawData().items;
	}

	public getAllBuildings(): {[key: string]: IBuildingSchema}
	{
		return this.getRawData().buildings;
	}

	public getAllCorporations(): {[key: string]: ICorporationSchema}
	{
		return this.getRawData().corporations || {};
	}

	public getCorporationBySlug(slug: string): ICorporationSchema|null
	{
		const corporations = this.getAllCorporations();
		for (const key in corporations) {
			if (corporations[key].slug === slug) {
				return corporations[key];
			}
		}
		return null;
	}

	public getCorporationByClassName(className: string): ICorporationSchema|null
	{
		const corporations = this.getAllCorporations();
		return corporations[className] || null;
	}

	// 查找解锁某个建筑的公司和等级
	public getCorporationUnlocksForBuilding(buildingClassName: string): {corporation: ICorporationSchema, level: number}[] | null
	{
		const result: {corporation: ICorporationSchema, level: number}[] = [];
		const corporations = this.getAllCorporations();

		for (const key in corporations) {
			const corporation = corporations[key];
			if (corporation.levels) {
				for (const level of corporation.levels) {
					if (level.buildingRewards) {
						for (const reward of level.buildingRewards) {
							if (reward.building === buildingClassName) {
								result.push({corporation: corporation, level: level.level});
							}
						}
					}
				}
			}
		}

		return result.length > 0 ? result : null;
	}

	// 查找解锁某个 recipe 的公司和等级
	public getCorporationUnlocksForRecipe(recipeClassName: string): {corporation: ICorporationSchema, level: number}[] | null
	{
		// Recipe 通常通过物品解锁，所以需要先找到对应的物品
		const recipe = this.getSchematicByClassName(recipeClassName);
		if (!recipe || !recipe.outputItem) {
			return null;
		}

		const itemClassName = recipe.outputItem.item;
		const result: {corporation: ICorporationSchema, level: number}[] = [];
		const corporations = this.getAllCorporations();

		for (const key in corporations) {
			const corporation = corporations[key];
			if (corporation.levels) {
				for (const level of corporation.levels) {
					if (level.itemRewards) {
						for (const reward of level.itemRewards) {
							if (reward.item === itemClassName) {
								result.push({corporation: corporation, level: level.level});
							}
						}
					}
				}
			}
		}

		return result.length > 0 ? result : null;
	}

	public getAllSchematics(): {[key: string]: ISchematicSchema}
	{
		// 优先返回 blueprints，如果没有则返回 schematics（向后兼容）
		const data = this.getRawData();
		return (data as any).blueprints || data.schematics;
	}

	public getAllBlueprints(): {[key: string]: ISchematicSchema}
	{
		const data = this.getRawData();
		return (data as any).blueprints || data.schematics;
	}

	public getRelevantSchematics(schematic: ISchematicSchema): ISchematicSchema[]
	{
		const allSchematics = this.getAllSchematics();
		const result: ISchematicSchema[] = [schematic];

		function addParentSchematics(s: ISchematicSchema) {
			for (const dependencyClass of s.requiredSchematics) {
				const dependency = allSchematics[dependencyClass];
				if (result.indexOf(dependency) === -1) {
					result.push(dependency);
					addParentSchematics(dependency);
				}
			}
		}

		function addChildSchematics(s: ISchematicSchema) {
			for (const key in allSchematics) {
				const child = allSchematics[key];
				if (child.requiredSchematics.indexOf(s.className) !== -1 && result.indexOf(child) === -1) {
					result.push(child);
					addChildSchematics(child);
				}
			}
		}

		addParentSchematics(schematic);
		addChildSchematics(schematic);

		return result;
	}

	public getSchematicBySlug(slug: string): ISchematicSchema|null
	{
		const data = this.getRawData();
		const schematics = (data as any).blueprints || data.schematics;
		for (const key in schematics) {
			if (schematics[key].slug === slug) {
				return schematics[key];
			}
		}
		return null;
	}

	public getItemBySlug(slug: string): IItemSchema|null
	{
		const items = this.getRawData().items;
		for (const key in items) {
			if (items[key].slug === slug) {
				return items[key];
			}
		}
		return null;
	}

	public getBuildingBySlug(slug: string): IBuildingSchema|null
	{
		const buildings = this.getRawData().buildings;
		for (const key in buildings) {
			if (buildings[key].slug === slug) {
				return buildings[key];
			}
		}
		return null;
	}

	public getBaseItemRecipes(): IRecipeSchema[]
	{
		const recipes: IRecipeSchema[] = [];
		const data = this.getRawData();
		for (const key in data.recipes) {
			const recipe = data.recipes[key];
			if (!recipe.alternate && recipe.inMachine) {
				recipes.push(recipe);
			}
		}
		return recipes;
	}

	public getSinkableItems(): IItemSchema[]
	{
		const data = this.getRawData();
		const items: IItemSchema[] = [];
		for (const key in data.items) {
			const item = data.items[key];
			if (item.sinkPoints > 0) {
				items.push(item);
			}
		}

		return items;
	}

	public getAlternateRecipes(): IRecipeSchema[]
	{
		const recipes: IRecipeSchema[] = [];
		const data = this.getRawData();
		for (const key in data.recipes) {
			const recipe = data.recipes[key];
			if (recipe.alternate) {
				recipes.push(recipe);
			}
		}
		return recipes;
	}

	public getRecipesForItem(item: IItemSchema): {[key: string]: IRecipeSchema}
	{
		const recipeData = this.getRawData().recipes;
		const recipes: {[key: string]: IRecipeSchema} = {};
		function addRecipes(alt: boolean) {
			for (const key in recipeData) {
				const recipe = recipeData[key];
				for (const product of recipe.products) {
					if (product.item === item.className && recipe.alternate === alt) {
						recipes[key] = recipe;
					}
				}
			}
		}
		addRecipes(false);
		addRecipes(true);
		return recipes;
	}

	public getUsagesAsIngredientForItem(item: IItemSchema): {[key: string]: IRecipeSchema}
	{
		const recipeData = this.getRawData().recipes;
		const recipes: {[key: string]: IRecipeSchema} = {};
		function addRecipes(alt: boolean) {
			for (const key in recipeData) {
				const recipe = recipeData[key];
				for (const ingredient of recipe.ingredients) {
					if (item.className === ingredient.item && !recipe.forBuilding && recipe.alternate === alt) {
						recipes[key] = recipe;
					}
				}
			}
		}
		addRecipes(false);
		addRecipes(true);
		return recipes;
	}

	public getUsagesForBuildingForItem(item: IItemSchema): {[key: string]: IRecipeSchema}
	{
		const recipeData = this.getRawData().recipes;
		const recipes: {[key: string]: IRecipeSchema} = {};
		for (const key in recipeData) {
			const recipe = recipeData[key];
			for (const ingredient of recipe.ingredients) {
				if (ingredient.item === item.className && recipe.forBuilding) {
					recipes[key] = recipe;
				}
			}
		}
		// 也检查建筑的Build Requirements（ResourceRequirements）
		const buildings = this.getRawData().buildings;
		for (const key in buildings) {
			const building = buildings[key];
			const bdData = (building as any)._bdData;
			if (bdData && bdData.resourceRequirements) {
				for (const req of bdData.resourceRequirements) {
					if (req.item === item.className) {
						// 创建一个虚拟的recipe来表示这个building需要这个item
						// 使用building的className作为key，避免重复
						const buildingKey = 'building_' + building.className;
						if (!recipes[buildingKey]) {
							// 创建一个虚拟recipe，用于显示building信息
							recipes[buildingKey] = {
								className: buildingKey,
								name: building.name,
								slug: building.slug,
								products: [{
									item: building.className,
									amount: 1,
								}],
								ingredients: bdData.resourceRequirements.map((r: any) => ({
									item: r.item,
									amount: r.quantity,
								})),
								forBuilding: true,
								alternate: false,
								inMachine: false,
								inHand: false,
								inWorkshop: false,
								manualTimeMultiplier: 1,
								producedIn: [],
								time: 0,
								isVariablePower: false as const,
							} as IRecipeSchema;
						}
					}
				}
			}
		}
		return recipes;
	}

	public getUsagesForSchematicsForItem(item: IItemSchema): {[key: string]: ISchematicSchema}
	{
		const data = this.getRawData();
		const schematicData = (data as any).blueprints || data.schematics;
		const schematics: {[key: string]: ISchematicSchema} = {};
		for (const key in schematicData) {
			const schematic = schematicData[key];
			// 检查 cost 和 unlockRequirements
			const costItems = schematic.cost || [];
			const unlockItems = schematic.unlockRequirements || [];
			const allItems = [...costItems, ...unlockItems];
			for (const ingredient of allItems) {
				if (ingredient.item === item.className) {
					schematics[key] = schematic;
					break; // 找到后跳出循环
				}
			}
		}
		return schematics;
	}

	public getSchematicByClassName(className: string): ISchematicSchema|null
	{
		const data = this.getRawData();
		const schematics = (data as any).blueprints || data.schematics;
		return (className in schematics) ? schematics[className] : null;
	}

	public getItemByClassName(className: string): IItemSchema|null
	{
		const items = this.getRawData().items;
		return (className in items) ? items[className] : null;
	}

	public getRecipeByClassName(className: string): IRecipeSchema|null
	{
		const recipes = this.getRawData().recipes;
		return (className in recipes) ? recipes[className] : null;
	}

	public getBuildingByClassName(className: string): IBuildingSchema|null
	{
		const buildings = this.getRawData().buildings;
		return (className in buildings) ? buildings[className] : null;
	}

	public getManufacturerByClassName(className: string): IManufacturerSchema|null
	{
		const buildings = this.getRawData().buildings;
		return (className in buildings) ? buildings[className] as IManufacturerSchema : null;
	}

	public isItem(entity: BuildingTypes): entity is IItemSchema
	{
		return entity !== null && entity !== undefined && entity.hasOwnProperty('fluid');
	}

	public isResource(entity: BuildingTypes): boolean
	{
		if (entity === null || entity === undefined) {
			return false;
		}
		return this.getRawData().resources.hasOwnProperty(entity.className);
	}

	public isBuilding(entity: BuildingTypes): entity is IBuildingSchema
	{
		if (entity === null || entity === undefined) {
			return false;
		}
		if (this.isItem(entity)) {
			return false;
		}

		return entity.hasOwnProperty('categories');
	}

	public isPowerConsumingBuilding(entity: BuildingTypes): entity is IBuildingSchema
	{
		if (!this.isBuilding(entity)) {
			return false;
		}

		if (this.isGeneratorBuilding(entity)) {
			return false;
		}

		return entity.hasOwnProperty('categories');
	}

	public isGeneratorBuilding(entity: BuildingTypes): boolean
	{
		if (!this.isBuilding(entity)) {
			return false;
		}
		return this.getRawData().generators.hasOwnProperty(entity.className);
	}

	public isManualManufacturer(entity: BuildingTypes): boolean{
		return Constants.WORKBENCH_CLASSNAME === entity.className || Constants.WORKSHOP_CLASSNAME === entity.className;
	}

	public isManufacturerBuilding(entity: BuildingTypes): boolean
	{
		if (!this.isBuilding(entity)) {
			return false;
		}
		if (this.isGeneratorBuilding(entity) || this.isExtractorBuilding(entity)) {
			return false;
		}
		if (this.isManualManufacturer(entity)) {
			return true;
		}

		return entity.metadata.manufacturingSpeed !== 0;
	}

	public isExtractorBuilding(entity: BuildingTypes): boolean
	{
		if (!this.isBuilding(entity)) {
			return false;
		}
		return this.getRawData().miners.hasOwnProperty(entity.className);
	}

	public getResources(): IResourceSchema[]
	{
		return Object.values(this.getRawData().resources).sort((a, b) => {
			const itemA = this.getItemByClassName(a.item) as IItemSchema;
			const itemB = this.getItemByClassName(b.item) as IItemSchema;
			return itemA.name.localeCompare(itemB.name);
		});
	}

	public getManufacturers(): IBuildingSchema[]
	{
		return Object.values(this.getRawData().buildings).filter((building) => {
			return this.isManufacturerBuilding(building) && !this.isManualManufacturer(building);
		}).sort((a, b) => {
			return a.name.localeCompare(b.name);
		});
	}

}

export default new Data;
