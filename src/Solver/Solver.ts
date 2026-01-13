import {IProductionToolResponse} from '@src/Tools/Production/IProductionToolResponse';
import {IProductionDataApiRequest} from '@src/Tools/Production/IProductionData';
import {LocalSolver} from '@src/Solver/LocalSolver';

export class Solver
{

	public static solveProduction(productionRequest: IProductionDataApiRequest, callback: (response: IProductionToolResponse) => void): void
	{
		// 使用本地求解器替代在线 API
		LocalSolver.solveProduction(productionRequest, callback);
	}

}
