# Htmlapp

`Htmlapp` makes it easy to develop web apps from **within** a web browser.
The apps targets both desktop and mobile browsers.

Open `index.html` in any browser and then open the javascript console.
This is an example of `Htmlapp` it is used:

```
var envOptions = {
  dbName: 'htmlapps',
  storeName: 'apps',
  title: ''
};
var env = new Htmlapp(envOptions);

var pageOptions = {
  title: 'Apps developed with incredible speed!'
};
env.createMainPage(pageOptions);

var appOptions = {
  id: 'about',
  title: 'My fabulous app',
  show: false
};
env.load(appOptions);
// check the DOM to see that the app has been loaded

// this will show the app
env.show('about');

// This will remove the app
env.unload('about');
// check the DOM to verify that the app has been removed

// show the about.html file
env.get('about.html').then(console.log.bind(console));
```
