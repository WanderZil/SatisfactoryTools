import {ILocationProvider, IModule, ISCEProvider, IScope, ITimeoutService} from 'angular';
import {HomeController} from '@src/Module/Controllers/HomeController';
import {PrivacyPolicyController} from '@src/Module/Controllers/PrivacyPolicyController';
import {TermsOfServiceController} from '@src/Module/Controllers/TermsOfServiceController';
import {AppDirective} from '@src/Module/Directives/AppDirective';
import {ItemController} from '@src/Module/Controllers/ItemController';
import {ItemIconDirective} from '@src/Module/Directives/ItemIconDirective';
import {RecentlyVisitedItemsService} from '@src/Module/Services/RecentlyVisitedItemsService';
import {ProductionController} from '@src/Module/Controllers/ProductionController';
import {VisualizationComponent} from '@src/Module/Components/VisualizationComponent';
import {ItemFilterComponent} from '@src/Module/Components/ItemFilterComponent';
import {ItemFiltersService} from '@src/Module/Services/ItemFiltersService';
import {ApplicationBreadcrumbsComponent} from '@src/Module/Components/ApplicationBreadcrumbsComponent';
import {EntityListingComponent} from '@src/Module/Components/EntityListingComponent';
import {IAppState, IAppStateProvider} from '@src/Types/IAppStateProvider';
import data from '@src/Data/Data';
import {BuildingFiltersService} from '@src/Module/Services/BuildingFiltersService';
import {CodexComponent} from '@src/Module/Components/CodexComponent';
import {TabsComponent} from '@src/Module/Components/TabsComponent';
import {BuildingFilterComponent} from '@src/Module/Components/BuildingFilterComponent';
import {PerfectScrollbarDirective} from '@src/Module/Directives/PerfectScrollbarDirective';
import {LazyLoadDirective} from '@src/Module/Directives/LazyLoadDirective';
import {DataStorageService} from '@src/Module/Services/DataStorageService';
import {BuildingController} from '@src/Module/Controllers/BuildingController';
import {RecipesTableComponent} from '@src/Module/Components/RecipesTableComponent';
import {ManufacturerDetailsComponent} from '@src/Module/Components/ManufacturerDetailsComponent';
import {ExtractorDetailsComponent} from '@src/Module/Components/ExtractorDetailsComponent';
import {GeneratorDetailsComponent} from '@src/Module/Components/GeneratorDetailsComponent';
import {OtherBuildingsDetailsComponent} from '@src/Module/Components/OtherBuildingsDetailsComponent';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';
import {ITransitionObject} from '@src/Types/ITransitionObject';
import {IFilterService} from '@src/Types/IFilterService';
import {GeneratorFuelsComponent} from '@src/Module/Components/GeneratorFuelsComponent';
import {ExtractorResourcesComponent} from '@src/Module/Components/ExtractorResourcesComponent';
import {ManufacturerRecipesComponent} from '@src/Module/Components/ManufacturerRecipesComponent';
import {ComponentOptionsService} from '@src/Module/Services/ComponentOptionsService';
import {SchematicFiltersService} from '@src/Module/Services/SchematicFiltersService';
import {SchematicFilterComponent} from '@src/Module/Components/SchematicFilterComponent';
import {SchematicController} from '@src/Module/Controllers/SchematicController';
// jQuery is provided globally at runtime (loaded via vendor scripts). Declare to satisfy TS on CI/Vercel.
declare const $: any;
import {CorporationFiltersService} from '@src/Module/Services/CorporationFiltersService';
import {CorporationFilterComponent} from '@src/Module/Components/CorporationFilterComponent';
import {CorporationController} from '@src/Module/Controllers/CorporationController';
import {April} from '@src/Utils/April';
import {DataProvider} from '@src/Data/DataProvider';

export class AppModule
{


	public constructor(private readonly app: IModule)
	{
	}

	public register(): void
	{
		this.app.config([
			'$locationProvider', '$stateProvider', '$urlRouterProvider', '$sceProvider',
			($locationProvider: ILocationProvider, $stateProvider: any, $urlRouterProvider: any, $sceProvider: ISCEProvider) => {
			$locationProvider.html5Mode({
				enabled: true,
				requireBase: false,
			}).hashPrefix('!');

			$sceProvider.enabled(false);
			const appStates: IAppState[] = [
				{
					name: 'root',
					ncyBreadcrumb: {
						skip: true,
					},
					abstract: true,
					url: '',
					template: require('@templates/root.html'),
				},
				{
					name: 'page_content',
					ncyBreadcrumb: {
						skip: true,
					},
					abstract: true,
					url: '',
					parent: 'root',
					views: {
						'page_top@root': 'applicationBreadcrumbs',
					},
				},
				{
					name: 'listing',
					ncyBreadcrumb: {
						skip: true,
					},
					abstract: true,
					url: '',
					parent: 'page_content',
					views: {
						'page_content@root': 'entityListing',
					},
				},
				{
					name: 'home',
					url: '/about',
					ncyBreadcrumb: {
						label: 'About',
					},
					parent: 'listing',
					views: {
						'content@listing': {
							controller: 'HomeController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/home.html'),
						},
					},
				},
				{
					name: 'privacy-policy',
					url: '/privacy-policy',
					ncyBreadcrumb: {
						label: 'Privacy Policy',
					},
					parent: 'listing',
					views: {
						'content@listing': {
							controller: 'PrivacyPolicyController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/privacy-policy.html'),
						},
					},
				},
				{
					name: 'terms-of-service',
					url: '/terms-of-service',
					ncyBreadcrumb: {
						label: 'Terms of Service',
					},
					parent: 'listing',
					views: {
						'content@listing': {
							controller: 'TermsOfServiceController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/terms-of-service.html'),
						},
					},
				},
				{
					name: 'schematics',
					url: '/blueprints',
					ncyBreadcrumb: {
						label: 'Recipes',
						parent: 'home',
					},
					onRetain: ['$transition$', 'filterService', ($transition: any, filterService: IFilterService<any>) => {
						if ('schematic' === $transition.from().name) {
							filterService.resetFilters();
						}
					}],
					parent: 'listing',
					resolve: {
						filterService: ['SchematicFiltersService', (service: SchematicFiltersService) => {
							return service;
						}],
						entityPreviewState: [() => {
							return 'schematic';
						}],
					},
					views: {
						'content@listing': 'codex',
						'filters@listing': 'schematicFilter',
					},
				},
				{
					name: 'schematic',
					url: '/{item}',
					parent: 'schematics',
					ncyBreadcrumb: {
						parent: 'schematics',
					},
					onEnter: ['$stateParams', '$state$', 'ComponentOptionsService', ($stateParams: any, $state$: IAppState, options: ComponentOptionsService) => {
						$state$.ncyBreadcrumb = $state$.ncyBreadcrumb || {};
						$state$.ncyBreadcrumb.label = data.getSchematicBySlug($stateParams.item)?.name;
						options.reset();
					}],
					onExit: ['ComponentOptionsService', (options: ComponentOptionsService) => {
						options.reset();
					}],
					resolve: {
						schematic: ['$transition$', ($transition$: ITransitionObject<{item: string}>) => {
							return data.getSchematicBySlug($transition$.params().item);
						}],
					},
					views: {
						'content@listing': {
							controller: 'SchematicController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/schematic.html'),
						},
					},
				},
				{
					name: 'buildings',
					url: '/buildings',
					ncyBreadcrumb: {
						label: 'Buildings',
						parent: 'home',
					},
					onRetain: ['$transition$', 'filterService', ($transition: any, filterService: IFilterService<any>) => {
						if ('building' === $transition.from().name) {
							filterService.resetFilters();
						}
					}],
					parent: 'listing',
					resolve: {
						filterService: ['BuildingFiltersService', (service: BuildingFiltersService) => {
							return service;
						}],
						entityPreviewState: [() => {
							return 'building';
						}],
					},
					views: {
						'content@listing': 'codex',
						'filters@listing': 'buildingFilter',
					},
				},
				{
					name: 'building',
					url: '/{item}',
					parent: 'buildings',
					ncyBreadcrumb: {
						parent: 'buildings',
					},
					onEnter: ['$stateParams', '$state$', 'ComponentOptionsService', ($stateParams: any, $state$: IAppState, options: ComponentOptionsService) => {
						$state$.ncyBreadcrumb = $state$.ncyBreadcrumb || {};
						$state$.ncyBreadcrumb.label = data.getBuildingBySlug($stateParams.item)?.name;
						options.reset();
					}],
					onExit: ['ComponentOptionsService', (options: ComponentOptionsService) => {
						options.reset();
					}],
					resolve: {
						building: ['$transition$', ($transition$: ITransitionObject<{item: string}>) => {
							return data.getBuildingBySlug($transition$.params().item);
						}],
					},
					views: {
						'content@listing': {
							controller: 'BuildingController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/building.html'),
						},
						'building_details@building': {
							componentProvider: ['building', (building: IBuildingSchema | null) => {
								if (!building) {
									return 'otherBuildingDetails';
								}
								if (data.isGeneratorBuilding(building)) {
									return 'generatorDetails';
								}
								if (data.isManufacturerBuilding(building)) {
									return 'manufacturerDetails';
								}
								if (data.isExtractorBuilding(building)) {
									return 'extractorDetails';
								}
								return 'otherBuildingDetails';
							}],
						},
						'building_related@building': {
							componentProvider: ['building', (building: IBuildingSchema) => {
								if (data.isGeneratorBuilding(building)) {
									return 'generatorFuels';
								}
								if (data.isManufacturerBuilding(building)) {
									return 'manufacturerRecipes';
								}
								if (data.isExtractorBuilding(building)) {
									return 'extractorResources';
								}
								return null;
							}],
						},
					},
				},
				{
					name: 'items',
					url: '/items',
					ncyBreadcrumb: {
						label: 'Items',
						parent: 'home',
					},
					parent: 'listing',
					resolve: {
						filterService: ['ItemFiltersService', (service: ItemFiltersService) => {
							return service;
						}],
						entityPreviewState: [() => {
							return 'item';
						}],
					},
					onRetain: ['$transition$', 'filterService', ($transition: any, filterService: IFilterService<any>) => {
						if ('item' === $transition.from().name) {
							filterService.resetFilters();
						}
					}],
					views: {
						'content@listing': 'codex',
						'filters@listing': 'itemFilter',
					},
				},
				{
					name: 'item',
					url: '/{item}',
					parent: 'items',
					ncyBreadcrumb: {
						parent: 'items',
					},
					onEnter: ['$stateParams', '$state$', ($stateParams: any, $state$: IAppState) => {
						$state$.ncyBreadcrumb = $state$.ncyBreadcrumb || {};
						$state$.ncyBreadcrumb.label = data.getItemBySlug($stateParams.item)?.name;
					}],
					views: {
						'content@listing': {
							controller: 'ItemController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/item.html'),
						},
					},
				},
				{
					name: 'corporations',
					url: '/corporations',
					ncyBreadcrumb: {
						label: 'Corporations',
						parent: 'home',
					},
					onRetain: ['$transition$', 'filterService', ($transition: any, filterService: IFilterService<any>) => {
						if ('corporation' === $transition.from().name) {
							filterService.resetFilters();
						}
					}],
					parent: 'listing',
					resolve: {
						filterService: ['CorporationFiltersService', (service: CorporationFiltersService) => {
							return service;
						}],
						entityPreviewState: [() => {
							return 'corporation';
						}],
					},
					views: {
						'content@listing': 'codex',
						'filters@listing': 'corporationFilter',
					},
				},
				{
					name: 'corporation',
					url: '/{item}',
					parent: 'corporations',
					ncyBreadcrumb: {
						parent: 'corporations',
					},
					onEnter: ['$stateParams', '$state$', ($stateParams: any, $state$: IAppState) => {
						$state$.ncyBreadcrumb = $state$.ncyBreadcrumb || {};
						$state$.ncyBreadcrumb.label = data.getCorporationBySlug($stateParams.item)?.name;
					}],
					views: {
						'content@listing': {
							controller: 'CorporationController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/corporation.html'),
						},
						'filters@listing': {
							template: '', // 隐藏搜索框
						},
					},
				},
				{
					name: 'production',
					url: '/',
					parent: 'listing',
					ncyBreadcrumb: {
						label: 'Calculator',
					},
					views: {
						'content@listing': {
							controller: 'ProductionController',
							controllerAs: 'ctrl',
							template: require('@templates/Controllers/production.html'),
						},
					},
				},
			];
			appStates.forEach((state) => {
				$stateProvider.state(state);
			});

			// Set default route
			$urlRouterProvider.otherwise('/');
		}]);
		this.app.config([
			'$breadcrumbProvider',
			($breadcrumbProvider: angular.ncy.$breadcrumbProvider) => {
				$breadcrumbProvider.setOptions({
					template: require('@templates/Components/bootstrap4Breadcrumbs.html'),
					includeAbstract: true,
				});
			},
		]);
		this.app.run(['$transitions', '$rootScope', '$state', '$timeout', ($transitions: any, $rootScope: any, $state: any, $timeout: ITimeoutService) => {
			// Initialize DataProvider with default data (0.8 which contains StarRupture data)
			// IMPORTANT: data is now lazy-loaded as a separate chunk to reduce initial JS eval/TBT.
			$rootScope.dataLoading = true;
			$rootScope.dataLoadingError = null;
			DataProvider.change('0.8');

			// Block route transitions until data is ready, preventing controllers from touching undefined data.
			$transitions.onBefore({}, () => {
				return DataProvider.whenReady();
			});

			DataProvider.whenReady().then(() => {
				$rootScope.dataLoading = false;
				// Let index.html know data is ready so it can remove the initial static SEO block.
				try {
					document.dispatchEvent(new Event('st:data-ready'));
				} catch (e) {
					// ignore
				}
			}).catch((e) => {
				$rootScope.dataLoading = false;
				const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
				const debug = DataProvider.getLastDebug ? DataProvider.getLastDebug() : null;
				const err = (e && (e.message || e.toString())) ? (e.message || e.toString()) : 'Unknown error';
				$rootScope.dataLoadingError = isLocal
					? ('Failed to load game data. ' + err + ' | debug=' + JSON.stringify(debug))
					: 'Failed to load game data. Please refresh and try again.';
				console.error('[DataProvider] Failed to load data:', {error: e, debug: debug});
			});

			// Fix SEO: Add href and role to ui-select clear buttons (they are generated by the library)
			$timeout(() => {
				const fixUiSelectClearButtons = () => {
					const clearButtons = document.querySelectorAll('a[ng-click*="$select.clear"]:not([href])');
					clearButtons.forEach((btn: any) => {
						if (!btn.getAttribute('href')) {
							btn.setAttribute('href', '#');
							btn.setAttribute('role', 'button');
							btn.setAttribute('tabindex', '0');
							// Prevent default navigation
							btn.addEventListener('click', (e: Event) => {
								e.preventDefault();
							});
						}
					});
				};
				// Fix on initial load
				fixUiSelectClearButtons();
				// Fix on DOM changes (ui-select dynamically creates elements)
				const observer = new MutationObserver(fixUiSelectClearButtons);
				observer.observe(document.body, { childList: true, subtree: true });
			}, 100);

			const setMetaTag = (selector: string, attr: 'content'|'href', value: string) => {
				const el = document.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
				if (!el) {
					return;
				}
				el.setAttribute(attr, value);
			};

			const getAbsUrl = (path: string) => {
				// Always use absolute URLs for canonical/OG to avoid duplicate indexing.
				const origin = window.location.origin;
				if (!path.startsWith('/')) {
					path = '/' + path;
				}
				return origin + path;
			};

			const updateSeoMeta = () => {
				// NOTE: This is a SPA. Without SSR/prerender, crawlers may not fully execute JS,
				// but dynamic title/description/canonical still improves share previews and modern bot indexing.
				const stateName = ($state.current && $state.current.name) ? $state.current.name : '';
				const params: any = ($state.params || {});

				// Slightly longer title helps SEO and makes the browser tab clearer.
				// Keep the brand at the front so it still matches user expectations.
				let title = 'StarRupture Calculator - Production Planner & Database';
				let description = 'Production calculator and tools for StarRupture. Plan your industrial base, calculate production chains, and survive the Rupture cycles on planet Arcadia-7!';
				let urlPath = window.location.pathname;
				let imageUrl = getAbsUrl('/assets/images/icons/android-chrome-512x512.webp');

				// List pages
				if (stateName === 'production') {
					title = 'StarRupture Calculator - Production Planner & Database';
					urlPath = '/';
				} else if (stateName === 'home') {
					title = 'About - StarRupture Calculator';
					urlPath = '/about';
				} else if (stateName === 'items') {
					title = 'StarRupture Items Database';
					urlPath = '/items';
				} else if (stateName === 'buildings') {
					title = 'StarRupture Buildings Database';
					urlPath = '/buildings';
				} else if (stateName === 'schematics') {
					title = 'StarRupture Recipes Database';
					urlPath = '/blueprints';
				} else if (stateName === 'corporations') {
					title = 'StarRupture Corporations';
					urlPath = '/corporations';
				} else if (stateName === 'privacy-policy') {
					title = 'Privacy Policy - StarRupture Calculator';
					urlPath = '/privacy-policy';
				} else if (stateName === 'terms-of-service') {
					title = 'Terms of Service - StarRupture Calculator';
					urlPath = '/terms-of-service';
				}

				// Detail pages (use game data if available)
				if (stateName === 'item' && params.item) {
					const item = data.getItemBySlug(params.item);
					if (item) {
						title = `${item.name} - StarRupture Item`;
						description = item.description || description;
						urlPath = `/items/${item.slug}`;
						const icon = (item.icon || item.slug);
						imageUrl = getAbsUrl(`/assets/images/items/${icon}_256.webp`);
					}
				} else if (stateName === 'building' && params.item) {
					const building = data.getBuildingBySlug(params.item);
					if (building) {
						title = `${building.name} - StarRupture Building`;
						description = building.description || description;
						urlPath = `/buildings/${building.slug}`;
						const icon = (building.icon || building.slug);
						imageUrl = getAbsUrl(`/assets/images/items/${icon}_256.webp`);
					}
				} else if (stateName === 'schematic' && params.item) {
					const schematic = data.getSchematicBySlug(params.item);
					if (schematic) {
						title = `${schematic.name} - StarRupture Recipe`;
						description = schematic.description || description;
						urlPath = `/blueprints/${schematic.slug}`;
						// Prefer output item icon if present
						if (schematic.outputItem && schematic.outputItem.item) {
							const outItem = data.getItemByClassName(schematic.outputItem.item);
							if (outItem) {
								const icon = (outItem.icon || outItem.slug);
								imageUrl = getAbsUrl(`/assets/images/items/${icon}_256.webp`);
							}
						}
					}
				} else if (stateName === 'corporation' && params.item) {
					const corp = data.getCorporationBySlug(params.item);
					if (corp) {
						title = `${corp.name} - StarRupture Corporation`;
						description = corp.description || description;
						urlPath = `/corporations/${corp.slug}`;
						if (corp.icon) {
							imageUrl = getAbsUrl(`/assets/images/items/${corp.icon}_256.webp`);
						}
					}
				}

				const canonicalUrl = getAbsUrl(urlPath === '' ? '/' : urlPath);
				document.title = title;

				// Standard meta
				setMetaTag('meta[name="title"]', 'content', title);
				setMetaTag('meta[name="description"]', 'content', description);
				// Canonical
				setMetaTag('link[rel="canonical"]', 'href', canonicalUrl);

				// OpenGraph
				setMetaTag('meta[property="og:url"]', 'content', canonicalUrl);
				setMetaTag('meta[property="og:title"]', 'content', title);
				setMetaTag('meta[property="og:description"]', 'content', description);
				setMetaTag('meta[property="og:image"]', 'content', imageUrl);

				// Twitter
				setMetaTag('meta[property="twitter:url"]', 'content', canonicalUrl);
				setMetaTag('meta[property="twitter:title"]', 'content', title);
				setMetaTag('meta[property="twitter:description"]', 'content', description);
				setMetaTag('meta[property="twitter:image"]', 'content', imageUrl);
			};

			$transitions.onFinish({}, () => {
				const elements = document.getElementsByClassName('tooltip');
				for (const index in elements) {
					if (elements.hasOwnProperty(index)) {
						elements[index].remove();
					}
				}

				// Update meta tags after route change (SEO/share previews)
				$timeout(() => updateSeoMeta(), 0);
			});

			$timeout(() => {
				$('#modal').modal({
					backdrop: 'static',
					keyboard: false,
				});
			})
		}]);

		this.app.filter('number', () => {
			return AppModule.generateNumberFormattingFunction();
		});

		this.app.filter('numberShort', () => {
			return AppModule.generateShortNumberFormattingFunction();
		});

		this.app.directive('app', () => {
			return new AppDirective;
		});

		this.app.directive('itemIcon', () => {
			return new ItemIconDirective;
		});

		this.app.directive('perfectScrollbar', () => {
			return new PerfectScrollbarDirective;
		});

		this.app.directive('lazyLoad', () => {
			return new LazyLoadDirective;
		});

		this.app.directive('tooltip', () => {
			return {
				restrict: 'A',
				link: (scope: IScope, element: any, attrs: any) => {
					element = $(element);
					element.data('boundary', 'window');
					element.on('mouseenter', () => {
						element.tooltip('_fixTitle')
							.tooltip('show');
					}).on('mouseleave', () => {
						element.tooltip('hide');
					}).on('click', () => {
						element.tooltip('hide');
					});
				},
			};
		});

		this.app.component('visualization', new VisualizationComponent);
		this.app.component('itemFilter', new ItemFilterComponent);
		this.app.component('buildingFilter', new BuildingFilterComponent);
		this.app.component('schematicFilter', new SchematicFilterComponent);
		this.app.component('corporationFilter', new CorporationFilterComponent);
		this.app.component('applicationBreadcrumbs', new ApplicationBreadcrumbsComponent);
		this.app.component('entityListing', new EntityListingComponent);
		this.app.component('codex', new CodexComponent);
		this.app.component('tabs', new TabsComponent);
		this.app.component('recipesTable', new RecipesTableComponent);
		// details components
		this.app.component('manufacturerDetails', new ManufacturerDetailsComponent);
		this.app.component('extractorDetails', new ExtractorDetailsComponent);
		this.app.component('generatorDetails', new GeneratorDetailsComponent);
		this.app.component('otherBuildingDetails', new OtherBuildingsDetailsComponent);
		this.app.component('manufacturerRecipes', new ManufacturerRecipesComponent);
		this.app.component('extractorResources', new ExtractorResourcesComponent);
		this.app.component('generatorFuels', new GeneratorFuelsComponent);

		this.app.service('RecentlyVisitedItemsService', RecentlyVisitedItemsService);
		this.app.service('ItemFiltersService', ItemFiltersService);
		this.app.service('BuildingFiltersService', BuildingFiltersService);
		this.app.service('SchematicFiltersService', SchematicFiltersService);
		this.app.service('CorporationFiltersService', CorporationFiltersService);
		this.app.service('DataStorageService', DataStorageService);
		this.app.service('ComponentOptionsService', ComponentOptionsService);
		this.app.service('Data', () => data);

		this.app.controller('HomeController', HomeController);
		this.app.controller('PrivacyPolicyController', PrivacyPolicyController);
		this.app.controller('TermsOfServiceController', TermsOfServiceController);
		this.app.controller('ItemController', ItemController);
		this.app.controller('BuildingController', BuildingController);
		this.app.controller('SchematicController', SchematicController);
		this.app.controller('CorporationController', CorporationController);
		this.app.controller('ProductionController', ProductionController);
	}

	private static generateNumberFormattingFunction()
	{
		return (value: number) => {
			if (typeof value === 'undefined') {
				return 'NaN';
			} else if (value === ~~value) {
				return value;
			} else {
				return (Number(value)).toFixed(5).replace(/\.?0+$/, '');
			}
		};
	}

	private static generateShortNumberFormattingFunction()
	{
		return (value: number) => {
			if (typeof value === 'undefined') {
				return 'NaN';
			} else if (value === ~~value) {
				return value;
			} else {
				return (Number(value)).toFixed(3).replace(/\.?0+$/, '');
			}
		};
	}

}
