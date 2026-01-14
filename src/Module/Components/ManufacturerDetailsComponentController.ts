import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import data from '@src/Data/Data';
import {ComponentOptionsService} from '@src/Module/Services/ComponentOptionsService';
import {Numbers} from '@src/Utils/Numbers';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';

export class ManufacturerDetailsComponentController
{

	public building: IBuildingSchema;
	public corporationUnlocks: Array<{corporation: ICorporationSchema, level: number}> | null = null;
	public corporation: ICorporationSchema | null = null; // 缓存公司对象
	public static $inject = ['ComponentOptionsService'];

	public constructor(public options: ComponentOptionsService)
	{

	}

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
			return Numbers.round(this.building.metadata.powerConsumption * Math.pow(this.options.overclock / 100, this.building.metadata.powerConsumptionExponent));
		}
		return 0;
	}

	public get minPowerConsumption(): number|undefined
	{
		if (this.building.metadata.minPowerConsumption && this.building.metadata.powerConsumptionExponent) {
			return Numbers.round(this.building.metadata.minPowerConsumption * Math.pow(this.options.overclock / 100, this.building.metadata.powerConsumptionExponent));
		}
	}

	public get maxPowerConsumption(): number|undefined
	{
		if (this.building.metadata.maxPowerConsumption && this.building.metadata.powerConsumptionExponent) {
			return Numbers.round(this.building.metadata.maxPowerConsumption * Math.pow(this.options.overclock / 100, this.building.metadata.powerConsumptionExponent));
		}
	}

	public get manufacturingSpeed(): number|undefined
	{
		if (this.building.metadata.manufacturingSpeed) {
			return Numbers.round(this.building.metadata.manufacturingSpeed * (this.options.overclock / 100));
		}
	}

	public isAutonomousManufacturer(entity: any): boolean
	{
		return data.isManufacturerBuilding(entity) && !data.isManualManufacturer(entity);
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
		
		// 如果name是枚举格式（如 "ECrCorporation::SelenianCORP"），尝试提取公司名称
		if (name.includes('::')) {
			const parts = name.split('::');
			if (parts.length > 1) {
				const corpEnum = parts[1]; // 如 "SelenianCORP", "CleverRobotics"
				
				// 创建映射：ECrCorporation enum -> CD_ className
				const corpMapping: {[key: string]: string} = {
					'SelenianCORP': 'CD_SelenianCorp',
					'SelenianCorporation': 'CD_SelenianCorp',
					'CleverRobotics': 'CD_CleverCorp',
					'FutureHealthSolution': 'CD_FutureCorp',
					'FutureHealthSolutions': 'CD_FutureCorp',
					'GriffithsBlueCorporation': 'CD_GriffithsCorp',
					'GriffithsCorp': 'CD_GriffithsCorp',
					'MoonEnergyCorporation': 'CD_MoonCorp',
					'MoonEnergy': 'CD_MoonCorp',
					'FE_FinalCorporation': 'CD_FE_FinalCorp',
					'StartingCorp': 'CD_StartingCorp',
				};
				
				// 首先尝试直接映射
				let corpClassName = corpMapping[corpEnum] || null;
				
				// 如果映射中没有，尝试通过 className 匹配（去掉 CD_ 前缀后比较）
				if (!corpClassName) {
					for (const key in allCorporations) {
						// 从 className 中提取核心名称（去掉 CD_ 前缀）
						const corpKeyName = key.replace(/^CD_/, '').toLowerCase();
						// 从 enum 中提取核心名称
						const enumName = corpEnum.toLowerCase().replace(/corp|corporation/gi, '').trim();
						// 尝试匹配
						if (corpKeyName.includes(enumName) || enumName.includes(corpKeyName)) {
							corpClassName = key;
							break;
						}
					}
				}
				
				// 如果仍然没有匹配，尝试通过名称匹配
				if (!corpClassName) {
					for (const key in allCorporations) {
						const corp = allCorporations[key];
						// 检查名称是否匹配（忽略大小写和特殊字符）
						const normalizedEnum = corpEnum.toLowerCase().replace(/corp|corporation/gi, '').trim();
						const normalizedName = (corp.name || '').toLowerCase().replace(/corp|corporation/gi, '').trim();
						if (normalizedName.includes(normalizedEnum) || normalizedEnum.includes(normalizedName)) {
							corpClassName = key;
							break;
						}
					}
				}
				
				if (corpClassName) {
					return allCorporations[corpClassName] || null;
				}
			}
		} else {
			// 直接使用作为 className
			return allCorporations[name] || null;
		}
		
		return null;
	}

}
