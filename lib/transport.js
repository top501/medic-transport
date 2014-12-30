
var async = require('async'),
    jsdump = require('jsDump'),
    driver = require('./driver'),
    adaptor = require('./adaptor');

/**
 * @namespace transport:
 */
exports.prototype = {
  /**
   * @name initialize:
   */
  initialize: function (_options) {

    this._options = (_options || {});
    if (this._options.status_check_interval === undefined) {
      this._options.status_check_interval = 360;
    }

    this._driver = this._options.driver;
    this._adaptor = this._options.adaptor;

    return this;
  },

  /**
   * @name load_driver:
   */
  load_driver: function (_driver_name, _driver_options) {

    this._driver = driver.create(_driver_name, _driver_options);
    return this;
  },

  /**
   * @name load_adaptor:
   */
  load_adaptor: function (_adaptor_name, _adaptor_options) {

    this._adaptor = adaptor.create(_adaptor_name, _adaptor_options);
    return this;
  },

  /**
   * @name start:
   */
  start: function () {

    var self = this;

    if (!self._driver || !self._adaptor) {
      throw new Error('Please provide a valid adaptor and driver');
    }

    /* Adaptor-to-driver case:
        The application sends outgoing messages via this path. */

    self._adaptor.register_transmit_handler(function (_message, _callback) {
      self._driver.send(_message, function (_err, _transmit_result) {
        if (_err) {
          console.log('send error: ' + jsdump.parse(_err));
        }
        return _callback(_err, _transmit_result);
      });
    });

    self._adaptor.register_error_handler(function (_err) {
      console.log('adaptor error: ' + jsdump.parse(_err)); /* FIXME */
    });

    /* Driver-to-adaptor case:
        The application receives incoming messages via this path. */

    self._driver.register_receive_handler(function (_message, _callback) {
      self._driver.status_pending = false;
      if (_message.from == self._driver_phone_number &&
        self._validate_status_message(_message.content)) {
          console.log('DEBUG Got status update');
      } else {
        self._adaptor.deliver(_message, function (_err, _deliver_result) {
          if (_err) {
            console.log('deliver error: ' + jsdump.parse(_err));
          }
          return _callback(_err, _deliver_result);
        });
      }
    });

    self._driver.register_error_handler(function (_err) {
      console.log('driver error: ' + jsdump.parse(_err)); /* FIXME */
    });

    //cache the driver phone number before starting it
    self._driver.get_phone_number(function(phone_number) {
      if (!phone_number) {
        console.log('driver error - unable to retrieve phone number');
        self._driver.up = false;
        return;
      }
      self._driver_phone_number = phone_number;
      self._driver.up = true;
      self._driver.start();
      self._send_check_status_message();
    });

    self._adaptor.start();

    return this;
  },

  _send_check_status_message: function() {
    var self = this;


    console.log('DEBUG Sending status request to ' + self._driver_phone_number);
    self._driver.send({
      to: self._driver_phone_number,
      content: self._get_status_message()
    }, function (_err, _transmit_result) {
      if (_err) {
        self._driver.up = false;
        console.log('driver error - unable to send status message: ' + jsdump.parse(_err));
      }
    });

    //in a minute, verify we got it
    self._driver.status_pending = true;
    setTimeout(self._check_status.bind(this), 60000);

    //and schedule the next check
    setTimeout(self._send_check_status_message.bind(this), self._options.status_check_interval * 60000);
  },

  _check_status: function() {
    console.log('DEBUG Verifying status');
    if (this._driver.status_pending) {
      console.log('driver error -STATUS DOWN');
      this._driver.up = false;
    }
  },

  _get_status_message: function() {
    return "STATUS";
  },

  _validate_status_message: function(message) {
    return message == "STATUS";
  },

  /**
   * @name send:
   *   Pass-through method for the currently-loaded driver's
   *   `send` method. See the `driver/abstract.js` documentation
   *   for details regarding the calling/callback conventions.
   */
  send: function (_message, _callback) {

    return this._driver.send(_message, _callback);
  },

  /**
   * @name deliver:
   *   Pass-through method for the currently-loaded adaptor's
   *   `deliver` method. See the `adaptor/abstract.js` documentation
   *   for details regarding the calling/callback conventions.
   */
  deliver: function (_message, _callback) {

    return this._adaptor.deliver(_message, _callback);
  },

  /**
   * @name stop:
   *   Stop any polling and/or watch operations that are currently
   *   running on behalf of the loaded adaptor or driver.
   */
  stop: function () {

    if (this._adaptor) {
      this._adaptor.stop();
    }

    if (this._driver) {
      this._driver.stop();
    }

    return this;
  },

  /**
   * @name destroy:
   *   Release any resources currently held by this instance.
   */
  destroy: function () {

    return this.stop();
  }

};


/**
 * @name create:
 *   Constructor. Create a new instance of the `medic-transport`
 *   class and return it.
 */
exports.create = function (/* ... */) {

  var klass = function (_arguments) {
    return this.initialize.apply(this, _arguments);
  };

  klass.prototype = _.extend({}, exports.prototype);
  return new klass(Array.prototype.slice.call(arguments, 1));
};
