import {IComponentOptions} from 'angular';
import {CorporationFiltersService} from '@src/Module/Services/CorporationFiltersService';

export class CorporationFilterComponent implements IComponentOptions
{

	public controller = CorporationFilterController;
	public template = require('@templates/Components/corporationFilter.html');
	public transclude = true;

}

class CorporationFilterController
{

	public static $inject = ['CorporationFiltersService'];

	public constructor(public filterService: CorporationFiltersService)
	{
	}

}


