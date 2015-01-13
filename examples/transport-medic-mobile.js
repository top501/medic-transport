
var transport = require('../lib/transport');

/**
 * @name test_medic_mobile:
 */

var test_medic_mobile = function () {

  var t = transport.create();

  t.load_adaptor('medic-mobile', {
    debug: true, pass: process.argv[2],
    url: 'http://medic.local/medic/_design/medic/_rewrite'
  });

  t.load_driver('gammu-json', {
    debug: true, interval: 0
  });

  t.start();
};

if (process.argv.length <= 2) {
  process.stderr.write('Usage: ' + process.argv[1] + ' [password]\n');
  process.exit(1);
}

test_medic_mobile();

