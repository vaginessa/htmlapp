;
(function () {

  var log = console.log.bind(console);
  var debug = console.debug.bind(console);

  debug('Initializing test...');

  var T = {};

  // imports
  // ======
  R = window['remote'];

  // load some html into IndexedDB
  // =============================

  var testSchema = {
    stores: [{
      name: 'apps',
      autoIncrement: false
    } ]
  };
  var testDbName = 'htmlapps';
  T.db = new ydn.db.Storage(testDbName, testSchema);

  T.db.clear('apps')
  .then(function() {
    debug('Fetching about.html');
    return R.get('./about.html')
  })
  .then(function(html) {
    debug('Saving about.html');
    return T.db.put('apps', {val: html}, 'about.html')
  })
  .then(function() {
    debug('Fetching about.js');
    return R.get('./about.js')
  })
  .then(function(js) {
    debug('Saving about.js');
    return T.db.put('apps', {val: js}, 'about.js')
  })
  .then(function() {
    debug('Fetching about.css');
    return R.get('./about.css')
  })
  .then(function(css) {
    debug('Saving about.css');
    return T.db.put('apps', {val: css}, 'about.css')
  })
  .then(function(res){
    debug('Finished fetching content.');
  });


  // export (for debugging purposes)
  // ===============================

  window['test'] = T;

}());
