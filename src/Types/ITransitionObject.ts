export interface ITransitionObject<T>
{

	abort: () => void;
	// Keep this loosely typed to avoid ui-router type export mismatches across environments (local vs CI/Vercel).
	to: () => any;
	params(): T;

}
