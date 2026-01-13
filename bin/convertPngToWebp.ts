#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 检查是否安装了 cwebp
function checkCwebpInstalled(): boolean {
	try {
		execSync('which cwebp', { stdio: 'ignore' });
		return true;
	} catch (e) {
		return false;
	}
}

// 转换单个 PNG 文件为 WebP
function convertPngToWebp(pngPath: string): void {
	const webpPath = pngPath.replace(/\.png$/i, '.webp');
	
	// 如果 WebP 文件已存在，跳过
	if (fs.existsSync(webpPath)) {
		console.log(`Skipping ${pngPath} (WebP already exists)`);
		return;
	}
	
	try {
		// 使用 cwebp 转换，质量设置为 85（平衡质量和文件大小）
		execSync(`cwebp -q 85 "${pngPath}" -o "${webpPath}"`, { stdio: 'pipe' });
		const pngSize = fs.statSync(pngPath).size;
		const webpSize = fs.statSync(webpPath).size;
		const savings = ((1 - webpSize / pngSize) * 100).toFixed(1);
		console.log(`✓ Converted: ${path.basename(pngPath)} (${(pngSize / 1024).toFixed(1)}KB → ${(webpSize / 1024).toFixed(1)}KB, ${savings}% smaller)`);
	} catch (error) {
		console.error(`✗ Failed to convert ${pngPath}:`, error);
	}
}

// 查找所有需要转换的 PNG 文件
function findPngFiles(): string[] {
	const imageDirs = [
		'www/assets/images/items',
		'www/assets/images/logo',
		'www/assets/images/icons'
	];
	
	const pngFiles: string[] = [];
	
	for (const dir of imageDirs) {
		if (!fs.existsSync(dir)) {
			console.log(`Directory not found: ${dir}`);
			continue;
		}
		
		const files = fs.readdirSync(dir, { withFileTypes: true });
		for (const file of files) {
			if (file.isFile() && /\.png$/i.test(file.name)) {
				pngFiles.push(path.join(dir, file.name));
			}
		}
	}
	
	return pngFiles;
}

// 主函数
function main(): void {
	console.log('PNG to WebP Converter\n');
	
	// 检查 cwebp 是否安装
	if (!checkCwebpInstalled()) {
		console.error('Error: cwebp is not installed.');
		console.error('Please install it first:');
		console.error('  macOS: brew install webp');
		console.error('  Ubuntu/Debian: sudo apt-get install webp');
		console.error('  Windows: Download from https://developers.google.com/speed/webp/download');
		process.exit(1);
	}
	
	// 查找所有 PNG 文件
	console.log('Finding PNG files...');
	const pngFiles = findPngFiles();
	
	if (pngFiles.length === 0) {
		console.log('No PNG files found to convert.');
		return;
	}
	
	console.log(`Found ${pngFiles.length} PNG file(s) to convert.\n`);
	
	// 转换每个文件
	let converted = 0;
	let skipped = 0;
	let failed = 0;
	
	for (const pngFile of pngFiles) {
		try {
			if (fs.existsSync(pngFile.replace(/\.png$/i, '.webp'))) {
				skipped++;
			} else {
				convertPngToWebp(pngFile);
				converted++;
			}
		} catch (error) {
			console.error(`Error processing ${pngFile}:`, error);
			failed++;
		}
	}
	
	console.log(`\nConversion complete!`);
	console.log(`  Converted: ${converted}`);
	console.log(`  Skipped: ${skipped}`);
	console.log(`  Failed: ${failed}`);
}

main();

