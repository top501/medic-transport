var status = require('../lib/status');
    _ = require('underscore');

exports.testStatusMonitoring = function(test){
  var _status = status.create();

  var phone_number = '9876543210';
  var default_country_code = '1';
  var test_message = _status.generate_status_message(
    phone_number, default_country_code);
  var result = _status.validate_status_message(
    test_message, phone_number, default_country_code);
  test.ok(result.success, "status message validates");
  
  test.done();
};
