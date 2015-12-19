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
    return R.get('./about.html')
  })
  .then(function(html) {
    return T.db.put('apps', {val: html}, 'about.html')
  })
  .then(function() {
    return R.get('./about.js')
  })
  .then(function(js) {
    return T.db.put('apps', {val: js}, 'about.js')
  })
  .then(function() {
    return R.get('./about.css')
  })
  .then(function(css) {
    return T.db.put('apps', {val: css}, 'about.css')
  })
  .then(function(res){
    return T.db.get('apps', 'about.html').then(console.log.bind(console));
  });


  // export (for debugging purposes)
  // ===============================

  window['test'] = T;

}());
