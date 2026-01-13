import {IRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IBuildingSchema, IManufacturerSchema} from '@src/Schema/IBuildingSchema';
import {IMinerSchema} from '@src/Schema/IMinerSchema';
import {Constants, RESOURCE_PURITY} from '@src/Constants';
import {IGeneratorSchema} from '@src/Schema/IGeneratorSchema';
import {IItemSchema} from '@src/Schema/IItemSchema';

export class Formula
{

	private static defaultClock = 100;
	private static defaultPowerProductionExponent = 1.6;

	public static calculateBuildingRecipeProductionTime(recipe: IRecipeSchema, building: IBuildingSchema | null, overclock: number): number
	{
		if (!building || !building.metadata) {
			// 如果没有建筑或元数据，返回默认时间
			return (Formula.defaultClock / overclock) * recipe.time;
		}
		// StarRupture：recipe.time 已经是实际生产时间，manufacturingSpeed 不影响时间
		// 只考虑时钟速度的影响
		return (Formula.defaultClock / overclock) * recipe.time;
	}

	public static calculateBuildingPowerConsumption(building: IBuildingSchema, overclock: number)
	{
		return Math.pow(overclock / 100, building.metadata.powerConsumptionExponent || Formula.defaultPowerProductionExponent) * (building.metadata.powerConsumption || 0);
	}

	public static calculateExtractorExtractionValue(extractor: IMinerSchema, purity: RESOURCE_PURITY): number
	{
		const itemsInMinute = (extractor.itemsPerCycle / extractor.extractCycleTime) * 60;
		switch (purity) {
			case 'impure':
				return itemsInMinute * Constants.RESOURCE_MULTIPLIER_IMPURE;
			case 'normal':
				return itemsInMinute * Constants.RESOURCE_MULTIPLIER_NORMAL;
			case 'pure':
				return itemsInMinute * Constants.RESOURCE_MULTIPLIER_PURE;
		}
	}

	public static calculateFuelConsumption(generator: IGeneratorSchema, fuel: IItemSchema, overclock: number)
	{
		return ((generator.powerProduction / fuel.energyValue) * 60) * overclock / 100;
	}

	public static calculateProductAmountsPerMinute(building: IManufacturerSchema | null, recipe: IRecipeSchema, recipeProductAmount: number, overclock: number): number
	{
		if (!building) {
			// 如果没有建筑，返回基于默认时间的产量
			return (60 / recipe.time) * recipeProductAmount * (overclock / 100);
		}
		// StarRupture 的计算方式：recipe.time 已经是实际生产时间（秒）
		// 每分钟产量 = (60秒 / 配方时间) * 输出数量 * (时钟速度 / 100)
		// 注意：manufacturingSpeed 在这个游戏中可能不用于计算产量，或者需要进一步确认其用途
		return (60 / recipe.time) * recipeProductAmount * (overclock / 100);
	}

	public static calculateGeneratorWaterConsumption(building: IGeneratorSchema, overclock: number): number
	{
		return (60 * (Formula.calculatePowerGeneratorPowerCapacity(building, overclock) * building.waterToPowerRatio)) / 1000;
	}

	public static calculatePowerGeneratorPowerCapacity(generator: IGeneratorSchema, overclock: number)
	{
		return (generator.powerProduction * Math.pow(overclock / 100, 1 / generator.powerProductionExponent));
	}

}
