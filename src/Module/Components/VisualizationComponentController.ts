import {IController, IScope, ITimeoutService} from 'angular';
import {IVisNode} from '@src/Tools/Production/Result/IVisNode';
import {IVisEdge} from '@src/Tools/Production/Result/IVisEdge';
import {IElkGraph} from '@src/Solver/IElkGraph';
import {Strings} from '@src/Utils/Strings';
import model from '@src/Data/Model';
import {ProductionResult} from '@src/Tools/Production/Result/ProductionResult';

declare const require: any;

export class VisualizationComponentController implements IController
{

	public result: ProductionResult;

	public static $inject = ['$element', '$scope', '$timeout'];

	private unregisterWatcherCallback: () => void;
	private network: any;
	private fitted: boolean = false;

	public constructor(private readonly $element: any, private readonly $scope: IScope, private readonly $timeout: ITimeoutService) {}

	// Heavy visualization libs are loaded on-demand to reduce unused JS on initial page load.
	private visDataSetCtor: any|null = null;
	private visNetworkCtor: any|null = null;
	private elkCtor: any|null = null;
	private cytoscapeFn: any|null = null;


	public $onInit(): void
	{
		this.unregisterWatcherCallback = this.$scope.$watch(() => {
			return this.result;
		}, (newValue) => {
			this.updateData(newValue);
		});
	}

	public $onDestroy(): void
	{
		this.unregisterWatcherCallback();
	}

	private ensureVisLayoutLibs(): Promise<void>
	{
		if (this.visDataSetCtor && this.visNetworkCtor && this.elkCtor) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			try {
				console.log('[Visualization] Loading vis-network and elkjs libraries...');
				
				// Since vis-network and elkjs are already imported in other files,
				// they should be available via require. Try direct require first.
				const vis = require('vis-network');
				const elkMod = require('elkjs/lib/elk.bundled');
				
				this.visDataSetCtor = vis.DataSet || (vis.default && vis.default.DataSet);
				this.visNetworkCtor = vis.Network || (vis.default && vis.default.Network);

				if (!this.visDataSetCtor || !this.visNetworkCtor) {
					throw new Error('Failed to get DataSet or Network from vis-network');
				}

				this.elkCtor = elkMod.default || elkMod;

				if (!this.elkCtor) {
					throw new Error('Failed to get ELK constructor');
				}

				console.log('[Visualization] Libraries initialized successfully');
				resolve();
			} catch (e) {
				console.error('[Visualization] Error loading/initializing libraries:', e);
				// If direct require fails, try require.ensure as fallback
				if (require && require.ensure) {
					console.log('[Visualization] Trying require.ensure as fallback...');
					require.ensure(['vis-network', 'elkjs/lib/elk.bundled'], () => {
						try {
							const vis = require('vis-network');
							const elkMod = require('elkjs/lib/elk.bundled');
							this.visDataSetCtor = vis.DataSet || (vis.default && vis.default.DataSet);
							this.visNetworkCtor = vis.Network || (vis.default && vis.default.Network);
							this.elkCtor = elkMod.default || elkMod;
							console.log('[Visualization] Libraries loaded via require.ensure');
							resolve();
						} catch (err) {
							console.error('[Visualization] Error in require.ensure callback:', err);
							reject(err);
						}
					}, 'vis-elk');
				} else {
					reject(e);
				}
			}
		});
	}

	private ensureCytoscapeLibs(): Promise<void>
	{
		if (this.cytoscapeFn) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			if (!require || !require.ensure) {
				const error = new Error('require.ensure is not available (webpack code-splitting expected)');
				console.error('[Visualization]', error);
				reject(error);
				return;
			}

			console.log('[Visualization] Loading cytoscape libraries...');
			require.ensure(['cytoscape', 'cytoscape-node-html-label'], () => {
				try {
					console.log('[Visualization] Cytoscape libraries loaded, initializing...');
					const cyMod = require('cytoscape');
					const cy = cyMod.default || cyMod;
					this.cytoscapeFn = cy;

					if (!this.cytoscapeFn) {
						throw new Error('Failed to get cytoscape function');
					}

					// Register plugin at runtime (previously done in app.ts).
					const pluginMod = require('cytoscape-node-html-label');
					const nodeHtmlLabel = pluginMod.default || pluginMod;
					nodeHtmlLabel(cy);

					console.log('[Visualization] Cytoscape libraries initialized successfully');
					resolve();
				} catch (e) {
					console.error('[Visualization] Error initializing cytoscape libraries:', e);
					reject(e);
				}
			}, 'cytoscape');
		});
	}

	public useCytoscape(result: ProductionResult): void
	{
		this.ensureCytoscapeLibs().then(() => {
			const cytoscape = this.cytoscapeFn;
			if (!cytoscape) {
				console.error('[Visualization] cytoscape function is null after loading');
				return;
			}

			const options: any = {
				container: this.$element[0],
			};
			options.layout = {
				name: 'elk',
				fit: true,
				padding: 200,
				nodeDimensionIncludeLabels: true,
				elk: {
					algorithm: 'layered',
					edgeRouting: 'POLYLINE',
					'spacing.nodeNode': 200,
				},
			} as any;

			const elements: any[] = [];
			for (const node of result.graph.nodes) {
				elements.push({
					data: {
						id: node.id.toString(),
						label: node.getTitle(),
					},
					position: {
						x: 1,
						y: 1,
					},
				});
			}

			for (const edge of result.graph.edges) {
				elements.push({
					data: {
						id: edge.id.toString(),
						source: edge.from.id.toString(),
						target: edge.to.id.toString(),
						label: edge.itemAmount.item,
					},
				});
			}

			options.elements = elements;
			options.style = [
				{
					selector: 'node[label]',
					style: {
						width: 'label',
						height: 'label',
						shape: 'round-rectangle',
						'font-size': '12px',
						label: 'data(label)',
						'text-valign': 'center',
						'text-halign': 'center',
					},
				},
				{
					selector: 'edge[label]',
					style: {
						label: 'data(label)',
						width: 3,
						'curve-style': 'segments',
					},
				},
			];

			cytoscape(options as any);
		}).catch((error) => {
			console.error('[Visualization] Failed to load cytoscape libraries:', error);
		});
	}

	public useVis(result: ProductionResult): void
	{
		this.ensureVisLayoutLibs().then(() => {
			const DataSet = this.visDataSetCtor;
			if (!DataSet) {
				console.error('[Visualization] DataSet is null after loading vis-network');
				return;
			}

			const nodes = new DataSet();
			const edges = new DataSet();

			for (const node of result.graph.nodes) {
				nodes.add(node.getVisNode());
			}

			for (const edge of result.graph.edges) {
				const smooth: any = {
					enabled: false,
				};

				if (edge.to.hasOutputTo(edge.from)) {
					smooth.enabled = true;
					smooth.type = 'curvedCW'
					smooth.roundness = 0.2;
				}

				edges.add({
					id: edge.id,
					from: edge.from.id,
					to: edge.to.id,
					label: model.getItem(edge.itemAmount.item).prototype.name + '\n' + Strings.formatNumber(edge.itemAmount.amount) + ' / min',
					color: {
						color: 'rgba(105, 125, 145, 1)',
						highlight: 'rgba(134, 151, 167, 1)',
					},
					font: {
						color: 'rgba(238, 238, 238, 1)',
					},
					smooth: smooth,
				} as any);
			}

			this.network = this.drawVisualisation(nodes, edges);

			this.$timeout(0).then(() => {
				const elkGraph: IElkGraph = {
					id: 'root',
					layoutOptions: {
						'elk.algorithm': 'org.eclipse.elk.layered',
						'org.eclipse.elk.layered.nodePlacement.favorStraightEdges': true as unknown as string, // fuck off typescript
						'org.eclipse.elk.spacing.nodeNode': 40 + '',
					},
					children: [],
					edges: [],
				};

				nodes.forEach((node: any) => {
					elkGraph.children.push({
						id: node.id.toString(),
						width: 250,
						height: 100,
					});
				});
				edges.forEach((edge: any) => {
					elkGraph.edges.push({
						id: '',
						source: edge.from.toString(),
						target: edge.to.toString(),
					});
				});

				this.$timeout(0).then(() => {
					const ELK = this.elkCtor;
					if (!ELK) {
						return;
					}

					const elk = new ELK();
					elk.layout(elkGraph).then((data: any) => {
						nodes.forEach((node: any) => {
							const id = node.id;
							if (data.children) {
								for (const item of data.children) {
									if (parseInt(item.id, 10) === id) {
										nodes.update({
											id: id,
											x: item.x,
											y: item.y,
										});
										return;
									}
								}
							}
						});

						if (!this.fitted) {
							this.fitted = true;
							this.network.fit();
						}
					});
				});
			});
		}).catch((error) => {
			console.error('[Visualization] Failed to load vis-network/elkjs libraries:', error);
		});
	}

	public updateData(result: ProductionResult|undefined): void
	{
		if (!result) {
			return;
		}

		this.fitted = false;

		let use;
		use = 'vis';

		if (use === 'cytoscape') {
			this.useCytoscape(result);
		} else {
			this.useVis(result);
		}
	}

	private drawVisualisation(nodes: any, edges: any): any
	{
		const Network = this.visNetworkCtor;
		return new Network(this.$element[0], {
			nodes: nodes,
			edges: edges,
		}, {
			edges: {
				labelHighlightBold: false,
				font: {
					size: 14,
					multi: 'html',
					strokeColor: 'rgba(0, 0, 0, 0.2)',
				},
				arrows: 'to',
				smooth: false,
			},
			nodes: {
				labelHighlightBold: false,
				font: {
					// align: 'left',
					size: 14,
					multi: 'html',
				},
				margin: {
					top: 10,
					left: 10,
					right: 10,
					bottom: 10,
				},
				shape: 'box',
				widthConstraint: {
					minimum: 50,
					maximum: 250,
				},
				// widthConstraint: 225,
			},
			physics: {
				enabled: false,
			},
			layout: {
				improvedLayout: false,
				hierarchical: false,
			},
			interaction: {
				tooltipDelay: 0,
			},
		});
	}

}
