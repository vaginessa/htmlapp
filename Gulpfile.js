var gulp = require('gulp');
var concat = require('gulp-concat');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');

//script paths
var files = ["./bower_components/remote/remote.js",
             "./bower_components/odapi/odata.js",
             "./bower_components/jsonparsearray/browser/jsonparsearray.js",
             "./bower_components/ydn.db/jsc/ydn.db-dev.js",
             "./bower_components/bluebird/js/browser/bluebird.min.js",
             "./bower_components/lodash/dist/lodash.min.js",
             "./bower_components/promise-flow/promise-flow.js",
             "./bower_components/hpm/hpm.js",
             "./htmlapp.js"],
    dist = 'dist';

gulp.task('copy-maps', function () {
  return gulp.src('./bower_components/ydn.db/jsc/ydn.db-dev.js.map')
    .pipe(gulp.dest(dist));
});

gulp.task('build', function() {
    return gulp.src(files)
        .pipe(concat('htmlapp.js'))
        .pipe(gulp.dest(dist))
        .pipe(rename('htmlapp.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest(dist));
});

gulp.task('default', ['copy-maps', 'build']);
