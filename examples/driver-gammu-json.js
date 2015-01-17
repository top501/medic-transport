
var driver = require('../lib/driver');

/**
 * @name test_gammu_json:
 */

var test_gammu_json = function () {

  var d = driver.create('gammu-json', null);

  d.register_receive_handler(function (_message, _callback) {
    console.log('** driver receive: ', JSON.stringify(_message));
    return _callback();
  });

  d.start();

  var message = {
    to: '5158226442', content: 'This is a test message'
  };

  d.send(message, function (_err) {
    console.log('** sent: ', JSON.stringify(message));
  });

};

test_gammu_json();
