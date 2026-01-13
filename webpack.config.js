const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const TSLintPlugin = require('tslint-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const path = require('path');

module.exports = (env, argv) => {
	const mode = (argv && argv.mode) ? argv.mode : 'development';
	const isProd = mode === 'production';

	return {
		// IMPORTANT: do not hardcode "development" here; Lighthouse should be run against production bundles.
		mode,

		// In dev we want fast rebuilds; in prod we want minimal parse/execute cost (TBT) and smaller transfer.
		devtool: isProd ? false : 'eval-cheap-module-source-map',

		entry: './src/app.ts',
		output: {
			// Emit bundles directly into www/assets so runtime chunk URLs are /assets/<chunk>.js
			// (avoids incorrect URLs like /assets/./www/assets/<chunk>.js which break chunk loading).
			path: path.join(__dirname, 'www', 'assets'),
			filename: 'app.js',
			chunkFilename: isProd ? '[name].[contenthash:8].js' : '[name].js',
			publicPath: '/assets/',
			// Avoid extra debug metadata in production bundles.
			pathinfo: !isProd,
		},
		plugins: [
			new webpack.IgnorePlugin({
				resourceRegExp: /(fs|child_process)/
			}),
			new TSLintPlugin({
				files: ['./src/**/*.ts'],
			}),
		],
		resolve: {
			plugins: [
				new TsconfigPathsPlugin,
			],
			extensions: ['.ts', '.tsx', '.js'],
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: [
						{
							loader: 'ts-loader',
						},
					],
					exclude: '/node_modules/',
				},
				{
					test: /\.html$/,
					use: [
						{
							loader: 'angular-templatecache-loader?module=app',
						},
					],
				},
				{
					test: /\.css$/i,
					use: ['style-loader', 'css-loader'],
				},
				{
					test: /\.scss$/,
					use: ['style-loader', 'css-loader', 'sass-loader'],
				},
			],
		},
		performance: {
			hints: false,
		},
		optimization: {
			minimize: isProd,
			minimizer: [
				new TerserPlugin({
					extractComments: false,
				}),
			],
		},
	};
};
