module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    lambda_invoke: {
      default: {
        options: {
          file_name: "alexa-isy"
        }
      }
    },
    lambda_package: {
      default: {
        options: {
          file_name: "alexa-isy"
        }
      }
    },
    lambda_deploy: {
      default: {
        options: {
          file_name: "alexa-isy"
        }
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-aws-lambda');

  // Default task(s).
  grunt.registerTask('default', ['lambda_invoke']);

};