export interface IBuildingMetadataSchema
{

	beltSpeed?: number;
	firstPieceCostMultiplier?: number;
	lengthPerCost?: number;
	maxLength?: number;
	storageSize?: number;
	powerConsumption?: number;
	powerConsumptionExponent?: number;
	manufacturingSpeed?: number;
	inventorySize?: number;
	inputInventorySize?: number;
	flowLimit?: number;
	maxPressure?: number;
	storageCapacity?: number;
	isVariablePower?: boolean;
	minPowerConsumption?: number;
	maxPowerConsumption?: number;
	_daData?: any; // StarRupture 扩展数据（从 DA 文件提取）
	_bpData?: any; // StarRupture 扩展数据（从 BP 文件提取）

}

export interface IManufacturerMetadataSchema extends IBuildingMetadataSchema
{

	powerConsumption: number;
	powerConsumptionExponent: number;
	manufacturingSpeed: number;

}

export interface IManufacturerVariablePowerMetadataSchema extends IManufacturerMetadataSchema
{

	isVariablePower: true;
	minPowerConsumption: number;
	maxPowerConsumption: number;

}

export interface IManufacturerFixedPowerMetadataSchema extends IManufacturerMetadataSchema
{

	isVariablePower: true;

}

export type IManufacturerAnyPowerMetadataSchema = IManufacturerVariablePowerMetadataSchema | IManufacturerFixedPowerMetadataSchema;
