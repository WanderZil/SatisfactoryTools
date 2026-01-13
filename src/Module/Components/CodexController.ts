import {RecentlyVisitedItemsService} from '@src/Module/Services/RecentlyVisitedItemsService';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {IFilterService} from '@src/Types/IFilterService';
import {Strings} from '@src/Utils/Strings';

export class CodexController
{

	public filtersService: IFilterService<any>;
	public entityPreviewState: string;
	public static $inject = ['RecentlyVisitedItemsService', '$state'];

	// `$state` is provided by ui-router at runtime; keep it loosely typed to avoid type export mismatches on CI/Vercel.
	public constructor(public recentlyVisited: RecentlyVisitedItemsService, public $state: any)
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
