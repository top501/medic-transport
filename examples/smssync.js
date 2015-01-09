var factory = require('../lib/factory');
var transport = factory.create([{
  name: 'smssync',
  secret: 'secret',
  log_level: 'debug'
}],
{
  name: 'medic-mobile',
  user: 'admin',
  password: 'password',
  url: 'http://localhost:5984/medic/_design/medic/_rewrite',
  log_level: 'debug'
},
{
  name: 'simple',
  log_level: 'debug'
},
{
  default_country_code: '1',
  status_check_interval: 1, //default to every minute for testing
  log_level: 'debug'
}
);
transport.start();
