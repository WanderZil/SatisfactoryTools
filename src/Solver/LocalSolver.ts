import {IProductionToolResponse} from '@src/Tools/Production/IProductionToolResponse';
import {IProductionDataApiRequest} from '@src/Tools/Production/IProductionData';
import data, {Data} from '@src/Data/Data';
import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IBuildingSchema, IManufacturerSchema} from '@src/Schema/IBuildingSchema';
import {Formula} from '@src/Formula';

/**
 * 本地生产计算器
 * 用于替代在线求解器，计算生产链所需的建筑和电力消耗
 */
export class LocalSolver
{
	/**
	 * 计算生产需求
	 * @param productionRequest 生产请求
	 * @param callback 回调函数
	 */
	public static solveProduction(productionRequest: IProductionDataApiRequest, callback: (response: IProductionToolResponse) => void): void
	{
		try {
			const result: IProductionToolResponse = {};
			const schema = data.getRawData();
			
			console.log('[LocalSolver] 开始计算生产需求，目标物品数量:', productionRequest.production.length);
			
			// 处理每个生产目标
			for (const product of productionRequest.production) {
				if (!product.item || product.amount <= 0) {
					continue;
				}
				
				const itemName = schema.items[product.item]?.name || product.item;
				console.log('[LocalSolver] 计算物品生产链:', {
					item: itemName,
					itemClass: product.item,
					amount: product.amount
				});
				
				// 计算该物品的生产链
				const itemResult = LocalSolver.calculateProductionChain(
					product.item,
					product.amount,
					schema
				);
				
				console.log('[LocalSolver] 物品生产链结果:', {
					item: itemName,
					keys: Object.keys(itemResult),
					result: itemResult
				});
				
				// 合并结果
				for (const key in itemResult) {
					if (itemResult.hasOwnProperty(key)) {
						const beforeValue = result[key] || 0;
						result[key] = (result[key] || 0) + itemResult[key];
						const afterValue = result[key];
						
						if (beforeValue !== afterValue && key.includes('#')) {
							console.log('[LocalSolver] 合并配方键:', {
								key: key,
								beforeValue: beforeValue,
								addedValue: itemResult[key],
								afterValue: afterValue
							});
						}
					}
				}
				
				// 添加 ProductNode 用于显示 Production
				// 格式：物品类名#Product: 产量
				const productKey = `${product.item}#Product`;
				result[productKey] = product.amount;
			}
			
			console.log('[LocalSolver] 最终结果:', {
				totalKeys: Object.keys(result).length,
				recipeKeys: Object.keys(result).filter(k => k.includes('@') && k.includes('#')),
				result: result
			});
			
			callback(result);
		} catch (error) {
			console.error('LocalSolver error:', error);
			callback({});
		}
	}
	
	/**
	 * 计算单个物品的生产链
	 * @param itemClassName 物品类名
	 * @param targetAmountPerMin 目标产量（每分钟）
	 * @param schema 数据架构
	 */
	private static calculateProductionChain(
		itemClassName: string,
		targetAmountPerMin: number,
		schema: any
	): IProductionToolResponse
	{
		const result: IProductionToolResponse = {};
		
		console.log('[LocalSolver.calculateProductionChain] 开始计算:', {
			item: itemClassName,
			itemName: schema.items[itemClassName]?.name || itemClassName,
			targetAmount: targetAmountPerMin
		});
		
		// 查找生产该物品的配方
		const recipes = LocalSolver.findRecipesForItem(itemClassName, schema);
		
		if (recipes.length === 0) {
			console.log('[LocalSolver.calculateProductionChain] 未找到配方，标记为原材料:', itemClassName);
			// 如果是原材料，标记为需要开采
			// 注意：StarRupture 数据可能没有 resources 字段，所以如果没有配方就认为是原材料
			// 即使没有 resources 字段，也创建 MinerNode 用于显示 Resources
			result[`${itemClassName}#Mine`] = targetAmountPerMin;
			return result;
		}
		
		// 选择第一个可用配方（后续可以优化为选择最优配方）
		const recipe = recipes[0];
		
		console.log('[LocalSolver.calculateProductionChain] 使用配方:', {
			recipe: recipe.className,
			recipeName: recipe.name,
			producedIn: recipe.producedIn
		});
		
		// 获取生产建筑（必须在计算建筑数量之前，因为需要建筑信息）
		const building = LocalSolver.getBuildingForRecipe(recipe, schema);
		
		console.log('[LocalSolver.calculateProductionChain] 获取建筑:', {
			recipe: recipe.className,
			building: building ? building.className : null,
			buildingName: building ? building.name : null
		});
		
		// 现在总是会返回一个建筑（可能是 Unknown 建筑），所以不需要检查 null
		// 但为了安全起见保留检查
		if (!building) {
			console.error('[LocalSolver.calculateProductionChain] 错误：getBuildingForRecipe 返回了 null');
			return {};
		}
		
		// 如果是 Unknown 建筑，记录日志
		if (building.className === 'BD_Unknown') {
			console.log('[LocalSolver.calculateProductionChain] 使用 Unknown 建筑:', {
				recipe: recipe.className,
				recipeName: recipe.name
			});
		}
		
		// 计算需要的建筑数量（可能为小数）
		const buildingCount = LocalSolver.calculateBuildingCount(
			recipe,
			targetAmountPerMin,
			schema
		);
		
		console.log('[LocalSolver.calculateProductionChain] 计算建筑数量:', {
			recipe: recipe.className,
			buildingCount: buildingCount
		});
		
		if (buildingCount > 0) {
				// 获取单个建筑的产量（每分钟，100% 时钟速度）
				const outputAmount = LocalSolver.getOutputAmount(recipe, itemClassName);
				const buildingOutputPerMin = Formula.calculateProductAmountsPerMinute(
					building as IManufacturerSchema,
					recipe,
					outputAmount,
					100 // 100% 时钟速度
				);
				
				// 计算产量倍数（目标产量 / 单个建筑产量）
				// MachineGroup 会根据这个倍数和时钟速度来计算实际需要的建筑数量
				const productionMultiplier = targetAmountPerMin / buildingOutputPerMin;
				
				// 计算需要的时钟速度
				// 当 productionMultiplier < 1 时，使用 100% 时钟速度，让 MachineGroup 处理降频
				// 这样 MachineGroup 会计算：Math.floor(productionMultiplier * 100 / 100) = 0，
				// rest = productionMultiplier，会添加 1 台降频建筑（总共 1 台）
				const clockSpeed = 100; // 始终使用 100%，让 MachineGroup 处理降频
				
				// 添加配方节点：格式为 "配方类名@时钟速度#建筑类名"
				// amount 应该是产量倍数，MachineGroup 会根据这个倍数计算建筑数量
				// 注意：每个建筑只能同时生产一个配方，所以不能将不同配方的产量倍数累加
				// 使用配方类名作为 key 的一部分，确保每个配方都有独立的节点
				const recipeKey = `${recipe.className}@${clockSpeed}#${building.className}`;
			
			console.log('[LocalSolver.calculateProductionChain] 添加配方节点:', {
				item: itemClassName,
				recipe: recipe.className,
				recipeName: recipe.name,
				building: building.className,
				buildingName: building.name,
				recipeKey: recipeKey,
				productionMultiplier: productionMultiplier,
				targetAmount: targetAmountPerMin,
				buildingOutputPerMin: buildingOutputPerMin
			});
			
			// 检查是否已存在相同的配方键
			if (recipeKey in result) {
				console.warn('[LocalSolver.calculateProductionChain] 警告：配方键已存在，将被覆盖:', {
					recipeKey: recipeKey,
					existingValue: result[recipeKey],
					newValue: productionMultiplier
				});
			}
			
				// 不累加，每个配方独立计算建筑数量
				result[recipeKey] = productionMultiplier;
				
				// 递归计算所需原材料
				for (const ingredient of recipe.ingredients) {
				const ingredientName = schema.items[ingredient.item]?.name || ingredient.item;
					const ingredientAmountPerMin = (targetAmountPerMin / LocalSolver.getOutputAmount(recipe, itemClassName)) * ingredient.amount;
				
				console.log('[LocalSolver.calculateProductionChain] 递归计算原材料:', {
					parentItem: itemClassName,
					parentRecipe: recipe.className,
					ingredient: ingredientName,
					ingredientClass: ingredient.item,
					ingredientAmount: ingredientAmountPerMin
				});
				
					const ingredientResult = LocalSolver.calculateProductionChain(
						ingredient.item,
						ingredientAmountPerMin,
						schema
					);
				
				console.log('[LocalSolver.calculateProductionChain] 原材料计算结果:', {
					ingredient: ingredientName,
					keys: Object.keys(ingredientResult),
					result: ingredientResult
				});
					
					// 合并原材料结果
					for (const key in ingredientResult) {
						if (ingredientResult.hasOwnProperty(key)) {
							result[key] = (result[key] || 0) + ingredientResult[key];
					}
				}
			}
		}
		
		return result;
	}
	
	/**
	 * 查找生产指定物品的配方
	 */
	private static findRecipesForItem(itemClassName: string, schema: any): IRecipeSchema[]
	{
		const recipes: IRecipeSchema[] = [];
		
		if (!schema.recipes) {
			console.log('[LocalSolver.findRecipesForItem] schema.recipes 不存在');
			return recipes;
		}
		
		console.log('[LocalSolver.findRecipesForItem] 查找物品配方:', {
			item: itemClassName,
			itemName: schema.items[itemClassName]?.name || itemClassName,
			totalRecipes: Object.keys(schema.recipes).length
		});
		
		for (const key in schema.recipes) {
			if (!schema.recipes.hasOwnProperty(key)) {
				continue;
			}
			
			const recipe = schema.recipes[key];
			
			// 检查配方是否生产该物品
			if (recipe.products && Array.isArray(recipe.products)) {
			for (const product of recipe.products) {
				if (product.item === itemClassName) {
						console.log('[LocalSolver.findRecipesForItem] 找到配方:', {
							recipe: recipe.className,
							recipeName: recipe.name,
							productItem: product.item,
							productAmount: product.amount
						});
					recipes.push(recipe);
					break;
					}
				}
			}
		}
		
		console.log('[LocalSolver.findRecipesForItem] 找到', recipes.length, '个配方');
		return recipes;
	}
	
	/**
	 * 计算需要的建筑数量
	 */
	private static calculateBuildingCount(
		recipe: IRecipeSchema,
		targetAmountPerMin: number,
		schema: any
	): number
	{
		const building = LocalSolver.getBuildingForRecipe(recipe, schema);
		
		if (!building) {
			return 0;
		}
		
		// 获取单个建筑的产量（每分钟）
		const outputAmount = LocalSolver.getOutputAmount(recipe, recipe.products[0].item);
		const buildingOutputPerMin = Formula.calculateProductAmountsPerMinute(
			building as IManufacturerSchema,
			recipe,
			outputAmount,
			100 // 默认 100% 时钟速度
		);
		
		if (buildingOutputPerMin <= 0) {
			return 0;
		}
		
		// 计算需要的建筑数量（可能为小数，表示需要降频）
		// 例如：目标 10 个/分钟，单个建筑 90 个/分钟，则需要 10/90 = 0.111 个建筑
		return targetAmountPerMin / buildingOutputPerMin;
	}
	
	/**
	 * 获取配方的输出数量
	 */
	private static getOutputAmount(recipe: IRecipeSchema, itemClassName: string): number
	{
		for (const product of recipe.products) {
			if (product.item === itemClassName) {
				return product.amount;
			}
		}
		return 0;
	}
	
	/**
	 * 创建 Unknown 建筑（用于没有指定生产建筑的配方）
	 */
	private static createUnknownBuilding(recipe: IRecipeSchema): IBuildingSchema
	{
		return {
			slug: 'unknown',
			name: 'Unknown',
			description: `Unknown building for recipe ${recipe.name}`,
			className: 'BD_Unknown',
			categories: ['SC_Manufacturers_C'],
			buildMenuPriority: 0,
			metadata: {
				// NOTE: allow the object to satisfy manufacturer metadata typing used elsewhere.
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
	
	/**
	 * 获取配方的生产建筑
	 */
	private static getBuildingForRecipe(recipe: IRecipeSchema, schema: any): IBuildingSchema | null
	{
		console.log('[LocalSolver.getBuildingForRecipe] 查找建筑:', {
			recipe: recipe.className,
			recipeName: recipe.name,
			producedIn: recipe.producedIn,
			hasBuildings: !!schema.buildings
		});
		
		if (!schema.buildings || !recipe.producedIn || recipe.producedIn.length === 0) {
			console.log('[LocalSolver.getBuildingForRecipe] producedIn 为空，从 availableRecipes 查找');
			// 如果没有指定建筑，尝试从配方的 availableRecipes 反向查找
			// 遍历所有建筑，查找哪个建筑的配方集合包含该配方
			let checkedBuildings = 0;
			let buildingsWithRecipes = 0;
			const buildingsWithRecipe: string[] = [];
			
			for (const buildingKey in schema.buildings) {
				if (!schema.buildings.hasOwnProperty(buildingKey)) {
					continue;
				}
				
				const building = schema.buildings[buildingKey];
				checkedBuildings++;
				if (building.metadata && building.metadata._daData && building.metadata._daData.availableRecipes) {
					const availableRecipes = building.metadata._daData.availableRecipes;
					buildingsWithRecipes++;
					
					// 记录包含该配方的建筑（用于调试）
					if (availableRecipes.includes(recipe.className)) {
						buildingsWithRecipe.push(`${building.className} (${building.name})`);
						console.log('[LocalSolver.getBuildingForRecipe] 找到建筑:', {
							building: building.className,
							buildingName: building.name,
							checkedBuildings: checkedBuildings,
							availableRecipes: availableRecipes
						});
						return building;
					}
					
					// 如果是 Factory 或 Smelter 相关建筑，输出其 availableRecipes（用于调试）
					if ((building.className.includes('Factory') || building.className.includes('Smelter')) && availableRecipes.length > 0) {
						console.log('[LocalSolver.getBuildingForRecipe] 建筑配方列表:', {
							building: building.className,
							buildingName: building.name,
							availableRecipes: availableRecipes,
							availableRecipesCount: availableRecipes.length,
							targetRecipe: recipe.className,
							hasTargetRecipe: availableRecipes.includes(recipe.className),
							// 检查是否有类似的配方名（用于调试）
							similarRecipes: availableRecipes.filter((r: string) => r.toLowerCase().includes(recipe.className.toLowerCase().substring(0, 10)))
						});
					}
				}
			}
			
			console.log('[LocalSolver.getBuildingForRecipe] 未找到建筑，使用 Unknown 建筑:', {
				recipe: recipe.className,
				checkedBuildings: checkedBuildings,
				buildingsWithRecipes: buildingsWithRecipes,
				buildingsWithTargetRecipe: buildingsWithRecipe
			});
			// 如果找不到建筑，返回 Unknown 建筑
			return LocalSolver.createUnknownBuilding(recipe);
		}
		
		// 使用配方的 producedIn 列表中的第一个建筑
		const buildingClassName = recipe.producedIn[0];
		const building = schema.buildings[buildingClassName] || null;
		if (!building) {
			console.log('[LocalSolver.getBuildingForRecipe] producedIn 建筑不存在，使用 Unknown 建筑:', {
				buildingClassName: buildingClassName
			});
			// 如果 producedIn 指定的建筑不存在，也使用 Unknown 建筑
			return LocalSolver.createUnknownBuilding(recipe);
		}
		console.log('[LocalSolver.getBuildingForRecipe] 使用 producedIn:', {
			buildingClassName: buildingClassName,
			found: !!building
		});
		return building;
	}
}

