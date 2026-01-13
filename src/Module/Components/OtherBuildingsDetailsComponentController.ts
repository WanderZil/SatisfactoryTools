import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import data from '@src/Data/Data';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';

export class OtherBuildingsDetailsComponentController
{

	public building: IBuildingSchema;
	public overclock: number = 100;
	public corporationUnlocks: Array<{corporation: ICorporationSchema, level: number}> | null = null;
	public corporation: ICorporationSchema | null = null; // 缓存公司对象

	public $onInit(): void
	{
		if (this.building) {
			this.corporationUnlocks = data.getCorporationUnlocksForBuilding(this.building.className);
			// 缓存公司对象
			if (this.building._bdData && this.building._bdData.corporation) {
				this.corporation = this.getCorporationByName(this.building._bdData.corporation);
			}
		}
	}

	public getItem(className: string): IItemSchema|null
	{
		return data.getItemByClassName(className);
	}

	public isDataPointItem(itemClassName: string): boolean
	{
		const item = data.getItemByClassName(itemClassName);
		return item ? (item as any).isDataPoint === true : false;
	}

	public get powerConsumption(): number|undefined
	{
		if (this.building.metadata.powerConsumption && this.building.metadata.powerConsumptionExponent) {
			return this.building.metadata.powerConsumption * Math.pow(this.overclock / 100, this.building.metadata.powerConsumptionExponent);
		} else if (this.building.metadata.powerConsumption) {
			return this.building.metadata.powerConsumption;
		}
	}

	public get manufacturingSpeed(): number|undefined
	{
		if (this.building.metadata.manufacturingSpeed) {
			return this.building.metadata.manufacturingSpeed * (this.overclock / 100);
		}
	}


	public getCorporation(corporation: ICorporationSchema): ICorporationSchema
	{
		return corporation;
	}

	public getCorporationByName(name: string): ICorporationSchema|null
	{
		if (!name) {
			return null;
		}
		const allCorporations = data.getAllCorporations();
		
		// 首先尝试精确匹配
		for (const key in allCorporations) {
			const corp = allCorporations[key];
			if (corp.name === name) {
				return corp;
			}
		}
		
		// 如果name是枚举格式（如 "ECrCorporation::SelenianCORP"），尝试提取公司名称
		const enumMatch = name.match(/::(\w+)$/);
		if (enumMatch) {
			const enumValue = enumMatch[1];
			// 建立映射关系
			const enumToNameMap: {[key: string]: string} = {
				'SelenianCORP': 'SelenianCorporation',
				'CleverRobotics': 'CleverCorporation',
				'FutureHealthSolutions': 'FutureCorporation',
				'GriffithsCorporation': 'GriffithsCorporation',
				'MoonEnergyCorporation': 'MoonCorporation',
				'StartingCorporation': 'StartingCorporation',
			};
			
			// 先尝试直接映射
			if (enumToNameMap[enumValue]) {
				for (const key in allCorporations) {
					const corp = allCorporations[key];
					if (corp.name === enumToNameMap[enumValue]) {
						return corp;
					}
				}
			}
			
			// 尝试模糊匹配：SelenianCORP -> SelenianCorporation
			// 或者 CleverRobotics -> CleverCorporation
			for (const key in allCorporations) {
				const corp = allCorporations[key];
				const corpNameUpper = corp.name.toUpperCase();
				const enumValueUpper = enumValue.toUpperCase();
				// 检查公司名称是否包含枚举值（去掉CORP、Corporation等后缀）
				const enumValueClean = enumValueUpper.replace(/CORP$/, '').replace(/CORPORATION$/, '');
				const corpNameClean = corpNameUpper.replace(/CORPORATION$/, '');
				if (corpNameClean.includes(enumValueClean) || enumValueClean.includes(corpNameClean)) {
					return corp;
				}
			}
		}
		
		return null;
	}

}
