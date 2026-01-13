export interface ICorporationSchema
{

	slug: string;
	icon?: string;
	name: string;
	description: string;
	className: string;
	displayText: string;
	corporationColor?: string;
	corporationIndex?: number;
	levels?: ICorporationLevel[];
	bHidden?: boolean;

}

export interface ICorporationLevel
{

	level: number;
	reputationRequired: number;
	itemRewards?: ICorporationReward[];
	buildingRewards?: ICorporationReward[];
	buildingCollectionRewards?: ICorporationReward[];
	featureRewards?: string[];
	inventorySlotRewards?: number;

}

export interface ICorporationReward
{

	item?: string;
	building?: string;
	buildingCollection?: string;
	amount?: number;

}


