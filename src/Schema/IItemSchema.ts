import {IColorSchema} from '@src/Schema/IColorSchema';

export interface IItemExportValue {
	level: number;
	buildTime: number;
	value: number;
}

export interface IItemExportInfo {
	selenian?: IItemExportValue[];
	clever?: IItemExportValue[];
	future?: IItemExportValue[];
	griffiths?: IItemExportValue[];
	moon?: IItemExportValue[];
}

export interface IItemSchema
{

	slug: string;
	icon?: string;
	name: string;
	sinkPoints: number;
	description: string;
	className: string;
	stackSize: number;
	energyValue: number;
	radioactiveDecay: number;
	liquid: boolean;
	fluidColor: IColorSchema;
	isDataPoint?: boolean; // 标记为 DataPoint 物品，不显示详情页链接
	export?: IItemExportInfo; // 导出信息
	uiItemType?: string; // UIItemType 属性，如 "EUIItemType::Resource", "EUIItemType::BlueprintItem", "EUIItemType::Consumable", "EUIItemType::Valuable"

}
