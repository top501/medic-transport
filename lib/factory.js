
var transport = require('../lib/transport');

/**
 * @name create:
 */

exports.create = function (_driver_options, _adaptor_options, _transport_options) {

  var driver_options = (_driver_options || [{}]);
  var adaptor_options = (_adaptor_options || {});
  var transport_options = (_transport_options || {});

  var t = transport.create(transport_options);

  t.load_driver(
    (driver_options.name || 'gammu-json'), driver_options
  );

  t.load_adaptor(
    (adaptor_options.name || 'medic-mobile'), adaptor_options
  );

  return t;
};
