import * as fs from 'fs';
import * as path from 'path';
import {IJsonSchema} from '@src/Schema/IJsonSchema';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {IAnyRecipeSchema, IRecipeFixedPowerSchema} from '@src/Schema/IRecipeSchema';

interface StarRuptureItem {
	slug: string;
	name: string;
	description: string;
	className: string;
	icon?: string;
	maxStack: number;
	uiItemType?: string;
	uniqueItemName?: string;
}

interface StarRuptureRecipe {
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

interface StarRuptureData {
	items: { [key: string]: StarRuptureItem };
	recipes: { [key: string]: StarRuptureRecipe };
	buildings: { [key: string]: any };
	recipeCollections: { [key: string]: any };
}

// 将 StarRupture 物品转换为现有格式
function convertItem(srItem: StarRuptureItem): IItemSchema {
	return {
		slug: srItem.slug,
		icon: srItem.icon,
		name: srItem.name,
		sinkPoints: 0, // StarRupture 没有 sinkPoints，设为 0
		description: srItem.description,
		className: srItem.className,
		stackSize: srItem.maxStack, // maxStack -> stackSize
		energyValue: 0.0, // StarRupture 没有 energyValue，设为 0
		radioactiveDecay: 0.0, // StarRupture 没有 radioactiveDecay，设为 0
		liquid: false, // StarRupture 没有 liquid 属性，设为 false
		fluidColor: { r: 0, g: 0, b: 0, a: 0 }, // 默认颜色
		// 保留新属性（如果需要的话，可以扩展 IItemSchema）
		// uiItemType: srItem.uiItemType,
		// uniqueItemName: srItem.uniqueItemName,
	};
}

// 将 StarRupture 配方转换为现有格式
function convertRecipe(srRecipe: StarRuptureRecipe): IAnyRecipeSchema {
	// 转换输入资源
	const ingredients = srRecipe.neededResources.map(resource => ({
		item: resource.item,
		amount: resource.count,
	}));

	// 转换输出物品
	const products = [{
		item: srRecipe.outputItem.item,
		amount: srRecipe.outputItem.count,
	}];

	// 创建配方对象，确保 isVariablePower 是字面量 false
	const recipe = {
		slug: srRecipe.slug,
		name: srRecipe.name,
		className: srRecipe.className,
		alternate: false, // StarRupture 没有 alternate 概念
		time: srRecipe.buildTime || 1.0, // buildTime -> time
		inHand: false, // StarRupture 没有 inHand
		forBuilding: false, // StarRupture 没有 forBuilding
		inWorkshop: false, // StarRupture 没有 inWorkshop
		inMachine: true, // StarRupture 配方通常在机器中制作
		manualTimeMultiplier: 1.0, // 默认值
		ingredients,
		products,
		producedIn: [] as string[], // 需要根据配方集合来确定，暂时为空
		isVariablePower: false as const, // StarRupture 没有可变功率（必须是字面量 false）
	};

	return recipe as IAnyRecipeSchema;
}

// 主函数
const existingDataPath = path.join(__dirname, '..', 'data', 'data.json');
const starRuptureDataPath = path.join(__dirname, '..', 'data', 'starRuptureData.json');
const outputPath = path.join(__dirname, '..', 'data', 'dataWithStarRupture.json');

console.log('读取现有数据...');
const existingData: IJsonSchema = JSON.parse(
	fs.readFileSync(existingDataPath, 'utf-8')
);

console.log('读取 StarRupture 数据...');
const starRuptureData: StarRuptureData = JSON.parse(
	fs.readFileSync(starRuptureDataPath, 'utf-8')
);

// 创建新数据对象（复制现有数据）
const mergedData: IJsonSchema = {
	...existingData,
	items: { ...existingData.items },
	recipes: { ...existingData.recipes },
};

// 过滤掉测试物品，只保留有意义的物品
const allItemKeys = Object.keys(starRuptureData.items);
const meaningfulItems = allItemKeys.filter(key => {
	const item = starRuptureData.items[key];
	// 排除测试物品和蓝图物品
	return !key.startsWith('BP_') && 
		   !key.startsWith('GA_') && 
		   key.startsWith('I_') && 
		   !key.includes('Blueprint') &&
		   item.name && 
		   item.name !== '<MISSING STRING TABLE ENTRY>' &&
		   item.description && 
		   item.description !== '<MISSING STRING TABLE ENTRY>';
});

// 导入前 100 个有意义的物品
const itemKeys = meaningfulItems.slice(0, 100);
console.log(`\n处理 ${itemKeys.length} 个 StarRupture 物品（从 ${meaningfulItems.length} 个有意义物品中选择）...`);

for (const key of itemKeys) {
	const srItem = starRuptureData.items[key];
	const convertedItem = convertItem(srItem);
	
	// 添加前缀以避免冲突
	const newKey = `SR_${key}`;
	mergedData.items[newKey] = convertedItem;
	
	if (itemKeys.indexOf(key) < 10) {
		console.log(`  - ${srItem.name} (${key} -> ${newKey})`);
	}
}

// 处理所有配方（排除测试配方）
const allRecipeKeys = Object.keys(starRuptureData.recipes);
const meaningfulRecipes = allRecipeKeys.filter(key => {
	const recipe = starRuptureData.recipes[key];
	return recipe.name && 
		   recipe.name !== '<MISSING STRING TABLE ENTRY>' &&
		   recipe.neededResources && 
		   recipe.neededResources.length > 0;
});

// 导入前 100 个有意义的配方
const recipeKeys = meaningfulRecipes.slice(0, 100);
console.log(`\n处理 ${recipeKeys.length} 个 StarRupture 配方（从 ${meaningfulRecipes.length} 个有意义配方中选择）...`);

for (const key of recipeKeys) {
	const srRecipe = starRuptureData.recipes[key];
	const convertedRecipe = convertRecipe(srRecipe);
	
	// 添加前缀以避免冲突
	const newKey = `SR_${key}`;
	mergedData.recipes[newKey] = convertedRecipe;
	
	if (recipeKeys.indexOf(key) < 10) {
		console.log(`  - ${srRecipe.name} (${key} -> ${newKey})`);
	}
}

// 保存结果
console.log(`\n保存合并后的数据到: ${outputPath}`);
fs.writeFileSync(outputPath, JSON.stringify(mergedData, null, 2), 'utf-8');

console.log(`\n=== 统计 ===`);
console.log(`现有物品: ${Object.keys(existingData.items).length}`);
console.log(`现有配方: ${Object.keys(existingData.recipes).length}`);
console.log(`新增物品: ${itemKeys.length}`);
console.log(`新增配方: ${recipeKeys.length}`);
console.log(`合并后物品总数: ${Object.keys(mergedData.items).length}`);
console.log(`合并后配方总数: ${Object.keys(mergedData.recipes).length}`);

// 显示示例
console.log(`\n=== 示例物品 ===`);
const exampleItemKey = itemKeys[0];
const exampleItem = mergedData.items[`SR_${exampleItemKey}`];
console.log(JSON.stringify(exampleItem, null, 2));

console.log(`\n=== 示例配方 ===`);
if (recipeKeys.length > 0) {
	const exampleRecipeKey = recipeKeys[0];
	const exampleRecipe = mergedData.recipes[`SR_${exampleRecipeKey}`];
	console.log(JSON.stringify(exampleRecipe, null, 2));
}

