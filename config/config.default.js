'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

config.mongo.uri = 'mongodb://127.0.0.1:27017/bip';

validateConfig(config);
module.exports = config;