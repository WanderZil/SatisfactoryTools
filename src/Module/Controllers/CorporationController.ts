import data from '@src/Data/Data';
import {ICorporationSchema} from '@src/Schema/ICorporationSchema';
import {ITransitionObject} from '@src/Types/ITransitionObject';
import {IScope} from 'angular';
import {CorporationFiltersService} from '@src/Module/Services/CorporationFiltersService';
import {IItemSchema} from '@src/Schema/IItemSchema';
import {IBuildingSchema} from '@src/Schema/IBuildingSchema';

export class CorporationController
{

	public corporation: ICorporationSchema;
	public sortColumn: string = 'item';
	public sortReverse: boolean = false;
	public sortedExportedItems: Array<{item: IItemSchema, exportInfo: any}> = [];
	public static $inject = ['$state', '$transition$', 'CorporationFiltersService', '$scope'];

	public constructor(
		$state: any, $transition$: ITransitionObject<{item: string}>, private filterService: CorporationFiltersService, private $scope: IScope,
	)
	{
		const corporation = data.getCorporationBySlug($transition$.params().item);
		if (corporation === null) {
			$state.go($state.current.parent);
			return;
		}
		this.corporation = corporation;
		this.filterService.filter.query = this.corporation.name;
		this.updateSortedExportedItems();
		this.$scope.$watch(() => {
			return this.filterService.filter.query;
		}, (newValue) => {
			if (newValue !== corporation.name) {
				$state.go($state.current.parent);
			}
		});
	}

	public getItem(className: string): IItemSchema|null
	{
		return data.getItemByClassName(className);
	}

	public getBuilding(className: string): IBuildingSchema|null
	{
		return data.getBuildingByClassName(className);
	}

	public getExportedItems(): Array<{item: IItemSchema, exportInfo: any}> {
		const result: Array<{item: IItemSchema, exportInfo: any}> = [];
		const allItems = data.getAllItems();
		const corporationName = this.corporation.name;
		
		// 根据公司名称确定要查找的字段
		let exportField: string | null = null;
		if (corporationName === 'Selenian Corporation') {
			exportField = 'selenian';
		} else if (corporationName === 'Clever Robotics') {
			exportField = 'clever';
		} else if (corporationName === 'Future Health Solutions') {
			exportField = 'future';
		} else if (corporationName === 'Griffith Blue Corporation') {
			exportField = 'griffiths';
		} else if (corporationName === 'Moon Energy Corporation') {
			exportField = 'moon';
		}
		
		if (!exportField) {
			return result;
		}
		
		// 为每个物品的每个等级创建一行
		for (const key in allItems) {
			const item = allItems[key];
			if (item.export && (item.export as any)[exportField]) {
				const exportInfos = (item.export as any)[exportField];
				// 为每个等级创建一行
				for (const exportInfo of exportInfos) {
					result.push({
						item: item,
						exportInfo: exportInfo, // 单个等级信息
					});
				}
			}
		}
		
		// 按物品名称和等级排序
		result.sort((a, b) => {
			if (a.item.name !== b.item.name) {
				return a.item.name.localeCompare(b.item.name);
			}
			return a.exportInfo.level - b.exportInfo.level;
		});
		
		return result;
	}

	public resetFilter(): void
	{
		this.filterService.resetFilters();
	}

	public setSort(column: string): void
	{
		if (this.sortColumn === column) {
			this.sortReverse = !this.sortReverse;
		} else {
			this.sortColumn = column;
			this.sortReverse = false;
		}
		this.updateSortedExportedItems();
	}

	private updateSortedExportedItems(): void {
		const items = this.getExportedItems();
		const sorted = [...items];
		
		sorted.sort((a, b) => {
			let comparison = 0;
			
			if (this.sortColumn === 'item') {
				comparison = a.item.name.localeCompare(b.item.name);
			} else if (this.sortColumn === 'level') {
				comparison = a.exportInfo.level - b.exportInfo.level;
			} else if (this.sortColumn === 'value') {
				comparison = a.exportInfo.value - b.exportInfo.value;
			} else if (this.sortColumn === 'buildTime') {
				comparison = a.exportInfo.buildTime - b.exportInfo.buildTime;
			}
			
			return this.sortReverse ? -comparison : comparison;
		});
		
		this.sortedExportedItems = sorted;
	}

	public getSortIcon(column: string): string {
		if (this.sortColumn !== column) {
			return '';
		}
		return this.sortReverse ? 'fa-caret-up' : 'fa-caret-down';
	}

	public getRelatedCorporations(): ICorporationSchema[] {
		const allCorporations = data.getAllCorporations();
		const result: ICorporationSchema[] = [];
		
		for (const key in allCorporations) {
			const corp = allCorporations[key];
			// 排除当前公司和隐藏的公司
			if (corp.className !== this.corporation.className && !corp.bHidden) {
				result.push(corp);
			}
		}
		
		// 按名称排序
		result.sort((a, b) => a.name.localeCompare(b.name));
		
		return result;
	}

	public getCorporationSpecialty(): string {
		if (!this.corporation || !this.corporation.levels) {
			return '';
		}

		const specialties: string[] = [];
		let hasWeapons = false;
		let hasDrones = false;
		let hasProduction = false;
		let hasResearch = false;
		let hasEnergy = false;
		let hasLogistics = false;
		let hasCombat = false;
		let hasDefense = false;

		// 分析所有等级的奖励
		for (const level of this.corporation.levels) {
			// 检查建筑奖励
			if (level.buildingRewards) {
				for (const reward of level.buildingRewards) {
					if (reward.building) {
						const building = data.getBuildingByClassName(reward.building);
						if (building) {
							const buildingName = building.name.toLowerCase();
							const className = reward.building.toLowerCase();

							// 武器相关
							if (className.includes('armory') || className.includes('weapon') || className.includes('turret')) {
								hasWeapons = true;
								hasCombat = true;
							}
							// 无人机相关
							if (className.includes('drone') || className.includes('rail')) {
								hasDrones = true;
								hasLogistics = true;
							}
							// 生产相关
							if (className.includes('factory') || className.includes('smelter') || className.includes('furnace') ||
								className.includes('fabricator') || className.includes('manufacturer') || className.includes('compounder') ||
								className.includes('synthetizer') || className.includes('crafter') || className.includes('forge')) {
								hasProduction = true;
							}
							// 研究相关
							if (className.includes('research') || className.includes('terminal') || className.includes('lab')) {
								hasResearch = true;
							}
							// 能源相关
							if (className.includes('generator') || className.includes('power') || className.includes('energy') ||
								className.includes('battery') || className.includes('reactor')) {
								hasEnergy = true;
							}
							// 物流相关
							if (className.includes('exporter') || className.includes('redistributor') || className.includes('storage') ||
								className.includes('conveyor') || className.includes('splitter') || className.includes('merger')) {
								hasLogistics = true;
							}
							// 防御相关
							if (className.includes('turret') || className.includes('decoy') || className.includes('defense')) {
								hasDefense = true;
								hasCombat = true;
							}
						}
					}
				}
			}

			// 检查建筑集合奖励
			if (level.buildingCollectionRewards) {
				for (const reward of level.buildingCollectionRewards) {
					if (reward.buildingCollection) {
						const collection = reward.buildingCollection.toLowerCase();
						if (collection.includes('drone')) {
							hasDrones = true;
							hasLogistics = true;
						}
						if (collection.includes('pistol') || collection.includes('grenade') || collection.includes('weapon') || collection.includes('armory')) {
							hasWeapons = true;
							hasCombat = true;
						}
						if (collection.includes('platform')) {
							hasLogistics = true;
						}
					}
				}
			}

			// 检查功能奖励
			if (level.featureRewards) {
				for (const feature of level.featureRewards) {
					const featureLower = feature.toLowerCase();
					if (featureLower.includes('drone')) {
						hasDrones = true;
						hasLogistics = true;
					}
					if (featureLower.includes('pistol') || featureLower.includes('grenade') || featureLower.includes('weapon')) {
						hasWeapons = true;
						hasCombat = true;
					}
				}
			}

			// 检查物品奖励
			if (level.itemRewards) {
				for (const reward of level.itemRewards) {
					if (reward.item) {
						const item = data.getItemByClassName(reward.item);
						if (item) {
							const itemName = item.name.toLowerCase();
							const className = reward.item.toLowerCase();
							if (className.includes('armory') || className.includes('weapon') || className.includes('ammo') ||
								itemName.includes('weapon') || itemName.includes('ammo') || itemName.includes('grenade')) {
								hasWeapons = true;
								hasCombat = true;
							}
						}
					}
				}
			}
		}

		// 根据检测到的特色生成描述
		if (hasWeapons && hasCombat) {
			specialties.push('weapons and combat equipment');
		}
		if (hasDrones && hasLogistics) {
			specialties.push('drone logistics and automation');
		}
		if (hasProduction) {
			specialties.push('manufacturing and production facilities');
		}
		if (hasResearch) {
			specialties.push('research and development');
		}
		if (hasEnergy) {
			specialties.push('power generation and energy systems');
		}
		if (hasLogistics && !hasDrones) {
			specialties.push('logistics and resource management');
		}
		if (hasDefense && !hasWeapons) {
			specialties.push('base defense systems');
		}

		// 如果没有检测到特定特色，使用描述中的信息
		if (specialties.length === 0) {
			const desc = (this.corporation.description || '').toLowerCase();
			if (desc.includes('military') || desc.includes('weapon') || desc.includes('combat')) {
				specialties.push('military and combat technologies');
			} else if (desc.includes('drone') || desc.includes('logistic')) {
				specialties.push('drone logistics and automation');
			} else if (desc.includes('energy') || desc.includes('power')) {
				specialties.push('energy and power systems');
			} else if (desc.includes('health') || desc.includes('medical')) {
				specialties.push('medical and health technologies');
			} else if (desc.includes('production') || desc.includes('manufacturing')) {
				specialties.push('production and manufacturing');
			} else {
				specialties.push('various technologies and upgrades');
			}
		}

		return specialties.join(', ');
	}

}

