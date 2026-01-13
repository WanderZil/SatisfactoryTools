import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import data from '@src/Data/Data';
import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {Constants} from '@src/Constants';
import {IOnInit} from 'angular';
import {ComponentOptionsService} from '@src/Module/Services/ComponentOptionsService';

export class ManufacturerRecipesComponentController implements IOnInit
{

	public building: IBuildingSchema;
	public recipes: IRecipeSchema[];
	public static $inject = ['ComponentOptionsService'];

	public constructor(public options: ComponentOptionsService)
	{

	}


	public isAutonomousManufacturer(entity: any): boolean
	{
		return data.isManufacturerBuilding(entity) && !data.isManualManufacturer(entity);
	}

	public isManualManufacturer(entity: any): boolean
	{
		return data.isManualManufacturer(entity);
	}

	public $onInit(): void
	{
		this.recipes = this.getRecipes();
	}

	private getRecipes(): IRecipeSchema[]
	{
		// 优先使用建筑的 availableRecipes（从 CRC 文件提取的 recipe 集合）
		const availableRecipes = (this.building.metadata as any)._daData?.availableRecipes;
		if (availableRecipes && availableRecipes.length > 0) {
			const recipeSchemas: IRecipeSchema[] = [];
			const allRecipes = data.getRawData().recipes;
			for (const recipeClassName of availableRecipes) {
				// 从 recipes 中查找
				const recipe = allRecipes[recipeClassName];
				if (recipe) {
					recipeSchemas.push(recipe);
				}
			}
			if (recipeSchemas.length > 0) {
				return recipeSchemas;
			}
		}

		// 如果没有 availableRecipes 或找不到对应的 recipes，使用原来的逻辑
		const recipeSchemas = Object.values(data.getRawData().recipes);
		if (this.isManualManufacturer(this.building) && Constants.WORKSHOP_CLASSNAME === this.building.className) {
			return recipeSchemas.filter((recipe: IRecipeSchema) => {
				return recipe.inWorkshop;
			});
		}
		if (this.isManualManufacturer(this.building) && Constants.WORKBENCH_CLASSNAME === this.building.className) {
			return recipeSchemas.filter((recipe: IRecipeSchema) => {
				return !recipe.inWorkshop && recipe.inHand;
			});
		}
		return recipeSchemas.filter((recipe: IRecipeSchema) => {
			return recipe.producedIn && recipe.producedIn.indexOf(this.building.className) > -1;
		});
	}

}
