var lazy = require('lazy');
var factory = require('../lib/factory');

/**
 * @name read_stdin_password:
 */
var read_stdin_password = function (_callback) {

  new lazy(process.stdin).lines.head(function (_line) {
    return _callback(null, _line.toString());
  });

  process.stdin.resume();
};


/**
 * @name main:
 */
var main = function (_argv) {

  var user = _argv[2];
  var password = _argv[3];

  if (user == '-h' || user == '--help') {
    process.stderr.write(
      'Usage: ' + _argv[1] + ' [ user [ password ] ]\n'
    );
    process.exit(1);
  }

  if (password == '-') {
    return read_stdin_password(function (_err, _password) {
      return run(user, _password);
    });
  }

  return run(user, password);
};



/**
* run:
*/
var run = function (_user, _password) {
  var transport = factory.create([{
    name: 'twilio',
    sid: 'ACc27ce8143c2f05d804a4828fc0f0f546',
    token: '986200d750694da9647988be4372bb51',
    phone: '+1 650-276-3342',
    log_level: 'debug',
    port: 9001,
    url: '/transport/twilio'
  }],
  {
    name: 'medic-mobile',
    user: _user,
    password: _password,
    url: 'http://localhost:5984/medic/_design/medic/_rewrite',
    log_level: 'debug'
  },
  {
    name: 'simple',
    log_level: 'debug'
  },
  {
    default_country_code: '1',
    status_check_interval: 60,
    log_level: 'debug'
  }
  );
  transport.start();
  return transport;
}

main(process.argv);
