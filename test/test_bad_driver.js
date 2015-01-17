var status = require('../lib/status');
    _ = require('underscore');
    driver = require('../lib/driver');
    transport = require('../lib/transport');
    factory = require('../lib/factory');

module.exports = {

  setUp: function (callback) {
    this.transport = factory.create([{
      name: '../../test/bad_driver',
      id: 1,
      log_level: 'debug'
    }],
    {
      name: 'medic-mobile',
      user: 'admin',
      password: 'password',
      url: 'http://localhost:5984/medic/_design/medic/_rewrite',
      log_level: 'debug'
    },
    {
      name: 'simple',
      log_level: 'debug'
    },
    {
      default_country_code: '1',
      status_check_interval: 1, //default to every minute for testing
      log_level: 'debug'
    }
    );

    callback();
  },

  'load bad driver': function(test){
    test.ok(this.transport, "transport created");
    this.transport.start();
    test.done();
  }
};
