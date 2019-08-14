// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeExternals = require('webpack-node-externals');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebpackShellPlugin = require('webpack-shell-plugin');

const { NODE_ENV = 'production' } = process.env;
module.exports = {
  watch: NODE_ENV === 'development',
  entry: './src/index.ts',
  mode: NODE_ENV,
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'index.js'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ['ts-loader']
      }
    ]
  },
  plugins:
    NODE_ENV === 'development'
      ? [
          new WebpackShellPlugin({
            onBuildEnd: ['yarn run:dev']
          })
        ]
      : []
};
