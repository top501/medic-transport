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

  grunt.registerTask('default', [
    'jshint'
  ]);

  grunt.registerTask('ci', 'Test for CI', [
    'default'
  ]);
}
