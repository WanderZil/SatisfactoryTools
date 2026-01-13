import {RecentlyVisitedItemsService} from '@src/Module/Services/RecentlyVisitedItemsService';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {IFilterService} from '@src/Types/IFilterService';
import {Strings} from '@src/Utils/Strings';
import {StateService} from 'angular-ui-router';

export class CodexController
{

	public filtersService: IFilterService<any>;
	public entityPreviewState: string;
	public static $inject = ['RecentlyVisitedItemsService', '$state'];

	public constructor(public recentlyVisited: RecentlyVisitedItemsService, public $state: StateService)
	{
	}

	public getSchematicType(type: string): string
	{
		return Strings.convertSchematicType(type);
	}

	public getFilteredItems(): IItemSchema[]
	{
		const items = this.filtersService.filterEntities();
		return items;
	}

}
