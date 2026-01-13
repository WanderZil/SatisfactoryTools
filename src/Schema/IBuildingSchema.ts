import {IBuildingMetadataSchema, IManufacturerAnyPowerMetadataSchema} from '@src/Schema/IBuildingMetadataSchema';
import {ISizeSchema} from '@src/Schema/ISizeSchema';

export interface IBuildingSchema
{

	slug: string;
	icon?: string;
	name: string;
	description: string;
	className: string;
	categories: string[];
	buildMenuPriority: number;
	metadata: IBuildingMetadataSchema;
	size: ISizeSchema;
	buildingType?: string; // 建筑类型，如 "Crafting", "Transport", "Power", "Extraction", "Defensive" 等
	_bdData?: any; // StarRupture 扩展数据（从 BD 文件提取）

}

export interface IManufacturerSchema extends IBuildingSchema
{

	metadata: IManufacturerAnyPowerMetadataSchema;

}
