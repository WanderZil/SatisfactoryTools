import * as fs from 'fs';
import * as path from 'path';

interface ItemData {
	slug: string;
	name: string;
	description: string;
	className: string;
	icon?: string;
	maxStack: number;
	uiItemType?: string;
	uniqueItemName?: string;
}

interface BuildingData {
	slug: string;
	name: string;
	description: string;
	className: string;
	icon?: string;
	buildingType?: string;
	uiType?: string;
	resourceRequirements?: Array<{
		item: string;
		quantity: number;
	}>;
	stabilityCost?: number;
}

interface RecipeData {
	slug: string;
	name: string;
	description: string;
	className: string;
	icon?: string;
	level?: number;
	buildTime?: number;
	neededResources: Array<{
		item: string;
		count: number;
	}>;
	outputItem: {
		item: string;
		count: number;
	};
	unlockRequirements?: Array<{
		item: string;
		value: number;
	}>;
}

interface RecipeCollection {
	className: string;
	recipes: string[]; // 配方类名列表
}

interface ExtractedData {
	items: { [key: string]: ItemData };
	buildings: { [key: string]: BuildingData };
	recipes: { [key: string]: RecipeData };
	recipeCollections: { [key: string]: RecipeCollection };
}

function extractItemNameFromPath(objectPath: string): string {
	// 从路径中提取物品名称
	// 例如: "/Game/Chimera/Items/I_BasicBuildingMaterial.1" -> "I_BasicBuildingMaterial"
	const match = objectPath.match(/\/([^/]+)\.\d+$/);
	if (match) {
		return match[1];
	}
	// 如果没有数字后缀，尝试其他格式
	const parts = objectPath.split('/');
	return parts[parts.length - 1].split('.')[0];
}

function extractIconPath(iconObj: any): string | undefined {
	if (!iconObj || !iconObj.ResourceObject) {
		return undefined;
	}

	const resourceObj = iconObj.ResourceObject;

	// 方法1: 从 ObjectPath 提取（如 "/Game/Chimera/UI/ItemIcons/T_BasicBuildingMaterial.0" -> "T_BasicBuildingMaterial"）
	if (resourceObj.ObjectPath) {
		const match = resourceObj.ObjectPath.match(/\/([^/]+)\.\d+$/);
		if (match) {
			return match[1];
		}
	}

	// 方法2: 从 ObjectName 提取（如 "Texture2D'T_Syringe_Icon'" -> "T_Syringe_Icon"）
	if (resourceObj.ObjectName) {
		const match = resourceObj.ObjectName.match(/Texture2D'([^']+)'/);
		if (match) {
			return match[1];
		}
		// 如果没有 Texture2D 前缀，直接使用 ObjectName
		if (resourceObj.ObjectName.startsWith('T_')) {
			return resourceObj.ObjectName;
		}
	}

	return undefined;
}

function parseItemFile(filePath: string): ItemData | null {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const data = JSON.parse(content);

		// 查找 Default__ 对象，它包含物品属性
		const defaultObj = data.find((obj: any) =>
			obj.Name && obj.Name.startsWith('Default__') && obj.Properties
		);

		if (!defaultObj || !defaultObj.Properties) {
			return null;
		}

		const props = defaultObj.Properties;
		const fileName = path.basename(filePath, '.json');

		// 提取名称
		const nameObj = props.ItemName;
		const name = nameObj?.LocalizedString || nameObj?.SourceString || fileName;

		// 提取描述
		const descObj = props.ItemDescription;
		const description = descObj?.LocalizedString || descObj?.SourceString || '';

		// 提取图标
		const icon = extractIconPath(props.ItemIcon);

		// 提取唯一名称
		const uniqueName = props.UniqueItemName || fileName;

		// 生成 slug
		const slug = uniqueName.toLowerCase().replace(/_/g, '-');

		return {
			slug,
			name,
			description,
			className: fileName,
			icon,
			maxStack: props.MaxStack || 1,
			uiItemType: props.UIItemType,
			uniqueItemName: uniqueName,
		};
	} catch (error) {
		console.error(`Error parsing item file ${filePath}:`, error);
		return null;
	}
}

function parseBuildingFile(filePath: string): BuildingData | null {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const data = JSON.parse(content);

		// 查找 CrBuildingData 对象
		const buildingObj = data.find((obj: any) =>
			obj.Type === 'CrBuildingData' && obj.Properties
		);

		if (!buildingObj || !buildingObj.Properties) {
			return null;
		}

		const props = buildingObj.Properties;
		const fileName = path.basename(filePath, '.json');

		// 提取名称
		const nameObj = props.BuildingName;
		const name = nameObj?.LocalizedString || nameObj?.SourceString || fileName;

		// 提取描述
		const descObj = props.BuildingDescription;
		const description = descObj?.LocalizedString || descObj?.SourceString || '';

		// 提取图标
		const icon = extractIconPath(props.Icon);

		// 提取资源需求
		const resourceRequirements = props.ResourceRequirements?.Requirements?.map((req: any) => ({
			item: extractItemNameFromPath(req.Item?.ObjectPath || ''),
			quantity: req.Quantity || 0,
		})) || [];

		// 生成 slug
		const slug = fileName.toLowerCase().replace(/_/g, '-');

		return {
			slug,
			name,
			description,
			className: fileName,
			icon,
			buildingType: props.Type,
			uiType: props.UIType,
			resourceRequirements,
			stabilityCost: props.StabilityCost,
		};
	} catch (error) {
		console.error(`Error parsing building file ${filePath}:`, error);
		return null;
	}
}

function parseRecipeFile(filePath: string): RecipeData | null {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const data = JSON.parse(content);

		// 查找 CrItemRecipeData 对象
		const recipeObj = data.find((obj: any) =>
			obj.Type === 'CrItemRecipeData' && obj.Properties
		);

		if (!recipeObj || !recipeObj.Properties) {
			return null;
		}

		const props = recipeObj.Properties;
		const fileName = path.basename(filePath, '.json');

		// 提取名称
		const nameObj = props.DisplayText;
		const name = nameObj?.LocalizedString || nameObj?.SourceString || fileName;

		// 提取描述
		const descObj = props.DisplayDescription;
		const description = descObj?.LocalizedString || descObj?.SourceString || '';

		// 提取图标
		const icon = extractIconPath(props.Icon);

		// 提取所需资源
		const neededResources = (props.NeededResources || []).map((req: any) => ({
			item: extractItemNameFromPath(req.Item?.ObjectPath || ''),
			count: req.Count || 0,
		}));

		// 提取输出物品
		const outputItem = {
			item: extractItemNameFromPath(props.OutputItem?.Item?.ObjectPath || ''),
			count: props.OutputItem?.Count || 1,
		};

		// 提取解锁需求
		const unlockRequirements = (props.UnlockRequirements || []).map((req: any) => ({
			item: extractItemNameFromPath(req.Key || ''),
			value: req.Value || 0,
		}));

		// 生成 slug
		const slug = fileName.toLowerCase().replace(/_/g, '-');

		return {
			slug,
			name,
			description,
			className: fileName,
			icon,
			level: props.Level,
			buildTime: props.BuildTime,
			neededResources,
			outputItem,
			unlockRequirements: unlockRequirements.length > 0 ? unlockRequirements : undefined,
		};
	} catch (error) {
		console.error(`Error parsing recipe file ${filePath}:`, error);
		return null;
	}
}

function parseRecipeCollectionFile(filePath: string): RecipeCollection | null {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const data = JSON.parse(content);

		// 查找 CrItemRecipeCollection 对象
		const collectionObj = data.find((obj: any) =>
			obj.Type === 'CrItemRecipeCollection' && obj.Properties
		);

		if (!collectionObj || !collectionObj.Properties) {
			return null;
		}

		const props = collectionObj.Properties;
		const fileName = path.basename(filePath, '.json');

		// 提取配方列表
		const recipes = (props.Recipes || []).map((recipe: any) => {
			const objectName = recipe.ObjectName || '';
			// 提取配方名称，例如: "CrItemRecipeData'CR_Accumulator'" -> "CR_Accumulator"
			const match = objectName.match(/'([^']+)'/);
			return match ? match[1] : '';
		}).filter((name: string) => name);

		return {
			className: fileName,
			recipes,
		};
	} catch (error) {
		console.error(`Error parsing recipe collection file ${filePath}:`, error);
		return null;
	}
}

function getAllFiles(dir: string, extension: string): string[] {
	const files: string[] = [];

	function walkDir(currentPath: string) {
		const entries = fs.readdirSync(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);

			if (entry.isDirectory()) {
				walkDir(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(extension)) {
				files.push(fullPath);
			}
		}
	}

	walkDir(dir);
	return files;
}

// 主函数
const dataDir = path.join(__dirname, '..', 'data', 'StarRupture', 'Content', 'Chimera');
const outputDir = path.join(__dirname, '..', 'data');

console.log(`开始解析 StarRupture 游戏数据...`);
console.log(`数据目录: ${dataDir}`);

const extracted: ExtractedData = {
	items: {},
	buildings: {},
	recipes: {},
	recipeCollections: {},
};

// 解析物品
console.log(`\n解析物品数据...`);
const itemFiles = getAllFiles(path.join(dataDir, 'Items'), '.json');
console.log(`找到 ${itemFiles.length} 个物品文件`);

for (const file of itemFiles) {
	const item = parseItemFile(file);
	if (item) {
		extracted.items[item.className] = item;
	}
}

// 解析 Corporations 目录下的物品（如 I_DataPoint）
const corporationItemFiles = getAllFiles(path.join(dataDir, 'Corporations'), '.json');
console.log(`找到 ${corporationItemFiles.length} 个 Corporations 文件`);
for (const file of corporationItemFiles) {
	const fileName = path.basename(file, '.json');
	// 只处理以 I_ 开头的物品文件（如 I_DataPoint.json）
	if (fileName.startsWith('I_')) {
		const item = parseItemFile(file);
		if (item) {
			extracted.items[item.className] = item;
		}
	}
}

console.log(`成功解析 ${Object.keys(extracted.items).length} 个物品`);

// 解析建筑
console.log(`\n解析建筑数据...`);
const buildingFiles = getAllFiles(path.join(dataDir, 'Buildings'), '.json');
console.log(`找到 ${buildingFiles.length} 个建筑文件`);

for (const file of buildingFiles) {
	const building = parseBuildingFile(file);
	if (building) {
		extracted.buildings[building.className] = building;
	}
}

console.log(`成功解析 ${Object.keys(extracted.buildings).length} 个建筑`);

// 解析配方
console.log(`\n解析配方数据...`);
const recipeFiles = getAllFiles(path.join(dataDir, 'Crafting'), '.json');
console.log(`找到 ${recipeFiles.length} 个配方文件`);

for (const file of recipeFiles) {
	const fileName = path.basename(file, '.json');

	// 判断是配方集合还是单个配方
	if (fileName.startsWith('CRC_')) {
		const collection = parseRecipeCollectionFile(file);
		if (collection) {
			extracted.recipeCollections[collection.className] = collection;
		}
	} else if (fileName.startsWith('CR_')) {
		const recipe = parseRecipeFile(file);
		if (recipe) {
			extracted.recipes[recipe.className] = recipe;
		}
	}
}

console.log(`成功解析 ${Object.keys(extracted.recipes).length} 个配方`);
console.log(`成功解析 ${Object.keys(extracted.recipeCollections).length} 个配方集合`);

// 保存结果
const outputPath = path.join(outputDir, 'starRuptureData.json');
fs.writeFileSync(outputPath, JSON.stringify(extracted, null, 2), 'utf-8');
console.log(`\n数据已保存到: ${outputPath}`);

// 输出统计信息
console.log(`\n=== 数据统计 ===`);
console.log(`物品: ${Object.keys(extracted.items).length} 个`);
console.log(`建筑: ${Object.keys(extracted.buildings).length} 个`);
console.log(`配方: ${Object.keys(extracted.recipes).length} 个`);
console.log(`配方集合: ${Object.keys(extracted.recipeCollections).length} 个`);

// 输出一些示例
console.log(`\n=== 物品示例 ===`);
Object.values(extracted.items).slice(0, 5).forEach(item => {
	console.log(`- ${item.name} (${item.className})`);
	if (item.icon) console.log(`  图标: ${item.icon}`);
});

console.log(`\n=== 建筑示例 ===`);
Object.values(extracted.buildings).slice(0, 5).forEach(building => {
	console.log(`- ${building.name} (${building.className})`);
	if (building.icon) console.log(`  图标: ${building.icon}`);
});

console.log(`\n=== 配方示例 ===`);
Object.values(extracted.recipes).slice(0, 5).forEach(recipe => {
	console.log(`- ${recipe.name} (${recipe.className})`);
	console.log(`  输入: ${recipe.neededResources.map(r => `${r.item} x${r.count}`).join(', ')}`);
	console.log(`  输出: ${recipe.outputItem.item} x${recipe.outputItem.count}`);
});

