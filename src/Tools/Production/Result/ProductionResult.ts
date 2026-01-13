import {Graph} from '@src/Tools/Production/Result/Graph';
import {InputNode} from '@src/Tools/Production/Result/Nodes/InputNode';
import {MinerNode} from '@src/Tools/Production/Result/Nodes/MinerNode';
import {
	IBuildingsResultDetails,
	IInputResultDetails,
	IItemBuildingAmountResultDetails,
	IItemResultDetails,
	IMachinePowerDetails,
	IRawResourceResultDetails,
	IRecipePowerDetails,
	IResultDetails,
	IUnlockRequirement
} from '@src/Tools/Production/Result/IResultDetails';
import {RecipeNode} from '@src/Tools/Production/Result/Nodes/RecipeNode';
import {IJsonSchema} from '@src/Schema/IJsonSchema';
import {GraphEdge} from '@src/Tools/Production/Result/Edges/GraphEdge';
import {GraphNode} from '@src/Tools/Production/Result/Nodes/GraphNode';
import {Objects} from '@src/Utils/Objects';
import {IProductionDataApiRequest} from '@src/Tools/Production/IProductionData';
import {ProductNode} from '@src/Tools/Production/Result/Nodes/ProductNode';
import {ByproductNode} from '@src/Tools/Production/Result/Nodes/ByproductNode';
import {Numbers} from '@src/Utils/Numbers';
import data, {Data} from '@src/Data/Data';

export class ProductionResult
{

	public details: IResultDetails = {
		buildings: {
			buildings: {},
			resources: {},
			amount: 0,
		},
		power: {
			byRecipe: {},
			byBuilding: {},
			total: {
				isVariable: false,
				average: 0,
				max: 0,
			},
		},
		items: {},
		input: {},
		hasInput: false,
		rawResources: {},
		output: {},
		hasOutput: false,
		byproducts: {},
		hasByproducts: false,
		unlockRequirements: [],
	};

	public constructor(request: IProductionDataApiRequest, public readonly graph: Graph, schema: IJsonSchema)
	{
		this.calculateBuildings(schema);
		this.calculateItems(schema);
		this.calculateInput(request, schema);
		this.calculateRawResources(request, schema);
		this.calculateProducts();
		this.findUnlockRequirements(schema);
		this.calculatePower(schema);
	}

	private calculateBuildings(schema: IJsonSchema): void
	{
		const buildings: IBuildingsResultDetails = {
			buildings: {},
			resources: {},
			amount: 0,
		};

		console.log('[calculateBuildings] 开始计算建筑数量，Graph 中共有', this.graph.nodes.length, '个节点');

		// 统计 RecipeNode 数量
		let recipeNodeCount = 0;
		for (const node of this.graph.nodes) {
			if (node instanceof RecipeNode) {
				recipeNodeCount++;
			}
		}
		console.log('[calculateBuildings] 找到', recipeNodeCount, '个 RecipeNode');

		// 遍历所有 RecipeNode，累加每个配方所需的建筑数量
		// 关键：每个建筑只能同时生产一个配方，所以不同配方需要独立的建筑实例
		for (const node of this.graph.nodes) {
			if (node instanceof RecipeNode) {
				const className = node.recipeData.machine.className;
				const recipeClassName = node.recipeData.recipe.className;
				const recipeName = schema.recipes[recipeClassName]?.name || recipeClassName;
				const buildingName = schema.buildings[className]?.name || className;

				// 使用 MachineGroup.countMachines() 获取实际建筑数量
				// 注意：这是该配方所需的建筑数量，不是产量倍数
				const amount = node.machineData.countMachines();
				const productionMultiplier = node.recipeData.amount;

				console.log('[calculateBuildings] 处理 RecipeNode:', {
					recipe: recipeName,
					recipeClass: recipeClassName,
					building: buildingName,
					buildingClass: className,
					productionMultiplier: productionMultiplier,
					machineCount: amount,
					machineData: {
						machines: node.machineData.machines,
						mode: node.machineData.mode
					}
				});

				if (!(className in buildings.buildings)) {
					buildings.buildings[className] = {
						amount: 0,
						recipes: {},
						resources: {},
					};
					console.log('[calculateBuildings] 初始化建筑类型:', buildingName, className);
				}

				const beforeAmount = buildings.buildings[className].amount;

				// 重要：每个建筑只能同时生产一个配方
				// 因此，即使两个不同配方使用相同的建筑类型，也需要累加它们的建筑数量
				// 因为每个配方都需要独立的建筑实例
				// 例如：Wolfram Bar 需要 1 个 Smelter，Anti-Radiation Covers 需要 1 个 Smelter
				// 总共需要 2 个 Smelter，不能共享
				buildings.buildings[className].amount += amount;

				console.log('[calculateBuildings] 累加建筑数量:', {
					building: buildingName,
					recipe: recipeName,
					amountBefore: beforeAmount,
					amountToAdd: amount,
					amountAfter: buildings.buildings[className].amount
				});

				// 如果同一个配方已经存在（可能发生在递归计算原材料时，同一个配方被多次使用）
				// 累加该配方的建筑数量
				if (recipeClassName in buildings.buildings[className].recipes) {
					console.log('[calculateBuildings] 警告：配方已存在，累加建筑数量:', {
						building: buildingName,
						recipe: recipeName,
						existingAmount: buildings.buildings[className].recipes[recipeClassName].amount,
						additionalAmount: amount
					});
					buildings.buildings[className].recipes[recipeClassName].amount += amount;
					// 重新计算该配方的建筑成本
					buildings.buildings[className].recipes[recipeClassName].resources =
						ProductionResult.calculateBuildingCost(className, buildings.buildings[className].recipes[recipeClassName].amount, schema);
				} else {
					// 新配方，直接添加
					console.log('[calculateBuildings] 添加新配方:', {
						building: buildingName,
						recipe: recipeName,
						amount: amount
					});
					buildings.buildings[className].recipes[recipeClassName] = {
					amount: amount,
					resources: ProductionResult.calculateBuildingCost(className, amount, schema),
					};
			}
			}
		}

		// 输出最终结果
		console.log('[calculateBuildings] 最终建筑统计:');
		for (const buildingClass in buildings.buildings) {
			const building = buildings.buildings[buildingClass];
			const buildingName = schema.buildings[buildingClass]?.name || buildingClass;
			console.log('[calculateBuildings]', buildingName, ':', {
				totalAmount: building.amount,
				recipes: Object.keys(building.recipes).map(recipeClass => ({
					recipe: schema.recipes[recipeClass]?.name || recipeClass,
					amount: building.recipes[recipeClass].amount
				}))
			});
		}

		for (const k in buildings.buildings) {
			buildings.buildings[k].resources = ProductionResult.sumBuildingCost(Object.values(buildings.buildings[k].recipes).map((value) => {
				return value.resources;
			}));
		}

		buildings.resources = ProductionResult.sumBuildingCost(Object.values(buildings.buildings).map((value) => {
			return value.resources;
		}));

		let totalAmount = 0;
		for (const building in buildings.buildings) {
			totalAmount += buildings.buildings[building].amount;
		}

		buildings.amount = totalAmount;

		this.details.buildings = buildings;
		this.details.buildings.buildings = Objects.sortByKeys(buildings.buildings, (building1: string, building2: string) => {
			// 处理 Unknown 建筑的情况
			const building1Data = schema.buildings[building1];
			const building2Data = schema.buildings[building2];
			const name1 = building1Data?.name || building1;
			const name2 = building2Data?.name || building2;
			if (name1 < name2) {
				return -1;
			}
			if (name1 > name2) {
				return 1;
			}
			return 0;
		});
	}

	private calculateItems(schema: IJsonSchema): void
	{
		const items: {[key: string]: IItemResultDetails} = {};

		for (const node of this.graph.nodes) {
			for (const edge of node.connectedEdges) {
				ProductionResult.addItem(items, node, edge);
			}
		}

		for (const itemClass in items) {
			const item = items[itemClass];
			item.diff = Numbers.round(item.produced - item.consumed);

			for (const p in item.producers) {
				if (item.producers.hasOwnProperty(p)) {
					item.producers[p].itemPercentage = Numbers.round(item.producers[p].itemAmount / item.produced * 100);
				}
			}
			for (const c in item.consumers) {
				if (item.consumers.hasOwnProperty(c)) {
					item.consumers[c].itemPercentage = Numbers.round(item.consumers[c].itemAmount / item.consumed * 100);
				}
			}
		}

		this.details.items = Objects.sortByKeys(items, (item1: string, item2: string) => {
			const name1 = schema.items[item1].name;
			const name2 = schema.items[item2].name;
			const isRaw1 = item1 in schema.resources;
			const isRaw2 = item2 in schema.resources;

			if (isRaw1 && !isRaw2) {
				return -1;
			}
			if (!isRaw1 && isRaw2) {
				return 1;
			}

			if (name1 < name2) {
				return -1;
			}
			if (name1 > name2) {
				return 1;
			}
			return 0;
		});
	}

	private calculateInput(request: IProductionDataApiRequest, schema: IJsonSchema): void
	{
		const inputs: {[key: string]: IInputResultDetails} = {};

		for (const input of request.input) {
			if (input.item && input.amount > 0 && (input.item in schema.items)) {
				if (!(input.item in inputs)) {
					inputs[input.item] = {
						used: 0,
						max: 0,
						usedPercentage: 0,
						producedExtra: 0,
					};
				}
				inputs[input.item].max += input.amount;
			}
		}

		for (const node of this.graph.nodes) {
			if (node instanceof InputNode) {
				const itemClass = node.itemAmount.item;
				if (itemClass in inputs) { // just a sanity check, should be always true
					inputs[itemClass].used += node.itemAmount.amount;
				}
			} else if (node instanceof RecipeNode) {
				for (const product of node.getOutputs()) {
					if (product.resource.className in inputs) {
						inputs[product.resource.className].producedExtra += product.maxAmount;
					}
				}
			} else if (node instanceof MinerNode) {
				if (node.itemAmount.item in inputs) {
					inputs[node.itemAmount.item].producedExtra += node.itemAmount.amount;
				}
			}
		}

		for (const k in inputs) {
			const input = inputs[k];
			input.used = Numbers.round(input.used);
			input.max = Numbers.round(input.max);
			input.usedPercentage = Numbers.round(input.used / input.max * 100);
		}

		this.details.input = inputs;
		this.details.hasInput = Object.keys(inputs).length > 0;
	}

	private calculateRawResources(request: IProductionDataApiRequest, schema: IJsonSchema): void
	{
		const resources: {[key: string]: IRawResourceResultDetails} = {};

		// 首先从 MinerNode 中收集所有使用的资源
		const usedResources: {[key: string]: number} = {};
		for (const node of this.graph.nodes) {
			if (node instanceof MinerNode) {
				const itemClassName = node.itemAmount.item;
				usedResources[itemClassName] = (usedResources[itemClassName] || 0) + node.itemAmount.amount;
			}
		}

		// 如果有 schema.resources，使用它来初始化资源列表
		if (schema.resources && Object.keys(schema.resources).length > 0) {
			for (const resource in Objects.sortByKeys(schema.resources, (item1: string, item2: string) => {
				const name1 = schema.items[item1].name;
				const name2 = schema.items[item2].name;

				if (name1 < name2) {
					return -1;
				}
				if (name1 > name2) {
					return 1;
				}
				return 0;
			})) {
				resources[resource] = {
					enabled: request.blockedResources.indexOf(resource) === -1,
					max: request.resourceMax[resource] || 0,
					used: 0,
					usedPercentage: 0,
				};
			}
		} else {
			// 如果没有 schema.resources，从 MinerNode 中创建资源列表
			for (const resource in usedResources) {
				if (schema.items[resource]) {
					resources[resource] = {
						enabled: request.blockedResources.indexOf(resource) === -1,
						max: request.resourceMax[resource] || 0,
						used: 0,
						usedPercentage: 0,
					};
				}
			}
		}

		// 更新使用量
		for (const node of this.graph.nodes) {
			if (node instanceof MinerNode && node.itemAmount.item in resources) {
				resources[node.itemAmount.item].used += node.itemAmount.amount;
			}
		}

		// 计算使用百分比
		for (const resource in resources) {
			resources[resource].used = Numbers.round(resources[resource].used);
			if (resources[resource].max > 0) {
				resources[resource].usedPercentage = Numbers.round(resources[resource].used / resources[resource].max * 100);
			} else {
				resources[resource].usedPercentage = 0;
			}
		}

		this.details.rawResources = resources;
	}

	private calculateProducts(): void
	{
		const products: {[key: string]: number} = {};
		const byproducts: {[key: string]: number} = {};

		for (const node of this.graph.nodes) {
			if (node instanceof ProductNode) {
				ProductionResult.addProduct(products, node.itemAmount.item, node.itemAmount.amount);
				this.details.hasOutput = true;
			} else if (node instanceof ByproductNode) {
				ProductionResult.addProduct(byproducts, node.itemAmount.item, node.itemAmount.amount);
				this.details.hasByproducts = true;
				this.details.hasOutput = true;
			}
		}

		this.details.output = products;
		this.details.byproducts = byproducts;
	}

	private calculatePower(schema: IJsonSchema): void
	{
		const byRecipe: {[key: string]: IRecipePowerDetails} = {};
		const byBuilding: {[key: string]: IMachinePowerDetails} = {};
		for (const node of this.graph.nodes) {
			if (node instanceof RecipeNode) {
				const machineClass = node.recipeData.machine.className;
				const recipeClass = node.recipeData.recipe.className;

				byRecipe[recipeClass] = {
					machine: machineClass,
					power: {
						average: Numbers.round(node.machineData.power.average),
						max: Numbers.round(node.machineData.power.max),
						isVariable: node.machineData.power.isVariable,
					},
					machines: node.machineData.machines,
				};

				if (!(machineClass in byBuilding)) {
					byBuilding[machineClass] = {
						amount: 0,
						power: {
							max: 0,
							isVariable: false,
							average: 0,
						},
						recipes: {},
					};
				}

				byBuilding[machineClass].recipes[recipeClass] = {
					clockSpeed: node.recipeData.clockSpeed,
					amount: node.machineData.countMachines(),
					power: {
						average: Numbers.round(node.machineData.power.average),
						max: Numbers.round(node.machineData.power.max),
						isVariable: node.machineData.power.isVariable,
					},
				};
				byBuilding[machineClass].amount += node.machineData.countMachines();

				byBuilding[machineClass].power.average += node.machineData.power.average;
				byBuilding[machineClass].power.max += node.machineData.power.max;
				if (node.machineData.power.isVariable) {
					byBuilding[machineClass].power.isVariable = true;
				}
			}
		}

		let isVariable = false;
		let average = 0;
		let max = 0;

		for (const machine in byBuilding) {
			average += byBuilding[machine].power.average;
			max += byBuilding[machine].power.max;
			if (byBuilding[machine].power.isVariable) {
				isVariable = true;
			}

			byBuilding[machine].power.average = Numbers.round(byBuilding[machine].power.average);
			byBuilding[machine].power.max = Numbers.round(byBuilding[machine].power.max);
		}

		if (Math.abs(max - average) < 1e-8) {
			isVariable = false;
		}

		average = Numbers.round(average);
		max = Numbers.round(max);

		this.details.power = {
			total: {
				isVariable: isVariable,
				average: average,
				max: max,
			},
			byBuilding: byBuilding,
			byRecipe: byRecipe,
		};
	}

	private findUnlockRequirements(schema: IJsonSchema): void
	{
		const requirements: IUnlockRequirement[] = [];
		const processedRecipes = new Set<string>();
		const processedBuildings = new Set<string>();
		const allSchematics = data.getAllSchematics();

		// 1. 从 graph 中收集所有实际使用的 recipe，查找它们的解锁需求
		for (const node of this.graph.nodes) {
			if (node instanceof RecipeNode) {
				const recipe = node.recipeData.recipe;
				if (processedRecipes.has(recipe.className)) {
					continue;
				}
				processedRecipes.add(recipe.className);

				// 查找解锁该 recipe 的 schematic
				for (const schematicKey in allSchematics) {
					const schematic = allSchematics[schematicKey];
					if (schematic.unlock && schematic.unlock.recipes && schematic.unlock.recipes.indexOf(recipe.className) !== -1) {
						// 找到该 recipe 生产的物品（用于显示）
						const productItem = recipe.products && recipe.products.length > 0 ? recipe.products[0].item : null;
						requirements.push({
							type: 'recipe',
							item: productItem || undefined,
							schematic: schematic
						});
						break;
				}
			}
		}
		}

		// 2. 收集 Buildings 的解锁需求
		for (const buildingClassName in this.details.buildings.buildings) {
			if (processedBuildings.has(buildingClassName)) {
				continue;
			}
			processedBuildings.add(buildingClassName);

			const building = schema.buildings[buildingClassName];
			if (!building) {
				continue;
			}

			// 查找建筑的公司解锁需求
			const corporationUnlocks = data.getCorporationUnlocksForBuilding(buildingClassName);
			if (corporationUnlocks && corporationUnlocks.length > 0) {
				console.log('[ProductionResult] 找到建筑的公司解锁需求:', {
					building: buildingClassName,
					corporationUnlocks: corporationUnlocks,
					firstCorp: corporationUnlocks[0]?.corporation,
					firstCorpUnlock: corporationUnlocks[0],
					hasCorporation: !!corporationUnlocks[0]?.corporation,
					corporationSlug: corporationUnlocks[0]?.corporation?.slug,
					corporationIcon: corporationUnlocks[0]?.corporation?.icon,
					corporationName: corporationUnlocks[0]?.corporation?.name
				});
				requirements.push({
					type: 'building',
					building: buildingClassName,
					corporationUnlocks: corporationUnlocks
				});
			}
		}

		// 去重：如果同一个 schematic 或 building 已经存在，不重复添加
		const uniqueRequirements: IUnlockRequirement[] = [];
		const seenKeys = new Set<string>();

		for (const req of requirements) {
			let key: string;
			if (req.type === 'recipe' && req.schematic) {
				key = `recipe:${req.schematic.className}`;
			} else if (req.type === 'building' && req.building) {
				key = `building:${req.building}`;
			} else {
				continue;
			}

			if (!seenKeys.has(key)) {
				seenKeys.add(key);
				uniqueRequirements.push(req);
			}
		}

		// 排序：先按类型排序（recipe 在前，building 在后），然后按名称排序
		uniqueRequirements.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'recipe' ? -1 : 1;
			}
			if (a.type === 'recipe' && b.type === 'recipe') {
				const nameA = a.schematic?.name || '';
				const nameB = b.schematic?.name || '';
				return nameA.localeCompare(nameB);
			}
			if (a.type === 'building' && b.type === 'building') {
				const nameA = schema.buildings[a.building || '']?.name || a.building || '';
				const nameB = schema.buildings[b.building || '']?.name || b.building || '';
				return nameA.localeCompare(nameB);
			}
			return 0;
		});

		this.details.unlockRequirements = uniqueRequirements;
	}

	private static addProduct(products: {[key: string]: number}, product: string, amount: number): void
	{
		if (!(product in products)) {
			products[product] = 0;
		}
		products[product] += amount;
	}

	private static addItem(items: {[key: string]: IItemResultDetails}, node: GraphNode, edge: GraphEdge): void
	{
		const className = edge.itemAmount.item;
		const amount = Numbers.round(edge.itemAmount.amount);

		let outgoing: boolean|null = null;

		if (edge.from !== edge.to) {
			if (edge.from === node) {
				outgoing = true;
			} else if (edge.to === node) {
				outgoing = false;
			}
		}

		if (!(className in items)) {
			items[className] = {
				consumed: 0,
				consumers: {},
				produced: 0,
				producers: {},
				diff: 0,
			};
		}

		if (outgoing === true) {
			if (edge.to instanceof RecipeNode) {
				ProductionResult.addRecipeAmount(items[className].consumers, edge.to.recipeData.recipe.className, amount);
				items[className].consumed += amount;
			}
		} else if (outgoing === false) {
			if (edge.from instanceof RecipeNode) {
				ProductionResult.addRecipeAmount(items[className].producers, edge.from.recipeData.recipe.className, amount);
				items[className].produced += amount;
			} else if (edge.from instanceof MinerNode) {
				ProductionResult.addRecipeAmount(items[className].producers, edge.from.itemAmount.item, amount, 'miner');
				items[className].produced += amount;
			} else if (edge.from instanceof InputNode) {
				ProductionResult.addRecipeAmount(items[className].producers, edge.from.itemAmount.item, amount, 'input');
			}
		} else {
			items[className].produced += amount;
			items[className].consumed += amount;
		}

		items[className].diff = Numbers.round(items[className].produced - items[className].consumed);
	}

	private static addRecipeAmount(data: {[key: string]: IItemBuildingAmountResultDetails}, className: string, amount: number, type: string = 'recipe'): void
	{
		if (!(className in data)) {
			data[className] = {
				type: type,
				itemAmount: 0,
				itemPercentage: 0,
			};
		}
		data[className].itemAmount += amount;
	}

	private static calculateBuildingCost(buildingClass: string, amount: number, schema: IJsonSchema): {[key: string]: number}
	{
		const cost: {[key: string]: number} = {};
		for (const recipeClass in schema.recipes) {
			const recipe = schema.recipes[recipeClass];
			if (recipe.products.length && recipe.products[0].item === buildingClass) {
				for (const ingredient of recipe.ingredients) {
					cost[ingredient.item] = amount * ingredient.amount;
				}
			}
		}
		return cost;
	}

	private static sumBuildingCost(costs: {[key: string]: number}[]): {[key: string]: number}
	{
		const cost: {[key: string]: number} = {};

		for (const i in costs) {
			for (const k in costs[i]) {
				if (!(k in cost)) {
					cost[k] = 0;
				}
				cost[k] += costs[i][k];
			}
		}

		return cost;
	}

}
