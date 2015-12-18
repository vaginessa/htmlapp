;
(function () {

  var log = console.log.bind(console);
  var debug = console.debug.bind(console);

  var T = {};

  // imports
  R = window['remote'];

  var store1 = 'apps';
  var email = 'joe@example.com';

  var testSchema = {
    stores: [{
      name: store1,
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
  window['test'] = T;

}());
