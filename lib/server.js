var transport = require('./transport');
    fs = require('fs');
var file_name = process.argv[2];
var config = require(file_name);
var transport = transport.create(config.transport)
transport.load_adaptor(config.adaptor.name, config.adaptor)
transport.start();
