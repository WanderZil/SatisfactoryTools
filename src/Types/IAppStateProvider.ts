interface IAppBreadcrumbState
{
	ncyBreadcrumb?: {
		label?: string;
		parent?: string;
		skip?: boolean;
	};
	ncyBreadcrumbLabel?: string;
	ncyBreadcrumbLink?: string;
}

// Keep state/provider types loosely typed to avoid ui-router type export mismatches across environments (local vs CI/Vercel).
export interface IAppState extends IAppBreadcrumbState
{
	// Allow ui-router state definitions to include any additional properties (url, parent, views, resolve, etc).
	// This avoids depending on a specific ui-router .d.ts export set, which differs between environments.
	[key: string]: any;
	name?: string;
}

export interface IAppStateProvider
{
	state(definition: IAppState): any;

	state(name: string, definition: IAppState): any;
}
