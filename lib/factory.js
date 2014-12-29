
var transport = require('../lib/transport');

/**
 * @name create:
 */

exports.create = function (_drivers_options, _adaptors_options) {

  var t = transport.create();

  _drivers_options.forEach(function(driver_options) {
    t.load_driver(
      driver_options.name, driver_options
    );
  });

  _adaptors_options.forEach(function(adaptor_options) {
    t.load_adaptor(
      adaptor_options.name, adaptor_options
    );
  });

  return t;
};
