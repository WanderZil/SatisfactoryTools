import {IItemAmountSchema} from '@src/Schema/IItemAmountSchema';

export interface ISchematicSchema
{

	className: string;
	type: string;
	name: string;
	slug: string;
	icon?: string;
	description?: string; // StarRupture 使用 - 描述文本
	cost: IItemAmountSchema[];
	unlockRequirements?: IItemAmountSchema[]; // StarRupture 使用
	unlock: ISchematicUnlockSchema;
	requiredSchematics: string[];
	tier: number;
	level?: number; // StarRupture 使用
	time: number;
	mam: boolean;
	alternate: boolean;
	neededResources?: IItemAmountSchema[]; // StarRupture 使用
	outputItem?: IItemAmountSchema; // StarRupture 使用
	corporation?: string; // StarRupture 使用 - 所属公司
	buildTime?: number; // StarRupture 使用 - 配方建造时间（秒）

}

export interface ISchematicUnlockSchema
{

	recipes: string[];
	scannerResources: string[];
	inventorySlots: number;
	giveItems: IItemAmountSchema[];

}
