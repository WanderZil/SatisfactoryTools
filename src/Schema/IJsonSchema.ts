import {IItemSchema} from '@src/Schema/IItemSchema';
import {IAnyRecipeSchema} from '@src/Schema/IRecipeSchema';
import {IResourceSchema} from '@src/Schema/IResourceSchema';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import {IMinerSchema} from '@src/Schema/IMinerSchema';
import {IGeneratorSchema} from '@src/Schema/IGeneratorSchema';
import {ISchematicSchema} from '@src/Schema/ISchematicSchema';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';

export interface IJsonSchema
{

	items: {[key: string]: IItemSchema};
	recipes: {[key: string]: IAnyRecipeSchema};
	blueprints: {[key: string]: ISchematicSchema};
	schematics: {[key: string]: ISchematicSchema}; // 保持向后兼容
	generators: {[key: string]: IGeneratorSchema};
	resources: {[key: string]: IResourceSchema};
	miners: {[key: string]: IMinerSchema};
	buildings: {[key: string]: IBuildingSchema};
	corporations?: {[key: string]: ICorporationSchema};

}
