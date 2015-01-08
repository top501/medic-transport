
var path = require('path');
    _ = require('underscore');
    winston = require('winston');

/**
 * @name create:
 *   Factory method. Create an instance of the driver class
 *   whose name matches `_driver_name`, and return the instance.
 */
exports.create = function (_driver_name /* ... */) {

  var driver_name = path.basename(_driver_name, '.js') + '.js';
  var driver_path = path.resolve(__dirname, 'driver', driver_name);

  var driver = require(driver_path);

  var klass = function (_arguments) {
    var logger = new (winston.Logger)({
      transports: [
      new (winston.transports.Console)({
        label: "driver " + _driver_name,
        level: (_arguments[0].log_level || "warn")
      })
      ]
    });
    _arguments.push(logger);
    return this.initialize.apply(this, _arguments);
  };

  klass.prototype = _.extend({}, driver.prototype);
  return new klass(Array.prototype.slice.call(arguments, 1));
};
