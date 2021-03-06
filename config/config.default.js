'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

config.mongo.uri = 'mongodb://127.0.0.1:27017/bip';
config.visualization.svgDirs.push('./node_modules/webgme-bip/src/svgs');
validateConfig(config);
module.exports = config;