var factory = require('../lib/factory');
var file_name;
if (process.argv.length < 3) {
  file_name = 'medic';
} else {
  file_name = process.argv[2];
}
var config = factory.create_config_from_file(file_name)
config.adaptor.user = 'admin';
config.adaptor.password = 'pass';
var transport = factory.create_from_config(config);
// transport._adaptor.set_configuration({
//       "drivers": [{
//         name: 'twilio',
//         sid: 'ACc27ce8143c2f05d804a4828fc0f0f546',
//         token: '986200d750694da9647988be4372bb51',
//         phone: '+1 650-276-3342',
//         log_level: 'debug',
//         port: 9001,
//         url: '/transport/twilio'
//       }],
//       "router":{
//         "name": "simple",
//         "log_level": "debug"
//       }}, function(error, status) {
//         console.log("set configuration, status: " + status)
//         transport.start();
//       });
transport.start();
