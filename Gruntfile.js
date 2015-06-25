module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    lambda_invoke: {
      default: {
        options: {
          file_name: "<%= pkg.main %>"
        }
      }
    },
    lambda_package: {
      default: {
        options: {
          file_name: "<%= pkg.main %>"
        }
      }
    },
    mochaTest: {
      test: {
        options: {},
        src: ['test/**/*.js']
      }
    },
    mocha_istanbul: {
      coverage: {
        src: 'test',
        options: {}
      },
    },
    lambda_deploy: {
      default: {
        options: {
          file_name: "<%= pkg.main %>"
        }
      }
    },
    shell: {
      deploy: {
        command: 'deploy.bat'
      }
    },
    jshint: {
      default: {
        src: ['*.js', '*.json']
      },
    },
    watch: {
      default: {
        files: ['*.js', 'test/**/*.js', '*.json'],
        tasks: ['jshint', 'mocha_istanbul:coverage']
      },
    }
  });

  grunt.loadNpmTasks('grunt-aws-lambda');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-mocha-istanbul');

  // Default task(s).
  grunt.registerTask('default', ['jshint']);
};