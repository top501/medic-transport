
var async = require('async'),
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
        console.log('send error: ' + _err);
        return _callback(_err, _transmit_result);
      });
    });
    
    self._adaptor.register_error_handler(function (_err) {
      /* FIXME */
      console.log('adaptor: ' + _err);
    });

    /* Driver-to-adaptor case:
        The application receives incoming messages via this path. */

    self._driver.register_receive_handler(function (_message, _callback) {
      self._adaptor.deliver(_message, function (_err, _deliver_result) {
        console.log('deliver error: ' + _err);
        return _callback(_err, _deliver_result);
      });
    });
    
    self._driver.register_error_handler(function (_err) {
      /* FIXME */
      console.log('driver: ' + _err);
    });

    self._driver.start();
    self._adaptor.start();

    return this;
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


