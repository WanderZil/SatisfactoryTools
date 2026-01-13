import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';
import {IJsonSchema} from '@src/Schema/IJsonSchema';

/**
 * 给图片添加水印
 * @param imageBuffer 图片 Buffer 或路径
 * @param watermarkText 水印文字
 */
async function addWatermarkToImage(imageBuffer: Buffer | string, watermarkText: string = 'SRCC'): Promise<Buffer> {
	const metadata = await sharp(imageBuffer).metadata();
	const width = metadata.width || 64;
	const height = metadata.height || 64;
	
	// 根据图片尺寸计算水印大小
	const fontSize = Math.max(10, Math.floor(width * 0.2)); // 水印文字大小约为图片宽度的20%
	
	// 创建 SVG 水印（45度倾斜，浅灰色）
	const centerX = width / 2;
	const centerY = height / 2;
	
	const svgWatermark = `
		<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
			<text
				x="${centerX}"
				y="${centerY}"
				font-family="Arial, Helvetica, sans-serif"
				font-size="${fontSize}"
				font-weight="500"
				fill="#C0C0C0"
				fill-opacity="0.6"
				transform="rotate(-45 ${centerX} ${centerY})"
				text-anchor="middle"
				dominant-baseline="middle"
				style="user-select: none;"
			>${watermarkText}</text>
		</svg>
	`;
	
	const watermarkBuffer = Buffer.from(svgWatermark);
	
	// 使用 sharp 合成图片和水印
	return await sharp(imageBuffer)
		.composite([
			{
				input: watermarkBuffer,
				blend: 'over'
			}
		])
		.webp({ quality: 85 })
		.toBuffer();
}
import {IItemSchema} from '@src/Schema/IItemSchema';
import {IAnyRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import {ISchematicSchema} from '@src/Schema/ISchematicSchema';
import {ICorporationSchema, ICorporationLevel, ICorporationReward} from '@src/Schema/ICorporationSchema';
// 简单的 slug 生成函数
function webalize(str: string): string {
	return str.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

// StarRupture 数据结构
interface StarRuptureData {
	items: {[key: string]: any};
	recipes: {[key: string]: any};
	buildings?: {[key: string]: any};
}

// 检查是否为 DataPoint 物品
function isDataPointItem(className: string, name: string): boolean {
	return className === 'I_DataPoint' || 
	       className.toLowerCase().includes('datapoint') ||
	       name.toLowerCase().includes('data point');
}

// 转换物品
function convertItem(srItem: any): IItemSchema {
	// 如果是 DataPoint 物品，使用统一的图标
	const icon = isDataPointItem(srItem.className, srItem.name) 
		? 'T_SR_dataPointsIcon_128x128' 
		: srItem.icon;
	
	// 提取 UIItemType，去掉 "EUIItemType::" 前缀
	let uiItemType: string | undefined = undefined;
	if (srItem.uiItemType) {
		uiItemType = srItem.uiItemType.replace(/^EUIItemType::/, '');
	}
	
	return {
		slug: srItem.slug,
		icon: icon,
		name: srItem.name,
		sinkPoints: 0,
		description: srItem.description || '',
		className: srItem.className,
		stackSize: srItem.maxStack || 100,
		energyValue: 0.0,
		radioactiveDecay: 0.0,
		liquid: false,
		fluidColor: { r: 0, g: 0, b: 0, a: 0 },
		isDataPoint: isDataPointItem(srItem.className, srItem.name), // 标记为 DataPoint 物品
		uiItemType: uiItemType, // 存储 UIItemType（去掉前缀）
	};
}

// 从 Crafting 文件读取配方信息
function parseCraftingRecipe(recipeClassName: string): any {
	const result = parseCraftingFile(recipeClassName);
	// 返回 Properties 部分以保持向后兼容
	return result?.Properties || result;
}

// 转换配方
function convertRecipe(srRecipe: any): IAnyRecipeSchema {
	// 尝试从 Crafting 文件中读取完整信息
	const craftingData = parseCraftingRecipe(srRecipe.className);
	let ingredients: any[] = [];
	let products: any[] = [];
	
	if (craftingData) {
		// 从 NeededResources 读取 ingredients
		if (craftingData.NeededResources) {
			ingredients = craftingData.NeededResources.map((resource: any) => ({
				item: extractItemNameFromItem(resource.Item),
				amount: resource.Count || 1,
			})).filter((ing: any) => ing.item); // 过滤掉无效的
		}
		
		// 从 OutputItem 读取 products
		if (craftingData.OutputItem) {
			const outputItemName = extractItemNameFromItem(craftingData.OutputItem.Item);
			if (outputItemName) {
				products = [{
					item: outputItemName,
					amount: craftingData.OutputItem.Count || 1,
				}];
			}
		}
	}
	
	// 如果没有从 Crafting 文件读取到，使用原始数据
	if (ingredients.length === 0) {
		ingredients = (srRecipe.neededResources || []).map((resource: any) => ({
			item: resource.item,
			amount: resource.count || 1,
		}));
	}
	
	if (products.length === 0) {
		products = [{
			item: srRecipe.outputItem?.item || '',
			amount: srRecipe.outputItem?.count || 1,
		}];
	}

	return {
		slug: srRecipe.slug,
		name: srRecipe.name,
		className: srRecipe.className,
		alternate: false,
		time: srRecipe.buildTime || 1.0,
		inHand: false,
		forBuilding: false,
		inWorkshop: false,
		inMachine: true,
		manualTimeMultiplier: 1.0,
		ingredients,
		products,
		producedIn: srRecipe.producedIn || [],
		isVariablePower: false as const,
	};
}

// 主函数
const starRuptureDataPath = path.join(__dirname, '..', 'data', 'starRuptureData.json');
const outputPath = path.join(__dirname, '..', 'data', 'data.json');

console.log('读取 StarRupture 数据...');
const starRuptureData: StarRuptureData = JSON.parse(
	fs.readFileSync(starRuptureDataPath, 'utf-8')
);

// 从 Crafting JSON 文件中提取信息
function extractItemNameFromPath(pathStr: string): string {
	if (!pathStr) return '';
	
	// 处理类似 "BlueprintGeneratedClass'/Game/Chimera/Items/I_GoethitePowder.I_GoethitePowder_C'" 的路径
	// 提取 I_GoethitePowder
	const classMatch = pathStr.match(/I_(\w+)(?:\.|_C)/);
	if (classMatch) {
		return 'I_' + classMatch[1];
	}
	
	// 处理类似 "/Game/Chimera/Items/I_GoethitePowder.1" 的路径
	const pathMatch = pathStr.match(/\/([^/]+)\.\d+$/);
	if (pathMatch) {
		return pathMatch[1];
	}
	
	// 尝试从 ObjectName 中提取
	const objMatch = pathStr.match(/['"](\w+)_C['"]/);
	if (objMatch) {
		return objMatch[1];
	}
	
	// 如果路径中包含 I_ 开头的类名
	const directMatch = pathStr.match(/(I_\w+)/);
	if (directMatch) {
		return directMatch[1];
	}
	
	return '';
}

// 从 Item 对象中提取类名
function extractItemNameFromItem(item: any): string {
	if (!item) return '';
	
	// 从 ObjectName 中提取，如 "BlueprintGeneratedClass'I_GoethitePowder_C'"
	const objName = item.ObjectName || '';
	const classMatch = objName.match(/I_(\w+)(?:_C|\.)/);
	if (classMatch) {
		return 'I_' + classMatch[1];
	}
	
	// 从 ObjectPath 中提取，如 "/Game/Chimera/Items/I_GoethitePowder.1"
	const objPath = item.ObjectPath || '';
	const pathMatch = objPath.match(/\/([^/]+)\.\d+$/);
	if (pathMatch) {
		return pathMatch[1];
	}
	
	return '';
}

function parseCraftingFile(recipeClassName: string): any {
	const craftingPath = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'Crafting', recipeClassName + '.json');
	if (!fs.existsSync(craftingPath)) {
		return null;
	}
	try {
		const content = fs.readFileSync(craftingPath, 'utf-8');
		const data = JSON.parse(content);
		const recipeObj = data.find((obj: any) => obj.Type === 'CrItemRecipeData' && obj.Properties);
		if (!recipeObj || !recipeObj.Properties) {
			return null;
		}
		// 返回包含 Type 和 Properties 的对象
		return {
			Type: recipeObj.Type, // 提取顶层的 Type
			Properties: recipeObj.Properties
		};
	} catch (error) {
		console.error(`Error parsing crafting file ${craftingPath}:`, error);
		return null;
	}
}

// 转换 Blueprint 物品为 Schematic
function convertBlueprintToSchematic(srItem: any, className: string, craftingData: any): ISchematicSchema {
	// 从物品名称中提取配方名称（去掉 Blueprint 后缀）
	const recipeName = srItem.name.replace(/\s*Blueprint\s*$/i, '').trim();
	const recipeClassName = className.replace(/Blueprint$/i, '').replace(/^I_/, 'CR_');
	
	// 从 Crafting 数据中提取信息
	let unlockRequirements: any[] = [];
	let level = 1;
	let requiredSchematics: string[] = [];
	let corporation: string | undefined = undefined;
	let buildTime: number | undefined = undefined;
	let description: string | undefined = undefined;
	let recipeType: string = 'CrItemRecipeData'; // 默认类型
	
	// 处理新的数据结构（包含 Type 和 Properties）
	const properties = craftingData?.Properties || craftingData;
	
	if (craftingData) {
		// 提取 Type（从顶层）
		if (craftingData.Type) {
			recipeType = craftingData.Type;
		}
		
		// 提取 Level
		level = properties.Level || 1;
		
		// 提取 Corporation
		if (properties.Corporation) {
			corporation = properties.Corporation;
		}
		
		// 提取 BuildTime
		if (properties.BuildTime !== undefined && properties.BuildTime !== null) {
			buildTime = properties.BuildTime;
		}
		
		// 提取 Description (从 DisplayDescription.SourceString)
		if (properties.DisplayDescription && properties.DisplayDescription.SourceString) {
			description = properties.DisplayDescription.SourceString;
		}
		
		// 提取 UnlockRequirements
		if (properties.UnlockRequirements) {
			for (const req of properties.UnlockRequirements) {
				const itemName = extractItemNameFromPath(req.Key || '');
				if (!itemName) continue;
				
				unlockRequirements.push({
					item: itemName,
					amount: req.Value || 1,
				});
				
				// 如果是其他 Blueprint，添加到 requiredSchematics（前置需求）
				if (itemName.includes('Blueprint') && itemName !== className) {
					requiredSchematics.push(itemName);
				}
			}
		}
	}
	
	// 提取 NeededResources 和 OutputItem
	let neededResources: any[] = [];
	let outputItem: any = undefined;
	
	if (properties) {
		// 从 NeededResources 提取
		if (properties.NeededResources) {
			neededResources = properties.NeededResources.map((resource: any) => ({
				item: extractItemNameFromItem(resource.Item),
				amount: resource.Count || 1,
			})).filter((ing: any) => ing.item);
		}
		
		// 从 OutputItem 提取
		if (properties.OutputItem) {
			const outputItemName = extractItemNameFromItem(properties.OutputItem.Item);
			if (outputItemName) {
				outputItem = {
					item: outputItemName,
					amount: properties.OutputItem.Count || 1,
				};
			}
		}
	}
	
	return {
		className: className,
		type: recipeType, // 使用从 Crafting JSON 提取的 Type
		name: srItem.name,
		slug: webalize(srItem.name),
		icon: srItem.icon,
		description: description, // Description
		cost: [], // 保持空数组以兼容
		unlockRequirements: unlockRequirements, // UnlockRequirements 放在这里
		unlock: {
			recipes: [recipeClassName], // 解锁对应的配方
			scannerResources: [],
			inventorySlots: 0,
			giveItems: [],
		},
		requiredSchematics: requiredSchematics,
		tier: 1, // 保持默认值
		level: level, // Level 使用 Level
		time: 0, // Blueprint 不需要时间
		mam: false,
		alternate: false,
		neededResources: neededResources, // NeededResources
		outputItem: outputItem, // OutputItem
		corporation: corporation, // Corporation
		buildTime: buildTime, // BuildTime
	};
}

// 创建新的数据对象，只包含 StarRupture 数据
const newData: IJsonSchema = {
	items: {},
	recipes: {},
	buildings: {},
	schematics: {},
	blueprints: {},
	generators: {},
	resources: {},
	miners: {},
	corporations: {},
};

// 分离 Blueprint 物品和普通物品
const allItemKeys = Object.keys(starRuptureData.items);
const blueprintItems = allItemKeys.filter(key => {
	const item = starRuptureData.items[key];
	return key.includes('Blueprint') &&
		   !key.startsWith('BP_') &&
		   !key.startsWith('GA_') &&
		   item.name &&
		   item.name !== '<MISSING STRING TABLE ENTRY>';
});

const meaningfulItems = allItemKeys.filter(key => {
	const item = starRuptureData.items[key];
	return !key.startsWith('BP_') &&
		   !key.startsWith('GA_') &&
		   key.startsWith('I_') &&
		   !key.includes('Blueprint') &&
		   item.name &&
		   item.name !== '<MISSING STRING TABLE ENTRY>' &&
		   item.description &&
		   item.description !== '<MISSING STRING TABLE ENTRY>';
});

console.log(`\n处理 ${meaningfulItems.length} 个 StarRupture 物品...`);
for (const key of meaningfulItems) {
	const srItem = starRuptureData.items[key];
	const convertedItem = convertItem(srItem);
	newData.items[key] = convertedItem;
}

// 处理配方
const allRecipeKeys = Object.keys(starRuptureData.recipes);
// 定义有效的 _Printed 配方（这些在 ItemPrinter 中使用）
const validPrintedRecipesForRecipe = [
	'CR_BasicBuildingMaterial_ItemPrinter',
	'CR_IntermediateBuildingMaterial_ItemPrinter',
	'CR_HeavyAmmo_ItemPrinter',
	'CR_PistolAmmo_ItemPrinter',
	'CR_StandardAmmo_ItemPrinter',
	'CR_ShotgunAmmo_ItemPrinter',
	'CR_ArmoryToken_ItemPrinter',
	'CR_FEAccessItem_ItemPrinter',
	'CR_QuartzBuildingMaterialItemPrinter',
];
const meaningfulRecipes = allRecipeKeys.filter(key => {
	const recipe = starRuptureData.recipes[key];
	// 过滤掉测试配方（如 CR_WolframBar_Printed，这些配方没有在任何建筑的配方集合中使用）
	if (key.includes('_Printed') && !validPrintedRecipesForRecipe.includes(key)) {
		return false;
	}
	return recipe.name &&
		   recipe.name !== '<MISSING STRING TABLE ENTRY>' &&
		   recipe.neededResources &&
		   recipe.neededResources.length > 0;
});

console.log(`\n处理 ${meaningfulRecipes.length} 个 StarRupture 配方...`);
for (const key of meaningfulRecipes) {
	const srRecipe = starRuptureData.recipes[key];
	const convertedRecipe = convertRecipe(srRecipe);
	newData.recipes[key] = convertedRecipe;
}

// 处理 Blueprint 物品，转换为 Schematics
console.log(`\n处理 ${blueprintItems.length} 个 StarRupture Blueprint...`);
// 定义有效的 _Printed 配方（这些在 ItemPrinter 中使用）
const validPrintedRecipes = [
	'CR_BasicBuildingMaterial_ItemPrinter',
	'CR_IntermediateBuildingMaterial_ItemPrinter',
	'CR_HeavyAmmo_ItemPrinter',
	'CR_PistolAmmo_ItemPrinter',
	'CR_StandardAmmo_ItemPrinter',
	'CR_ShotgunAmmo_ItemPrinter',
	'CR_ArmoryToken_ItemPrinter',
	'CR_FEAccessItem_ItemPrinter',
	'CR_QuartzBuildingMaterialItemPrinter',
];
for (const key of blueprintItems) {
	const srItem = starRuptureData.items[key];
	const recipeClassName = key.replace(/Blueprint$/i, '').replace(/^I_/, 'CR_');
	// 过滤掉测试配方（如 CR_WolframBar_Printed，这些配方没有在任何建筑的配方集合中使用）
	if (recipeClassName.includes('_Printed') && !validPrintedRecipes.includes(recipeClassName)) {
		continue;
	}
	const craftingData = parseCraftingFile(recipeClassName);
	if (!craftingData) {
		continue; // 如果配方文件不存在，跳过
	}
	const schematic = convertBlueprintToSchematic(srItem, key, craftingData);
	newData.blueprints[key] = schematic;
	newData.schematics[key] = schematic; // 同时添加到 schematics 以保持兼容
	
	if (blueprintItems.indexOf(key) < 5) {
		console.log(`  - ${srItem.name} (tier: ${schematic.tier}, cost: ${schematic.cost.length} items, required: ${schematic.requiredSchematics.length} blueprints)`);
	}
}

// 处理建筑数据 - 从 Buildings 目录读取所有 BD_*.json 文件
console.log(`\n处理 StarRupture 建筑...`);
const buildingsDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'Buildings');
const buildingFiles: string[] = [];

// 递归查找所有 BD_*.json 文件（排除 Variant 目录）
function findBuildingFiles(dir: string): void {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// 跳过 Variant 目录
			if (entry.name !== 'Variant' && !entry.name.startsWith('.')) {
				findBuildingFiles(fullPath);
			}
		} else if (entry.isFile() && entry.name.startsWith('BD_') && entry.name.endsWith('.json')) {
			buildingFiles.push(fullPath);
		}
	}
}

findBuildingFiles(buildingsDir);
console.log(`找到 ${buildingFiles.length} 个建筑文件`);

// 从 DA 文件中提取元数据
function parseBuildingDA(buildingName: string): any {
	const dirName = buildingName.replace('BD_', '');
	const daPath = path.join(buildingsDir, dirName, 'DA_' + dirName + '.json');
	if (!fs.existsSync(daPath)) {
		// 尝试在子目录中查找（如 Interiors/, ForgottenEngine/ 等）
		const possiblePaths = [
			path.join(buildingsDir, dirName.replace('Tier2', ''), 'DA_' + dirName.replace('Tier2', '') + '.json'),
			// 尝试在 Interiors 子目录中查找
			path.join(buildingsDir, 'Interiors', dirName, 'DA_' + dirName + '.json'),
			// 尝试在 ForgottenEngine 子目录中查找
			path.join(buildingsDir, 'ForgottenEngine', 'Interior', dirName, 'DA_' + dirName + '.json'),
			path.join(buildingsDir, 'ForgottenEngine', 'Interior', dirName, 'DA_ForgottenMachine_01_' + dirName + '.json'),
		];
		for (const possiblePath of possiblePaths) {
			if (fs.existsSync(possiblePath)) {
				return parseDAFile(possiblePath);
			}
		}
		return null;
	}
	return parseDAFile(daPath);
}

// 从 RecipeCollection 的 ObjectName 中提取 CRC_ 文件名
function extractCRCName(recipeCollection: any): string | null {
	if (!recipeCollection || !recipeCollection.ObjectName) {
		return null;
	}
	// 格式：CrItemRecipeCollection'CRC_Factory' -> CRC_Factory
	const match = recipeCollection.ObjectName.match(/CRC_\w+/);
	return match ? match[0] : null;
}

// 从 Recipe 的 ObjectName 中提取 CR_ 类名
function extractRecipeClassName(recipeObj: any): string | null {
	if (!recipeObj || !recipeObj.ObjectName) {
		return null;
	}
	// 格式：CrItemRecipeData'CR_Accumulator' 或 CrItemRecipeData'CR_Anti-RadiationCovers'
	// 需要提取单引号之间的内容，然后提取 CR_ 开头的部分
	const objName = recipeObj.ObjectName;
	// 先提取单引号之间的内容
	const quotedMatch = objName.match(/'([^']+)'/);
	if (!quotedMatch) {
		return null;
	}
	const quotedContent = quotedMatch[1];
	// 提取 CR_ 开头的类名（可能包含连字符）
	const classMatch = quotedContent.match(/CR_[A-Za-z0-9\-]+/);
	return classMatch ? classMatch[0] : null;
}

// 解析 CRC_ 文件以获取 recipe 列表
function parseCRCFile(crcName: string): string[] {
	const craftingDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'Crafting');
	const crcPath = path.join(craftingDir, crcName + '.json');
	
	if (!fs.existsSync(crcPath)) {
		return [];
	}
	
	try {
		const content = fs.readFileSync(crcPath, 'utf-8');
		const data = JSON.parse(content);
		
		// 查找 CrItemRecipeCollection 类型的对象
		const collection = data.find((obj: any) => obj.Type === 'CrItemRecipeCollection');
		if (!collection || !collection.Properties || !collection.Properties.Recipes) {
			return [];
		}
		
		// 提取所有 recipe 类名
		const recipeClassNames: string[] = [];
		for (const recipeObj of collection.Properties.Recipes) {
			const className = extractRecipeClassName(recipeObj);
			if (className) {
				recipeClassNames.push(className);
			}
		}
		
		return recipeClassNames;
	} catch (error) {
		console.error(`Error parsing CRC file ${crcPath}:`, error);
		return [];
	}
}

function parseDAFile(daPath: string): any {
	try {
		const content = fs.readFileSync(daPath, 'utf-8');
		const data = JSON.parse(content);
		
		// 查找 CrBuildingCraftingTrait 以判断是否为生产型建筑
		const craftingTrait = data.find((obj: any) => obj.Type === 'CrBuildingCraftingTrait');
		const isCraftingBuilding = !!craftingTrait;
		const craftingLoopDuration = craftingTrait?.Properties?.CraftingParameters?.CraftingLoopDuration;
		const recipeCollection = craftingTrait?.Properties?.CraftingParameters?.RecipeCollection;
		
		// 从 RecipeCollection 提取 CRC 文件名并解析 recipe 列表
		let availableRecipes: string[] = [];
		if (recipeCollection) {
			const crcName = extractCRCName(recipeCollection);
			if (crcName) {
				availableRecipes = parseCRCFile(crcName);
			}
		}
		
		// 查找 CrElectricityTrait 以获取电力消耗
		const electricityTrait = data.find((obj: any) => obj.Type === 'CrElectricityTrait');
		const powerConsumption = electricityTrait?.Properties?.Parameters?.ElectricityValue;
		
		// 查找 CrBuildingLogisticsTrait 以获取物流信息
		const logisticsTrait = data.find((obj: any) => obj.Type === 'CrBuildingLogisticsTrait');
		const logisticsType = logisticsTrait?.Properties?.Parameters?.LogisticsType;
		const inventoryColumns = logisticsTrait?.Properties?.Parameters?.InventoryColumns;
		const inventoryRows = logisticsTrait?.Properties?.Parameters?.InventoryRows;
		const inputInventoryColumns = logisticsTrait?.Properties?.Parameters?.InputInventoryColumns;
		const inputInventoryRows = logisticsTrait?.Properties?.Parameters?.InputInventoryRows;
		const hasInputStorage = logisticsTrait?.Properties?.Parameters?.bHasInputStorage;
		
		return {
			isCraftingBuilding: isCraftingBuilding,
			craftingLoopDuration: craftingLoopDuration,
			recipeCollection: recipeCollection,
			availableRecipes: availableRecipes, // 从 CRC 文件提取的 recipe 列表
			manufacturingSpeed: craftingLoopDuration ? 1.0 / craftingLoopDuration : undefined,
			powerConsumption: powerConsumption,
			logisticsType: logisticsType,
			inventoryColumns: inventoryColumns,
			inventoryRows: inventoryRows,
			inputInventoryColumns: inputInventoryColumns,
			inputInventoryRows: inputInventoryRows,
			hasInputStorage: hasInputStorage,
		};
	} catch (error) {
		console.error(`Error parsing DA file ${daPath}:`, error);
		return null;
	}
}

// 从 BP 文件中提取 CraftingSettings
function parseBuildingBP(buildingName: string): any {
	const dirName = buildingName.replace('BD_', '');
	const bpPath = path.join(buildingsDir, dirName, 'BP_' + dirName + '.json');
	if (!fs.existsSync(bpPath)) {
		// 尝试在子目录中查找
		const possiblePaths = [
			path.join(buildingsDir, dirName.replace('Tier2', ''), 'BP_' + dirName.replace('Tier2', '') + '.json'),
		];
		for (const possiblePath of possiblePaths) {
			if (fs.existsSync(possiblePath)) {
				return parseBPFile(possiblePath);
			}
		}
		return null;
	}
	return parseBPFile(bpPath);
}

function parseBPFile(bpPath: string): any {
	try {
		const content = fs.readFileSync(bpPath, 'utf-8');
		const data = JSON.parse(content);
		
		// 查找包含 CraftingSettings 的对象
		let craftingSpeed: number | undefined = undefined;
		let requestMultiplier: number | undefined = undefined;
		let numOfBuildingStages: number | undefined = undefined;
		
		// 在数据中查找 Properties 包含 CraftingSettings 的对象
		for (const obj of data) {
			if (obj.Properties) {
				if (obj.Properties.CraftingSettings?.CraftingSpeed !== undefined) {
					craftingSpeed = obj.Properties.CraftingSettings.CraftingSpeed;
				}
				if (obj.Properties.RequestMultiplier !== undefined) {
					requestMultiplier = obj.Properties.RequestMultiplier;
				}
				if (obj.Properties.NumOfBuildingStages !== undefined) {
					numOfBuildingStages = obj.Properties.NumOfBuildingStages;
				}
			}
		}
		
		return {
			craftingSpeed: craftingSpeed,
			requestMultiplier: requestMultiplier,
			numOfBuildingStages: numOfBuildingStages,
		};
	} catch (error) {
		console.error(`Error parsing BP file ${bpPath}:`, error);
		return null;
	}
}

// 转换建筑数据
function convertBuilding(bdData: any, daData: any, bpData: any): IBuildingSchema | null {
	if (!bdData || !bdData.Properties) {
		return null;
	}
	
	const props = bdData.Properties;
	const buildingName = props.BuildingName?.SourceString || props.BuildingName?.LocalizedString || bdData.Name || '';
	const buildingDesc = props.BuildingDescription?.SourceString || props.BuildingDescription?.LocalizedString || '';
	const className = bdData.Name || '';
	
	// 过滤掉测试建筑（UIType 为 "Test" 的建筑）
	// 但是保留 Factory 相关建筑，因为它们可能包含重要的生产配方
	const uiType = props.UIType || '';
	// 检查建筑类名或名称是否包含 Factory
	const isFactoryBuilding = className.toLowerCase().includes('factory') || buildingName.toLowerCase().includes('factory') || buildingName.toLowerCase().includes('constructorizer');
	if (uiType.includes('Test') && !isFactoryBuilding) {
		return null;
	}
	
	// 过滤掉建筑变体（NonDeconstructible, StartingHUB, Starting, FE_, _Lander, Stability 等），只保留主要建筑
	// 这些变体通常只是游戏内部使用的特殊版本，不应该在网站上显示
	if (className.includes('_NonDeconstructible') || 
	    className.includes('_StartingHUB') ||
	    className.includes('_Starting') ||
	    className.includes('_FE_') ||
	    className.includes('_Lander') ||
	    className.includes('Stability') ||
	    className.includes('_Left') ||
	    className.includes('_Right') ||
	    className.includes('_Middle') ||
	    className.includes('_Single') ||
	    className.includes('_Flat')) {
		return null;
	}
	
	// 提取图标名称
	let icon: string | undefined = undefined;
	let iconPath: string | undefined = undefined;
	if (props.Icon?.ResourceObject?.ObjectName) {
		const iconName = props.Icon.ResourceObject.ObjectName;
		// 提取类似 "Texture2D'T_Crafter_Icon'" 中的 "T_Crafter_Icon"
		const iconMatch = iconName.match(/Texture2D'([^']+)'/);
		if (iconMatch) {
			icon = iconMatch[1];
		}
	}
	
	// 如果 ObjectPath 存在，尝试从中提取路径信息
	if (props.Icon?.ResourceObject?.ObjectPath) {
		const objectPath = props.Icon.ResourceObject.ObjectPath;
		// 提取路径，如 "/Game/Chimera/Buildings/DroneConnections/DroneRail/Icons/T_DroneRailT1_Icon.0"
		// 转换为相对路径：Buildings/DroneConnections/DroneRail/Icons/T_DroneRailT1_Icon
		const pathMatch = objectPath.match(/\/Game\/Chimera\/Buildings\/(.+?)\/([^\/]+)\.\d+$/);
		if (pathMatch) {
			const dirPath = pathMatch[1];
			const fileName = pathMatch[2];
			// 构建可能的文件路径
			const possibleIconPath = path.join(buildingsDir, dirPath, fileName);
			iconPath = possibleIconPath;
		}
	}
	
	// 确定建筑类型和类别
	const buildingType = props.Type || '';
	const categories: string[] = [];
	
	// 提取Type中的类型名称（如 "ECrBuildingType::Crafting" -> "Crafting"）
	let buildingTypeName: string | undefined = undefined;
	if (buildingType) {
		const typeMatch = buildingType.match(/::(\w+)$/);
		if (typeMatch) {
			buildingTypeName = typeMatch[1];
		}
	}
	
	// 优先根据 BD 文件中的 Type 判断建筑类型
	// 如果 Type 是 Extraction，则不是生产型建筑（即使有 CrBuildingCraftingTrait）
	if (buildingType.includes('Extraction')) {
		categories.push('SC_Miners_C');
	} else if (buildingType.includes('Power')) {
		categories.push('SC_Generators_C');
	} else if (buildingType.includes('Crafting') || daData?.isCraftingBuilding) {
		// 只有当 Type 是 Crafting 或者有 CrBuildingCraftingTrait 时才认为是生产型建筑
		categories.push('SC_Manufacturers_C');
	}
	
	// 提取元数据
	const metadata: any = {};
	
	// 计算制造速度：优先使用 BP 中的 CraftingSpeed，否则使用 DA 中的 CraftingLoopDuration 计算
	let manufacturingSpeed: number | undefined = undefined;
	if (bpData?.craftingSpeed !== undefined) {
		// 如果 BP 中有 CraftingSpeed，使用它
		manufacturingSpeed = bpData.craftingSpeed;
	} else if (daData?.craftingLoopDuration !== undefined) {
		// 否则使用 CraftingLoopDuration 计算：manufacturingSpeed = 1.0 / CraftingLoopDuration
		manufacturingSpeed = 1.0 / daData.craftingLoopDuration;
	}
	
	if (manufacturingSpeed !== undefined) {
		metadata.manufacturingSpeed = manufacturingSpeed;
	}
	
	// 提取电力消耗
	if (daData?.powerConsumption !== undefined) {
		metadata.powerConsumption = daData.powerConsumption;
		metadata.powerConsumptionExponent = 1.6; // 默认值
	}
	
	// 提取库存大小（如果有）
	if (daData?.inventoryColumns !== undefined && daData?.inventoryRows !== undefined) {
		metadata.inventorySize = daData.inventoryColumns * daData.inventoryRows;
	}
	if (daData?.inputInventoryColumns !== undefined && daData?.inputInventoryRows !== undefined) {
		metadata.inputInventorySize = daData.inputInventoryColumns * daData.inputInventoryRows;
	}
	
	// 保存所有从 DA、BP 文件中提取的原始数据（用于在网站上显示）
	metadata._daData = {
		isCraftingBuilding: daData?.isCraftingBuilding, // 保存是否为生产型建筑的标识
		craftingLoopDuration: daData?.craftingLoopDuration,
		recipeCollection: daData?.recipeCollection?.ObjectName,
		availableRecipes: daData?.availableRecipes || [], // 从 CRC 文件提取的 recipe 列表
		logisticsType: daData?.logisticsType,
		hasInputStorage: daData?.hasInputStorage,
	};
	metadata._bpData = {
		craftingSpeed: bpData?.craftingSpeed,
		requestMultiplier: bpData?.requestMultiplier,
		numOfBuildingStages: bpData?.numOfBuildingStages,
	};
	
	// 如果没有制造速度但是生产型建筑，设置默认值
	const isCraftingBuilding = buildingType.includes('Crafting') || daData?.isCraftingBuilding;
	if (isCraftingBuilding && !metadata.manufacturingSpeed) {
		metadata.manufacturingSpeed = 1.0; // 默认值
	}
	
	// 提取尺寸信息（从 TilesData 中，如果有）
	let size = { width: 0, length: 0, height: 0 };
	if (props.TilesData?.ObjectName) {
		// 尝试从 TilesData 名称中提取尺寸，如 "BD_Modular_Tiles6x3" -> 6x3
		const tilesMatch = props.TilesData.ObjectName.match(/Tiles(\d+)x(\d+)/);
		if (tilesMatch) {
			size.width = parseInt(tilesMatch[1], 10) * 100; // 转换为厘米（假设每个单位是 100cm）
			size.length = parseInt(tilesMatch[2], 10) * 100;
		}
	}
	
	// 保存 BD 文件中的其他属性
	const bdData_extended: any = {
		buildingType: props.Type, // 保存 Type 字段，用于判断是否为 Crafting 类型
		corporation: props.UIBuildingCorporation,
		minPlacementDistance: props.MinPlacementDistance,
		maxPlacementDistance: props.MaxPlacementDistance,
		droneMaxPlacementDistance: props.DroneMaxPlacementDistance,
		stabilityCost: props.StabilityCost,
		resourceRequirements: props.ResourceRequirements?.Requirements?.map((req: any) => ({
			item: extractItemNameFromItem(req.Item),
			quantity: req.Quantity,
		})) || [],
	};
	
	const result: any = {
		slug: webalize(buildingName),
		icon: icon,
		name: buildingName,
		description: buildingDesc,
		className: className,
		categories: categories,
		buildMenuPriority: props.UISortPriority || 0,
		metadata: metadata,
		size: size,
		buildingType: buildingTypeName, // 保存建筑类型名称（如 "Crafting", "Transport" 等）
		_bdData: bdData_extended, // 保存 BD 文件的扩展数据
	};
	
	// 如果从 ObjectPath 提取了图标路径，保存它（用于后续查找）
	if (iconPath) {
		result._iconPath = iconPath;
	}
	
	return result;
}

// 处理每个建筑文件
let processedBuildings = 0;
for (const buildingFile of buildingFiles) {
	try {
		const content = fs.readFileSync(buildingFile, 'utf-8');
		const data = JSON.parse(content);
		
		// 查找 CrBuildingData 类型的对象
		const bdData = data.find((obj: any) => obj.Type === 'CrBuildingData');
		if (!bdData) {
			continue;
		}
		
		const className = bdData.Name;
		if (!className) {
			continue;
		}
		
		// 解析对应的 DA 文件
		const daData = parseBuildingDA(className);
		
		// 解析对应的 BP 文件（仅对生产型建筑）
		let bpData: any = null;
		if (daData?.isCraftingBuilding) {
			bpData = parseBuildingBP(className);
		}
		
		// 转换建筑数据
		const building = convertBuilding(bdData, daData, bpData);
		if (building) {
			newData.buildings[className] = building;
			processedBuildings++;
		}
	} catch (error) {
		console.error(`Error processing building file ${buildingFile}:`, error);
	}
}

console.log(`成功处理 ${processedBuildings} 个建筑`);

// 确保所有建筑的 slug 唯一性
console.log(`\n检查并修复重复的 slug...`);
const slugMap: {[slug: string]: string[]} = {};
for (const className in newData.buildings) {
	const building = newData.buildings[className];
	const slug = building.slug;
	if (!slugMap[slug]) {
		slugMap[slug] = [];
	}
	slugMap[slug].push(className);
}

// 修复重复的 slug
let fixedSlugs = 0;
for (const slug in slugMap) {
	if (slugMap[slug].length > 1) {
		// 有重复的 slug，为除第一个外的其他建筑生成唯一 slug
		const classes = slugMap[slug];
		for (let i = 1; i < classes.length; i++) {
			const className = classes[i];
			const building = newData.buildings[className];
			// 使用 className 生成唯一的 slug
			const uniqueSlug = webalize(building.name + '-' + className.replace('BD_', ''));
			building.slug = uniqueSlug;
			fixedSlugs++;
			console.log(`  修复重复 slug: ${className} (${building.name}) -> ${uniqueSlug}`);
		}
	}
}
if (fixedSlugs > 0) {
	console.log(`修复了 ${fixedSlugs} 个重复的 slug`);
}

// 后处理：过滤重复名称的建筑，保留属性更完整的版本
console.log(`\n后处理：过滤重复名称的建筑...`);
const buildingNames: {[name: string]: Array<{className: string, building: IBuildingSchema}>} = {};
for (const className in newData.buildings) {
	const building = newData.buildings[className];
	const name = building.name;
	if (!buildingNames[name]) {
		buildingNames[name] = [];
	}
	buildingNames[name].push({className, building});
}

let removedDuplicates = 0;
for (const name in buildingNames) {
	if (buildingNames[name].length > 1) {
		// 有重复名称，选择属性最完整的版本
		const buildings = buildingNames[name];
		
		// 计算每个建筑的"完整度"分数
		const scores = buildings.map(({className, building}) => {
			let score = 0;
			// 有 availableRecipes 的 +10 分
			if (building.metadata?._daData?.availableRecipes?.length > 0) {
				score += 10 + building.metadata._daData.availableRecipes.length;
			}
			// 有 categories 的 +5 分
			if (building.categories && building.categories.length > 0) {
				score += 5;
			}
			// 有描述且长度 > 50 的 +3 分
			if (building.description && building.description.length > 50) {
				score += 3;
			}
			// 有 buildingType 的 +2 分
			if (building.buildingType) {
				score += 2;
			}
			// 有 metadata 的 +1 分
			if (building.metadata) {
				score += 1;
			}
			return {className, building, score};
		});
		
		// 按分数排序，保留分数最高的
		scores.sort((a, b) => b.score - a.score);
		const keep = scores[0];
		
		// 删除其他版本
		for (let i = 1; i < scores.length; i++) {
			delete newData.buildings[scores[i].className];
			removedDuplicates++;
			console.log(`  删除重复建筑: ${scores[i].className} (${name}), 保留: ${keep.className} (分数: ${keep.score} vs ${scores[i].score})`);
		}
	}
}
if (removedDuplicates > 0) {
	console.log(`删除了 ${removedDuplicates} 个重复建筑`);
}

// 后处理：为 producedIn 为空的配方从建筑的 availableRecipes 反向填充
console.log(`\n后处理：为 producedIn 为空的配方填充生产建筑...`);
let fixedProducedIn = 0;
for (const recipeKey in newData.recipes) {
	const recipe = newData.recipes[recipeKey];
	if (!recipe.producedIn || recipe.producedIn.length === 0) {
		// 遍历所有建筑，查找哪个建筑的 availableRecipes 包含该配方
		for (const buildingKey in newData.buildings) {
			const building = newData.buildings[buildingKey];
			if (building.metadata && building.metadata._daData && building.metadata._daData.availableRecipes) {
				const availableRecipes = building.metadata._daData.availableRecipes;
				if (availableRecipes.includes(recipe.className)) {
					recipe.producedIn = [building.className];
					fixedProducedIn++;
					console.log(`  修复配方 ${recipe.className} (${recipe.name}) -> ${building.className} (${building.name})`);
					break;
				}
			}
		}
	}
}
if (fixedProducedIn > 0) {
	console.log(`修复了 ${fixedProducedIn} 个配方的 producedIn`);
}

// 复制物品图标
console.log(`\n复制物品图标...`);
const itemIconsDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'UI', 'ItemIcons');
const wwwItemIconsDir = path.join(__dirname, '..', 'www', 'assets', 'images', 'items');
if (!fs.existsSync(wwwItemIconsDir)) {
	fs.mkdirSync(wwwItemIconsDir, { recursive: true });
}

let copiedItemIcons = 0;

// 使用异步函数处理物品图标复制（支持 PNG 转 WebP）
(async () => {
	for (const className in newData.items) {
		const item = newData.items[className];
		if (item.icon) {
			const iconName = item.icon;
			// 尝试多个可能的路径
			const possiblePaths = [
				path.join(itemIconsDir, iconName + '.png'),
				path.join(itemIconsDir, iconName.replace('T_', '') + '.png'),
				path.join(itemIconsDir, 'RecipeItemBlueprints', iconName + '.png'),
				path.join(itemIconsDir, 'RecipeItemBlueprints', iconName.replace('T_', '') + '.png'),
			];
			
			for (const iconPath of possiblePaths) {
				if (fs.existsSync(iconPath)) {
					// 转换为 WebP 并添加水印（SEO 友好）
					try {
						const destPath64 = path.join(wwwItemIconsDir, iconName + '_64.webp');
						const destPath256 = path.join(wwwItemIconsDir, iconName + '_256.webp');
						
						// 使用 sharp 转换为 WebP（64 尺寸）并添加水印
						const resized64 = await sharp(iconPath)
							.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
							.toBuffer();
						const watermarked64 = await addWatermarkToImage(resized64, 'SRCC');
						fs.writeFileSync(destPath64, watermarked64);
						
						// 使用 sharp 转换为 WebP（256 尺寸）并添加水印
						const resized256 = await sharp(iconPath)
							.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
							.toBuffer();
						const watermarked256 = await addWatermarkToImage(resized256, 'SRCC');
						fs.writeFileSync(destPath256, watermarked256);
						
						copiedItemIcons++;
						break;
					} catch (error) {
						console.error(`  转换物品图标失败: ${iconName} (${className}):`, error);
						break;
					}
				}
			}
		}
	}
	
	console.log(`复制了 ${copiedItemIcons} 个物品图标`);
})();

// 复制建筑图标
console.log(`\n复制建筑图标...`);
const buildingIconsDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'UI', 'Buildings', 'Icons');
const wwwBuildingIconsDir = path.join(__dirname, '..', 'www', 'assets', 'images', 'items');
// itemIconsDir 已在上面声明，直接使用
if (!fs.existsSync(wwwBuildingIconsDir)) {
	fs.mkdirSync(wwwBuildingIconsDir, { recursive: true });
}

let copiedBuildingIcons = 0;
let missingBuildingIcons: string[] = [];

// 使用异步函数处理图标复制（支持 HDR 转换）
(async () => {
	for (const className in newData.buildings) {
	const building = newData.buildings[className];
	if (building.icon) {
		// 查找图标文件
		const iconName = building.icon;
		
		// 构建可能的路径列表
		const possiblePaths: string[] = [];
		
		// 如果建筑有 _iconPath（从 ObjectPath 提取），优先使用
		if ((building as any)._iconPath) {
			const iconPath = (building as any)._iconPath;
			possiblePaths.push(
				iconPath + '.png',
				iconPath + '.hdr',
			);
		}
		
		// 标准图标目录
		possiblePaths.push(
			path.join(buildingIconsDir, iconName + '.png'),
			path.join(buildingIconsDir, iconName.replace('T_', '') + '.png'),
			path.join(itemIconsDir, iconName + '.png'),
			path.join(itemIconsDir, iconName.replace('T_', '') + '.png'),
		);
		
		// 在建筑目录中查找图标（根据 className 推断目录名）
		const buildingDirName = className.replace('BD_', '');
		const buildingDir = path.join(buildingsDir, buildingDirName);
		if (fs.existsSync(buildingDir)) {
			possiblePaths.push(
				path.join(buildingDir, iconName + '.png'),
				path.join(buildingDir, iconName + '.hdr'),
				path.join(buildingDir, iconName.replace('T_', '') + '.png'),
				path.join(buildingDir, iconName.replace('T_', '') + '.hdr'),
			);
		}
		
		// 也在可能的子目录中查找（如 DroneConnections/DroneJunction/Icons）
		// 处理复杂的目录结构，如 BD_DroneJunction_4 -> DroneConnections/DroneJunction/Icons
		const possibleSubDirs: string[] = [
			path.join(buildingsDir, buildingDirName, 'Icons'),
			path.join(buildingsDir, buildingDirName.replace('_', '/'), 'Icons'),
		];
		
		// 对于 Drone 相关建筑，尝试在 DroneConnections 目录中查找
		if (buildingDirName.includes('Drone')) {
			// BD_DroneJunction_4 -> DroneConnections/DroneJunction/Icons
			// BD_DroneRailT1 -> DroneConnections/DroneRail/Icons
			const baseName = buildingDirName.replace(/_\d+$/, '').replace(/_\d+x\d+$/, '').replace(/T\d+$/, '');
			possibleSubDirs.push(
				path.join(buildingsDir, 'DroneConnections', baseName, 'Icons'),
				path.join(buildingsDir, 'DroneConnections', baseName.replace('Drone', ''), 'Icons'),
			);
			// 对于 Rail，尝试 DroneRail/Icons
			if (buildingDirName.includes('Rail')) {
				possibleSubDirs.push(
					path.join(buildingsDir, 'DroneConnections', 'DroneRail', 'Icons'),
				);
			}
		}
		
		for (const subDir of possibleSubDirs) {
			if (fs.existsSync(subDir)) {
				possiblePaths.push(
					path.join(subDir, iconName + '.png'),
					path.join(subDir, iconName.replace('T_', '') + '.png'),
				);
			}
		}
		
		// 递归搜索整个 Buildings 目录
		const findIconInDir = (dir: string, iconName: string, depth: number = 0): string | null => {
			if (depth > 3) return null; // 限制搜索深度
			if (!fs.existsSync(dir)) return null;
			
			const files = fs.readdirSync(dir);
			for (const file of files) {
				const fullPath = path.join(dir, file);
				const stat = fs.statSync(fullPath);
				
				if (stat.isFile()) {
					const baseName = path.basename(file, path.extname(file));
					if (baseName === iconName || baseName === iconName.replace('T_', '')) {
						const ext = path.extname(file).toLowerCase();
						if (ext === '.png' || ext === '.hdr') {
							return fullPath;
						}
					}
				} else if (stat.isDirectory() && depth < 2) {
					const found = findIconInDir(fullPath, iconName, depth + 1);
					if (found) return found;
				}
			}
			return null;
		};
		
		// 如果标准路径都没找到，尝试递归搜索
		let foundPath: string | null = null;
		for (const iconPath of possiblePaths) {
			if (fs.existsSync(iconPath)) {
				foundPath = iconPath;
				break;
			}
		}
		
		// 如果还没找到，尝试递归搜索（优先搜索 Icons 子目录）
		if (!foundPath) {
			// 先搜索所有 Icons 子目录
			const iconsDirs: string[] = [];
			const findIconsDirs = (dir: string, depth: number = 0): void => {
				if (depth > 4) return;
				if (!fs.existsSync(dir)) return;
				const entries = fs.readdirSync(dir, { withFileTypes: true });
				for (const entry of entries) {
					const fullPath = path.join(dir, entry.name);
					if (entry.isDirectory()) {
						if (entry.name.toLowerCase() === 'icons') {
							iconsDirs.push(fullPath);
						} else {
							findIconsDirs(fullPath, depth + 1);
						}
					}
				}
			};
			findIconsDirs(buildingsDir);
			
			// 在所有 Icons 目录中查找
			for (const iconsDir of iconsDirs) {
				const iconPath = path.join(iconsDir, iconName + '.png');
				if (fs.existsSync(iconPath)) {
					foundPath = iconPath;
					break;
				}
			}
			
			// 如果还没找到，进行完整递归搜索
			if (!foundPath) {
				foundPath = findIconInDir(buildingsDir, iconName);
			}
		}
		
		if (foundPath) {
			const isHdr = foundPath.toLowerCase().endsWith('.hdr');
			const isPng = foundPath.toLowerCase().endsWith('.png');
			
			if (isPng) {
				// PNG 文件：转换为 WebP（SEO 友好）
				try {
					const destPath64 = path.join(wwwBuildingIconsDir, iconName + '_64.webp');
					const destPath256 = path.join(wwwBuildingIconsDir, iconName + '_256.webp');
					
					// 使用 sharp 转换为 WebP（64 尺寸）
					await sharp(foundPath)
						.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
						.webp({ quality: 85 })
						.toFile(destPath64);
					
					// 使用 sharp 转换为 WebP（256 尺寸）
					await sharp(foundPath)
						.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
						.webp({ quality: 85 })
						.toFile(destPath256);
					
					copiedBuildingIcons++;
				} catch (error) {
					console.error(`  转换 PNG 失败: ${iconName} (${className}):`, error);
					missingBuildingIcons.push(`${className} (${building.name}): ${iconName} (PNG 转换失败)`);
				}
			} else if (isHdr) {
				// HDR 文件：使用 ImageMagick 转换为 WebP 并添加水印
				try {
					const destPath64 = path.join(wwwBuildingIconsDir, iconName + '_64.webp');
					const destPath256 = path.join(wwwBuildingIconsDir, iconName + '_256.webp');
					
					// 使用 ImageMagick 的 convert 命令转换 HDR 到 PNG
					// 先转换为临时 PNG，然后使用 sharp 转换为 WebP 并添加水印
					const tempPng64 = path.join(wwwBuildingIconsDir, iconName + '_64_temp.png');
					const tempPng256 = path.join(wwwBuildingIconsDir, iconName + '_256_temp.png');
					
					// 使用 ImageMagick 转换 HDR 到 PNG（64 尺寸）
					execSync(`convert "${foundPath}" -resize 64x64 -quality 95 "${tempPng64}"`, { stdio: 'pipe' });
					// 使用 sharp 转换为 WebP 并添加水印
					const resized64 = await sharp(tempPng64).toBuffer();
					const watermarked64 = await addWatermarkToImage(resized64, 'SRCC');
					fs.writeFileSync(destPath64, watermarked64);
					fs.unlinkSync(tempPng64); // 删除临时文件
					
					// 使用 ImageMagick 转换 HDR 到 PNG（256 尺寸）
					execSync(`convert "${foundPath}" -resize 256x256 -quality 95 "${tempPng256}"`, { stdio: 'pipe' });
					// 使用 sharp 转换为 WebP 并添加水印
					const resized256 = await sharp(tempPng256).toBuffer();
					const watermarked256 = await addWatermarkToImage(resized256, 'SRCC');
					fs.writeFileSync(destPath256, watermarked256);
					fs.unlinkSync(tempPng256); // 删除临时文件
					
					copiedBuildingIcons++;
					console.log(`  转换 HDR 图标: ${iconName} (${className})`);
				} catch (error) {
					console.error(`  转换 HDR 失败: ${iconName} (${className}):`, error);
					missingBuildingIcons.push(`${className} (${building.name}): ${iconName} (HDR 转换失败)`);
				}
			} else {
				missingBuildingIcons.push(`${className} (${building.name}): ${iconName} (不支持的文件格式)`);
			}
		} else {
			missingBuildingIcons.push(`${className} (${building.name}): ${iconName}`);
		}
	} else {
		missingBuildingIcons.push(`${className} (${building.name}): 无图标`);
		}
	}
	
	console.log(`复制了 ${copiedBuildingIcons} 个建筑图标`);
	if (missingBuildingIcons.length > 0) {
		console.log(`\n警告: ${missingBuildingIcons.length} 个建筑缺少图标:`);
		missingBuildingIcons.slice(0, 10).forEach(msg => console.log(`  - ${msg}`));
		if (missingBuildingIcons.length > 10) {
			console.log(`  ... 还有 ${missingBuildingIcons.length - 10} 个`);
		}
	}
})();

// 解析 Corporations
console.log(`\n解析 Corporations...`);
const corporationsDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'Corporations');
const corporationFiles = [
	'CD_CleverCorp.json',
	'CD_FE_FinalCorp.json',
	'CD_FutureCorp.json',
	'CD_GriffithsCorp.json',
	'CD_MoonCorp.json',
	'CD_SelenianCorp.json',
	'CD_StartingCorp.json',
];

function extractItemNameFromItemForCorp(itemObj: any): string | undefined {
	if (!itemObj || !itemObj.ObjectName) {
		return undefined;
	}
	// 格式：BlueprintGeneratedClass'I_BasicBuildingMaterial_C' -> I_BasicBuildingMaterial
	const match = itemObj.ObjectName.match(/I_[\w]+/);
	return match ? match[0] : undefined;
}

function extractBuildingNameFromBuildingForCorp(buildingObj: any): string | undefined {
	if (!buildingObj || !buildingObj.ObjectName) {
		return undefined;
	}
	// 格式：CrBuildingData'BD_Crafter' -> BD_Crafter
	const match = buildingObj.ObjectName.match(/BD_[\w]+/);
	return match ? match[0] : undefined;
}

function convertCorporation(corpData: any): ICorporationSchema | null {
	if (!corpData || !corpData.Properties) {
		return null;
	}
	
	const props = corpData.Properties;
	const className = corpData.Name || '';
	const displayText = props.DisplayText?.SourceString || props.DisplayText?.LocalizedString || props.Name || '';
	const description = props.Description?.SourceString || props.Description?.LocalizedString || '';
	
	// 提取图标
	let icon: string | undefined = undefined;
	if (props.Icon?.ResourceObject?.ObjectName) {
		const iconName = props.Icon.ResourceObject.ObjectName;
		const match = iconName.match(/Texture2D'([^']+)'/);
		if (match) {
			icon = match[1];
		}
	}
	
	// 转换 Levels
	const levels: ICorporationLevel[] = [];
	if (props.Levels && Array.isArray(props.Levels)) {
		for (const level of props.Levels) {
			const itemRewards: ICorporationReward[] = [];
			if (level.ItemRewards && Array.isArray(level.ItemRewards)) {
				for (const reward of level.ItemRewards) {
					const itemName = extractItemNameFromItemForCorp(reward.Item);
					if (itemName) {
						itemRewards.push({
							item: itemName,
							amount: reward.Amount || 1,
						});
					}
				}
			}
			
			const buildingRewards: ICorporationReward[] = [];
			// 添加 BuildingRewards
			if (level.BuildingRewards && Array.isArray(level.BuildingRewards)) {
				for (const reward of level.BuildingRewards) {
					const buildingName = extractBuildingNameFromBuildingForCorp(reward);
					if (buildingName) {
						buildingRewards.push({
							building: buildingName,
						});
					}
				}
			}
			// 添加 BuildingsForUI（Level 1 解锁的建筑）
			if (level.BuildingsForUI && Array.isArray(level.BuildingsForUI)) {
				for (const building of level.BuildingsForUI) {
					const buildingName = extractBuildingNameFromBuildingForCorp(building);
					if (buildingName) {
						// 检查是否已存在，避免重复
						const exists = buildingRewards.some(r => r.building === buildingName);
						if (!exists) {
							buildingRewards.push({
								building: buildingName,
							});
						}
					}
				}
			}
			
			const buildingCollectionRewards: ICorporationReward[] = [];
			// 添加 BuildingCollectionRewards
			if (level.BuildingCollectionRewards && Array.isArray(level.BuildingCollectionRewards)) {
				for (const reward of level.BuildingCollectionRewards) {
					if (reward.ObjectName) {
						const match = reward.ObjectName.match(/BuildingCollectionData'([^']+)'/);
						if (match) {
							buildingCollectionRewards.push({
								buildingCollection: match[1],
							});
						}
					}
				}
			}
			// 添加 CollectionsForUI（Level 1 解锁的建筑集合）
			if (level.CollectionsForUI && Array.isArray(level.CollectionsForUI)) {
				for (const collection of level.CollectionsForUI) {
					if (collection.ObjectName) {
						const match = collection.ObjectName.match(/BuildingCollectionData'([^']+)'/);
						if (match) {
							// 检查是否已存在，避免重复
							const exists = buildingCollectionRewards.some(r => r.buildingCollection === match[1]);
							if (!exists) {
								buildingCollectionRewards.push({
									buildingCollection: match[1],
								});
							}
						}
					}
				}
			}
			
			levels.push({
				level: level.Level || 0,
				reputationRequired: level.ReputationRequired || 0,
				itemRewards: itemRewards.length > 0 ? itemRewards : undefined,
				buildingRewards: buildingRewards.length > 0 ? buildingRewards : undefined,
				buildingCollectionRewards: buildingCollectionRewards.length > 0 ? buildingCollectionRewards : undefined,
				featureRewards: level.FeatureRewards && level.FeatureRewards.length > 0 ? level.FeatureRewards : undefined,
				inventorySlotRewards: level.InventorySlotRewards || undefined,
			});
		}
	}
	
	return {
		slug: webalize(displayText),
		icon: icon,
		name: displayText,
		description: description,
		className: className,
		displayText: displayText,
		corporationColor: props.CorporationColor?.Hex,
		corporationIndex: props.CorporationIndex,
		levels: levels.length > 0 ? levels : undefined,
		bHidden: props.bHidden || false,
	};
}

let processedCorporations = 0;
for (const corpFile of corporationFiles) {
	try {
		const filePath = path.join(corporationsDir, corpFile);
		if (!fs.existsSync(filePath)) {
			console.warn(`Corporation 文件不存在: ${filePath}`);
			continue;
		}
		
		const content = fs.readFileSync(filePath, 'utf-8');
		const data = JSON.parse(content);
		
		// 查找 CrCorporationData 类型的对象
		const corpData = data.find((obj: any) => obj.Type === 'CrCorporationData');
		if (!corpData) {
			continue;
		}
		
		const className = corpData.Name;
		if (!className) {
			continue;
		}
		
		const corporation = convertCorporation(corpData);
		if (corporation) {
			newData.corporations![className] = corporation;
			processedCorporations++;
		}
	} catch (error) {
		console.error(`Error processing corporation file ${corpFile}:`, error);
	}
}
console.log(`解析了 ${processedCorporations} 个 Corporations`);

// 复制公司图标
console.log(`\n复制公司图标...`);
const corporationIconsDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'UI', 'CommonAssets', 'Textures', 'Corporations');
const corporationSidebarIconsDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'UI', 'Research', 'Textures');
const wwwCorporationIconsDir = path.join(__dirname, '..', 'www', 'assets', 'images', 'items');
if (!fs.existsSync(wwwCorporationIconsDir)) {
	fs.mkdirSync(wwwCorporationIconsDir, { recursive: true });
}

let copiedCorporationIcons = 0;

// 使用异步函数处理公司图标复制（支持 PNG 转 WebP）
(async () => {
	for (const className in newData.corporations!) {
		const corporation = newData.corporations![className];
		if (corporation.icon) {
			const iconName = corporation.icon;
			// 尝试多个可能的路径
			const possiblePaths = [
				path.join(corporationIconsDir, iconName + '.png'),
				path.join(corporationIconsDir, iconName.replace('SR_', '') + '.png'),
				path.join(corporationSidebarIconsDir, iconName + '.png'),
				path.join(corporationSidebarIconsDir, iconName.replace('SR_', '') + '.png'),
			];
			
			for (const iconPath of possiblePaths) {
				if (fs.existsSync(iconPath)) {
					// 转换为 WebP 并添加水印（SEO 友好）
					try {
						const destPath64 = path.join(wwwCorporationIconsDir, iconName + '_64.webp');
						const destPath256 = path.join(wwwCorporationIconsDir, iconName + '_256.webp');
						
						// 使用 sharp 转换为 WebP（64 尺寸）并添加水印
						const resized64 = await sharp(iconPath)
							.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
							.toBuffer();
						const watermarked64 = await addWatermarkToImage(resized64, 'SRCC');
						fs.writeFileSync(destPath64, watermarked64);
						
						// 使用 sharp 转换为 WebP（256 尺寸）并添加水印
						const resized256 = await sharp(iconPath)
							.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
							.toBuffer();
						const watermarked256 = await addWatermarkToImage(resized256, 'SRCC');
						fs.writeFileSync(destPath256, watermarked256);
						
						copiedCorporationIcons++;
						break;
					} catch (error) {
						console.error(`  转换公司图标失败: ${iconName} (${className}):`, error);
						break;
					}
				}
			}
		}
	}
	
	console.log(`复制了 ${copiedCorporationIcons} 个公司图标`);
})();

// 复制 Schematic (Recipe/Blueprint) 图标
console.log(`\n复制 Schematic 图标...`);
const wwwSchematicIconsDir = path.join(__dirname, '..', 'www', 'assets', 'images', 'items');
if (!fs.existsSync(wwwSchematicIconsDir)) {
	fs.mkdirSync(wwwSchematicIconsDir, { recursive: true });
}

let copiedSchematicIcons = 0;

// 使用异步函数处理 Schematic 图标复制（支持 PNG 转 WebP 并添加水印）
(async () => {
	for (const className in newData.schematics!) {
		const schematic = newData.schematics![className];
		if (schematic.icon) {
			const iconName = schematic.icon;
			// 尝试多个可能的路径（包括 RecipeItemBlueprints 目录）
			const possiblePaths = [
				path.join(itemIconsDir, iconName + '.png'),
				path.join(itemIconsDir, iconName.replace('T_', '') + '.png'),
				path.join(itemIconsDir, 'RecipeItemBlueprints', iconName + '.png'),
				path.join(itemIconsDir, 'RecipeItemBlueprints', iconName.replace('T_', '') + '.png'),
			];
			
			for (const iconPath of possiblePaths) {
				if (fs.existsSync(iconPath)) {
					// 转换为 WebP 并添加水印（SEO 友好）
					try {
						const destPath64 = path.join(wwwSchematicIconsDir, iconName + '_64.webp');
						const destPath256 = path.join(wwwSchematicIconsDir, iconName + '_256.webp');
						
						// 检查是否已存在（避免重复处理）
						if (fs.existsSync(destPath64) && fs.existsSync(destPath256)) {
							// 如果文件已存在且是今天生成的，跳过
							const stat64 = fs.statSync(destPath64);
							const stat256 = fs.statSync(destPath256);
							const today = new Date();
							today.setHours(0, 0, 0, 0);
							if (stat64.mtime >= today && stat256.mtime >= today) {
								copiedSchematicIcons++;
								break;
							}
						}
						
						// 使用 sharp 转换为 WebP（64 尺寸）并添加水印
						const resized64 = await sharp(iconPath)
							.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
							.toBuffer();
						const watermarked64 = await addWatermarkToImage(resized64, 'SRCC');
						fs.writeFileSync(destPath64, watermarked64);
						
						// 使用 sharp 转换为 WebP（256 尺寸）并添加水印
						const resized256 = await sharp(iconPath)
							.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
							.toBuffer();
						const watermarked256 = await addWatermarkToImage(resized256, 'SRCC');
						fs.writeFileSync(destPath256, watermarked256);
						
						copiedSchematicIcons++;
						break;
					} catch (error) {
						console.error(`  转换 Schematic 图标失败: ${iconName} (${className}):`, error);
						break;
					}
				}
			}
		}
	}
	
	console.log(`复制了 ${copiedSchematicIcons} 个 Schematic 图标`);
})();

// 解析导出物品数据表
console.log(`\n解析导出物品数据表...`);
const exporterItemsPath = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera', 'Corporations', 'ExporterItemsDataTable.json');
if (fs.existsSync(exporterItemsPath)) {
	try {
		const exporterContent = fs.readFileSync(exporterItemsPath, 'utf-8');
		const exporterData = JSON.parse(exporterContent);
		
		// 查找 DataTable 对象
		const dataTable = exporterData.find((obj: any) => obj.Type === 'DataTable' && obj.Name === 'ExporterItemsDataTable');
		if (dataTable && dataTable.Rows) {
			// 按物品分组导出信息
			const exportMap: {[itemClassName: string]: any} = {};
			
			for (const rowKey in dataTable.Rows) {
				const row = dataTable.Rows[rowKey];
				if (!row.Item || !row.Item.ObjectName) {
					continue;
				}
				
				// 提取物品类名
				const itemMatch = row.Item.ObjectName.match(/BlueprintGeneratedClass'([^']+)'/);
				if (!itemMatch) {
					continue;
				}
				
				// 去掉 _C 后缀（如果存在）
				let itemClassName = itemMatch[1];
				if (itemClassName.endsWith('_C')) {
					itemClassName = itemClassName.slice(0, -2);
				}
				if (!exportMap[itemClassName]) {
					exportMap[itemClassName] = {
						selenian: [],
						clever: [],
						future: [],
						griffiths: [],
						moon: [],
					};
				}
				
				const exportInfo = {
					level: row.Level || 0,
					buildTime: row.BuildTime || 0,
				};
				
				// 添加各公司的价值
				if (row.SelenianValue && row.SelenianValue > 0) {
					exportMap[itemClassName].selenian.push({
						...exportInfo,
						value: row.SelenianValue,
					});
				}
				if (row.CleverValue && row.CleverValue > 0) {
					exportMap[itemClassName].clever.push({
						...exportInfo,
						value: row.CleverValue,
					});
				}
				if (row.FutureValue && row.FutureValue > 0) {
					exportMap[itemClassName].future.push({
						...exportInfo,
						value: row.FutureValue,
					});
				}
				if (row.GriffithsValue && row.GriffithsValue > 0) {
					exportMap[itemClassName].griffiths.push({
						...exportInfo,
						value: row.GriffithsValue,
					});
				}
				if (row.MoonValue && row.MoonValue > 0) {
					exportMap[itemClassName].moon.push({
						...exportInfo,
						value: row.MoonValue,
					});
				}
			}
			
			// 将导出信息添加到物品数据中
			let exportItemsCount = 0;
			for (const itemClassName in exportMap) {
				if (newData.items[itemClassName]) {
					const exportInfo = exportMap[itemClassName];
					// 只保留有值的公司
					const filteredExport: any = {};
					if (exportInfo.selenian.length > 0) {
						filteredExport.selenian = exportInfo.selenian;
					}
					if (exportInfo.clever.length > 0) {
						filteredExport.clever = exportInfo.clever;
					}
					if (exportInfo.future.length > 0) {
						filteredExport.future = exportInfo.future;
					}
					if (exportInfo.griffiths.length > 0) {
						filteredExport.griffiths = exportInfo.griffiths;
					}
					if (exportInfo.moon.length > 0) {
						filteredExport.moon = exportInfo.moon;
					}
					
					if (Object.keys(filteredExport).length > 0) {
						(newData.items[itemClassName] as any).export = filteredExport;
						exportItemsCount++;
					}
				}
			}
			console.log(`为 ${exportItemsCount} 个物品添加了导出信息`);
		}
	} catch (error) {
		console.error(`Error parsing ExporterItemsDataTable.json:`, error);
	}
} else {
	console.warn(`ExporterItemsDataTable.json 文件不存在: ${exporterItemsPath}`);
}

// 保存结果
console.log(`\n保存新的数据到: ${outputPath}`);
fs.writeFileSync(outputPath, JSON.stringify(newData, null, 2), 'utf-8');

console.log(`\n=== 统计 ===`);
console.log(`物品数: ${Object.keys(newData.items).length}`);
console.log(`配方数: ${Object.keys(newData.recipes).length}`);
console.log(`建筑数: ${Object.keys(newData.buildings).length}`);
console.log(`Blueprint 数: ${Object.keys(newData.blueprints).length}`);
console.log(`Schematics 数: ${Object.keys(newData.schematics).length}`);
console.log(`Corporations 数: ${Object.keys(newData.corporations || {}).length}`);

console.log(`\n=== 示例物品 ===`);
const exampleItemKey = meaningfulItems[0];
if (exampleItemKey) {
	const exampleItem = newData.items[exampleItemKey];
	console.log(JSON.stringify(exampleItem, null, 2));
}

console.log(`\n=== 示例配方 ===`);
if (meaningfulRecipes.length > 0) {
	const exampleRecipeKey = meaningfulRecipes[0];
	const exampleRecipe = newData.recipes[exampleRecipeKey];
	console.log(JSON.stringify(exampleRecipe, null, 2));
}

