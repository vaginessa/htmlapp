;
(function () {
  var log = console.log.bind(console);
  var info = console.info.bind(console);
  var debug = console.debug.bind(console);
  var error = console.error.bind(console);

  // imports
  // =======

  R = window['remote'];

  // Logic
  // =======

  // One event handler is used. This makes it easy to see how all events are
  // handeled. Also, handle events that are send between varps (iframes)
  var handler = function(evt) {
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
  };

  // constructor
  var App = function (dbName, storeName) {

    // primitive singleton
    window.htmlappInstance_ = this;

    if (!dbName || !storeName)
      throw "ERROR: database name and store name must be specified!";

    this.dbName = dbName;
    this.storeName = storeName;
    this.varps_ = {};

    // Use YDN-DB to access IndexedDB - not using inline key
    var schema = {
      stores: [{
        name: storeName,
        autoIncrement: false
      } ]
    };

    this.db = new ydn.db.Storage(dbName, schema);

    // events that we listens to in the main frame
    document.addEventListener('click', handler);
  };

  // primitive singleton implementation
  // TODO: create proper Singleton
  App.getInstance = function() {
    return window.htmlappInstance_;
  }

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

  App.prototype.createMainPage = function () {
    var self = this;

    document.head.title = 'htmlapp - main page';

    var css =
      'html,' +
      'body {' +
      '  height: 100%' +
      '}' +
      '#menu {' +
      '  height: 10%' +
      '}' +
      '#varps {' +
      '  height: 90%' +
      '}';

    self.loadStyle(css, document, false);

    var normalize =
      '/*! normalize.css v3.0.2 | MIT License | git.io/normalize */html{font-family:sans-serif;-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}body{margin:0}article,aside,details,figcaption,figure,footer,header,hgroup,main,menu,nav,section,summary{display:block}audio,canvas,progress,video{display:inline-block;vertical-align:baseline}audio:not([controls]){display:none;height:0}[hidden],template{display:none}a{background-color:transparent}a:active,a:hover{outline:0}abbr[title]{border-bottom:1px dotted}b,strong{font-weight:bold}dfn{font-style:italic}h1{font-size:2em;margin:.67em 0}mark{background:#ff0;color:#000}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sup{top:-0.5em}sub{bottom:-0.25em}img{border:0}svg:not(:root){overflow:hidden}figure{margin:1em 40px}hr{-moz-box-sizing:content-box;box-sizing:content-box;height:0}pre{overflow:auto}code,kbd,pre,samp{font-family:monospace,monospace;font-size:1em}button,input,optgroup,select,textarea{color:inherit;font:inherit;margin:0}button{overflow:visible}button,select{text-transform:none}button,html input[type="button"],input[type="reset"],input[type="submit"]{-webkit-appearance:button;cursor:pointer}button[disabled],html input[disabled]{cursor:default}button::-moz-focus-inner,input::-moz-focus-inner{border:0;padding:0}input{line-height:normal}input[type="checkbox"],input[type="radio"]{box-sizing:border-box;padding:0}input[type="number"]::-webkit-inner-spin-button,input[type="number"]::-webkit-outer-spin-button{height:auto}input[type="search"]{-webkit-appearance:textfield;-moz-box-sizing:content-box;-webkit-box-sizing:content-box;box-sizing:content-box}input[type="search"]::-webkit-search-cancel-button,input[type="search"]::-webkit-search-decoration{-webkit-appearance:none}fieldset{border:1px solid silver;margin:0 2px;padding:.35em .625em .75em}legend{border:0;padding:0}textarea{overflow:auto}optgroup{font-weight:bold}table{border-collapse:collapse;border-spacing:0}td,th{padding:0}';
    self.loadStyle(normalize, document, false);

    var menu = document.createElement('div');
    menu.id = 'menu';
    document.body.appendChild(menu);

    var varps = document.createElement('div');
    varps.id = 'varps'
    document.body.appendChild(varps);
  };

  App.prototype.load = function (varpDef) {
    var self = this;

    debug('load varp:' + varpDef.id +
      ' with permissions:' + varpDef.permissions);

    // check mandatory input
    if (!varpDef || !varpDef.id) {

      throw 'ERROR: id must me specified';
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
      debug('createIFrame ' + input.id, input.data);

      // Get rid of HTML comments
      input.data = removeHTMLComments(input.data);

      var title = parseHTMLTag('title', input.data, false);
      var scripts = parseHTMLTag2('script', input.data);
      var styles = parseHTMLTag('style', input.data, false);

      // This will include the whole body including script tags
      var bodyObj = parseHTMLTag2('body', input.data, false)[0];
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

        self.loadStyle(styles, iframeDoc, false);

        // Load the scripts - they are not intialized otherwise
        // ---------------------------------------------------

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

        // Load JS from IndexedDb
        // This is a promise-based alternative, but the login screen isn't
        // initialized for some reason
        //      self.fetchRemoteScripts2(scripts).then(function(scripts) {
        self.db.get(self.storeName, varpDef.id + '.js').then(function (scripts) {
          if(!scripts) return;

          debug('updateIframe with id ' + input.id +
            ': ' + scripts.length + ' remote scripts fetched.')

          // remove the scripts from the body
          var tmpScripts = iframeDoc.getElementsByTagName('script');
          while (tmpScripts.length > 0) {
            iframeDoc.body.removeChild(tmpScripts[0]);
          }

          // Add the scripts to the head
          for (var i = 0; i < scripts.length; i++) {
            self.loadScript(scripts[i], input.id + '_script' + i,
              iframeDoc.head);
          }

          // run the init function if it exists
          if (iframe.contentWindow.init) {
            debug('Initializing frame.')
            iframe.contentWindow.init();
          }

        });

      };

      iframe.addEventListener("load", updateIframe, true);

      // Add iframe to varps element
      input.target.appendChild(iframe);

      return iframe;
    };

    var addMenu_ = function (val) {
      var el = document.createElement('input');
      el.type = 'button';
      el.value = val;
      el.id = 'btn' + val;

      document.getElementById('menu').appendChild(el);
    };

    var load_ = function (data) {

      var input = {
        id: varpDef.id,
        target: document.getElementById('varps'),
        permissions: varpDef.permissions,
        data: data.val
      };

      varpDef.element = createIFrame(input);
      addMenu_(varpDef.id);
      self.varps_[varpDef.id] = varpDef;

    };

    // end of helpers
    // --------------

    try {
      self.db.get(self.storeName, varpDef.id+'.html').then(load_);
    } catch (e){
      debug('load:' + varpDef.id + ':' + e);
    }
  };

  App.prototype.unload = function (id) {
    document.getElementById('menu').removeChild(document.getElementById('btn' + id))
  }

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

  // Export
  // ======

  window['htmlapp'] = App;


}());
