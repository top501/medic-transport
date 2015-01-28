var driver = require('../lib/driver');
var router = require('../lib/router');
_ = require('underscore');


module.exports = {

  setUp: function (callback) {
    var bad_driver = driver.create('twilio',  {
      sid: 'ACe44caa8008e9f5e8e40a47ced42b367e',
      token: '0fae96141c89c26bffc834ad27eb8138',
      phone: '+15005550001',
      log_level: 'debug'
    });
    var good_driver = driver.create('twilio',  {
      sid: 'ACe44caa8008e9f5e8e40a47ced42b367e',
      token: '0fae96141c89c26bffc834ad27eb8138',
      phone: '+15005550006',
      log_level: 'debug'
    });
    this._router = router.create('simple',  {
      log_level: 'debug'
    });

    this._router.set_drivers([bad_driver, good_driver]);

    callback();
  },

  'send test message to invalid number': function(test) {
    this._router.send({
      to: '+15005550001',
      content: 'test'
    }, function(_err, _result) {
      test.ok(_result.status == 'failure', 'status returned not failure');
      test.done();
    });
  },

  'send test message to valid number': function(test) {
    this._router.send({
      to: '+15005550006',
      content: 'test'
    }, function(_err, _result) {
      test.ok(_result.status == 'success', 'status returned not success');
      test.done();
    });
  }
}
