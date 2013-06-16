
var path = require('path')
    _ = require('underscore');

/**
 * @name create:
 *   Factory method. Create an instance of the adapter class
 *   whose name matches `_driver_name`, and return the instance.
 */
exports.create = function (_driver_name /* ... */) {

  var driver_name = path.basename(_driver_name, '.js') + '.js';
  var driver_path = path.resolve(__dirname, 'driver', driver_name);

  var driver = require(driver_path);

  var klass = function (_arguments) {
    return this.initialize.apply(this, _arguments);
  };

  klass.prototype = _.extend({}, driver.prototype);
  return new klass(Array.prototype.slice.call(arguments, 1));
};


