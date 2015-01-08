var winston = require('winston');
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

  /** We generate an obfuscated status message by hashing
  the driver phone number, the timestamp, and a secret.
  This string can be verified against the timestamp to make
  sure it's valid
  **/
  _generate_status_message_hash: function(timestamp, driver_phone_number) {
    return crypto.createHash('md5').update(timestamp + driver_phone_number + this._secret).digest("hex");
  },

  /**
  * @name generate_status_message:
  *   Create's a hashed status message from the a phone number.
  */
  generate_status_message: function(driver_phone_number) {
    var timestamp = Math.round(Date.now() / 1000);
    var hash = this._generate_status_message_hash(timestamp, driver_phone_number);
    return timestamp.toString() + this._delineator + hash;
  },

  /**
  * @name validate_status_message:
  *   Validates a status message against a phone number.
  */
  validate_status_message: function(message, driver_phone_number) {
    var parts = message.split(this._delineator);
    if (parts.length != 2) {
      this._logger.debug(
        "received message that was not the form of a status response",
        {message: message}
      );
      return false;
    }
    var timestamp = parseInt(parts[0]);
    if (isNaN(timestamp)) {
      this._logger.debug(
        "received message that was not the form of a status response",
        {message: message}
      );
      return false;
    }
    var period = Math.round(Date.now() / 1000) - timestamp;
    if (period < 0 || period > 60 * 60) {
      this._logger.warn(
        "received status response with bad timestamp",
        {message: message}
      );
      return false;
    }
    var hash = this._generate_status_message_hash(timestamp, driver_phone_number);
    if (hash != parts[1]) {
      this._logger.warn(
        "received status response with bad signature",
        {message: message}
      );
      return false;
    }
    return true;
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
