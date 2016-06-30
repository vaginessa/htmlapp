var gulp = require('gulp');
var concat = require('gulp-concat');  
var rename = require('gulp-rename');  
var uglify = require('gulp-uglify');  

//script paths
var files = ["./bower_components/ydn.db/jsc/ydn.db-dev.js",
               "./bower_components/bluebird/js/browser/bluebird.min.js",
               "./bower_components/lodash/dist/lodash.min.js",
               "./bower_components/promise-flow/promise-flow.js",
               "./bower_components/hpm/hpm.js",
               "./bower_components/htmlapp/htmlapp.js"],  
    dist = 'dist';

gulp.task('default', function() {  
    return gulp.src(files)
        .pipe(concat('htmlapp.js'))
        .pipe(gulp.dest(dist))
        .pipe(rename('htmlapp.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest(dist));
});

