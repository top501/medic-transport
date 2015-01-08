
var async = require('async'),
    jsdump = require('jsDump'),
    driver = require('./driver'),
    adaptor = require('./adaptor');
    router = require('./router');
    crypto = require('crypto');
    status = require('./status');

/**
 * @namespace transport:
 */
exports.prototype = {

  SECRET: 'KJHD876LDF0K',
  STATUS_DELINEATOR: '$',

  /**
   * @name initialize:
   */
  initialize: function (_options) {

    this._options = (_options || {});
    //this can be false, in which case status is not checked
    if (this._options.status_check_interval === undefined) {
      this._options.status_check_interval = 360;
    }

    this._drivers = this._options.drivers || [];
    this._adaptor = this._options.adaptor;
    this._router = this._options.router;
    this._logger = new (winston.Logger)({
      transports: [
      new (winston.transports.Console)({
        label: "transport",
        level: (this._options.log_level || "warn")
      })
      ]
    });
    this._status = status.create({logger: this._logger});

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
          self._logger.error("unable to send message", _err);
        }
        return _callback(_err, _transmit_result);
      });
    });

    self._adaptor.register_error_handler(function (_err) {
      self._logger.error("adaptor error", {error: _err.toString()});
    });

    /* Driver-to-adaptor case:
        The application receives incoming messages via this path. */

    self._drivers.forEach(function(driver) {
      driver.register_receive_handler(function (_message, _callback) {
        driver.status_pending = false;
        if (_message.from == driver.phone_number &&
          self._status.validate_status_message(driver, _message.content)) {
            self._logger.debug("good status response received", {name: driver._options.name});
            _callback(null);
        } else {
          self._adaptor.deliver(_message, function (_err, _deliver_result) {
            if (_err) {
              self._logger.error("adaptor delivery error", _err);
            }
            return _callback(_err, _deliver_result);
          });
        }
      });
    });

    self._drivers.forEach(function(driver) {
      driver.register_error_handler(function (_err) {
        self._logger.error("driver error", _err);
      });
    });

    //cache the driver phone number before starting it
    self._drivers.forEach(function(driver) {
      driver.get_phone_number(function(phone_number) {
        if (!phone_number) {
          self._logger.error("unable to retrieve phone number", {name: driver._options.name});
          driver.set_state(false, function(_err) {
            if (_err) {
              self._logger.error("driver unable to set state ", _err);
            }
          });
          return;
        }
        driver.phone_number = phone_number;
        driver.set_state(true, function(_err) {
          if (_err) {
            self._logger.error("driver unable to set state", _err);
          }
        });
        driver.start();
        if (self._options.status_check_interval) {
          self._send_check_status_message(driver);
        }
      });
    });

    self._adaptor.start();

    return this;
  },

  _send_check_status_message: function(driver) {
    var self = this;
    this._logger.debug("polling driver status", {name: driver._options.name});
    driver.send({
      to: driver.phone_number,
      content: self._status.generate_status_message(driver)
    }, function (_err, _transmit_result) {
      if (_err) {
        driver.set_state(false, function(_err) {
          if (_err) {
            self._logger.error("driver unable to set state", _err);
          }
        });
        self._logger.error("error sending status message", _err);
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
    this._logger.debug('verifying driver status', {name: driver._options.name});
    if (driver.status_pending) {
      this._logger.warn('driver DOWN!', {name: driver._options.name});
      driver.set_state(false, function(_err) {
        if (_err) {
          self._logger.error("driver unable to set state", _err);
        }
      });
    }
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
  return new klass(arguments);
};
