var factory = require('../lib/factory');
var file_name;
if (process.argv.length < 3) {
  file_name = 'medic';
} else {
  file_name = process.argv[2];
}
var transport = factory.create_from_config_file(file_name);
transport.start();
