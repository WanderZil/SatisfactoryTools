import {IComponentOptions} from 'angular';

export class TabsComponent implements IComponentOptions
{

	public controller = ['$state', function($state: any) {
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

