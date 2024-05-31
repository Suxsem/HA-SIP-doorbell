const path = require('path');

module.exports = {
  entry: {
    'sip-doorbell': './src/sip-doorbell.ts'
  },
  //devtool: 'inline-source-map',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js?$/,
        resolve: {
          fullySpecified: false
        },
        use: 'ts-loader'
      },
      {
        test: /\.ts?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  }
};
