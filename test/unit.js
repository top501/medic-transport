var status = require('../lib/status');
    _ = require('underscore');

module.exports = {

  setUp: function (callback) {
    this._status = status.create();
    callback();
  },

  'ensure status message validates': function(test){
    var phone_number = '9876543210';
    var default_country_code = '1';
    var test_message = this._status.generate_status_message(
      phone_number, default_country_code);
    var result = this._status.validate_status_message(
      test_message, phone_number, default_country_code);
    test.ok(result.success, "status message invalid");

    test.done();
  },

  'status message with bad number fails to validate': function(test){
    var phone_number = '9876543210';
    var bad_phone_number = '1876543210';
    var default_country_code = '1';
    var test_message = this._status.generate_status_message(
      phone_number, default_country_code);
    var result = this._status.validate_status_message(
      test_message, bad_phone_number, default_country_code);
    test.ok(!result.success, "status message validated");

    test.done();
  },

  'ensure status message with bad signature does not validate': function(test){
    var phone_number = '9876543210';
    var default_country_code = '1';
    var test_message = this._status.generate_status_message(
      phone_number, default_country_code);
    var parts = test_message.split(this._status._delineator);
    var bad_timestamp = parseInt(parts[0]) + 1; //in the future
    var bad_message = bad_timestamp.toString() +
      this._status._delineator + parts[1];
    var  result = this._status.validate_status_message(
      bad_message, phone_number, default_country_code);
    test.ok(!result.success, "status message validate");

    test.done();
  },

  'ensure status message with bad timestamp does not validate': function(test){
    var phone_number = '9876543210';
    var default_country_code = '1';
    var test_message = this._status.generate_status_message(
      phone_number, default_country_code);
    var parts = test_message.split(this._status._delineator);
    var self = this;
    function validateTimestamp(timestamp) {
      //alter timestamp to muck up signature
      var bad_message = timestamp +
        self._status._delineator +
        self._status._generate_status_message_hash(
          timestamp, self._status._parse_phone_number(
            phone_number, default_country_code
            )
          );
      return self._status.validate_status_message(
        bad_message, phone_number, default_country_code);
    }

    test.ok(validateTimestamp(parts[0]).success,
      "status message with current timestampinvalid");
    test.ok(!validateTimestamp(parseInt(parts[0]) + 10).success,
      "status message with future timestamp valid");
    test.ok(validateTimestamp(parseInt(parts[0]) -
      this._status._acceptable_delay + 10).success,
      "status message with delayed timestamp invalid");
    test.ok(!validateTimestamp(parseInt(parts[0]) -
      this._status._acceptable_delay - 1).success,
      "status message with too delayed timestamp valid");

    test.done();
  }
};
