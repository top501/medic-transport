module.exports = function(grunt) {
  'use strict';

  grunt.initConfig({
    jshint: {
      options: {
        jshintrc: true,
      },
      all: [
        'lib/**/*.js',
        'test/**/*.js',
      ]
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-mocha');

  grunt.registerTask('default', [
    'jshint',
    'mocha'
  ]);

  grunt.registerTask('ci', 'Test for CI', [
    'default'
  ]);
}
