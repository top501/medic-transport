
var async = require('async'),
    jsdump = require('jsDump'),
    driver = require('./driver'),
    adaptor = require('./adaptor');
    router = require('./router');
    crypto = require('crypto');
    status = require('./status');

/**
 * @namespace transport
 *  Transport routes messages from the the adapter to the router, and from the
 *  drivers back to the adapter. It also tracks driver status and monitors their
 *  status using round-trip SMS.
 */
exports.prototype = {

  SECRET: 'KJHD876LDF0K',
  STATUS_DELINEATOR: '$',

  /**
  * milliseconds to wait for the status message round trip,
  * MUST be less than the status message interval
  */
  STATUS_WAIT_TIME: 30000,

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
        timestamp: true,
        level: (this._options.log_level || "warn")
      })
      ]
    });
    this._status = status.create({logger: this._logger});

    //cached data about each driver is stored in this array
    //the indices of objects in this array match the indices
    //of the associated driver
    this._driver_data = new Array(
      this._drivers.length
    ).map(function(){return {};});
    this._adaptor_data = {};

    return this;
  },

  /**
   * @name load_driver:
   */
  load_driver: function (_driver_name, _driver_options) {
    this._drivers.push(driver.create(_driver_name, _driver_options));
    this._driver_data.push({});
    return this;
  },

  /**
   * @name load_adaptor:
   */
  load_adaptor: function (_adaptor_name, _adaptor_options) {
    this._adaptor = adaptor.create(_adaptor_name, _adaptor_options);
    this._adaptor_data = {};
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
  start: function() {
    var self = this;
    if (!self._adaptor) {
      throw new Error('Please provide a valid adaptor');
    }

    self._adaptor.get_configuration(function(err, config) {
      if (err) {
        logger.warn("Could not retrieve configuration from adapter." +
          " Continuing regardless...");
      } else {
        config.drivers.forEach(function(driver_config) {
          self.load_driver(driver_config.name, driver_config);
        });
        self.load_router(config.router.name, config.router);
      }
      self._start_preconfigured();
    });
  },

  _start_preconfigured: function () {
    var self = this;

    if (self._drivers.length === 0 || !self._adaptor || !self._router) {
      throw new Error('Please provide a valid adaptor, router and driver');
    }

    self._router.set_drivers(self._drivers);

    /* Adaptor-to-driver case:
        The application sends outgoing messages via this path. */
    var currently_sending = [];
    self._adaptor.register_transmit_handler(function (_message, _callback) {
      if (!currently_sending[_message.uuid]) {
        currently_sending[_message.uuid] = true;
        self._router.send(_message, function (_err, _transmit_result) {
          currently_sending[_message.uuid] = false;
          if (_err) {
            self._logger.error("unable to send message", _err);
          }
          return _callback(_err, _transmit_result);
        });
      }
    });

    self._adaptor.register_error_handler(function (_err) {
      self._logger.error("adaptor error", {error: _err.toString()});
    });

    /* Driver-to-adaptor case:
        The application receives incoming messages via this path. */

    self._drivers.forEach(function(driver, idx) {
      driver.register_receive_handler(function (_message, _callback) {
        self._driver_data[idx].last_message_timestamp = Date.now();
        //if there's no phone number, then dont run check
        var is_status_message;
        if (self._driver_data[idx].phone_number) {
          is_status_message = self._status.check_message_is_from_driver(
            _message,
            self._driver_data[idx].phone_number,
            self._adaptor_data.default_country_code).success
        } else {
          is_status_message = false;
        }
        if (is_status_message) {
          var result = self._status.validate_status_message(
            _message.content,
            self._driver_data[idx].phone_number,
            self._adaptor_data.default_country_code
            );
          if (!result.success) {
            self._logger.error(result.error);
            return;
          }
          self._logger.debug("good status response received",
            {name: driver._options.name});
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

    //fire up the adaptor, and tell it to start drivers when it's ready
    if (self._adaptor.get_default_country_code) {
      self._adaptor.get_default_country_code(function(default_country_code) {
        if (!default_country_code) {
          self._logger.error("unable to retrieve default country code" +
          "from adaptor");
        }
        self._start_adaptor_with_default_country_code(
          default_country_code, self_start_drivers.bind(self));
      });
    } else {
      self._start_adaptor_with_default_country_code(
        null, self._start_drivers.bind(self));
    }
    return this;
  },

  /**
  * @name _start_drivers:
  *  Preps and starts each driver.
  */
  _start_drivers: function() {
    var self = this;
    //cache the driver phone number before starting it
    this._drivers.forEach(function(driver, idx) {
      driver.get_phone_number(function(phone_number) {
        if (!phone_number || phone_number == '') {
          self._logger.warn("unable to retrieve phone number", {name: driver._options.name});
        } else {
          self._driver_data[idx].phone_number = phone_number;
        }
        driver.set_state(true, function(_err) {
          if (_err) {
            self._logger.error("driver unable to set state", _err);
          }
        });
        self._logger.debug("starting driver", {name: driver._options.name});
        driver.start();
        if (self._options.status_check_interval > 0) {
          self._send_check_status_message(idx);
        }
      });
    });
  },

  /**
  * @name _start_adaptor_with_default_country_code:
  *  Starts the adaptor with a given default country code,
  *  and makes a callback when it's ready.
  */
  _start_adaptor_with_default_country_code: function(
    default_country_code, callback) {
    if (!default_country_code) {
      default_country_code = this._options.default_country_code;
      if (!default_country_code) {
        this._logger.error("no local default country_code specified");
        return;
      }
    }

    this._adaptor_data.default_country_code = default_country_code;
    this._adaptor.start();
    callback();
  },

  /**
    @name _send_check_status_message
  *     Begins checking status of the driver identified by index.
  *
  *     Call this only once, it begins a loop.
  **/
  _send_check_status_message: function(idx) {
    var self = this;
    var driver = this._drivers[idx];
    //and schedule the next check
    setTimeout(function() {
      self._send_check_status_message(idx);
    }, self._options.status_check_interval * 60000);

    //don't poll if we don't have a phone number
    if (!self._driver_data[idx].phone_number) {
      return;
    }

    this._logger.debug("polling driver status", {name: driver._options.name});
    var content = self._status.generate_status_message(
      self._driver_data[idx].phone_number, self._adaptor_data.default_country_code);
    if (!content) {
      self._logger.error("unable to generate status message " +
      "(check driver phone number)");
      driver.set_state(false, function(_err) {
        if (_err) {
          self._logger.error("driver unable to set state", _err);
        }
      });
      return;
    }
    driver.send({
      to: self._driver_data[idx].phone_number,
      content: content
    }, function (_err, _transmit_result) {
      if (_err) {
        driver.set_state(false, function(_err) {
          if (_err) {
            self._logger.error("driver unable to set state", _err);
          }
        });
        self._logger.error("error sending status message", _err);
        return;
      }

      //in 30 seconds, verify we got it
      setTimeout(function() { self._check_status(idx); }, self.STATUS_WAIT_TIME);
    });
  },

  _check_status: function(idx) {
    var driver = this._drivers[idx];
    this._logger.debug('verifying driver status', {name: driver._options.name});
    if (Date.now() - this._driver_data[idx].last_message_timestamp > this.STATUS_WAIT_TIME) {
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
   *   Pass-through method for the currently-loaded router's
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
