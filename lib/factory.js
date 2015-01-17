
var transport = require('../lib/transport');

/**
 * @name create:
 *  The factory is the simplest entry point into medic-transport,
 *  allowing a user to define an adapter, router, and drivers in one
 *  fell swoop.
 */

exports.create = function (_drivers_options, _adaptor_options,
    _router_options, _transport_options) {

  var drivers_options = (_drivers_options || [{}]);
  var adaptor_options = (_adaptor_options || {});
  var router_options = (_router_options || {});
  var transport_options = (_transport_options || {});

  var t = transport.create(transport_options);

  _drivers_options.forEach(function(driver_options) {
    t.load_driver(
      (driver_options.name), driver_options
    );
  });

  t.load_adaptor(
    (adaptor_options.name), adaptor_options
  );

  t.load_router(
    (router_options.name), router_options
  );

  return t;
};
