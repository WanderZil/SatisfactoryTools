import {IProductionDataApiRequest, IProductionDataApiResponse} from '@src/Tools/Production/IProductionData';
import {IJsonSchema} from '@src/Schema/IJsonSchema';
import {IBuildingSchema, IManufacturerSchema} from '@src/Schema/IBuildingSchema';
import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {RecipeData} from '@src/Tools/Production/Result/RecipeData';
import {RecipeNode} from '@src/Tools/Production/Result/Nodes/RecipeNode';
import {MinerNode} from '@src/Tools/Production/Result/Nodes/MinerNode';
import {ProductNode} from '@src/Tools/Production/Result/Nodes/ProductNode';
import {ByproductNode} from '@src/Tools/Production/Result/Nodes/ByproductNode';
import {InputNode} from '@src/Tools/Production/Result/Nodes/InputNode';
import {Graph} from '@src/Tools/Production/Result/Graph';
import {ProductionResult} from '@src/Tools/Production/Result/ProductionResult';
import {SinkNode} from '@src/Tools/Production/Result/Nodes/SinkNode';

export class ProductionResultFactory
{

	public create(request: IProductionDataApiRequest, response: IProductionDataApiResponse, data: IJsonSchema): ProductionResult
	{
		return new ProductionResult(request, ProductionResultFactory.createGraph(response, data), data);
	}

	/**
	 * 创建 Unknown 建筑（用于没有指定生产建筑的配方）
	 */
	private static createUnknownBuilding(recipe: IRecipeSchema): IManufacturerSchema
	{
		return {
			slug: 'unknown',
			name: 'Unknown',
			description: `Unknown building for recipe ${recipe.name}`,
			className: 'BD_Unknown',
			categories: ['SC_Manufacturers_C'],
			buildMenuPriority: 0,
			metadata: {
				// NOTE: IManufacturerAnyPowerMetadataSchema currently requires `isVariablePower`.
				// (Schema typing treats both variable/fixed as `isVariablePower: true`.)
				isVariablePower: true,
				powerConsumption: 0,
				powerConsumptionExponent: 1.6,
				manufacturingSpeed: 1.0, // 默认制造速度，用于计算生产时间
				_daData: {
					isCraftingBuilding: true,
					availableRecipes: []
				},
				_bpData: {}
			},
			size: {
				width: 0,
				length: 0,
				height: 0
			},
			buildingType: 'Crafting',
			_bdData: {}
		};
	}

	private static createGraph(response: IProductionDataApiResponse, data: IJsonSchema): Graph
	{
		const graph = new Graph;

		for (const recipeData in response) {
			if (!response.hasOwnProperty(recipeData)) {
				continue;
			}

			let machineData;
			let machineClass;
			let recipeClass;
			let clockSpeed;
			const amount = parseFloat(response[recipeData] + '');

			[machineData, machineClass] = recipeData.split('#');

			if (machineClass === 'Mine') {
				graph.addNode(new MinerNode({
					item: machineData,
					amount: amount,
				}, data));
			} else if (machineClass === 'Sink') {
				if (machineData in data.items) {
					graph.addNode(new SinkNode({
						item: machineData,
						amount: amount,
					}, data));
				}
			} else if (machineClass === 'Product') {
				if (machineData in data.items) {
					graph.addNode(new ProductNode({
						item: machineData,
						amount: amount,
					}, data));
				}
			} else if (machineClass === 'Byproduct') {
				if (machineData in data.items) {
					graph.addNode(new ByproductNode({
						item: machineData,
						amount: amount,
					}, data));
				}
			} else if (machineClass === 'Input') {
				if (machineData in data.items) {
					graph.addNode(new InputNode({
						item: machineData,
						amount: amount,
					}, data));
				}
			} else {
				[recipeClass, clockSpeed] = machineData.split('@');

				if (clockSpeed) {
					console.log('[ProductionResultFactory] 创建 RecipeNode:', {
						recipeKey: recipeData,
						recipeClass: recipeClass,
						buildingClass: machineClass,
						amount: amount,
						clockSpeed: parseInt(clockSpeed, 10)
					});
					
					// 获取建筑，如果不存在则创建 Unknown 建筑
					let building = data.buildings[machineClass] as IManufacturerSchema;
					if (!building) {
						const recipe = data.recipes[recipeClass];
						if (recipe) {
							console.log('[ProductionResultFactory] 建筑不存在，创建 Unknown 建筑:', {
								buildingClass: machineClass,
								recipeClass: recipeClass
							});
							building = ProductionResultFactory.createUnknownBuilding(recipe);
						} else {
							console.error('[ProductionResultFactory] 配方不存在:', recipeClass);
							continue;
						}
					}
					
					const recipe = data.recipes[recipeClass];
					if (!recipe) {
						console.error('[ProductionResultFactory] 配方不存在:', recipeClass);
						continue;
					}
					
					graph.addNode(new RecipeNode(new RecipeData(
						building,
						recipe,
						amount,
						parseInt(clockSpeed, 10),
					), data));
				}
			}
		}

		graph.generateEdges();

		return graph;
	}

}
