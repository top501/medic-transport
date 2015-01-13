var winston = require('winston');
  libphonenumber = require('libphonenumber');
  crypto = require('crypto');
/**
* @namespace abstract:
*/
exports.prototype = {

  /**
  * @name initialize:
  */
  initialize: function (_options) {
    this._options = (this._options || {});
    this._secret = (this._options.secret || '123kj41l2k3hsad98');
    this._delineator = (this._options.delineator || '$');
    this._logger = (this._options.logger || winston);
    return this;
  },

  _parse_phone_number: function (number, default_country_code) {
    try {
      return libphonenumber.phoneUtil.format(
        libphonenumber.phoneUtil.parse(number,
          libphonenumber.phoneUtil.getRegionCodeForCountryCode(
            default_country_code
            )
          ),
        1); //1=INTL
    } catch (e) {
      this._logger.error("Unable to parse phone number", {
        number: number,
        error: e,
        default_country_code: default_country_code
      });
      return null;
    }
  },

  /** We generate an obfuscated status message by hashing
  * the driver phone number, the timestamp, and a secret.
  * This string can be verified against the timestamp to make
  * sure it's valid.
  **/
  _generate_status_message_hash: function (timestamp, phone) {
    return crypto.createHash('md5').update(
      timestamp + phone + this._secret).digest("hex");
  },

  /**
  * @name generate_status_message:
  *   Create's a hashed status message from the a phone number.
  *   Returns null if the phone number is invalid.
  */
  generate_status_message: function (
    driver_phone_number, default_country_code) {
    var phone = this._parse_phone_number(
      driver_phone_number, default_country_code);
    if (!phone) {
      return null;
    }
    var timestamp = Math.round(Date.now() / 1000);
    var hash = this._generate_status_message_hash(
      timestamp, phone);
    if (!hash) {
      return null;
    }
    return timestamp.toString() + this._delineator + hash;
  },

  /**
  * @name validate_status_message:
  *   Validates a status message against a phone number.
  *   Returns null on success, or an error message otherwise.
  */
  validate_status_message: function (
    message, driver_phone_number, default_country_code) {
    var phone = this._parse_phone_number(
      driver_phone_number, default_country_code);
    if (!phone) {
      return {error: "invalid phone number", success: false};
    }
    var parts = message.split(this._delineator);
    if (parts.length != 2) {
      this._logger.debug(
        "received message that was not the form of a status response",
        {message: message}
      );
      return {error: "not a valid status message", success: false};
    }
    var timestamp = parseInt(parts[0]);
    if (isNaN(timestamp)) {
      this._logger.debug(
        "received message that was not the form of a status response",
        {message: message}
      );
      return {error: "not a valid status message", success: false};
    }
    var period = Math.round(Date.now() / 1000) - timestamp;
    if (period < 0 || period > 60 * 60) {
      this._logger.warn(
        "received status response with bad timestamp",
        {message: message}
      );
      return {error: "status message had invalid timestamp", success: false};
    }
    var hash = this._generate_status_message_hash(timestamp, phone);
    if (hash != parts[1]) {
      this._logger.warn(
        "received status response with bad signature",
        {message: message}
      );
      return {error: "status message had invalid signature", success: false};
    }
    return {error: null, success: true};
  },
};

/**
* @name create:
*   Constructor. Create a new instance of the status
*   class and return it.
*/
exports.create = function (/* ... */) {
  var klass = function (_arguments) {
    return this.initialize.apply(this, _arguments);
  };

  klass.prototype = _.extend({}, exports.prototype);
  return new klass(arguments);
};
