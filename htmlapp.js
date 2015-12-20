// htmlapp.js
// Copyright: Jonas Colmsjö
//
// TODO: check that the custom events still works,
//        data-gna-send='["event1", ..., "eventN"]'

;
(function () {
  var log = console.log.bind(console);
  var info = console.info.bind(console);
  var debug = console.debug.bind(console);
  var error = console.error.bind(console);

  debug('Initializing htmlapp...');

  // imports
  // =======

  R = window['remote'];

  // App Class
  // =========

  // constructor
  var App = function (options) {

    // primitive singleton
    window.htmlappInstance_ = this;

    if (!options.dbName || !options.storeName)
      throw "ERROR: database name and store name must be specified!";

    this.dbName = options.dbName;
    this.storeName = options.storeName;
    this.varps_ = {};

    // Use YDN-DB to access IndexedDB - not using inline key
    var schema = {
      stores: [{
        name: options.storeName,
        autoIncrement: false
      }]
    };

    this.db = new ydn.db.Storage(this.dbName, schema);

    // events that we listens to in the main frame
    document.addEventListener('click', handler);
  };

  // primitive singleton implementation
  // TODO: create proper Singleton
  App.getInstance = function () {
    return window.htmlappInstance_;
  }

  App.prototype.get = function (filename) {
    return this.db.get(this.storeName, filename);
  };

  App.prototype.put = function (filename, data) {
    return this.db.put(this.storeName, data, filename);
  };

  // NOTE: KeyRange not accessible in Safari since the IndexedDbShm is used
  App.prototype.ls = function () {
    debug(this.db);
    var keyRange = this.db.KeyRange.starts(0);
    return this.db.keys(this.storeName, keyRange, 500);
  };

  // static function to setup a standard environment
  App.getEnv = function () {
    var envOptions = {
      dbName: "htmlapps",
      storeName: "apps",
    };
    var env = new Htmlapp(envOptions);

    var pageOptions = {
      title: "Apps developed with incredible speed!"
    };
    env.createMainPage(pageOptions);

    return env;
  };

  App.prototype.loadStyle = function (cssData, document, clearExisting) {
    var self = this;
    debug('loadStyle');

    var head = document.head || document.getElementsByTagName('head')[0];

    if (clearExisting) {
      // remove the current stylesheets
      while (document.getElementsByTagName('style').length > 0) {
        head.removeChild(document.getElementsByTagName('style')[0]);
      }
    }

    // create the new stylesheet
    if (cssData) {

      var style = document.createElement('style');

      style.type = 'text/css';
      if (style.styleSheet) {
        style.styleSheet.cssText = cssData;
      } else {
        style.appendChild(document.createTextNode(cssData));
      }

      head.appendChild(style);
    }
  };

  // This will create a script tag with the code in `data`
  // `head` makes it possible to load scripts within `iframes`
  App.prototype.loadScript = function (data, id, head) {
    var self = this;
    debug('loadScript:' + id);

    // generated id for script
    id = (id !== undefined && id !== null) ? '$$' + id + '$$' : null;

    // check if script is loaded
    if (id !== undefined && document.getElementById(id) !== null) {
      return;
    }

    var head = head || document.head || document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.defer = true;
    script.async = false;
    script.text = data;

    if (id !== null) {
      script.id = id;
    }

    head.appendChild(script);
  };

  App.prototype.createMainPage = function (options) {
    var self = this;

    document.head.title = (options.title) ? options.title : '';

    var css =
      'html,' +
      'body {' +
      '  height: 100%' +
      '}' +
      '#varps {' +
      '  height: 100%' +
      '}';

    self.loadStyle(css, document, false);

    var normalize =
      '/*! normalize.css v3.0.2 | MIT License | git.io/normalize */html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,details,figcaption,figure,footer,header,hgroup,main,menu,nav,section,summary{display:block}audio,canvas,progress,video{display:inline-block;vertical-align:baseline}audio:not([controls]){display:none;height:0}[hidden],template{display:none}a{background-color:transparent}a:active,a:hover{outline:0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:bold}dfn{font-style:italic}h1{font-size:2em;margin:.67em 0}mark{background:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-0.5em}sub{bottom:-0.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:1em 40px}hr{-moz-box-sizing:content-box;box-sizing:content-box;height:0}pre{overflow:auto}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}button,input,optgroup,select,textarea{color:inherit;font:inherit;margin:0}button{overflow:visible}button,select{text-transform:none}button,html input[type="button"],input[type="reset"],input[type="submit"]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}input{line-height:normal}input[type="checkbox"],input[type="radio"]{box-sizing:border-box;padding:0}input[type="number"]::-webkit-inner-spin-button,input[type="number"]::-webkit-outer-spin-button{height:auto}input[type="search"]{-webkit-appearance:textfield;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;box-sizing:content-box}input[type="search"]::-webkit-search-cancel-button,input[type="search"]::-webkit-search-decoration{-webkit-appearance:none}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0;padding:0}textarea{overflow:auto}optgroup{font-weight:bold}table{border-collapse:collapse;border-spacing:0}td,th{padding:0}';
    self.loadStyle(normalize, document, false);

    var varps = document.createElement('div');
    varps.id = 'varps'
    document.body.appendChild(varps);
  };

  App.prototype.load = function (varpDef) {
    var self = this;

    return new Promise(function (fulfill, reject) {

      debug('load app:', varpDef);

      // check mandatory input
      if (!varpDef || !varpDef.id) {

        throw 'ERROR: app id must me specified!';
      }

      if (!varpDef.permissions) {
        varpDef.permissions = 'allow-scripts allow-forms';
      }

      // Create an iframe element using an input object:
      //
      //```
      //  {
      //    id: '',
      //    data: ''
      //    target: object,
      //    permissions: ''
      //  }
      //```
      var createIFrame = function (input) {
        debug('createIFrame ' + input.id);

        // Get rid of HTML comments
        input.html = removeHTMLComments(input.html);

        var title = parseHTMLTag('title', input.html, false);
        var scripts = parseHTMLTag2('script', input.html);
        var styles = parseHTMLTag('style', input.html, false);

        // This will include the whole body including script tags
        var bodyObj = parseHTMLTag2('body', input.html, false)[0];
        var body = [bodyObj.inner];
        var eventsToRegister = null;

        var iframe = document.createElement('iframe');

        // The only attribute that is supported is:
        // data-gna-send='["event1", ..., "eventN"]'
        if (bodyObj.attr) {
          var bodyAttr = bodyObj.attr.trim();
          eventsToRegister = jsonParse(bodyAttr.substr(15, bodyAttr.length - 15 - 1));
          debug('updateIframe ' + input.id + ' send=' + eventsToRegister);
        }

        // This is necesseray for Firefox, the real permissions are set at the end
        // Set the sandbox permissions
        if (input.permissions !== '') {
          iframe.sandbox = 'allow-same-origin allow-scripts';
        }

        iframe.id = input.id;

        // this is executed when the iframe has been loaded
        var updateIframe = function (event) {
          debug('updateIframe ' + input.id + ' (load event fired)');

          // This works in all browsers
          var iframeDoc = event.target.contentDocument;

          iframeDoc.body.innerHTML = (body) ? body[0] : null;
          iframeDoc.head.title = (title) ? title[0] : null;

          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 0;
          iframe.hidden = true;

          // Register custom events and fix permissions
          // ------------------------------------------

          if (eventsToRegister) {
            self.customEvents_.concat(eventsToRegister);
            for (var i = 0; i < eventsToRegister.length; i++) {
              document.addEventListener(eventsToRegister[i], handler);
            }
          }

          // Set the sandbox permissions
          if (input.permissions !== '') {
            event.target.sandbox = input.permissions;
            debug('permissions set to: ' +
              document.getElementById(iframe.id).sandbox);
          }

          // Load CSS from the database (embedded CSS is not supported)
          // ------------------------------------------------------------------
          self.db.get(self.storeName, varpDef.id + '.css').then(function (css) {

            if (css && !input.noCSS) {
              debug('updateIframe with id ' + input.id + '. Load CSS.');
              self.loadStyle(css.val, iframeDoc, false);
            }

            // Load script from the database (embedded scrips are not supported)
            // ------------------------------------------------------------------

            self.db.get(self.storeName, varpDef.id + '.js').then(function (script) {

              // Embedded scripts are not loaded, remove them the body
              var tmpScripts = iframeDoc.getElementsByTagName('script');
              while (tmpScripts.length > 0) {
                iframeDoc.body.removeChild(tmpScripts[0]);
              }

              if (script && !input.noJS) {
                debug('updateIframe with id ' + input.id + '. Load javascript.');
                self.loadScript(script.val, input.id + '_script', iframeDoc.head);
              }

              // run the init function if it exists
              if (iframe.contentWindow.init) {
                debug('Initializing frame.')
                iframe.contentWindow.init();
              }

              if (input.show) self.show(input.id);

              // NOTE: final step, return from async operation
              fulfill(null);

            });
          });

        };

        iframe.addEventListener("load", updateIframe, true);

        // Add iframe to varps element
        input.target.appendChild(iframe);

        return iframe;
      };

      var load_ = function (data) {

        varpDef.target = document.getElementById('varps');
        varpDef.html = data.val;

        varpDef.element = createIFrame(varpDef);
        self.varps_[varpDef.id] = varpDef;

      };

      // end of helpers
      // --------------

      try {
        self.db.get(self.storeName, varpDef.id + '.html').then(load_);
      } catch (e) {
        debug('load:' + varpDef.id + ':' + e);
        reject(e);
      }

      // end of Promise
    });
  };

  App.prototype.unload = function (id) {
    document.getElementById('varps').removeChild(document.getElementById(id));
  };

  App.prototype.show = function (iframeId) {
    var self = this;

    debug('show:' + iframeId);

    var vs = document.getElementById('varps');
    var v = document.getElementById(iframeId);

    // check that the iframe exists
    if (v === null) {
      return;
    }

    // hide all varps
    for (var i = 0; i < vs.childNodes.length; i++) {
      vs.childNodes[i].hidden = true;
    }

    // show the varp
    v.hidden = false;

    // dispatch show event to the relevant frame
    dispatchEvent(iframeId, 'gnaEvent', 'show');
  };

  // Misc helpers
  // -----------
  // TODO: refactor out these functions into a separate bower package

  // One event handler is used. This makes it easy to see how all events are
  // handeled. Also, handle events that are send between varps (iframes)
  var handler = function (evt) {
    var self = App.getInstance();

    // Mouse events
    if (evt instanceof MouseEvent) {

      // skip the btn part of the id
      var id = evt.target.id.substring(3, evt.target.id.length)
      debug('handler:MouseEvent:' + id);

      // dispatch show event to the relevant varp
      if (Object.keys(self.varps_).indexOf(id) !== -1) {
        self.show(id);
        debug('handler:MouseEvent:dispatch:' + id);
      }
    }

    // Custom events
    if (self.customEvents_.indexOf(evt.type) !== -1) {
      debug('handler:CustomEvent', evt);

      // make sure that targets are specified, ignore otherwise
      if (evt.detail.targets && evt.detail.message) {
        for (var i = 0; i < evt.detail.targets.length; i++) {

          // Dispatch event to the varps/iframes listed
          dispatchEvent(evt.detail.targets[i],
            evt.type,
            evt.detail.message);
        }
      }
    }

  };

  var dispatchEvent = function (frameId, eventName, message) {

    var event = new CustomEvent(
      eventName, {
        detail: { // detail is a custom object
          message: message,
          time: new Date(),
        },
        bubbles: true,
        cancelable: true
      }
    );

    var el = document.getElementById(frameId).contentDocument;

    el.dispatchEvent(event);
  };

  var removeHTMLComments = function (str) {
    if (!str || str.length === 0) return '';

    var start = str.indexOf('<!--');
    var end = str.indexOf('-->');

    if (start === -1 || end === -1) return str;

    var res = str.substring(0, start);
    str = str.substring(end + 3, str.length);

    var res2 = removeHTMLComments(str);
    return res.concat(res2);
  };

  // Outer or inner allowing (but not returning) attributes in tag
  var parseHTMLTag = function (tag, str, outer) {
    if (!str || str.length === 0) return [];

    // find start of beginning and end tags
    var startStartTag = str.indexOf('<' + tag);
    var startEndTag = str.indexOf('</' + tag + '>');
    if (startStartTag === -1 || startEndTag === -1) return [];

    // check that the tag has an end
    var endStartTag = str.substring(startStartTag + tag.length, str.length).indexOf('>');
    if (endStartTag === -1) return [];
    endStartTag += startStartTag + tag.length;

    var startTagLength = endStartTag - startStartTag;
    var endTagLength = ('</' + tag + '>').length;

    var res;
    res = (outer) ? str.substring(startStartTag, startEndTag + endTagLength) :
      str.substring(startStartTag + startTagLength + 1, startEndTag);

    str = str.substring(startEndTag + endTagLength, str.length);

    var res2 = parseHTMLTag(tag, str, outer);
    return [res].concat(res2);

  };

  // Outer and inner with attributes in tag including the attributes
  // [{outer:..., inner:..., attr:...}]
  // TODO: should refactor and combine this with parseHTMLTag
  var parseHTMLTag2 = function (tag, str) {
    if (!str || str.length === 0) return [];

    // find start of beginning and end tags
    var startStartTag = str.indexOf('<' + tag);
    var startEndTag = str.indexOf('</' + tag + '>');
    if (startStartTag === -1 || startEndTag === -1) return [];

    // check that the tag has an end
    var endStartTag = str.substring(startStartTag + tag.length, str.length).indexOf('>');
    if (endStartTag === -1) return [];
    endStartTag += startStartTag + tag.length;

    var startTagLength = endStartTag - startStartTag;
    var endTagLength = ('</' + tag + '>').length;

    var res = {};
    res.outer = str.substring(startStartTag, startEndTag + endTagLength);
    res.inner = str.substring(startStartTag + startTagLength + 1, startEndTag);
    res.attr = str.substring(startStartTag + ('<' + tag).length, endStartTag);

    str = str.substring(startEndTag + endTagLength, str.length);

    var res2 = parseHTMLTag2(tag, str);
    return [res].concat(res2);

  };

  var jsonParse = function (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      log.log('Error parsing JSON:' + e);
    }
  };

  // Command line help, static functions on the App object
  // -----------------------------------------------------

  App.help = function (topic) {

    if (!topic) {
      info('Overview of Htmlapp');
      info('* Htmlapp.help("setup") - show a typical example of how Htmlapp is setup.');
      info('* Htmlapp.help("hello") - show hello world example.');
      info('* Htmlapp.help("load") - load a new webapp in the browser window');
      info('* Htmlapp.help("unload") - remove a webapp from the borwser window');
      info('* Htmlapp.help("get") - get the contents of a file.');
      info('* Htmlapp.help("put") - save new content into a file.');
      info('* Htmlapp.help("objects") - short introduction to JavaScript objects.');
      return;
    }

    var footer = '\n\nKeep in mind that you need to perform the setup first, ' +
      'see Htmlapp.help("setup")';

    if (topic === 'setup2') {
      var msg = 'How to create a customized Htmlapp environment (copy and past ' +
        'the text below):\n\n' +
        'var envOptions = {\n' +
        '\tdbName: "htmlapps",\n' +
        '\tstoreName: "apps",\n' +
        '};\n' +
        'var env = new Htmlapp(envOptions);\n\n' +
        'var pageOptions = {\n' +
        'title: "Apps developed with incredible speed!"\n' +
        '};\n' +
        'env.createMainPage(pageOptions);\n';

      info(msg);
    } else if (topic === 'setup') {
      var msg = 'How to create a Htmlapp environment (copy and past ' +
        'the text below):' +
        '\n\nvar env = Htmlapp.getEnv()' +
        '\n\nRun Htmlapp.help("setup2") to see how to customize the environment';

      info(msg);
    } else if (topic === 'hello') {
      var msg = 'This is the traditional hello world example. Copy and past ' +
        'this text to create the app.\n\n' +
        'var html = "<htlm><body><h1>Hello World</h1></body></html>;"' +
        '\nenv.put("hello.html", {val: html})' +
        '\nvar appOptions = {' +
        '\n\tid: "hello",' +
        '\n\ttitle: "My fabulous app",' +
        '\n\tshow: true' +
        '\n};' +
        '\nenv.load(appOptions);' +
        footer;

      info(msg);
    } else if (topic === 'load') {
      var msg = 'HtmlappInstance.load({id: <webapp id>}) - Load a webapp that has ' +
        'been created into the browser window. ' +
        '\nThe convention used is that the ' +
        'webapp is the name of the html file minus the extension.' +
        'For instance, "hello.html" has the webapp id "hello".' +
        '\n\nenv.load({id: "hello", show: true})' +
        footer;

      info(msg);
    } else if (topic === 'unload') {
      var msg = 'HtmlappInstance.unload(<webapp id>) - Remove a webapp from ' +
        'the browser window. See htmlapp.help("load") for more information ' +
        'about webapp ids.' +
        '\nenv.unload("hello")' +
        footer;

      info(msg);
    } else if (topic === 'get') {
      var msg = 'Get the contents of a file:\n\n' +
        'HtmlappInstance.get(<filename>) - exmaple of how the contents of a ' +
        'file is fetched and then printed:\n\n' +
        'env.get("hello.html").then(console.log.bind(console))';

      footer;

      info(msg);
    } else if (topic === 'put') {
      var msg = '' +
        'HtmlappInstance.put(filename, data) - ' +
        'save new contents into a file. Only JavaScript Object can ' +
        'be saved (see Htmlapp.help("objects")).' +
        '\nThis is an example of how new content is saved into file:' +
        '\n\nenv.put("hello.html", {val: "Some random content"})' +
        footer;

      info(msg);
    } else {
      info('Unknown help topic: ' + topic);
    }

  };

  // Export
  // ======

  window['Htmlapp'] = App;

  debug('htmlapp is loaded.');

  // Introduction message
  // ====================

  info('Welcome to htmlapp!');
  info("Htmlapp let's you develop web and mobile apps easily. All you need is your web browser.");
  info("Show the help with Htmlapp.help()")

}());
