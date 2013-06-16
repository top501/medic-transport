
var path = require('path')
    _ = require('underscore');

/**
 * @name create:
 *   Factory method. Create an instance of the adapter class
 *   whose name matches `_adaptor_name`, and return the instance.
 */
exports.create = function (_adaptor_name /* ... */) {

  var adaptor_name = path.basename(_adaptor_name, '.js') + '.js';
  var adaptor_path = path.resolve(__dirname, 'adaptor', adaptor_name);

  var adaptor = require(adaptor_path);

  var klass = function (_arguments) {
    return this.initialize.apply(this, _arguments);
  };

  klass.prototype = _.extend({}, adaptor.prototype);
  return new klass(Array.prototype.slice.call(arguments, 1));
};


