var factory = require('../lib/factory');
var transport = factory.create([{
  name: 'bad',
  id: 1,
  debug: true
},
{
  name: 'bad',
  id: 2,
  debug: true
}],
{
  name: 'medic-mobile',
  debug: false,
  user: 'admin',
  password: 'password',
  url: 'http://localhost:5984/medic/_design/medic/_rewrite'
},
{
  name: 'simple',
  debug: true
},
{
  status_check_interval: 1 //default to every minute for testing
}
);
transport.start();
