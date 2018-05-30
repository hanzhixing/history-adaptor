const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        'main': [
            'babel-polyfill',
            './demo.js',
        ],
    },
    output: {
        filename: '[name].js',
        devtoolModuleFilenameTemplate: 'webpack:///[absolute-resource-path]',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                    },
                },
            },
        ],
    },
    devServer: {
        hot: true,
        disableHostCheck: true,
        stats: 'minimal',
    },
    plugins: [
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin(),
    ],
};
