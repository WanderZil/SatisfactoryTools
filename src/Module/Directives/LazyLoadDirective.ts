import {IDirective, IScope, IAttributes} from 'angular';

export class LazyLoadDirective implements IDirective
{
	public transclude = true;
	public restrict = 'A';
	public scope = false; // 不使用独立 scope，直接使用父 scope

	public link($scope: IScope, $element: JQLite, $attrs: IAttributes): void
	{
		let currentSrc: string | null = null;
		
		const updateImage = () => {
			const imgSrc = $attrs.imgSrc;
			if (imgSrc && imgSrc !== 'null' && imgSrc !== 'undefined' && imgSrc !== currentSrc) {
				currentSrc = imgSrc;
				const img = $element[0] as HTMLImageElement;
				if (img && img.src !== imgSrc) {
					img.src = imgSrc;
				}
			}
		};
		
		// 添加错误处理，当图片加载失败时隐藏图片
		const handleError = () => {
			const img = $element[0] as HTMLImageElement;
			if (img) {
				img.style.display = 'none';
			}
		};
		$element.on('error', handleError);
		
		const loadImg = (changes: IntersectionObserverEntry[]) => {
			changes.forEach((change: IntersectionObserverEntry) => {
				if (change.isIntersecting || change.intersectionRatio > 0) {
					updateImage();
				}
			});
		};

		// 使用 $observe 来监听属性变化，这是 Angular 推荐的方式，不会导致无限循环
		const unwatch = $attrs.$observe('imgSrc', (newValue: string) => {
			if (newValue && newValue !== currentSrc) {
				currentSrc = null; // 重置，强制更新
				updateImage();
			}
		});
		
		const observer = new IntersectionObserver(loadImg);
		observer.observe($element[0]);
		$element.on('$destroy', () => {
			observer.disconnect();
			if (unwatch) {
				unwatch();
			}
		});
	}
}
