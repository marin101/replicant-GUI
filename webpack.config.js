const path = require('path');
const webpack = require('webpack');

module.exports = {
  // Path for the entry point
  context: path.resolve(__dirname, 'static', 'jsx'),

  // TODO: May not be necessary
  devServer: {
    port: 5000,
    historyApiFallback: {
      index: 'templates/index.html'
    }
  },

  entry: {
    app: ['./app.jsx'],

    vendor: [
		'js-yaml',

		'react',
		'react-dom',
		'react-redux',
		'react-router-dom',
		'react-bootstrap-table'
    ]
  },

  output: {
    path: path.resolve(__dirname, 'static'),
    filename: 'app.bundle.js',
  },

  module: {
    rules: [
      {
        test: /.jsx$/,
        loader: 'babel-loader',
        exclude: [/node_modules/, /templates/],
        query: {
          presets: [
		      // Should I let babel do the es6 -> es5 conversion
            ['es2015', {"modules": false}],
            'react'
          ]
        }
      },
      {
        test: /\.css$/,
        loader: 'style-loader!css-loader'
      },
      {
        test: /\.ttf(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=application/octet-stream"
	  },
/*
      {
        test: /\.eot(\?v=\d+\.\d+\.\d+)?$/,
        loader: "file"
      },
      {
        test: /\.(woff|woff2)$/,
        loader:"url?prefix=font/&limit=5000"
      },
*/
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        loader: "url?limit=10000&mimetype=image/svg+xml"
      }
    ]
  },

  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      filename: "vendor.bundle.js"
    }),
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery"
	})
  ]
};

