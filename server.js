var factory = require('./lib/factory');
var transport = factory.create([
    {
      name: 'smssync',
      debug: true,
      secret: 'secret'
    }
  ],
  [
    {
      name: 'medic-mobile',
      debug: true,
      user: 'admin',
      password: 'password',
      url: 'http://localhost:5984/medic/_design/medic/_rewrite'
    }
  ]
);
transport.start();
