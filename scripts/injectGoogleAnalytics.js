/**
 * 构建后处理脚本：将环境变量中的 Google Analytics ID 注入到 HTML 文件中
 */
const fs = require('fs');
const path = require('path');

const GA_ID = process.env.GOOGLE_ANALYTICS_ID || process.env.GID || '';

if (!GA_ID) {
	console.warn('警告: 未设置 GOOGLE_ANALYTICS_ID 或 GID 环境变量，Google Analytics 将被禁用');
}

// 需要处理的 HTML 文件列表
const htmlFiles = [
	path.join(__dirname, '..', 'www', 'index.html'),
	path.join(__dirname, '..', 'www', 'about', 'index.html'),
	path.join(__dirname, '..', 'www', 'items', 'index.html'),
	path.join(__dirname, '..', 'www', 'buildings', 'index.html'),
	path.join(__dirname, '..', 'www', 'blueprints', 'index.html'),
	path.join(__dirname, '..', 'www', 'corporations', 'index.html'),
	path.join(__dirname, '..', 'www', 'privacy-policy', 'index.html'),
	path.join(__dirname, '..', 'www', 'terms-of-service', 'index.html'),
];

let processedCount = 0;

for (const htmlFile of htmlFiles) {
	if (!fs.existsSync(htmlFile)) {
		continue;
	}

		try {
		let content = fs.readFileSync(htmlFile, 'utf-8');
		
		// 替换占位符
		if (GA_ID) {
			content = content.replace(/__GOOGLE_ANALYTICS_ID__/g, GA_ID);
			fs.writeFileSync(htmlFile, content, 'utf-8');
			processedCount++;
		} else {
			// 如果没有设置 GA_ID，保留占位符（代码保留但不工作）
			// 这样在 Vercel 上设置环境变量后就能正常工作
			processedCount++;
		}
	} catch (error) {
		console.error(`处理文件失败: ${htmlFile}:`, error);
	}
}

if (GA_ID) {
	console.log(`✓ 已为 ${processedCount} 个 HTML 文件注入 Google Analytics ID: ${GA_ID}`);
} else {
	console.log(`⚠ 未设置环境变量，Google Analytics 代码已保留但未激活。请在 Vercel 上设置 GOOGLE_ANALYTICS_ID 或 GID 环境变量。`);
}
