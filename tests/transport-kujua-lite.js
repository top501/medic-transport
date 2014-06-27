
var transport = require('../lib/transport');

/**
 * @name test_kujua_lite:
 */

var test_kujua_lite = function () {

  var t = transport.create();

  t.load_adaptor('kujua-lite', {
    debug: true, pass: process.argv[2],
    url: 'http://dev.medicmobile.org:5984/kujua-dave/_design/kujua-lite/_rewrite'
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

test_kujua_lite();

