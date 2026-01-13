#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

/**
 * 给图片添加水印
 * @param inputPath 输入图片路径
 * @param outputPath 输出图片路径
 * @param watermarkText 水印文字
 */
async function addWatermark(inputPath: string, outputPath: string, watermarkText: string = 'SRCC'): Promise<void> {
	try {
		// 读取原始图片信息
		const metadata = await sharp(inputPath).metadata();
		const width = metadata.width || 64;
		const height = metadata.height || 64;
		
		// 根据图片尺寸计算水印大小
		const fontSize = Math.max(10, Math.floor(width * 0.2)); // 水印文字大小约为图片宽度的20%
		
		// 创建 SVG 水印（45度倾斜，浅灰色）
		// 计算旋转中心点
		const centerX = width / 2;
		const centerY = height / 2;
		
		// 创建 SVG 水印图层
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
		
		// 将 SVG 转换为 Buffer
		const watermarkBuffer = Buffer.from(svgWatermark);
		
		// 使用 sharp 合成图片和水印
		await sharp(inputPath)
			.composite([
				{
					input: watermarkBuffer,
					blend: 'over'
				}
			])
			.webp({ quality: 85 })
			.toFile(outputPath);
		
		console.log(`✓ 已添加水印: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
	} catch (error) {
		console.error(`✗ 添加水印失败: ${inputPath}:`, error);
		throw error;
	}
}

// 主函数
async function main(): Promise<void> {
	console.log('添加水印测试...\n');
	
	// 选择3张测试图片（包含64和256两种尺寸）
	const testImages = [
		'www/assets/images/items/T_Accumulator_Icon_64.webp',
		'www/assets/images/items/T_Accumulator_Icon_256.webp',
		'www/assets/images/items/T_AcidExtractor_Icon_64.webp',
		'www/assets/images/items/T_AcidExtractor_Icon_256.webp',
		'www/assets/images/items/T_Aerogel_Icon_64.webp',
		'www/assets/images/items/T_Aerogel_Icon_256.webp'
	];
	
	const outputDir = 'www/assets/images/items/watermarked';
	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir, { recursive: true });
	}
	
	for (const imagePath of testImages) {
		if (fs.existsSync(imagePath)) {
			const fileName = path.basename(imagePath);
			const outputPath = path.join(outputDir, fileName);
			await addWatermark(imagePath, outputPath, 'SRCC');
		} else {
			console.log(`⚠ 文件不存在: ${imagePath}`);
		}
	}
	
	console.log('\n✓ 测试完成！请查看 www/assets/images/items/watermarked/ 目录');
}

main().catch(console.error);
