
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
    this._drivers = [];
    this._adaptors = [];

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

    this._adaptors.push(adaptor.create(_adaptor_name, _adaptor_options));
    return this;
  },

  /**
   * @name start:
   */
  start: function () {

    var self = this;

    if (self._drivers.length === 0 || self._adaptors.length === 0) {
      throw new Error('Please provide at least one adaptor and driver');
    }

    /* Adaptor-to-driver case:
        The application sends outgoing messages via this path.

        In this case, only send to the first driver so multiple messages don't go out.
        */

    self._adaptors.forEach(function(adaptor) {
      adaptor.register_transmit_handler(function (_message, _callback) {
        self._drivers[0].send(_message, function (_err, _transmit_result) {
          if (_err) {
            console.log('send error: ' + jsdump.parse(_err));
          }
          return _callback(_err, _transmit_result);
        });
      });
    });

    self._adaptors.forEach(function(adaptor) {
      adaptor.register_error_handler(function (_err) {
        console.log('adaptor error: ' + jsdump.parse(_err)); /* FIXME */
      });
    });

    /* Driver-to-adaptor case:
        The application receives incoming messages via this path. */

    self._drivers.forEach(function(driver) {
      driver.register_receive_handler(function (_message, _callback) {
        self._adaptors.forEach(function(adaptor) {
          adaptor.deliver(_message, function (_err, _deliver_result) {
            if (_err) {
              console.log('deliver error: ' + jsdump.parse(_err));
            }
            return _callback(_err, _deliver_result);
          });
        });
      });
    });

    self._drivers.forEach(function(driver) {
        driver.register_error_handler(function (_err) {
        console.log('driver error: ' + jsdump.parse(_err)); /* FIXME */
      });
    });

    self._drivers.forEach(function(driver) {
      driver.start();
    });

    self._adaptors.forEach(function(adaptor) {
      adaptor.start();
    });

    return this;
  },

  /**
   * @name stop:
   *   Stop any polling and/or watch operations that are currently
   *   running on behalf of the loaded adaptor or driver.
   */
  stop: function () {

    this._adaptors.forEach(function(adapter) {
      adaptor.stop();
    });

    this._drivers.forEach(function(driver) {
      driver.stop();
    });

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
