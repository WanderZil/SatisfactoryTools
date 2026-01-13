import {IComponentOptions} from 'angular';
import {StateService} from 'angular-ui-router';

export class EntityListingComponent implements IComponentOptions
{

	public controller = ['$state', function($state: StateService) {
		this.$state = $state;
	}];
	public controllerAs = '$ctrl';
	public template: string = require('@templates/Components/entityListing.html');

}
