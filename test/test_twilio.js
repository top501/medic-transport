var driver = require('../lib/driver');
    _ = require('underscore');


module.exports = {

  setUp: function (callback) {
    this._bad_driver = driver.create('twilio',  {
      sid: 'ACe44caa8008e9f5e8e40a47ced42b367e',
      token: '0fae96141c89c26bffc834ad27eb8138',
      phone: '+15005550001',
      log_level: 'debug'
    });
    this._driver = driver.create('twilio',  {
      sid: 'ACe44caa8008e9f5e8e40a47ced42b367e',
      token: '0fae96141c89c26bffc834ad27eb8138',
      phone: '+15005550006',
      log_level: 'debug'
    });

    callback();
  },

  'send test message from invalid number': function(test) {
    this._driver.send({
      to: '+15005550006',
      content: 'test'
    }, function(_err, _result) {
      test.ok(_result.status == 'failure', 'status returned not failure');
      test.done();
    });
  },

  'send test message to invalid number': function(test) {
    this._driver.send({
      to: '+15005550001',
      content: 'test'
    }, function(_err, _result) {
      test.ok(_err.code == 21211);
      test.ok(_result.status == 'failure', 'status returned not failure');
      test.done();
    });
  },

  'send test message to valid number': function(test) {
    this._driver.send({
      to: '+15005550006',
      content: 'test'
    }, function(_err, _result) {
      test.ok(_result.status == 'success', 'status returned not success');
      test.done();
    });
  }
}
