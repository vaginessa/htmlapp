# htmlapp

Usage:

```
var App = window['htmlapp'];
var options = {
  title: 'My fabulous app',
  show: false,
  dbName: 'htmlapps',
  storeName: 'apps'
};
var app = new App(options);
app.createMainPage();
app.load({id: 'about'});
// check the DOM to see that the app has been loaded

// this will show the app
app.show('about');

// This will remove the app
app.unload('about');
// check the DOM to verify that the app has been removed
```
