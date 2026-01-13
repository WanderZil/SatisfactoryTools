import {IComponentOptions} from 'angular';

export class EntityListingComponent implements IComponentOptions
{

	public controller = ['$state', function($state: any) {
		this.$state = $state;
	}];
	public controllerAs = '$ctrl';
	public template: string = require('@templates/Components/entityListing.html');

}
