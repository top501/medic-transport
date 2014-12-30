var factory = require('./lib/factory');
var transport = factory.create({
    name: 'smssync',
    debug: true,
    secret: 'secret'
  },
  {
    name: 'medic-mobile',
    debug: true,
    user: 'admin',
    password: 'password',
    url: 'http://localhost:5984/medic/_design/medic/_rewrite'
  },
  {
    name: 'simple'
  },
  {
    status_check_interval: 1 //default to every minute for testing
  }
);
transport.start();
