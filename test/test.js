;
(function () {

  var log = console.log.bind(console);
  var debug = console.debug.bind(console);

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
  .then(function(app) {
    return R.get('./about.html')
  })
  .then(function(app) {
    return T.db.put('apps', {val: app}, 'about.html')
  })
  .then(function(res){
    return T.db.get('apps', 'about.html').then(console.log.bind(console));
  });


  // export (for debugging purposes)
  // ===============================

  window['test'] = T;

}());
