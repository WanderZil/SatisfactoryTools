import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { execSync } from 'child_process';

/**
 * 将所有使用的图片文件转换为 WebP 格式，并删除未使用的 PNG 文件
 * 网站 icon（favicon 等）不转换
 */

const wwwImagesDir = path.join(__dirname, '..', 'www', 'assets', 'images', 'items');
const dataPath = path.join(__dirname, '..', 'data', 'data.json');

// 网站 icon 文件（不转换）
const iconFiles = [
	'favicon.ico',
	'apple-touch-icon.png',
	'favicon-32x32.png',
	'favicon-16x16.png',
	'site.webmanifest',
	'safari-pinned-tab.svg',
	'browserconfig.xml',
];

// 添加水印到图片
async function addWatermarkToImage(imageBuffer: Buffer | string, watermarkText: string = 'SRCC'): Promise<Buffer> {
	const metadata = await sharp(imageBuffer).metadata();
	const width = metadata.width || 64;
	const height = metadata.height || 64;
	
	// 根据图片尺寸计算水印大小
	const fontSize = Math.max(10, Math.floor(width * 0.2)); // 水印文字大小约为图片宽度的20%
	
	// 创建 SVG 水印（45度倾斜，浅灰色）
	const centerX = width / 2;
	const centerY = height / 2;
	
	const svgWatermark = `
		<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
			<text
				x="${centerX}"
				y="${centerY}"
				font-family="Arial, Helvetica, sans-serif"
				font-size="${fontSize}"
				font-weight="500"
				fill="#C0C0C0"
				fill-opacity="0.6"
				transform="rotate(-45 ${centerX} ${centerY})"
				text-anchor="middle"
				dominant-baseline="middle"
				style="user-select: none;"
			>${watermarkText}</text>
		</svg>
	`;
	
	const watermarkBuffer = Buffer.from(svgWatermark);
	
	return await sharp(imageBuffer)
		.composite([
			{
				input: watermarkBuffer,
				blend: 'over'
			}
		])
		.webp({ quality: 85 })
		.toBuffer();
}

// 从 data.json 中提取所有使用的图标名称
function getUsedIcons(): Set<string> {
	const usedIcons = new Set<string>();
	
	if (!fs.existsSync(dataPath)) {
		console.error(`数据文件不存在: ${dataPath}`);
		return usedIcons;
	}
	
	const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
	
	// 提取 items 的图标
	if (data.items) {
		for (const className in data.items) {
			const item = data.items[className];
			if (item.icon) {
				usedIcons.add(item.icon);
			}
			if (item.slug) {
				usedIcons.add(item.slug);
			}
		}
	}
	
	// 提取 buildings 的图标
	if (data.buildings) {
		for (const className in data.buildings) {
			const building = data.buildings[className];
			if (building.icon) {
				usedIcons.add(building.icon);
			}
			if (building.slug) {
				usedIcons.add(building.slug);
			}
		}
	}
	
	// 提取 corporations 的图标
	if (data.corporations) {
		for (const className in data.corporations) {
			const corp = data.corporations[className];
			if (corp.icon) {
				usedIcons.add(corp.icon);
			}
			if (corp.slug) {
				usedIcons.add(corp.slug);
			}
		}
	}
	
	// 提取 schematics 的图标
	if (data.schematics) {
		for (const className in data.schematics) {
			const schematic = data.schematics[className];
			if (schematic.icon) {
				usedIcons.add(schematic.icon);
			}
			if (schematic.slug) {
				usedIcons.add(schematic.slug);
			}
		}
	}
	
	return usedIcons;
}

// 检查文件是否是网站 icon
function isIconFile(filename: string): boolean {
	const basename = path.basename(filename);
	return iconFiles.some(icon => basename.includes(icon));
}

// 转换 PNG 为 WebP（64 和 256 尺寸）并添加水印
async function convertPngToWebp(pngPath: string, iconName: string): Promise<void> {
	try {
		const dir = path.dirname(pngPath);
		
		// 检查是否已经有对应的 webp 文件
		const webp64Path = path.join(dir, `${iconName}_64.webp`);
		const webp256Path = path.join(dir, `${iconName}_256.webp`);
		
		// 如果 webp 文件已存在且较新，跳过
		if (fs.existsSync(webp64Path) && fs.existsSync(webp256Path)) {
			const pngStat = fs.statSync(pngPath);
			const webp64Stat = fs.statSync(webp64Path);
			const webp256Stat = fs.statSync(webp256Path);
			
			if (webp64Stat.mtime >= pngStat.mtime && webp256Stat.mtime >= pngStat.mtime) {
				return; // 已转换且较新，跳过
			}
		}
		
		// 读取 PNG 文件并调整尺寸
		const resized64 = await sharp(pngPath)
			.resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.toBuffer();
		const watermarked64 = await addWatermarkToImage(resized64, 'SRCC');
		fs.writeFileSync(webp64Path, watermarked64);
		
		const resized256 = await sharp(pngPath)
			.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
			.toBuffer();
		const watermarked256 = await addWatermarkToImage(resized256, 'SRCC');
		fs.writeFileSync(webp256Path, watermarked256);
		
		console.log(`✓ 转换: ${path.basename(pngPath)} -> ${iconName}_64.webp, ${iconName}_256.webp`);
	} catch (error) {
		console.error(`✗ 转换失败: ${pngPath}:`, error);
	}
}

// 从文件名提取图标名称（支持多种格式）
function extractIconName(filename: string, usedIcons: Set<string>): string | null {
	const basename = path.basename(filename, '.png');
	
	// 尝试直接匹配（完整匹配）
	if (usedIcons.has(basename)) {
		return basename;
	}
	
	// 尝试匹配 _64 或 _256 后缀
	const withoutSize = basename.replace(/[-_]?(64|256|c)$/i, '');
	if (usedIcons.has(withoutSize)) {
		return withoutSize;
	}
	
	// 尝试匹配 T_ 前缀
	if (basename.startsWith('T_')) {
		if (usedIcons.has(basename)) {
			return basename;
		}
		const withoutT = basename.replace(/^T_/, '');
		if (usedIcons.has(withoutT)) {
			return withoutT;
		}
		// 尝试去掉 _Icon 后缀
		const withoutIcon = withoutT.replace(/_Icon$/, '');
		if (usedIcons.has(withoutIcon)) {
			return withoutIcon;
		}
	}
	
	// 尝试匹配 desc-、resourcesink-、research-、schematic- 前缀
	const prefixes = ['desc-', 'resourcesink-', 'research-', 'schematic-'];
	for (const prefix of prefixes) {
		if (basename.startsWith(prefix)) {
			// 提取基础名称（去掉前缀和尺寸后缀）
			const base = basename.replace(prefix, '').replace(/[-_]?(64|256|c)$/i, '');
			// 尝试精确匹配（去掉所有特殊字符）
			const normalizedBase = base.replace(/[-_]/g, '').toLowerCase();
			for (const icon of Array.from(usedIcons)) {
				const normalizedIcon = icon.replace(/[-_]/g, '').toLowerCase();
				if (normalizedIcon === normalizedBase || normalizedIcon.includes(normalizedBase) || normalizedBase.includes(normalizedIcon)) {
					return icon;
				}
			}
		}
	}
	
	// 最后尝试：模糊匹配（去掉所有特殊字符后比较）
	const normalizedBasename = basename.replace(/[-_T]/g, '').replace(/Icon|64|256|c/gi, '').toLowerCase();
	for (const icon of Array.from(usedIcons)) {
		const normalizedIcon = icon.replace(/[-_T]/g, '').replace(/Icon/gi, '').toLowerCase();
		if (normalizedIcon === normalizedBasename || normalizedIcon.includes(normalizedBasename) || normalizedBasename.includes(normalizedIcon)) {
			return icon;
		}
	}
	
	return null;
}

async function main() {
	console.log('开始转换所有使用的图片为 WebP 格式...\n');
	
	// 获取所有使用的图标名称
	console.log('读取 data.json 提取使用的图标...');
	const usedIcons = getUsedIcons();
	console.log(`找到 ${usedIcons.size} 个使用的图标\n`);
	
	// 查找所有 PNG 文件
	console.log('查找所有 PNG 文件...');
	const allPngFiles = fs.readdirSync(wwwImagesDir)
		.filter(file => file.endsWith('.png'))
		.map(file => path.join(wwwImagesDir, file));
	
	console.log(`找到 ${allPngFiles.length} 个 PNG 文件\n`);
	
	// 转换使用的 PNG 文件
	const converted = new Set<string>();
	const toDelete: string[] = [];
	
	for (const pngPath of allPngFiles) {
		const filename = path.basename(pngPath);
		
		// 跳过网站 icon
		if (isIconFile(filename)) {
			console.log(`⊘ 跳过网站 icon: ${filename}`);
			continue;
		}
		
		// 提取图标名称
		const iconName = extractIconName(filename, usedIcons);
		
		if (iconName) {
			// 转换使用的文件
			await convertPngToWebp(pngPath, iconName);
			converted.add(pngPath);
			// 转换完成后，也删除原 PNG 文件（因为已经有 WebP 版本了）
			toDelete.push(pngPath);
		} else {
			// 标记为删除（未使用的文件）
			toDelete.push(pngPath);
		}
	}
	
	console.log(`\n转换完成: ${converted.size} 个文件`);
	console.log(`待删除: ${toDelete.length} 个未使用的 PNG 文件\n`);
	
	// 删除未使用的 PNG 文件
	if (toDelete.length > 0) {
		console.log('删除未使用的 PNG 文件...');
		for (const pngPath of toDelete) {
			try {
				fs.unlinkSync(pngPath);
				console.log(`✓ 删除: ${path.basename(pngPath)}`);
			} catch (error) {
				console.error(`✗ 删除失败: ${pngPath}:`, error);
			}
		}
		console.log(`\n删除完成: ${toDelete.length} 个文件`);
	}
	
	console.log('\n✓ 所有操作完成！');
}

main().catch(console.error);
