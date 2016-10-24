const path = require('path');

const webpack = require('webpack');


module.exports = {
  entry: {
    demo: path.resolve(__dirname, 'src/demo/demo.js')
  },
  devServer: {
    contentBase: './src',
    inline: true
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    filename: '[name]/[name].js'
  },
  devtool: 'inline-source-map',
  resolve: {
    extensions: ['', '.js', '.json']
  },
  module: {
    loaders: [
      {
        test: /\.html$/,
        loader: 'html'
      },
      {
        test: /\.json$/,
        loader: 'json'
      },
      {
        test: /\.css$/,
        loader: 'style!css'
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg)$/,
        loader: 'file'
      }
    ]
  },
  externals: ['ws'],
  plugins: [
    new webpack.ContextReplacementPlugin(/bindings$/, /^$/)
  ]
};
