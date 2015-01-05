
var async = require('async'),
    jsdump = require('jsDump'),
    driver = require('./driver'),
    adaptor = require('./adaptor');
    router = require('./router');

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

    this._drivers = this._options.drivers || [];
    this._adaptor = this._options.adaptor;
    this._router = this._options.router;

    return this;
  },

  /**
   * @name load_driver:
   */
  load_driver: function (_driver_name, _driver_options) {
    this._drivers.push(driver.create(_driver_name, _driver_options));
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
  * @name load_router:
  */
  load_router: function (_router_name, _router_options) {

    this._router = router.create(_router_name, _router_options);
    return this;
  },

  /**
   * @name start:
   */
  start: function () {

    var self = this;

    if (self._drivers.length === 0 || !self._adaptor || !self._router) {
      throw new Error('Please provide a valid adaptor, router and driver');
    }

    self._router.set_drivers(self._drivers);

    /* Adaptor-to-driver case:
        The application sends outgoing messages via this path. */

    self._adaptor.register_transmit_handler(function (_message, _callback) {
      self._router.send(_message, function (_err, _transmit_result) {
        if (_err) {
          console.log('send error: ' + _err.toString());
        }
        return _callback(_err, _transmit_result);
      });
    });

    self._adaptor.register_error_handler(function (_err) {
      console.log('adaptor error: ' + _err.toString());
    });

    /* Driver-to-adaptor case:
        The application receives incoming messages via this path. */

    self._drivers.forEach(function(driver) {
      driver.register_receive_handler(function (_message, _callback) {
        driver.status_pending = false;
        if (_message.from == driver.phone_number &&
          self._validate_status_message(_message.content)) {
            console.log('DEBUG Got status update');
            _callback(null);
        } else {
          self._adaptor.deliver(_message, function (_err, _deliver_result) {
            if (_err) {
              console.log('deliver error: ' + _err.toString());
            }
            return _callback(_err, _deliver_result);
          });
        }
      });
    });

    self._drivers.forEach(function(driver) {
      driver.register_error_handler(function (_err) {
        console.log('driver error: ' + _err.toString());
      });
    });

    //cache the driver phone number before starting it
    self._drivers.forEach(function(driver) {
      driver.get_phone_number(function(phone_number) {
        if (!phone_number) {
          console.log('driver error - unable to retrieve phone number');
          driver.up = false;
          return;
        }
        driver.phone_number = phone_number;
        driver.up = true;
        driver.start();
        self._send_check_status_message(driver);
      });
    });

    self._adaptor.start();

    return this;
  },

  _send_check_status_message: function(driver) {
    var self = this;

    console.log('DEBUG Sending status request to ' + driver.phone_number);
    driver.send({
      to: driver.phone_number,
      content: self._get_status_message()
    }, function (_err, _transmit_result) {
      if (_err) {
        driver.up = false;
        console.log('driver error - unable to send status message: ' + _err.toString());
      }
    });

    //in a minute, verify we got it
    driver.status_pending = true;
    setTimeout(function() { self._check_status(driver); }, 60000);

    //and schedule the next check
    setTimeout(function() {
      self._send_check_status_message(driver);
    }, self._options.status_check_interval * 60000);
  },

  _check_status: function(driver) {
    console.log('DEBUG Verifying status');
    if (driver.status_pending) {
      console.log('driver error -STATUS DOWN');
      driver.up = false;
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
   *   Pass-through method for the currently-loaded routers
   *   `send` method. See the `driver/abstract.js` documentation
   *   for details regarding the calling/callback conventions.
   */
  send: function (_message, _callback) {

    return this._router.send(_message, _callback);
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
