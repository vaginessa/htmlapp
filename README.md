# Htmlapp

`Htmlapp` makes it easy to develop web apps from **within** a web browser.
The apps target both desktop and mobile browsers.

The easiest way to install `htmlapp` is with [`bower`](http://bower.io):
`bower install htmlapp`

Open `index.html` in any browser and then
open the javascript console (search for 'javascript console' and your browser
name if you don't know how to open the console).

Run `Htmlapp.help()` to show the command line help.

This is an example of how `Htmlapp` it is used:

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

// this will show the app in the browser window
env.show('about');

// This will remove the app from the browser window
env.unload('about');
// check the DOM to verify that the app has been removed

// show the about.html file
env.get('about.html').then(console.log.bind(console));
```

## Support

Create a [github issue](https://github.com/gizur/htmlapp/issues/new) if you
have questions.

## Contributing

Contributions are welcome, just create a fork and create a pull request.

Download/clone this repo and install with: `npm install` follow by
`npm run-script init`.

`index-dev.html` is used when developing.
