
var path = require('path');
    _ = require('underscore');
    winston = require('winston');
    fs = require('fs');

/**
 * @name create:
 *   Factory method. Create an instance of the driver class
 *   whose name matches `_driver_name`, and return the instance.
 *   The first argument, _driver_name, can either by a file name located
 *   in the /driver folder, or a full path accessible from this directory.
 */
exports.create = function (_driver_name /* ... */) {
  var driver_name = _driver_name + '.js';
  if (fs.existsSync(driver_name)) {
    var driver = require(path.resolve(__dirname, driver_name));
  } else {
    var driver = require(path.resolve(__dirname, 'driver', driver_name));
  }

  var klass = function (_arguments) {
    var logger = new (winston.Logger)({
      transports: [
      new (winston.transports.Console)({
        label: "driver " + _driver_name,
        timestamp: true,
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
