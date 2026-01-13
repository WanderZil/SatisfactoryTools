import {IComponentOptions} from 'angular';
import {StateService} from 'angular-ui-router';

export class TabsComponent implements IComponentOptions
{

	public controller = ['$state', function($state: StateService) {
		this.isActive = (state: string) => {
			return $state.is(state) || $state.includes(state);
		};
		this.goToState = (state: string) => {
			$state.go(state);
		};
	}];
	public controllerAs = 'ctrl';
	public template = require('@templates/Components/tabs.html');

}

