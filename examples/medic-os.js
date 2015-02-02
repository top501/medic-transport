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
transport.start();
