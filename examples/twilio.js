var factory = require('../lib/factory');
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
  user: 'admin',
  password: 'pass',
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
