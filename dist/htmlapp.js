;
(function () {

  var log = console.log.bind(console);
  var error = console.log.bind(console, 'ERROR');
  var info = console.log.bind(console, 'INFO');
  var debug = console.debug.bind(console, 'DEBUG');


  // imports
  // =======

  var jsonParseArray = window['jsonparsearray'];


  // main
  // ====

  var R = {};

  // thenable version of `xhr`. Returns:
  // {
  //    status: HTTP status,
  //    data: data returned from server,
  //    err: error code in case of an error
  //  }
  R.xhr = function (url, method, data, headers, mimeType, user, password) {
    if (!url || !method) throw new Error("ERROR: url and method are mandatory!");

    return new Promise(function (fulfill, reject) {
      var request = new XMLHttpRequest();

      request.addEventListener('load', function () {
        fulfill({
          status: request.status,
          data: request.responseText
        });
      }, false);

      var transferError = function (evt) {
        error('xhr error:', request.status, evt);
        reject({
          status: request.status,
          data: request.responseText,
          err: evt
        });
      };

      request.addEventListener('error', transferError, false);
      request.addEventListener('abort', transferError, false);

      if (mimeType) request.overrideMimeType(mimeType);

      request.open(method, url, true);

      if (user && password) {
        request.withCredentials = true;
        request.setRequestHeader('user', user);
        request.setRequestHeader('password', password);
      }

      if (headers) {
        Object.keys(headers).forEach(function (key) {
          request.setRequestHeader(key, headers[key]);
        });
      }

      if (data) request.send(data);
      else request.send(null);

    });
  };

  // like xhr and tries to parse the result as JSON. Accepts JSON obejcts as data.
  R.xhrJSON = function (url, method, data, headers, user, password) {
    if (!url | !method) throw new Error('ERROR: url and method are mandatory');

    if (data && typeof data !== 'object' && typeof data !== 'string')
      throw new Error('ERROR: Type for data not supported: ' + typeof data);

    if (data && typeof data === 'object') data = JSON.stringify(data);

    return R.xhr(url, method, data, headers, null, user, password).then(function (res) {
      // Try to convert response to JSON
      try {
        //res.data = JSON.parse(res.data);
        var p = new window['jsonparsearray']; //import don't work jsonParseArray();
        p.write(res.data);
        res.data = p.get();
      } catch (e) {
        info('xhrJSON:response is not JSON, will return string');
      }

      return res;
    });
  };

  // thenable xhr that saves the result in base64 encoded in local storage (IndexedDb or local file) using YDN-DB
  R.xhrToDbAsBase64 = function (database, store, key, url, method, headers, user, password) {
    if (!database || !store || !key || !url || !method) {
      throw new Error("ERROR: database, store, key, url and method are mandatory attributes");
    }

    return new Promise(function (fulfill, reject) {
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'blob';

      xhr.onload = function () {
        var reader = new FileReader();
        reader.onloadend = function () {

          var schema = {
            stores: [{
              name: store,
              type: 'TEXT' // data type of 'file' object store key
              }]
          };
          var db = new ydn.db.Storage(database, schema);

          db.put(store, {
              data: reader.result
            }, key)
            .done(function (res) {
              fulfill({
                status: xhr.status,
                db: res
              });
            }, function (err) {
              reject({
                status: xhr.status,
                err: err
              });
            });
        }
        reader.readAsDataURL(xhr.response);
      };

      xhr.open(method, url);

      if (user && password) {
        xhr.withCredentials = true;
        xhr.setRequestHeader('user', user);
        xhr.setRequestHeader('password', password);
      }

      if (headers) {
        Object.keys(headers).forEach(function (key) {
          xhr.setRequestHeader(key, headers[key]);
        });
      }

      xhr.send();
    });
  };

  // thenable xhr that takes the data from a local database
  R.xhrToDb = function (database, store, key, url, method, data, headers, user, password) {
    if (!database || !store || !key || !url) {
      throw new Error("ERROR: database, store, key and url are mandatory attributes");
    }

    var schema = {
      stores: [{
        name: store,
        type: 'TEXT' // data type of 'file' object store key
              }]
    };
    var db = new ydn.db.Storage(database, schema);

    return R.xhr(url, method, data, headers, null, user, password)
      .then(function (res) {
        return db.put(store, {
            data: res.data
          }, key)
          .done(function (res) {
            return Promise.resolve({
              status: res.status
            });
          }, function (err) {
            return Promise.reject({
              err: err
            });
          });
      });

  };

  // thenable xhr that stores several rows to a local database
  R.xhrToDb2 = function (database, store, keyPath, url, method, data, headers, user, password) {
    if (!database || !store || !keyPath || !url) {
      throw new Error("ERROR: database, store, key and url are mandatory attributes");
    }

    var schema = {
      stores: [{
        name: store,
        keyPath: keyPath,
        autoIncrement: false
      }]
    };

    var db = new ydn.db.Storage(database, schema);

    return remote.xhrJSON(url, method, data, headers, user, password)
      .then(function (res) {
        res.data.shift();
        promises = [];
        res.data.forEach(function (row) {
          debug(row);
          promises.push(db.put(store, row))
        });

        return Promise.all(promises);
      })
      .then(function (res) {
        return Promise.resolve({
          status: res
        });
      }, function (err) {
        return Promise.reject({
          err: err
        });
      });

  };

  // thenable xhr that takes the data from a local database
  R.xhrFromDb = function (database, store, key, url, method, headers, user, password) {
    if (!database || !store || !key || !url) {
      throw new Error("ERROR: database, store, key and url are mandatory attributes");
    }

    var schema = {
      stores: [{
        name: store,
        type: 'TEXT' // data type of 'file' object store key
              }]
    };
    var db = new ydn.db.Storage(database, schema);

    return db.get(store, key).done(function (res) {
      return R.xhr(url, method, res.data, headers, user, password);
    }, function (err) {
      Promise.reject({
        err: err
      });
    });
  };

  // Exports
  // =======

  window['remote'] = R;

}());

;
(function () {

  // imports
  // ========

  var log = console.log.bind(console);
  var info = console.info.bind(console, 'INFO');
  var debug = console.debug.bind(console, 'DEBUG');
  var error = console.error.bind(console, 'ERROR');

  var H = window.helpers;

  // Odata class
  // ==========

  // constructor
  Odata = function (options) {
    if (!options.accountId || !options.password || !options.url)
      throw "ERROR: url, accountId and password must be set!";

    this.options = options;
    this.credentials = {
      user: options.accountId,
      password: options.password
    }

    // TODO: cleanup this
    this.url = options.url;
    this.password = options.password;
    this.accountId = options.accountId;
  };

  // Static declarations
  // -------------------

  // TODO: cleanup this
  //Odata.xhr = remote.xhr;
  Odata.DEV_URL = 'https://odatadev.gizur.com/';
  Odata.PROD_URL = 'https://odata.gizur.com/';

  // curl -d '{"email":"joe@example.com"}' http://[IP]:[PORT]/create_account
  Odata.createAccount = function (options) {
    debug('createAccount', options);
    var data = {
      email: options.email
    };
    return remote.xhrJSON(options.url + 'create_account', 'POST', data);
  };

  // `curl -d '{"accountId":"3ea8f06baf64","email":"joe@example.com"}' http://[IP]:[PORT]/3ea8f06baf64/s/reset_password`
  Odata.resetPassword = function (options) {
    var data = {
      accountId: options.accountId,
      email: options.email
    };
    return remote.xhrJSON(options.url + options.accountId + '/s/reset_password', 'POST', data);
  };

  // Prototype declarations
  // -----------------------

  // `curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"tableDef":{"tableName":"mytable","columns":["col1 int","col2 varchar(255)"]}}' http://[IP]:[PORT]/3ea8f06baf64/s/create_table`
  Odata.prototype.createTable = function (tableName, columns) {
    var data = {
      tableDef: {
        tableName: tableName,
        columns: columns
      }
    };
    return remote.xhrJSON(this.url + this.accountId + '/s/create_table', 'POST', data, this.credentials);
  };


  // curl -H "user:3ea8f06baf64" -H "password:xxx" http://[IP]:[PORT]/3ea8f06baf64
  Odata.prototype.accountInfo = function () {
    return remote.xhrJSON(this.url + this.accountId, 'GET', null, this.credentials);
  };


  //`curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"tableName":"mytable","accountId":"6adb637f9cf2"}' http://[IP]:[PORT]/3ea8f06baf64/s/grant`
  Odata.prototype.grant = function (tableName, accountId) {
    var data = {
      tableName: tableName,
      accountId: accountId
    };
    return remote.xhrJSON(this.url + this.accountId + '/s/grant', 'POST', data, this.credentials);
  };

  // curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"col1":11,"col2":"11"}' http://[IP]:[PORT]/3ea8f06baf64/mytable`
  Odata.prototype.insert = function (accountId, tableName, data) {
    return remote.xhrJSON(this.url + accountId + '/' + tableName, 'POST', data, this.credentials);
  };

  // `curl -H "user:3ea8f06baf64" -H "password:xxx" http://[IP]:[PORT]/3ea8f06baf64/mytable`
  // `curl -H "user:3ea8f06baf64" -H "password:xxx" http://[IP]:[PORT]/3ea8f06baf64/mytable\?\$select=col2`
  Odata.prototype.get = function (accountId, tableName, columns, filter, orderby, skip) {

    var params = {};
    if (columns) params['$select'] = columns;
    if (filter) params['$filter'] = filter;
    if (orderby) params['$orderby'] = orderby;
    if (skip) params['$skip'] = skip;

    var url = this.url + accountId + '/' + tableName;
    url += (columns || filter || orderby || skip) ? '?' : '';
    url += Qs.stringify(params);

    return remote.xhrJSON(url, 'GET', null, this.credentials);
  };

  // `curl -X DELETE -H "user:3ea8f06baf64" -H "password:xxx" http://[IP]:[PORT]/3ea8f06baf64/mytable`
  Odata.prototype.delete = function (accountId, tableName, filter) {
    var url = this.url + accountId + '/' + tableName;
    url += (filter) ? '?$filter=' + filter : '';
    return remote.xhrJSON(url, 'DELETE', null, this.credentials);
  };

  // `curl -X PUT -H "user:3ea8f06baf64" -H "password:xxx" -d '{"col1":11,"col2":"11"}' http://[IP]:[PORT]/3ea8f06baf64/mytable`
  Odata.prototype.update = function (accountId, tableName, data, filter) {
    var url = this.url + accountId + '/' + tableName;
    url += (filter) ? '?$filter=' + filter : '';

    return remote.xhrJSON(url, 'PUT', data, this.credentials);
  };

  // `curl -X POST -H "user:3ea8f06baf64" -H "password:xxx" -d '{"tableName":"mytable"}' http://[IP]:[PORT]/3ea8f06baf64/s/delete_table`
  Odata.prototype.drop = function (tableName) {
    var data = {
      tableName: tableName,
    };

    return remote.xhrJSON(this.url + this.accountId + '/s/delete_table', 'POST', data, {
      user: this.accountId,
      password: this.password
    });
  };

  // NOTE: crate_bucket is not used anymore, just grant privs instead
  // `curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"bucketName":"b_mybucket"}' http://[IP]:[PORT]/3ea8f06baf64/s/create_bucket`
  Odata.prototype.createBucket = function (bucketName) {
    var data = {
      bucketName: bucketName,
    };
    return remote.xhrJSON(this.url + this.accountId + '/s/create_bucket', 'POST', data,
      this.credentials);
  };

  // `curl -H "user:3ea8f06baf64" -H "password:xxx" -d "Just some test data to store in the bucket" http://[IP]:[PORT]/3ea8f06baf64/b_mybucket`
  Odata.prototype.store = function (accountId, bucketName, data) {
    return remote.xhrJSON(this.url + accountId + '/' + bucketName, 'POST', data,
      this.credentials);
  };

  // `curl -H "user:3ea8f06baf64" -H "password:xxx" -v http://[IP]:[PORT]/3ea8f06baf64/b_mybucket`
  Odata.prototype.fetch = function (accountId, bucketName) {
    return remote.xhrJSON(this.url + accountId + '/' + bucketName, 'GET', null,
      this.credentials);
  };

  // curl -X POST -H "user:3ea8f06baf64" -H "password:xxx" -d '{"accountId":"3ea8f06baf64"}' http://[IP]:[PORT]/3ea8f06baf64/s/delete_account
  Odata.prototype.deleteAccount = function (accountId) {
    var data = {
      accountId: accountId
    };
    return remote.xhrJSON(this.url + accountId + '/s/delete_account', 'POST', data,
      this.credentials);
  };

  // curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"procedure":"myProcedure","params":["\"param1\"","\"param2\"","3"]}' http://[IP]:[PORT]/3ea8f06baf64/s/exec
  Odata.prototype.executeProcedure = function (accountId, procedure, params) {
    var data = {
      procedure: procedure,
      params: params
    };
    return remote.xhrJSON(this.url + accountId + '/s/exec', 'POST', data, this.credentials);
  };

  //`curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"name":"mytable","accountId":"6adb637f9cf2"}' http://[IP]:[PORT]/3ea8f06baf64/s/grant_bucket`
  Odata.prototype.grantBucket = function (accountId, name) {
    var data = {
      name: name,
      verbs: ['select', 'insert', 'update', 'delete'],
      accountId: accountId
    };
    return remote.xhrJSON(this.url + this.accountId + '/s/grant_bucket', 'POST', data, this.credentials);
  };

  //`curl -H "user:3ea8f06baf64" -H "password:xxx" -d '{"name":"mytable","accountId":"6adb637f9cf2"}' http://[IP]:[PORT]/3ea8f06baf64/s/revoke_bucket`
  Odata.prototype.revokeBucket = function (accountId, name) {
    var data = {
      name: name,
      verbs: ['select', 'insert', 'update', 'delete'],
      accountId: accountId
    };
    return remote.xhrJSON(this.url + this.accountId + '/s/revoke_bucket', 'POST', data, this.credentials);
  };

  // Command line help, static functions on the App object
  // -----------------------------------------------------

  Odata.help2 = function (url) {
    if (!url) throw 'ERROR: Mandatory url argument is missing. The constants Odata.DEV_URL and Odata.PROD_URL can for instance be used.';
    return remote.xhrJSON(url + 'help', 'GET');
  }

  Odata.help = function (topic) {

    var footer = '\n\n-----\nSee Odata.help("accounts") for how to setup an account.';

    if (!topic) {

      var msg =
        '-- Odata API help --' +
        "\n\n* Odata.help('accounts') - create accounts, reset password etc." +
        "\n* Odata.help('tables') - working with tables" +
        "\n* Odata.help('buckets') - working with buckets";

      info(msg);

      return;
    }

    if (topic === 'accounts') {
      var msg = "An account can be created in the odata server if you don't alreqady have one:"  +
        "\nThis creas an account and saves the accountid in options.accountId" +
        "\nA 404 i received if the account already exists, the account id is saved anyway" +
        "\n\nvar log = console.log.bind(console);" +
        "\n\nvar options = {url: Odata.DEV_URL, email: 'joe@example.com'};" +
        '\nOdata.createAccount(options).then(' +
        '\n\tfunction(res){log(options.accountId=res.data[1].accountId)}, ' +
        '\n\tfunction(res){log(options.accountId=res.data[1].accountId)});' +
        '\n' +
        "\nOdata.resetPassword(options).then(" +
        "\n\tfunction(res){log(options.password=res.data[0].password)}, log);" +
        "\n\nNow is options setup with the required data to work with the odataserver" +
        "\n\nA second account is used in some of the examples in this help." +
        "\n\nvar options2 = {url: Odata.DEV_URL, email: 'gina@example.com'}" +
        '\nOdata.createAccount(options2).then(' +
        '\n\tfunction(res){log(options2.accountId=res.data[1].accountId)}, ' +
        '\n\tfunction(res){log(options2.accountId=res.data[1].accountId)});' +
        '\n' +
        "\nOdata.resetPassword(options2).then(" +
        "\n\tfunction(res){log(options2.password=res.data[0].password)}, log);" +
        "\n\nDelete an account" +
        "\nvar od = new Odata(options);" +
        "\nod.deleteAccount(options.accountId).then(log);" +
        "\n";

      info(msg);
    }

    else if (topic === 'tables') {
      var msg = "options needs to be setup when working with tables (see Odata.help('accounts') ):"  +
        "\n\nvar log = console.log.bind(console);" +
        "\n\nvar od = new Odata(options);" +
        "\nod.createTable('mytable', ['col1 int','col2 varchar(255)']).then(log);" +
        "\nod.accountInfo().then(log);" +
        "\n" +
        "\n\nod.grant('mytable', options2.accountId).then(console.log.bind(console));" +
        "\nod.insert(options.accountId, 'mytable', {col1:11, col2:'11'}).then(log);" +
        "\nod.insert(options.accountId, 'mytable', {col1:1000, col2:'1010'}).then(log);" +
        "\nod.get(options.accountId, 'mytable').then(log);" +
        "\nod.get(options.accountId, 'mytable', 'col1').then(log);" +
        "\nod.get(options.accountId, 'mytable', null, 'col1 eq 11').then(log);" +
        "\n\n//delete a row" +
        "\nod.delete(options.accountId, 'mytable', 'col1 eq 11').then(log);" +
        "\nod.get(options.accountId, 'mytable').then(log);" +
        "\n\n//update a row" +
        "\nod.update(options.accountId, 'mytable', {col1:1000,col2:'1011'}, 'col1 eq 1000').then(log);" +
        "\nod.get(options.accountId, 'mytable').then(log);" +
        "\n//drop a table" +
        "\nod.drop('mytable').then(log);" +
        "\n";

      info(msg);
    }

    else if (topic === 'buckets') {
      var msg = "options needs to be setup when working with buckets (see Odata.help('accounts') ):"  +
        "\n\nvar log = console.log.bind(console);" +
        "\n\nvar od = new Odata(options);" +
        "\nood.grantBucket(options.accountId,'b_mybucket').then(log);" +
        "\nod.store(options.accountId, 'b_mybucket', 'Some data to store in a bucket').then(log);" +
        "\nod.fetch(options.accountId, 'b_mybucket').then(log);" +
        "\n";

      info(msg);
    }

  }

  // exports
  // ========

  window.Odata = Odata;


}());

!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.buffer=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],2:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],"buffer":[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192

/**
 * If `TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
var TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

// STATIC METHODS
// ==============

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str.toString()
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.compare = function (a, b) {
  assert(Buffer.isBuffer(a) && Buffer.isBuffer(b), 'Arguments must be Buffers')
  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) {
    return -1
  }
  if (y < x) {
    return 1
  }
  return 0
}

// BUFFER INSTANCE METHODS
// =======================

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end === undefined) ? self.length : Number(end)

  // Fastpath empty strings
  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = asciiSlice(self, start, end)
      break
    case 'binary':
      ret = binarySlice(self, start, end)
      break
    case 'base64':
      ret = base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.equals = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.compare = function (b) {
  assert(Buffer.isBuffer(b), 'Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return readUInt16(this, offset, false, noAssert)
}

function readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return readInt16(this, offset, false, noAssert)
}

function readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return readInt32(this, offset, false, noAssert)
}

function readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return readFloat(this, offset, false, noAssert)
}

function readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
  return offset + 1
}

function writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
  return offset + 2
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  return writeUInt16(this, value, offset, false, noAssert)
}

function writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
  return offset + 4
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  return writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
  return offset + 1
}

function writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  return offset + 2
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  return writeInt16(this, value, offset, false, noAssert)
}

function writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  return offset + 4
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  return writeInt32(this, value, offset, false, noAssert)
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  assert(end >= start, 'end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

/*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":1,"ieee754":2}]},{},[])("buffer")
});
// From: https://github.com/creationix/jsonparse
// Import Buffer implemenation from https://github.com/feross/buffer
var Buffer = window.buffer.Buffer;

/*global Buffer*/
// Named constants with unique integer values
var C = {};
// Tokens
var LEFT_BRACE    = C.LEFT_BRACE    = 0x1;
var RIGHT_BRACE   = C.RIGHT_BRACE   = 0x2;
var LEFT_BRACKET  = C.LEFT_BRACKET  = 0x3;
var RIGHT_BRACKET = C.RIGHT_BRACKET = 0x4;
var COLON         = C.COLON         = 0x5;
var COMMA         = C.COMMA         = 0x6;
var TRUE          = C.TRUE          = 0x7;
var FALSE         = C.FALSE         = 0x8;
var NULL          = C.NULL          = 0x9;
var STRING        = C.STRING        = 0xa;
var NUMBER        = C.NUMBER        = 0xb;
// Tokenizer States
var START   = C.START   = 0x11;
var STOP    = C.STOP    = 0x12;
var TRUE1   = C.TRUE1   = 0x21;
var TRUE2   = C.TRUE2   = 0x22;
var TRUE3   = C.TRUE3   = 0x23;
var FALSE1  = C.FALSE1  = 0x31;
var FALSE2  = C.FALSE2  = 0x32;
var FALSE3  = C.FALSE3  = 0x33;
var FALSE4  = C.FALSE4  = 0x34;
var NULL1   = C.NULL1   = 0x41;
var NULL2   = C.NULL2   = 0x42;
var NULL3   = C.NULL3   = 0x43;
var NUMBER1 = C.NUMBER1 = 0x51;
var NUMBER3 = C.NUMBER3 = 0x53;
var STRING1 = C.STRING1 = 0x61;
var STRING2 = C.STRING2 = 0x62;
var STRING3 = C.STRING3 = 0x63;
var STRING4 = C.STRING4 = 0x64;
var STRING5 = C.STRING5 = 0x65;
var STRING6 = C.STRING6 = 0x66;
// Parser States
var VALUE   = C.VALUE   = 0x71;
var KEY     = C.KEY     = 0x72;
// Parser Modes
var OBJECT  = C.OBJECT  = 0x81;
var ARRAY   = C.ARRAY   = 0x82;


function Parser() {
  this.tState = START;
  this.value = undefined;

  this.string = undefined; // string data
  this.unicode = undefined; // unicode escapes

  this.key = undefined;
  this.mode = undefined;
  this.stack = [];
  this.state = VALUE;
  this.bytes_remaining = 0; // number of bytes remaining in multi byte utf8 char to read after split boundary
  this.bytes_in_sequence = 0; // bytes in multi byte utf8 char to read
  this.temp_buffs = { "2": new Buffer(2), "3": new Buffer(3), "4": new Buffer(4) }; // for rebuilding chars split before boundary is reached

  // Stream offset
  this.offset = -1;
}

// Slow code to string converter (only used when throwing syntax errors)
Parser.toknam = function (code) {
  var keys = Object.keys(C);
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    if (C[key] === code) { return key; }
  }
  return code && ("0x" + code.toString(16));
};

var proto = Parser.prototype;
proto.onError = function (err) { throw err; };
proto.charError = function (buffer, i) {
  this.tState = STOP;
  this.onError(new Error("Unexpected " + JSON.stringify(String.fromCharCode(buffer[i])) + " at position " + i + " in state " + Parser.toknam(this.tState)));
};
proto.write = function (buffer) {
  if (typeof buffer === "string") buffer = new Buffer(buffer);
  var n;
  for (var i = 0, l = buffer.length; i < l; i++) {
    if (this.tState === START){
      n = buffer[i];
      this.offset++;
      if(n === 0x7b){ this.onToken(LEFT_BRACE, "{"); // {
      }else if(n === 0x7d){ this.onToken(RIGHT_BRACE, "}"); // }
      }else if(n === 0x5b){ this.onToken(LEFT_BRACKET, "["); // [
      }else if(n === 0x5d){ this.onToken(RIGHT_BRACKET, "]"); // ]
      }else if(n === 0x3a){ this.onToken(COLON, ":");  // :
      }else if(n === 0x2c){ this.onToken(COMMA, ","); // ,
      }else if(n === 0x74){ this.tState = TRUE1;  // t
      }else if(n === 0x66){ this.tState = FALSE1;  // f
      }else if(n === 0x6e){ this.tState = NULL1; // n
      }else if(n === 0x22){ this.string = ""; this.tState = STRING1; // "
      }else if(n === 0x2d){ this.string = "-"; this.tState = NUMBER1; // -
      }else{
        if (n >= 0x30 && n < 0x40) { // 1-9
          this.string = String.fromCharCode(n); this.tState = NUMBER3;
        } else if (n === 0x20 || n === 0x09 || n === 0x0a || n === 0x0d) {
          // whitespace
        } else {
          return this.charError(buffer, i);
        }
      }
    }else if (this.tState === STRING1){ // After open quote
      n = buffer[i]; // get current byte from buffer
      // check for carry over of a multi byte char split between data chunks
      // & fill temp buffer it with start of this data chunk up to the boundary limit set in the last iteration
      if (this.bytes_remaining > 0) {
        for (var j = 0; j < this.bytes_remaining; j++) {
          this.temp_buffs[this.bytes_in_sequence][this.bytes_in_sequence - this.bytes_remaining + j] = buffer[j];
        }
        this.string += this.temp_buffs[this.bytes_in_sequence].toString();
        this.bytes_in_sequence = this.bytes_remaining = 0;
        i = i + j - 1;
      } else if (this.bytes_remaining === 0 && n >= 128) { // else if no remainder bytes carried over, parse multi byte (>=128) chars one at a time
        if (n <= 193 || n > 244) {
          return this.onError(new Error("Invalid UTF-8 character at position " + i + " in state " + Parser.toknam(this.tState)));
        }
        if ((n >= 194) && (n <= 223)) this.bytes_in_sequence = 2;
        if ((n >= 224) && (n <= 239)) this.bytes_in_sequence = 3;
        if ((n >= 240) && (n <= 244)) this.bytes_in_sequence = 4;
        if ((this.bytes_in_sequence + i) > buffer.length) { // if bytes needed to complete char fall outside buffer length, we have a boundary split
          for (var k = 0; k <= (buffer.length - 1 - i); k++) {
            this.temp_buffs[this.bytes_in_sequence][k] = buffer[i + k]; // fill temp buffer of correct size with bytes available in this chunk
          }
          this.bytes_remaining = (i + this.bytes_in_sequence) - buffer.length;
          i = buffer.length - 1;
        } else {
          this.string += buffer.slice(i, (i + this.bytes_in_sequence)).toString();
          i = i + this.bytes_in_sequence - 1;
        }
      } else if (n === 0x22) { this.tState = START; this.onToken(STRING, this.string); this.offset += Buffer.byteLength(this.string, 'utf8') + 1; this.string = undefined; }
      else if (n === 0x5c) { this.tState = STRING2; }
      else if (n >= 0x20) { this.string += String.fromCharCode(n); }
      else {
          return this.charError(buffer, i);
      }
    }else if (this.tState === STRING2){ // After backslash
      n = buffer[i];
      if(n === 0x22){ this.string += "\""; this.tState = STRING1;
      }else if(n === 0x5c){ this.string += "\\"; this.tState = STRING1; 
      }else if(n === 0x2f){ this.string += "\/"; this.tState = STRING1; 
      }else if(n === 0x62){ this.string += "\b"; this.tState = STRING1; 
      }else if(n === 0x66){ this.string += "\f"; this.tState = STRING1; 
      }else if(n === 0x6e){ this.string += "\n"; this.tState = STRING1; 
      }else if(n === 0x72){ this.string += "\r"; this.tState = STRING1; 
      }else if(n === 0x74){ this.string += "\t"; this.tState = STRING1; 
      }else if(n === 0x75){ this.unicode = ""; this.tState = STRING3;
      }else{ 
        return this.charError(buffer, i); 
      }
    }else if (this.tState === STRING3 || this.tState === STRING4 || this.tState === STRING5 || this.tState === STRING6){ // unicode hex codes
      n = buffer[i];
      // 0-9 A-F a-f
      if ((n >= 0x30 && n < 0x40) || (n > 0x40 && n <= 0x46) || (n > 0x60 && n <= 0x66)) {
        this.unicode += String.fromCharCode(n);
        if (this.tState++ === STRING6) {
          this.string += String.fromCharCode(parseInt(this.unicode, 16));
          this.unicode = undefined;
          this.tState = STRING1; 
        }
      } else {
        return this.charError(buffer, i);
      }
    } else if (this.tState === NUMBER1 || this.tState === NUMBER3) {
        n = buffer[i];

        switch (n) {
          case 0x30: // 0
          case 0x31: // 1
          case 0x32: // 2
          case 0x33: // 3
          case 0x34: // 4
          case 0x35: // 5
          case 0x36: // 6
          case 0x37: // 7
          case 0x38: // 8
          case 0x39: // 9
          case 0x2e: // .
          case 0x65: // e
          case 0x45: // E
          case 0x2b: // +
          case 0x2d: // -
            this.string += String.fromCharCode(n);
            this.tState = NUMBER3;
            break;
          default:
            this.tState = START;
            var result = Number(this.string);

            if (isNaN(result)){
              return this.charError(buffer, i);
            }

            if ((this.string.match(/[0-9]+/) == this.string) && (result.toString() != this.string)) {
              // Long string of digits which is an ID string and not valid and/or safe JavaScript integer Number
              this.onToken(STRING, this.string);
            } else {
              this.onToken(NUMBER, result);
            }

            this.offset += this.string.length - 1;
            this.string = undefined;
            i--;
            break;
        }
    }else if (this.tState === TRUE1){ // r
      if (buffer[i] === 0x72) { this.tState = TRUE2; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === TRUE2){ // u
      if (buffer[i] === 0x75) { this.tState = TRUE3; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === TRUE3){ // e
      if (buffer[i] === 0x65) { this.tState = START; this.onToken(TRUE, true); this.offset+= 3; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === FALSE1){ // a
      if (buffer[i] === 0x61) { this.tState = FALSE2; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === FALSE2){ // l
      if (buffer[i] === 0x6c) { this.tState = FALSE3; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === FALSE3){ // s
      if (buffer[i] === 0x73) { this.tState = FALSE4; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === FALSE4){ // e
      if (buffer[i] === 0x65) { this.tState = START; this.onToken(FALSE, false); this.offset+= 4; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === NULL1){ // u
      if (buffer[i] === 0x75) { this.tState = NULL2; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === NULL2){ // l
      if (buffer[i] === 0x6c) { this.tState = NULL3; }
      else { return this.charError(buffer, i); }
    }else if (this.tState === NULL3){ // l
      if (buffer[i] === 0x6c) { this.tState = START; this.onToken(NULL, null); this.offset += 3; }
      else { return this.charError(buffer, i); }
    }
  }
};
proto.onToken = function (token, value) {
  // Override this to get events
};

proto.parseError = function (token, value) {
  this.tState = STOP;
  this.onError(new Error("Unexpected " + Parser.toknam(token) + (value ? ("(" + JSON.stringify(value) + ")") : "") + " in state " + Parser.toknam(this.state)));
};
proto.push = function () {
  this.stack.push({value: this.value, key: this.key, mode: this.mode});
};
proto.pop = function () {
  var value = this.value;
  var parent = this.stack.pop();
  this.value = parent.value;
  this.key = parent.key;
  this.mode = parent.mode;
  this.emit(value);
  if (!this.mode) { this.state = VALUE; }
};
proto.emit = function (value) {
  if (this.mode) { this.state = COMMA; }
  this.onValue(value);
};
proto.onValue = function (value) {
  // Override me
};  
proto.onToken = function (token, value) {
  if(this.state === VALUE){
    if(token === STRING || token === NUMBER || token === TRUE || token === FALSE || token === NULL){
      if (this.value) {
        this.value[this.key] = value;
      }
      this.emit(value);  
    }else if(token === LEFT_BRACE){
      this.push();
      if (this.value) {
        this.value = this.value[this.key] = {};
      } else {
        this.value = {};
      }
      this.key = undefined;
      this.state = KEY;
      this.mode = OBJECT;
    }else if(token === LEFT_BRACKET){
      this.push();
      if (this.value) {
        this.value = this.value[this.key] = [];
      } else {
        this.value = [];
      }
      this.key = 0;
      this.mode = ARRAY;
      this.state = VALUE;
    }else if(token === RIGHT_BRACE){
      if (this.mode === OBJECT) {
        this.pop();
      } else {
        return this.parseError(token, value);
      }
    }else if(token === RIGHT_BRACKET){
      if (this.mode === ARRAY) {
        this.pop();
      } else {
        return this.parseError(token, value);
      }
    }else{
      return this.parseError(token, value);
    }
  }else if(this.state === KEY){
    if (token === STRING) {
      this.key = value;
      this.state = COLON;
    } else if (token === RIGHT_BRACE) {
      this.pop();
    } else {
      return this.parseError(token, value);
    }
  }else if(this.state === COLON){
    if (token === COLON) { this.state = VALUE; }
    else { return this.parseError(token, value); }
  }else if(this.state === COMMA){
    if (token === COMMA) { 
      if (this.mode === ARRAY) { this.key++; this.state = VALUE; }
      else if (this.mode === OBJECT) { this.state = KEY; }

    } else if (token === RIGHT_BRACKET && this.mode === ARRAY || token === RIGHT_BRACE && this.mode === OBJECT) {
      this.pop();
    } else {
      return this.parseError(token, value);
    }
  }else{
    return this.parseError(token, value);
  }
};

Parser.C = C;

window['jsonparse'] = Parser;


// imports
// =======

var Parser = window['jsonparse'];

// from https://github.com/isaacs/inherits/blob/master/inherits_browser.js
var inherits = function (ctor, superCtor) {
  ctor.super_ = superCtor
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};

// Parser
// ========

f = function () {
  Parser.call(this);

  this.res = [];
  this.onValue = function (value) {
    if (!this.stack.length) this.res.push(value);
  };
};
inherits(f, Parser);


f.prototype.get = function () {
  return this.res;
};

f.prototype.clear = function () {
  this.res = [];
};

// exports
// ======

window['jsonparsearray'] = f;

(function(){var l,r=this;function t(a){return void 0!==a}function ba(a){a=a.split(".");for(var b=r,c;c=a.shift();)if(null!=b[c])b=b[c];else return null;return b}
function ca(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b}function v(a){return"array"==ca(a)}function w(a){var b=ca(a);return"array"==b||"object"==b&&"number"==typeof a.length}function x(a){return"string"==typeof a}function da(a){return"boolean"==typeof a}function ea(a){return"number"==typeof a}function fa(a){return"function"==ca(a)}function y(a){var b=typeof a;return"object"==b&&null!=a||"function"==b}var ga="closure_uid_"+(1E9*Math.random()>>>0),ia=0;
function ja(a,b,c){return a.call.apply(a.bind,arguments)}function ka(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function la(a,b,c){la=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ja:ka;return la.apply(null,arguments)}
function ma(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}}var na=Date.now||function(){return+new Date};function oa(a,b){var c=a.split("."),d=r;c[0]in d||!d.execScript||d.execScript("var "+c[0]);for(var e;c.length&&(e=c.shift());)!c.length&&t(b)?d[e]=b:d[e]?d=d[e]:d=d[e]={}}
function z(a,b){function c(){}c.prototype=b.prototype;a.B=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.Qc=function(a,c,f){for(var g=Array(arguments.length-2),h=2;h<arguments.length;h++)g[h-2]=arguments[h];return b.prototype[c].apply(a,g)}};function pa(a){a.prototype.then=a.prototype.then;a.prototype.$goog_Thenable=!0}function qa(a){if(!a)return!1;try{return!!a.$goog_Thenable}catch(b){return!1}};function ra(a){if(Error.captureStackTrace)Error.captureStackTrace(this,ra);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))}z(ra,Error);ra.prototype.name="CustomError";var ta;function ua(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")}function va(a){return/^[\s\xa0]*$/.test(a)}var wa=String.prototype.trim?function(a){return a.trim()}:function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")};
function xa(a){if(!ya.test(a))return a;-1!=a.indexOf("&")&&(a=a.replace(za,"&amp;"));-1!=a.indexOf("<")&&(a=a.replace(Aa,"&lt;"));-1!=a.indexOf(">")&&(a=a.replace(Ba,"&gt;"));-1!=a.indexOf('"')&&(a=a.replace(Ca,"&quot;"));-1!=a.indexOf("'")&&(a=a.replace(Da,"&#39;"));-1!=a.indexOf("\x00")&&(a=a.replace(Ea,"&#0;"));return a}var za=/&/g,Aa=/</g,Ba=/>/g,Ca=/"/g,Da=/'/g,Ea=/\x00/g,ya=/[\x00&<>"']/;
function Fa(a,b){for(var c=b.length,d=0;d<c;d++){var e=1==c?b:b.charAt(d);if(a.charAt(0)==e&&a.charAt(a.length-1)==e)return a.substring(1,a.length-1)}return a}var Ga={"\x00":"\\0","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\x0B",'"':'\\"',"\\":"\\\\"},Ha={"'":"\\'"};
function Ia(a){a=String(a);if(a.quote)return a.quote();for(var b=['"'],c=0;c<a.length;c++){var d=a.charAt(c),e=d.charCodeAt(0),f=c+1,g;if(!(g=Ga[d])){if(!(31<e&&127>e))if(d in Ha)d=Ha[d];else if(d in Ga)d=Ha[d]=Ga[d];else{e=d;g=d.charCodeAt(0);if(31<g&&127>g)e=d;else{if(256>g){if(e="\\x",16>g||256<g)e+="0"}else e="\\u",4096>g&&(e+="0");e+=g.toString(16).toUpperCase()}d=Ha[d]=e}g=d}b[f]=g}b.push('"');return b.join("")}function Ja(a,b){return a<b?-1:a>b?1:0};function Ka(a,b){b.unshift(a);ra.call(this,ua.apply(null,b));b.shift()}z(Ka,ra);Ka.prototype.name="AssertionError";function La(a,b){throw new Ka("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));};var Ma=Array.prototype,Na=Ma.indexOf?function(a,b,c){return Ma.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(x(a))return x(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},Oa=Ma.forEach?function(a,b,c){Ma.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=x(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},Pa=Ma.map?function(a,b,c){return Ma.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=
x(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},Qa=Ma.some?function(a,b,c){return Ma.some.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=x(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return!0;return!1};function Ra(a,b){var c=Sa(a,b,void 0);return 0>c?null:x(a)?a.charAt(c):a[c]}function Sa(a,b,c){for(var d=a.length,e=x(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return f;return-1}
function Ta(a){if(!v(a))for(var b=a.length-1;0<=b;b--)delete a[b];a.length=0}function Ua(a,b){var c=Na(a,b),d;(d=0<=c)&&Ma.splice.call(a,c,1);return d}function Va(a){var b=a.length;if(0<b){for(var c=Array(b),d=0;d<b;d++)c[d]=a[d];return c}return[]}function Wa(a,b,c){return 2>=arguments.length?Ma.slice.call(a,b):Ma.slice.call(a,b,c)}function Xa(a,b){if(!w(a)||!w(b)||a.length!=b.length)return!1;for(var c=a.length,d=Ya,e=0;e<c;e++)if(!d(a[e],b[e]))return!1;return!0}function Ya(a,b){return a===b};var Za;a:{var $a=r.navigator;if($a){var ab=$a.userAgent;if(ab){Za=ab;break a}}Za=""}function bb(a){return-1!=Za.indexOf(a)};function cb(a,b){for(var c in a)b.call(void 0,a[c],c,a)}function db(a,b){for(var c=w(b),d=c?b:arguments,c=c?0:1;c<d.length&&(a=a[d[c]],t(a));c++);return a}var eb="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function fb(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<eb.length;f++)c=eb[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}}
function gb(a){var b=arguments.length;if(1==b&&v(arguments[0]))return gb.apply(null,arguments[0]);for(var c={},d=0;d<b;d++)c[arguments[d]]=!0;return c};function hb(a){r.setTimeout(function(){throw a;},0)}var ib;
function jb(){var a=r.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&(a=function(){var a=document.createElement("iframe");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host,a=la(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},
this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&!bb("Trident")&&!bb("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(t(c.next)){c=c.next;var a=c.Ub;c.Ub=null;a()}};return function(a){d.next={Ub:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("script")?function(a){var b=document.createElement("script");b.onreadystatechange=function(){b.onreadystatechange=
null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){r.setTimeout(a,0)}};function kb(a,b){lb||nb();ob||(lb(),ob=!0);pb.push(new qb(a,b))}var lb;function nb(){if(r.Promise&&r.Promise.resolve){var a=r.Promise.resolve();lb=function(){a.then(rb)}}else lb=function(){var a=rb;!fa(r.setImmediate)||r.Window&&r.Window.prototype.setImmediate==r.setImmediate?(ib||(ib=jb()),ib(a)):r.setImmediate(a)}}var ob=!1,pb=[];[].push(function(){ob=!1;pb=[]});function rb(){for(;pb.length;){var a=pb;pb=[];for(var b=0;b<a.length;b++){var c=a[b];try{c.a.call(c.b)}catch(d){hb(d)}}}ob=!1}
function qb(a,b){this.a=a;this.b=b};function sb(a,b){this.b=tb;this.h=void 0;this.a=this.c=null;this.f=this.g=!1;try{var c=this;a.call(b,function(a){vb(c,wb,a)},function(a){if(!(a instanceof xb))try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(b){}vb(c,yb,a)})}catch(d){vb(this,yb,d)}}var tb=0,wb=2,yb=3;sb.prototype.then=function(a,b,c){return zb(this,fa(a)?a:null,fa(b)?b:null,c)};pa(sb);function Ab(a){a.b==tb&&kb(function(){var a=new xb(void 0);Bb(this,a)},a)}
function Bb(a,b){if(a.b==tb)if(a.c){var c=a.c;if(c.a){for(var d=0,e=-1,f=0,g;g=c.a[f];f++)if(g=g.Ea)if(d++,g==a&&(e=f),0<=e&&1<d)break;0<=e&&(c.b==tb&&1==d?Bb(c,b):(d=c.a.splice(e,1)[0],Cb(c,d,yb,b)))}}else vb(a,yb,b)}function Db(a,b){a.a&&a.a.length||a.b!=wb&&a.b!=yb||Eb(a);a.a||(a.a=[]);a.a.push(b)}
function zb(a,b,c,d){var e={Ea:null,cc:null,dc:null};e.Ea=new sb(function(a,g){e.cc=b?function(c){try{var e=b.call(d,c);a(e)}catch(m){g(m)}}:a;e.dc=c?function(b){try{var e=c.call(d,b);!t(e)&&b instanceof xb?g(b):a(e)}catch(m){g(m)}}:g});e.Ea.c=a;Db(a,e);return e.Ea}sb.prototype.i=function(a){this.b=tb;vb(this,wb,a)};sb.prototype.j=function(a){this.b=tb;vb(this,yb,a)};
function vb(a,b,c){if(a.b==tb){if(a==c)b=yb,c=new TypeError("Promise cannot resolve to itself");else{if(qa(c)){a.b=1;c.then(a.i,a.j,a);return}if(y(c))try{var d=c.then;if(fa(d)){Fb(a,c,d);return}}catch(e){b=yb,c=e}}a.h=c;a.b=b;Eb(a);b!=yb||c instanceof xb||Gb(a,c)}}function Fb(a,b,c){function d(b){f||(f=!0,a.j(b))}function e(b){f||(f=!0,a.i(b))}a.b=1;var f=!1;try{c.call(b,e,d)}catch(g){d(g)}}function Eb(a){a.g||(a.g=!0,kb(a.m,a))}
sb.prototype.m=function(){for(;this.a&&this.a.length;){var a=this.a;this.a=[];for(var b=0;b<a.length;b++)Cb(this,a[b],this.b,this.h)}this.g=!1};function Cb(a,b,c,d){if(c==wb)b.cc(d);else{if(b.Ea)for(;a&&a.f;a=a.c)a.f=!1;b.dc(d)}}function Gb(a,b){a.f=!0;kb(function(){a.f&&Hb.call(null,b)})}var Hb=hb;function xb(a){ra.call(this,a)}z(xb,ra);xb.prototype.name="cancel";/*
 Portions of this code are from MochiKit, received by
 The Closure Authors under the MIT license. All other code is Copyright
 2005-2009 The Closure Authors. All Rights Reserved.
*/
function C(a,b){this.j=[];this.Y=b||null;this.b=this.c=!1;this.g=void 0;this.ja=this.K=this.m=!1;this.i=0;this.f=null;this.G=0}l=C.prototype;l.Xa=function(a,b){this.m=!1;Ib(this,a,b)};function Ib(a,b,c){a.c=!0;a.g=c;a.b=!b;a.yb()}function Jb(a){if(a.c){if(!a.ja)throw new Kb;a.ja=!1}}l.callback=function(a){Jb(this);Ib(this,!0,a)};l.o=function(a){Jb(this);Ib(this,!1,a)};l.H=function(a,b){return Lb(this,a,null,b)};l.Sb=function(a,b){return Lb(this,null,a,b)};l.Rb=function(a,b){return Lb(this,a,a,b)};
function Lb(a,b,c,d){a.j.push([b,c,d]);a.c&&a.yb();return a}l.then=function(a,b,c){var d,e,f=new sb(function(a,b){d=a;e=b});Lb(this,d,function(a){e(a)});return f.then(a,b,c)};pa(C);C.prototype.ub=function(a){Lb(this,a.callback,a.o,a);return this};function Mb(a,b){b instanceof C?a.H(la(b.ia,b)):a.H(function(){return b})}C.prototype.ia=function(a){var b=new C;this.ub(b);a&&(b.f=this,this.G++);return b};function Nb(a){return Qa(a.j,function(a){return fa(a[1])})}
C.prototype.yb=function(){this.i&&this.c&&Nb(this)&&(Ob(this.i),this.i=0);this.f&&(this.f.G--,delete this.f);for(var a=this.g,b=!1,c=!1;this.j.length&&!this.m;){var d=this.j.shift(),e=d[0],f=d[1],d=d[2];if(e=this.b?f:e)try{var g=e.call(d||this.Y,a);t(g)&&(this.b=this.b&&(g==a||g instanceof Error),this.g=a=g);qa(a)&&(this.m=c=!0)}catch(h){a=h,this.b=!0,Nb(this)||(b=!0)}}this.g=a;c&&(c=la(this.Xa,this,!0),g=la(this.Xa,this,!1),a instanceof C?(Lb(a,c,g),a.K=!0):a.then(c,g));b&&(a=new Rb(a),Sb[a.gb]=
a,this.i=a.gb)};function Tb(a){var b=new C;b.callback(a);return b}function Kb(){ra.call(this)}z(Kb,ra);Kb.prototype.message="Deferred has already fired";Kb.prototype.name="AlreadyCalledError";function Rb(a){this.gb=r.setTimeout(la(this.b,this),0);this.a=a}Rb.prototype.b=function(){delete Sb[this.gb];window.console.error(this.a.stack);throw this.a;};var Sb={};function Ob(a){var b=Sb[a];b&&(r.clearTimeout(b.gb),delete Sb[a])};var Ub=gb("area base br col command embed hr img input keygen link meta param source track wbr".split(" "));function Vb(){this.a="";this.b=Wb}Vb.prototype.oa=!0;Vb.prototype.ha=function(){return this.a};Vb.prototype.toString=function(){return"Const{"+this.a+"}"};function Xb(a){if(a instanceof Vb&&a.constructor===Vb&&a.b===Wb)return a.a;La("expected object of type Const, got '"+a+"'");return"type_error:Const"}var Wb={};function Yb(a){var b=new Vb;b.a=a;return b};function Zb(){this.a="";this.b=$b}Zb.prototype.oa=!0;var $b={};Zb.prototype.ha=function(){return this.a};Zb.prototype.toString=function(){return"SafeStyle{"+this.a+"}"};function ac(a){var b=new Zb;b.a=a;return b}var bc=ac(""),cc=/^[-.%_!# a-zA-Z0-9]+$/;function dc(){this.a="";this.b=ec}l=dc.prototype;l.oa=!0;l.ha=function(){return this.a};l.Db=!0;l.ua=function(){return 1};l.toString=function(){return"SafeUrl{"+this.a+"}"};function fc(a){if(a instanceof dc&&a.constructor===dc&&a.b===ec)return a.a;La("expected object of type SafeUrl, got '"+a+"'");return"type_error:SafeUrl"}var gc=/^(?:(?:https?|mailto):|[^&:/?#]*(?:[/?#]|$))/i;
function hc(a){try{var b=encodeURI(a)}catch(c){return"about:invalid#zClosurez"}return b.replace(ic,function(a){return jc[a]})}var ic=/[()']|%5B|%5D|%25/g,jc={"'":"%27","(":"%28",")":"%29","%5B":"[","%5D":"]","%25":"%"},ec={};function kc(a){var b=new dc;b.a=a;return b};function lc(){this.a=mc}l=lc.prototype;l.oa=!0;l.ha=function(){return""};l.Db=!0;l.ua=function(){return 1};l.toString=function(){return"TrustedResourceUrl{}"};var mc={};function nc(){this.a="";this.c=oc;this.b=null}l=nc.prototype;l.Db=!0;l.ua=function(){return this.b};l.oa=!0;l.ha=function(){return this.a};l.toString=function(){return"SafeHtml{"+this.a+"}"};function pc(a){if(a instanceof nc&&a.constructor===nc&&a.c===oc)return a.a;La("expected object of type SafeHtml, got '"+a+"'");return"type_error:SafeHtml"}function qc(a){if(a instanceof nc)return a;var b=null;a.Db&&(b=a.ua());return rc(xa(a.oa?a.ha():String(a)),b)}
function sc(a){if(a instanceof nc)return a;a=qc(a);var b;b=pc(a).replace(/  /g," &#160;").replace(/(\r\n|\r|\n)/g,"<br>");return rc(b,a.ua())}var tc=/^[a-zA-Z0-9-]+$/,uc={action:!0,cite:!0,data:!0,formaction:!0,href:!0,manifest:!0,poster:!0,src:!0},vc={embed:!0,iframe:!0,link:!0,object:!0,script:!0,style:!0,template:!0};
function wc(a,b,c){if(!tc.test(a))throw Error("Invalid tag name <"+a+">.");if(a.toLowerCase()in vc)throw Error("Tag name <"+a+"> is not allowed for SafeHtml.");var d=null,e="<"+a;if(b)for(var f in b){if(!tc.test(f))throw Error('Invalid attribute name "'+f+'".');var g=b[f];if(null!=g){var h,k=a;h=f;if(g instanceof Vb)g=Xb(g);else if("style"==h.toLowerCase()){if(!y(g))throw Error('The "style" attribute requires goog.html.SafeStyle or map of style properties, '+typeof g+" given: "+g);if(!(g instanceof
Zb)){var k="",m=void 0;for(m in g){if(!/^[-_a-zA-Z0-9]+$/.test(m))throw Error("Name allows only [-_a-zA-Z0-9], got: "+m);var n=g[m];null!=n&&(n instanceof Vb?n=Xb(n):cc.test(n)||(La("String value allows only [-.%_!# a-zA-Z0-9], got: "+n),n="zClosurez"),k+=m+":"+n+";")}g=k?ac(k):bc}k=void 0;g instanceof Zb&&g.constructor===Zb&&g.b===$b?k=g.a:(La("expected object of type SafeStyle, got '"+g+"'"),k="type_error:SafeStyle");g=k}else{if(/^on/i.test(h))throw Error('Attribute "'+h+'" requires goog.string.Const value, "'+
g+'" given.');if(h.toLowerCase()in uc)if(g instanceof lc)g instanceof lc&&g.constructor===lc&&g.a===mc?g="":(La("expected object of type TrustedResourceUrl, got '"+g+"'"),g="type_error:TrustedResourceUrl");else if(g instanceof dc)g=fc(g);else throw Error('Attribute "'+h+'" on tag "'+k+'" requires goog.html.SafeUrl or goog.string.Const value, "'+g+'" given.');}g.oa&&(g=g.ha());h=h+'="'+xa(String(g))+'"';e=e+(" "+h)}}t(c)?v(c)||(c=[c]):c=[];!0===Ub[a.toLowerCase()]?e+=">":(d=xc(c),e+=">"+pc(d)+"</"+
a+">",d=d.ua());(a=b&&b.dir)&&(/^(ltr|rtl|auto)$/i.test(a)?d=0:d=null);return rc(e,d)}function xc(a){function b(a){v(a)?Oa(a,b):(a=qc(a),d+=pc(a),a=a.ua(),0==c?c=a:0!=a&&c!=a&&(c=null))}var c=0,d="";Oa(arguments,b);return rc(d,c)}var oc={};function rc(a,b){var c=new nc;c.a=a;c.b=b;return c}var yc=rc("",0);var zc="StopIteration"in r?r.StopIteration:Error("StopIteration");function Ac(){}Ac.prototype.next=function(){throw zc;};Ac.prototype.tb=function(){return this};function Bc(a){if(a instanceof Ac)return a;if("function"==typeof a.tb)return a.tb(!1);if(w(a)){var b=0,c=new Ac;c.next=function(){for(;;){if(b>=a.length)throw zc;if(b in a)return a[b++];b++}};return c}throw Error("Not implemented");}
function Cc(a,b){if(w(a))try{Oa(a,b,void 0)}catch(c){if(c!==zc)throw c;}else{a=Bc(a);try{for(;;)b.call(void 0,a.next(),void 0,a)}catch(d){if(d!==zc)throw d;}}};function Dc(a,b){this.b={};this.a=[];this.f=this.c=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1])}else if(a){var e;if(a instanceof Dc)e=a.na(),d=a.cb();else{var c=[],f=0;for(e in a)c[f++]=e;e=c;c=[];f=0;for(d in a)c[f++]=a[d];d=c}for(c=0;c<e.length;c++)this.set(e[c],d[c])}}l=Dc.prototype;l.zb=function(){return this.c};
l.cb=function(){Ec(this);for(var a=[],b=0;b<this.a.length;b++)a.push(this.b[this.a[b]]);return a};l.na=function(){Ec(this);return this.a.concat()};l.clear=function(){this.b={};this.f=this.c=this.a.length=0};
function Ec(a){if(a.c!=a.a.length){for(var b=0,c=0;b<a.a.length;){var d=a.a[b];Object.prototype.hasOwnProperty.call(a.b,d)&&(a.a[c++]=d);b++}a.a.length=c}if(a.c!=a.a.length){for(var e={},c=b=0;b<a.a.length;)d=a.a[b],Object.prototype.hasOwnProperty.call(e,d)||(a.a[c++]=d,e[d]=1),b++;a.a.length=c}}l.get=function(a,b){return Object.prototype.hasOwnProperty.call(this.b,a)?this.b[a]:b};l.set=function(a,b){Object.prototype.hasOwnProperty.call(this.b,a)||(this.c++,this.a.push(a),this.f++);this.b[a]=b};
l.forEach=function(a,b){for(var c=this.na(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this)}};l.clone=function(){return new Dc(this)};l.tb=function(a){Ec(this);var b=0,c=this.a,d=this.b,e=this.f,f=this,g=new Ac;g.next=function(){for(;;){if(e!=f.f)throw Error("The map has changed since the iterator was created");if(b>=c.length)throw zc;var g=c[b++];return a?g:d[g]}};return g};var Fc=bb("Opera")||bb("OPR"),Gc=bb("Trident")||bb("MSIE"),Hc=bb("Gecko")&&-1==Za.toLowerCase().indexOf("webkit")&&!(bb("Trident")||bb("MSIE")),Ic=-1!=Za.toLowerCase().indexOf("webkit");Ic&&bb("Mobile");bb("Macintosh");bb("Windows");bb("Linux")||bb("CrOS");var Jc=r.navigator||null;Jc&&(Jc.appVersion||"").indexOf("X11");bb("Android");!bb("iPhone")||bb("iPod")||bb("iPad");bb("iPad");function Kc(){var a=r.document;return a?a.documentMode:void 0}
var Lc=function(){var a="",b;if(Fc&&r.opera)return a=r.opera.version,fa(a)?a():a;Hc?b=/rv\:([^\);]+)(\)|;)/:Gc?b=/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/:Ic&&(b=/WebKit\/(\S+)/);b&&(a=(a=b.exec(Za))?a[1]:"");return Gc&&(b=Kc(),b>parseFloat(a))?String(b):a}(),Mc={};
function Nc(a){var b;if(!(b=Mc[a])){b=0;for(var c=wa(String(Lc)).split("."),d=wa(String(a)).split("."),e=Math.max(c.length,d.length),f=0;0==b&&f<e;f++){var g=c[f]||"",h=d[f]||"",k=RegExp("(\\d*)(\\D*)","g"),m=RegExp("(\\d*)(\\D*)","g");do{var n=k.exec(g)||["","",""],p=m.exec(h)||["","",""];if(0==n[0].length&&0==p[0].length)break;b=Ja(0==n[1].length?0:parseInt(n[1],10),0==p[1].length?0:parseInt(p[1],10))||Ja(0==n[2].length,0==p[2].length)||Ja(n[2],p[2])}while(0==b)}b=Mc[a]=0<=b}return b}
var Oc=r.document,Pc=Oc&&Gc?Kc()||("CSS1Compat"==Oc.compatMode?parseInt(Lc,10):5):void 0;function Qc(a){var b;b||(b=Rc(a||arguments.callee.caller,[]));return b}
function Rc(a,b){var c=[];if(0<=Na(b,a))c.push("[...circular reference...]");else if(a&&50>b.length){c.push(Sc(a)+"(");for(var d=a.arguments,e=0;d&&e<d.length;e++){0<e&&c.push(", ");var f;f=d[e];switch(typeof f){case "object":f=f?"object":"null";break;case "string":break;case "number":f=String(f);break;case "boolean":f=f?"true":"false";break;case "function":f=(f=Sc(f))?f:"[fn]";break;default:f=typeof f}40<f.length&&(f=f.substr(0,40)+"...");c.push(f)}b.push(a);c.push(")\n");try{c.push(Rc(a.caller,
b))}catch(g){c.push("[exception trying to get caller]\n")}}else a?c.push("[...long stack...]"):c.push("[end]");return c.join("")}function Sc(a){if(Tc[a])return Tc[a];a=String(a);if(!Tc[a]){var b=/function ([^\(]+)/.exec(a);Tc[a]=b?b[1]:"[Anonymous]"}return Tc[a]}var Tc={};function Uc(a,b,c,d,e){"number"==typeof e||Vc++;this.g=d||na();this.f=a;this.c=b;this.b=c;delete this.a}Uc.prototype.a=null;var Vc=0;function Wc(a){this.g=a;this.a=this.f=this.b=this.c=null}function Xc(a,b){this.name=a;this.value=b}Xc.prototype.toString=function(){return this.name};var Yc=new Xc("SHOUT",1200),Zc=new Xc("SEVERE",1E3),$c=new Xc("WARNING",900),ad=new Xc("INFO",800),bd=new Xc("CONFIG",700),cd=new Xc("FINE",500),dd=new Xc("FINER",400),ed=new Xc("FINEST",300),fd=[new Xc("OFF",Infinity),Yc,Zc,$c,ad,bd,cd,dd,ed,new Xc("ALL",0)],gd=null;Wc.prototype.getName=function(){return this.g};
function hd(a){if(a.b)return a.b;if(a.c)return hd(a.c);La("Root logger has no level set.");return null}Wc.prototype.log=function(a,b,c){if(a.value>=hd(this).value)for(fa(b)&&(b=b()),a=new Uc(a,String(b),this.g),c&&(a.a=c),c="log:"+a.c,r.console&&(r.console.timeStamp?r.console.timeStamp(c):r.console.markTimeline&&r.console.markTimeline(c)),r.msWriteProfilerMark&&r.msWriteProfilerMark(c),c=this;c;){b=c;var d=a;if(b.a)for(var e=0,f=void 0;f=b.a[e];e++)f(d);c=c.c}};var id={},jd=null;
function kd(){jd||(jd=new Wc(""),id[""]=jd,jd.b=bd)}function ld(){kd();return jd}function D(a){kd();var b;if(!(b=id[a])){b=new Wc(a);var c=a.lastIndexOf("."),d=a.substr(c+1),c=D(a.substr(0,c));c.f||(c.f={});c.f[d]=b;b.c=c;id[a]=b}return b};function md(a,b,c){a&&a.log(b,c,void 0)}function nd(a,b){a&&a.log(Zc,b,void 0)}function E(a,b){a&&a.log($c,b,void 0)}function od(a,b){a&&a.log(cd,b,void 0)};function F(a,b){a&&a.log(ed,b,void 0)}function G(a,b){a&&a.log(dd,b,void 0)};function J(a){ra.call(this,a);this.name="ydn.error.ArgumentException"}z(J,ra);function pd(a){ra.call(this,a);this.name="ydn.error.TypeError"}z(pd,ra);function qd(a){ra.call(this,a);this.name="ydn.error.NotSupportedException"}z(qd,ra);function rd(a){ra.call(this,a);this.name="ydn.error.NotImplementedException"}z(rd,ra);function sd(a){ra.call(this,a);this.name="ydn.error.InvalidOperationException"}z(sd,ra);
function td(a){Error.captureStackTrace?Error.captureStackTrace(this,td):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.InternalError"}z(td,Error);td.prototype.name="ydn.error.InternalError";function ud(a,b){C.call(this,0,b);this.h=[]}z(ud,C);l=ud.prototype;l.Tb=function(a,b){this.h.push([a,b]);return this};function vd(a,b){for(var c=0;c<a.h.length;c++)a.h[c][0].call(a.h[c][1],b)}l.callback=function(a){this.h.length=0;ud.B.callback.call(this,a)};l.o=function(a){this.h.length=0;ud.B.o.call(this,a)};l.ub=function(a){ud.B.ub.call(this,a);a instanceof ud&&a.Tb(function(a){vd(this,a)},this);return this};l.zc=function(){return this};C.prototype.done=C.prototype.H;C.prototype.fail=C.prototype.Sb;C.prototype.always=C.prototype.Rb;ud.prototype.then=ud.prototype.then;function K(a,b,c,d){a>b&&(b=a=void 0);null===a&&(a=void 0);null===b&&(b=void 0);this.lower=a;this.upper=b;this.lowerOpen=!!c;this.upperOpen=!!d}K.prototype.lower=void 0;K.prototype.upper=void 0;K.prototype.toJSON=function(){return wd(this)};function xd(a){return yd(a)}function zd(a){return new K(a,a,!1,!1)}function Ad(a,b,c,d){return new K(a,b,c,d)}function Bd(a,b){return new K(void 0,a,void 0,!!b)}function Cd(a,b){return new K(a,void 0,!!b,void 0)}
function Dd(a){var b;if(v(a))b=Va(a),b.push("\uffff");else if(x(a))b=a+"\uffff";else if(ea(a))b=a+2.220460492503131E-16,a-=2.220460492503131E-16;else return zd(a);return Ad(a,b,!1,!0)}function wd(a){a=a||{};return{lower:a.lower,upper:a.upper,lowerOpen:a.lowerOpen,upperOpen:a.upperOpen}}
function yd(a){return null!=a?null!=a.upper&&null!=a.lower?Ed.bound(a.lower,a.upper,!!a.lowerOpen,!!a.upperOpen):null!=a.upper?Ed.upperBound(a.upper,a.upperOpen):null!=a.lower?Ed.lowerBound(a.lower,a.lowerOpen):null:null}function Fd(a){if(a instanceof K)return"";if(null!=a){if(y(a)){for(var b in a){var c;if(c=a.hasOwnProperty(b))c=!(0<=Na(["lower","upper","lowerOpen","upperOpen"],b));if(c)return'invalid attribute "'+b+'" in key range object'}return""}return"key range must be an object"}return""}
K.prototype.ka=function(a){var b=this.lower,c=this.upper,d=this.lowerOpen,e=this.upperOpen;null!=a.lower&&(null==this.lower||a.lower>=this.lower)&&(b=a.lower,d=a.lowerOpen||this.lowerOpen);null!=a.upper&&(null==this.upper||a.upper<=this.upper)&&(c=a.upper,e=a.upperOpen||this.upperOpen);return Ad(b,c,d,e)};function Gd(a){if(!a)return"";var b=a.lowerOpen?"(":"[";null!=a.lower&&(b+=a.lower+", ");null!=a.upper&&(b+=a.upper);return b+=a.upperOpen?")":"]"}
function Hd(a,b,c,d,e){if(c)if(c.lowerOpen||c.upperOpen||null==c.lower||null==c.upper||0!==L(c.lower,c.upper)){if(null!=c.lower){var f=c.lowerOpen?" > ":" >= ";d.push(a+f+"?");e.push(Id(c.lower,b))}null!=c.upper&&(f=c.upperOpen?" < ":" <= ",d.push(a+f+"?"),e.push(Id(c.upper,b)))}else d.push(a+" = ?"),e.push(Id(c.lower,b))}
function Jd(a,b,c,d){var e,f,g,h;if("starts"==a||"^"==a)return Dd(b);if("<"==a||"<="==a)e=b,g="<"==a;else if(">"==a||">="==a)f=b,h=">"==a;else if("="==a||"=="==a)e=f=b;else throw new J("invalid op: "+a);if("<"==c||"<="==c)e=d,g="<"==c;else if(">"==c||">="==c)f=d,h=">"==c;else if(t(c))throw new J("invalid op2: "+c);return Ad(f,e,h,g)}var Ed=r.IDBKeyRange||r.webkitIDBKeyRange||K;function Kd(a,b){var c,d;2==arguments.length&&x(arguments[1])?(c=!0,d=arguments[1].split(".")):d=(c=w(b))?b:arguments;for(c=c?0:1;c<d.length&&(a=a[d[c]],t(a));c++);return a}function Ld(a,b,c){if(a)if(-1==b.indexOf("."))a[b]=c;else{b=b.split(".");for(var d=b.pop(),e;e=b.shift();)y(a[e])||(a[e]={}),a=a[e];a[d]=c}}var Md={};
function Nd(a){var b=[a];a=new Od;for(var c=0,d,e;void 0!==(e=b.pop());){0===c%4&&12<c+4&&(a.write(c),c=0);d=typeof e;if(e instanceof Array)if(c+=4,0<e.length){b.push(Md);for(d=e.length;d--;)b.push(e[d]);continue}else a.write(c);else if("number"===d)c+=1,a.write(c),Pd(a,e);else if(e instanceof Date)c+=2,a.write(c),Pd(a,e.valueOf());else if("string"===d){c+=3;a.write(c);c=a;for(d=0;d<e.length;d++){var f=e.charCodeAt(d);126>=f?c.write(f+1):16510>=f?(f-=127,c.write(128|f>>8,f&255)):c.write(192|f>>10,
f>>2|255,(f|3)<<6)}c.write(0)}else if(e===Md)a.write(0);else return"";c=0}for(b=a.a.length;"00"===a.a[--b];);a.a.length=++b;return a.toString()}function Qd(a){for(var b=[],c=b,d=[],e,f,g=new Sd(a);null!=Td(g);)if(0===g.a)c=d.pop();else{if(null===g.a)break;do{e=g.a/4|0;a=g.a%4;for(var h=0;h<e;h++)f=[],c.push(f),d.push(c),c=f;if(0===a&&12<g.a+4)Td(g);else break}while(1);1===a?c.push(Ud(g)):2===a?c.push(new Date(Ud(g))):3===a?c.push(Vd(g)):0===a&&(c=d.pop())}return b[0]}
function Pd(a,b){var c,d,e;c=b;var f=e=d=0;if(0!==c)if(isFinite(c)){0>c&&(d=1,c=-c);f=0;if(2.2250738585072014E-308<=c){for(e=c;1>e;)f--,e*=2;for(;2<=e;)f++,e/=2;e=f+1023}f=e?Math.floor(4503599627370496*(c/Math.pow(2,f)-1)):Math.floor(c/4.9E-324)}else e=2047,isNaN(c)?f=0x8000000000000:-Infinity===c&&(d=1);c=d;d=e;e=f;c&&(e=0xfffffffffffff-e,d=2047-d);a.write((c?0:128)|d>>4);a.write((d&15)<<4|0|e/281474976710656);e%=281474976710656;c=0|e/4294967296;a.write(c>>8,c&255);e%=4294967296;c=0|e/65536;a.write(c>>
8,c&255);c=e%65536;a.write(c>>8,c&255)}function Ud(a){var b=Td(a)|0,c=b>>7?!1:!0,d=c?-1:1,e=(b&127)<<4,b=Td(a)|0,e=e+(b>>4);c&&(e=2047-e);for(var b=[c?15-(b&15):b&15],f=6;f--;)b.push(c?255-(Td(a)|0):Td(a)|0);a=0;for(f=7;f--;)a=a/256+b[f];a/=16;return 0===a&&0===e?0:(a+1)*Math.pow(2,e-1023)*d}
function Vd(a){for(var b=[],c=0,d=0,e=0,f,g;;){f=Td(a);if(0===f||null==f)break;0===c?(g=f>>6,2>g&&!isNaN(f)?b.push(String.fromCharCode(f-1)):(c=g,d=f<<10,e++)):2===c?(b.push(String.fromCharCode(d+f+127)),c=d=e=0):2===e?(d+=f<<2,e++):(b.push(String.fromCharCode(d|f>>6)),c=d=e=0)}return b.join("")}function Sd(a){this.a=null;this.b=a;this.c=this.b.length-1;this.index=-1}function Td(a){return a.a=a.index<a.c?parseInt(a.b.charAt(++a.index)+a.b.charAt(++a.index),16):null}
function Od(){this.a=[];this.b=void 0}Od.prototype.write=function(a){for(var b=0;b<arguments.length;b++)this.b=arguments[b].toString(16),this.a.push(2===this.b.length?this.b:this.b="0"+this.b)};Od.prototype.toString=function(){return this.a.length?this.a.join(""):""};function Wd(a,b){var c=Nd(a),d=Nd(b);return c>d?1:c==d?0:-1};function Xd(a,b,c,d,e){if(!(b instanceof K))if(x(b)&&t(c))b=Jd(b,c,d,e);else if(null!=b){if(!(b instanceof K))if(y(b))b=new K(b.lower,b.upper,b.lowerOpen,b.upperOpen);else throw new J("Invalid key range: "+b+" of type "+typeof b);}else b=null;this.a=b;this.ma=a}Xd.prototype.ma="";Xd.prototype.ka=function(a){if(this.ma!=a.ma)return null;a=null!=this.a&&null!=a.a?this.a.ka(a.a):this.a||a.a;return new Xd(this.ma,a)};var Yd={READ_ONLY:"readonly",READ_WRITE:"readwrite",VERSION_CHANGE:"versionchange"},Zd=Yd.READ_ONLY,M=Yd.READ_WRITE,$d=Yd.VERSION_CHANGE,ae=r.indexedDB||r.mozIndexedDB||r.webkitIndexedDB||r.moz_indexedDB||r.msIndexedDB;function be(){0!=ce&&(de[this[ga]||(this[ga]=++ia)]=this);this.ia=this.ia;this.ja=this.ja}var ce=0,de={};be.prototype.ia=!1;be.prototype.Wb=function(){if(!this.ia&&(this.ia=!0,this.fa(),0!=ce)){var a=this[ga]||(this[ga]=++ia);delete de[a]}};be.prototype.fa=function(){if(this.ja)for(;this.ja.length;)this.ja.shift()()};function ee(a,b,c,d){be.call(this);this.b=c;this.s=c.getName();this.O=void 0;this.g=!1;this.w=null;this.f=a;this.Qb=b;this.ta=0;this.N=this.C=!1;this.u=d||4;this.j=this.c=this.a=void 0;this.G=function(){throw new td;};this.Y=function(){throw new td;};this.Pb=function(){}}z(ee,be);l=ee.prototype;
l.Ob=function(a,b,c,d,e){if(t(b)){a=this.b;var f,g=b;v(b)?(f=fe(a,b),g=b.join(", ")):f=ge(a,b);if(!f)throw new J('require index "'+g+'" not found in store "'+a.getName()+'"');this.O=f.getName()}this.g=x(this.O);this.w=c||null;this.ta=0;this.N=this.C=!1;this.reverse="prev"==d||"prevunique"==d;this.unique="nextunique"==d||"prevunique"==d;this.Z=d;this.Ia=e;this.j=this.c=this.a=void 0};l.Z="";l.w=null;l.unique=!1;l.reverse=!1;l.Ia=!0;l.logger=D("ydn.db.core.req.AbstractCursor");
function he(a,b){a.Y(b);ie(a);a.C=!0}l.W=function(a,b,c){null==a&&(G(this.logger,this+" finished."),this.C=!0);this.a=a;this.c=b;this.j=c;this.ta++;this.C?(F(this.logger,this+" DONE."),this.G(),ie(this)):(F(this.logger,this+" new cursor position {"+(this.g?this.a+", "+this.c:this.a)+"}"),this.G(this.a))};l.fa=function(){this.f=null};l.toString=function(){return"Cursor:"+this.s+(t(this.O)?":"+this.O:"")+"["+(this.f?"":"~")+this.Qb+"]"};
function ie(a){null!=a.c?a.c=je(a.c):a.c=void 0;null!=a.a?a.a=je(a.a):a.a=void 0;a.Pb(a.N,a.a,a.c)}l.open=function(a,b,c,d){this.f=a;this.Qb=b;this.C=this.N=!1;this.a=c;this.c=d;this.openCursor(this.a,this.c)};function ke(a){a.N=!0;F(a.logger,a+": exit");ie(a)}l.zb=function(){return this.ta};l.Mc=function(){return this.a};l.T=function(){return this.g?this.c:this.a};l.Ca=function(){return this.Ia?this.T():this.j};l.Sa=function(){};l.ra=function(){};
function le(a,b,c){F(a.logger,a+" restarting");a.C=!1;a.N=!1;a.openCursor(c,b)};function me(){};function N(a,b,c,d,e,f,g){if(!x(a))throw new TypeError("store name must be a string, but "+a+" found.");this.b=a;this.c=b;this.h=g;this.u=!!this.c;if(t(d)&&!da(d))throw new J("reverse value must be a boolean, but "+typeof d+" found");if(t(e)&&!da(e))throw new J("unique value must be a boolean, but "+typeof e+" found");if(t(f)&&!da(f))throw new J("key_only value must be a boolean, but "+typeof f+" found");this.f=t(f)?f:!!x(this.c);a="next";d&&e?a="prevunique":d?a="prev":e&&(a="nextunique");this.m=
a;if(d=Fd(c))throw new J("Invalid key range: "+d);this.a=yd(c);this.g=ne;this.C=NaN}z(N,me);N.prototype.f=!0;function oe(a,b,c){if(3<arguments.length)throw new J("too many argument");N.call(this,a,void 0,b,c,void 0,!0)}z(oe,N);function pe(a,b,c,d,e){if(!x(b))throw new J("index name must be string");N.call(this,a,b,c,d,e,!0)}z(pe,N);function qe(a,b,c){if(3<arguments.length)throw new J("too many argument");N.call(this,a,void 0,b,c,void 0,!1)}z(qe,N);
function re(a,b,c,d,e){if(!x(b))throw new J("index name must be string");N.call(this,a,b,c,d,e,!1)}z(re,N);var ne="init";l=N.prototype;l.logger=D("ydn.db.Iterator");l.Dc=function(){return this.b};l.Ac=function(){return this.c};l.gc=function(){return this.a?this.a instanceof Ed?this.a:Ed.bound(this.a.lower,this.a.upper,this.a.lowerOpen,this.a.upperOpen):null};l.Ec=function(){return this.f};l.qc=function(){return this.u};
l.clone=function(){var a=new N(this.b,this.c,this.a,this.da(),this.za(),this.f,this.h);a.C=this.C;return a};l.unique=function(a){return new N(this.b,this.c,this.a,this.da(),a,this.f,this.h)};l.toJSON=function(){return{store:this.b,index:this.c,keyRange:this.a?wd(this.a):null,direction:this.m}};
l.toString=function(){var a=t(this.h)?":"+this.h.join(","):t(this.c)?":"+this.c:"",a=a+Gd(this.a);this.g!=ne&&(a+=this.g+"{"+this.i,this.u&&(a+=", "+this.j),a+="}");var b=this.u?"Index":"",b=b+(this.f?"Key":"Value");return b+"Iterator:"+this.b+a};l.hc=function(a,b){var c=new N(this.b,this.c,this.a,this.da(),this.za(),this.f,this.h);c.i=a;c.j=b;c.g="rest";return c};l.reverse=function(){return new N(this.b,this.c,this.a,!this.da(),this.za(),this.f,this.h)};
l.da=function(){return"prev"===this.m||"prevunique"===this.m};l.za=function(){return"nextunique"===this.m||"prevunique"===this.m};l.pc=function(){return this.g};l.load=function(a){a=a[0];a.Ob(this.b,this.h||this.c,this.a,this.m,this.f);this.g="busy";var b=this;a.Pb=function(a,d,e){b.i=d;b.j=e;b.g=a?"rest":"done"};a.openCursor(this.i,this.j);return a};l.Bc=function(){return this.i};l.Cc=function(){return this.j};
l.Jb=function(a,b,c){a=a||ne;"busy"==this.g?E(this.logger,this+": resetting state to "+a+" ignore during iteration"):(this.i=b,this.j=c,this.g=a)};l.stores=function(){return[this.b]};function se(a,b,c){ud.call(this,0,c);this.C=a;this.h=[];this.u=[];this.ta=[];this.a=null;this.ya="";this.N=0}z(se,ud);l=se.prototype;l.ya="";l.logger=D("ydn.db.Request");function te(a,b,c){a.a=b;a.ya=c;G(a.logger,a+" BEGIN");if(b){for(c=0;c<a.u.length;c++)a.u[c][0].call(a.u[c][1],b);a.u.length=0}}function ue(a){var b=new se(a.C);a.N++;te(b,a.a,a.ya+"C"+a.N);return b}function ve(a){G(a.logger,a+" END");a.a=null}l.lc=function(){return!!this.a};
l.abort=function(){G(this.logger,this+" aborting "+this.a);if(this.a)if(fa(this.a.abort))this.a.abort();else if(fa(this.a.executeSql))this.a.executeSql("ABORT",[],function(){},function(){return!0});else throw new qd;else throw new we(this+" No active transaction");};function P(a,b,c){var d=a.ta.shift();c=!!c;d?d[0].call(d[1],b,c,function(b,c){P(a,b,c)}):c?a.o(b):a.callback(b)}function xe(a,b,c){a.ta.push([b,c])}function Q(a,b,c){a.a?b.call(c,a.a):a.u.push([b,c])}
l.callback=function(a){G(this.logger,this+" SUCCESS");se.B.callback.call(this,a)};l.o=function(a){G(this.logger,this+" ERROR");se.B.o.call(this,a)};l.state=function(){return this.c?this.b?"rejected":"resolved":"pending"};function R(a){var b="";a.ya&&(b=a.a?"*":"",b="["+a.ya+b+"]");return a.C+b}function ye(a,b){var c=new se(a);P(c,b);return c}l.toString=function(){return"Request:"+R(this)};
l.yb=function(){this.i&&this.c&&Nb(this)&&(Ob(this.i),this.i=0);this.f&&(this.f.G--,delete this.f);for(var a=this.g,b=!1;this.j.length&&!this.m;){var c=this.j.shift(),d=c[0],e=c[1],c=c[2];if(d=this.b?e:d)d=d.call(c||this.Y,a),t(d)&&(this.b=this.b&&(d==a||d instanceof Error),this.g=a=d),qa(a)&&(this.m=b=!0)}this.g=a;b&&(b=la(this.Xa,this,!0),d=la(this.Xa,this,!1),a instanceof C?(Lb(a,b,d),a.K=!0):a.then(b,d))};
l.toJSON=function(){var a=(this.ya||"").match(/B(\d+)T(\d+)(?:Q(\d+?))?(?:R(\d+))?/)||[];return{method:this.C?this.C.split(":"):[],branchNo:parseFloat(a[1]),transactionNo:parseFloat(a[2]),queueNo:parseFloat(a[3]),requestNo:parseFloat(a[4])}};var L=ae&&ae.cmp?la(ae.cmp,ae):Wd,ze=[];function Ae(a,b,c,d){if("transaction"in a)this.i=a,this.c=this.h=null;else if("objectStore"in a){if(this.i=null,this.h=a.db,this.c=a,!this.c.db.objectStoreNames.contains(b))throw new Be('store "'+b+'" not in transaction.');}else throw new Be("storage instance require.");this.j=b;this.m=c;this.u=d;this.b=[];this.a=0;this.g=!1}Ae.prototype.logger=D("ydn.db.con.IdbCursorStream");Ae.prototype.g=!1;
function Ce(a,b){a.a++;b.onsuccess=function(b){if(b=b.target.result){if(fa(a.u)){var d=b.value;a.u(b.primaryKey,null!=a.m?d[a.m]:d)}else E(a.logger,"sink gone, dropping value for: "+b.primaryKey);if(b&&0<a.b.length)b["continue"](a.b.shift());else a.a--,0==a.a&&a.ea&&a.ea()}};b.onerror=function(){E(a.logger,"seeking fail. "+("error"in b?b.error.name+":"+b.error.message:""));a.a--;0==a.a&&a.ea&&a.ea()}}function De(a,b){0==a.b.length&&0==a.a?b():a.ea=b}
function Ee(a){if(!a.g){var b=function(b,c){a.c=null;"complete"!==b&&E(a.logger,c.name+":"+c.message);F(a.logger,a+" transaction "+b)},c=function(b){var c=a.b.shift();F(a.logger,a+" transaction started for "+c);b=b.objectStore(a.j);Ce(a,b.openCursor(c))};if(a.c)F(a.logger,a+" using existing tx."),c(a.c);else if(a.h)F(a.logger,a+" creating tx from IDBDatabase."),a.f=a.h.transaction([a.j],Zd),a.f.oncomplete=function(a){b("complete",a)},a.f.onerror=function(a){b("error",a)},a.f.onabort=function(a){b("abort",
a)};else if(a.i)F(a.logger,a+" creating tx from ydn.db.con.IStorage."),a.g=!0,a.i.transaction(function(b){a.g=!1;c(b)},[a.j],Zd,b);else throw new Fe("no way to create a transaction provided.");}};function Ge(a,b,c){a&&a instanceof S?this.Pa=a:a&&a.db&&(this.Pa=null,He(this,a));if(!x(b))throw new J("a store name required.");this.c=b;if(t(c)&&!x(c))throw new J("projection index name must be a string.");this.Qa=c;this.qa=null;this.b=[];this.a=[];this.Ha=!1}l=Ge.prototype;l.logger=D("ydn.db.Streamer");l.Pa=null;l.Lb=null;l.qa=null;l.xc=function(a){this.Lb=a};function He(a,b){if(b.db)a.qa=new Ae(b,a.c,a.Qa,la(a.ea,a));else throw new J("Invalid IndexedDB Transaction.");}
function Ie(a){var b=0<a.a.length;if(b&&!a.Ha&&fa(a.Lb)){var c=function(){Ie(a)},d=a.b.shift(),e=a.a.shift(),b=0<a.a.length,c=a.Lb(d,e,b?c:null);b&&!c&&Ie(a)}}l.Ha=!1;l.Jc=function(a){if(this.qa){this.Ha=!0;var b=this;De(this.qa,function(){a(b.b,b.a);b.b=[];b.a=[];b.Ha=!1})}else a(this.b,this.a),this.b=[],this.a=[]};l.ea=function(a,b){this.b.push(a);this.a.push(b);Ie(this)};
l.push=function(a,b){if(this.Ha)throw new Je("push not allowed after a collection is started");if(2<=arguments.length)this.ea(a,b);else{if(!this.qa){if(!this.Pa)throw new Je("Database connection is not setup.");var c=this.Pa.Ba();if(c)if("indexeddb"===c)this.qa=new Ae(this.Pa,this.c,this.Qa,la(this.ea,this));else throw new Ke(c);else throw new Je("Database is not connected.");}c=this.qa;c.b.push(a);Ee(c)}};l.toString=function(){return"Streamer:"+this.c+(this.Qa||"")};function Le(a,b){if(null!=a&&!("push"in a))throw new Be('output receiver object must have "push" method.');this.a=a||null;this.i=b;this.g=0;this.b=!1;this.f=a instanceof Ge&&!!a.Qa}Le.prototype.logger=D("ydn.db.algo.AbstractSolver");
Le.prototype.h=function(a,b){this.b=b[0].da();for(var c=0;c<b.length;c++){if(!(b[c]instanceof N))throw new pd("item at iterators "+c+" is not an iterator.");if(0<c&&this.b!=b[c].da())throw new pd("iterator at "+c+" must "+(this.b?"be reverse":"not be reverse"));}this.a instanceof Ge&&He(this.a,a);if(this.f&&(c=b[0].h)&&1<c.length&&c[c.length-1]!=this.a.Qa)throw new Je("Output streamer projection field must be same as postfix field in the iterator");for(var d="{",c=0;c<b.length;c++)0<c&&(d+=", "),
d+=b.toString();d+="}";this.b&&(d+=" reverse");od(this.logger,this+" begin "+d);return!1};function Me(a,b,c){var d,e=null!=d;if(!t(d)){d=c[0];for(var e=null!=d,f=1;e&&f<c.length;f++)null!=c[f]&&0==L(c[f],d)||(e=!1)}return e&&(a.g++,a.a&&(a.f?a.a.push(d,void 0):a.a.push(d)),t(a.i)&&a.g>=a.i)?[]:b}Le.prototype.c=function(){return[]};function Ne(a){Error.captureStackTrace?Error.captureStackTrace(this,Ne):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ConstraintError"}z(Ne,Error);Ne.prototype.name="ConstraintError";Ne.prototype.toString=function(){return this.name+": "+this.message};function Oe(a){Error.captureStackTrace?Error.captureStackTrace(this,Oe):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.db.VersionError"}z(Oe,Error);Oe.prototype.name="ydn.db.VersionError";
Oe.prototype.toString=function(){return this.name+": "+this.message};function Pe(a){Error.captureStackTrace?Error.captureStackTrace(this,Pe):this.stack=Error().stack||"";a&&(this.message=String(a))}z(Pe,Error);Pe.prototype.name="ydn.db.InternalError";function we(a){Error.captureStackTrace?Error.captureStackTrace(this,we):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="InvalidStateError"}z(we,Error);
function Qe(a){Error.captureStackTrace?Error.captureStackTrace(this,Qe):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="InvalidAccessError"}z(Qe,Error);function Re(a){Error.captureStackTrace?Error.captureStackTrace(this,Re):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="NotFoundError"}z(Re,Error);Re.prototype.name="NotFoundError";Re.prototype.toString=function(){return this.name+": "+this.message};
function Se(a,b){Error.captureStackTrace?Error.captureStackTrace(this,Se):this.stack=Error().stack||"";b&&(this.message=String(b));this.message+=" :"+a.message+" ["+a.code+"]";this.name="SQLError"}z(Se,Error);Se.prototype.toString=function(){return this.name+": "+this.message};function Te(a,b){Error.captureStackTrace?Error.captureStackTrace(this,Te):this.stack=Error().stack||"";b&&(this.message=String(b));this.message+=" :"+a.message;this.name="SecurityError"}z(Te,Error);
Te.prototype.toString=function(){return this.name+": "+this.message};function Ue(a){Error.captureStackTrace?Error.captureStackTrace(this,Ue):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.db.SqlParseError"}z(Ue,Error);function Ve(a){Error.captureStackTrace?Error.captureStackTrace(this,Ve):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.db.TimeoutError"}z(Ve,Error);function We(a,b,c){var d;if(y(a))d=a.store,b=a.id,null!=a.parent&&(c=new We(a.parent));else if(t(b))d=a;else if(d=a.lastIndexOf("^|"),b=a,0<d&&(b=a.substr(d),c=new We(a.substring(0,d))),b=b.split("^:"),d=b[0],b=b[1],!t(b))throw Error("Invalid key value: "+a);this.s=d;this.id=b;this.parent=c||null}l=We.prototype;l.toJSON=function(){var a={store:this.s,id:this.id};this.parent&&(a.parent=this.parent.toJSON());return a};
l.valueOf=function(){return(this.parent?this.parent.valueOf()+"^|":"")+this.s+"^:"+this.id};l.toString=function(){return this.valueOf().replace("^|","|").replace("^:",":")};l.Gc=function(){return this.s};l.mc=function(){return this.id};function Xe(a){return v(a.id)?a.id.join("^|"):a.id instanceof Date?+a.id:a.id}l.Fc=function(){return this.parent};function je(a){if(w(a)){for(var b=[],c=0,d=a.length;c<d;c++)b[c]=a[c];return b}return a};function Ye(a,b){this.a=b}Ye.prototype.logger=D("ydn.db.crud.req.RequestExecuto");Ye.prototype.toString=function(){return"RequestExecutor"};function Ze(a){this.c=a;this.a=null;this.b=0}Ze.prototype.logger=D("ydn.db.tr.Mutex");Ze.prototype.R=null;function $e(a){return!!a.a&&!a.f}Ze.prototype.L=null;Ze.prototype.toString=function(){return"Mutex:"+("B"+this.c+"T"+this.b)+(this.a?"*":"")};function af(a,b,c,d,e,f){this.K=a;this.N=b;this.a=this.f=0;this.G=d;this.C=e;this.g=c||bf;this.j=f||0}af.prototype.logger=D("ydn.db.tr.Thread");af.prototype.type=function(){return this.K.Ba()};af.prototype.l=function(){return this.K};af.prototype.I=function(){return"B"+this.N+"T"+this.f};var bf="single";function ef(a){if(a)if(fa(a.abort))a.abort();else if(fa(a.executeSql))a.executeSql("ABORT",[],null,function(){return!0});else throw new qd;else throw new we("No active transaction");};function ff(a,b,c,d,e,f){af.call(this,a,b,c,d,e,f);this.c=[];this.h=[];this.i=null;this.b=new Ze(b);this.m=f||0;this.u=!1}z(ff,af);l=ff.prototype;l.logger=D("ydn.db.tr.Serial");
function gf(a,b,c){if("multi"==a.g)a:if(a=a.b,!a.R||!a.mode||c!=a.mode&&(a.mode!=M||c!=Zd)||b.length>a.R.length)b=!1;else{for(c=0;c<b.length;c++)if(-1==a.R.indexOf(b[c])){b=!1;break a}b=!0}else if("repeat"==a.g)a:if(a=a.b,a.R&&a.mode&&c==a.mode&&a.R.length==b.length){for(c=0;c<b.length;c++)if(-1==a.R.indexOf(b[c])){b=!1;break a}b=!0}else b=!1;else b="all"==a.g?!0:!1;return b}function hf(a){var b=0<a.c.length?a.c[0].R:null,c=0<a.c.length?a.c[0].mode:null;return null!=b&&null!=c?gf(a,b,c):!1}
function jf(a,b,c,d,e){F(a.logger,"push tx queue["+a.c.length+"]");a.c.push({ab:b,R:c,mode:d,L:e})}l.abort=function(){G(this.logger,this+": aborting");ef(this.i)};
l.pa=function(a,b,c,d){var e=x(b)?[b]:b;if(w(e)){if(0==e.length)throw new J("number of store names must more than 0");for(var f=0;f<e.length;f++){if(!x(e[f]))throw new J("store name at "+f+" must be string but found "+e[f]+" of type "+typeof e[f]);if(this.Y&&!(0<=Na(this.Y,e[f])))throw new J('store name "'+f+e[f]+'" in scope of '+this);}}else throw new J("store names must be an array");var g=t(c)?c:Zd,h=this;if(this.b.a||!kf(this.l())&&this.u)jf(this,a,b,g,d);else{var k=this.I();d&&this.h.push(d);
if(this.m&&this.f>=this.m)throw new sd("Exceed maximum number of transactions of "+this.m);this.u=!0;this.l().transaction(function(c){var d=h.b;d.a=c;d.f=!1;d.R=b;d.mode=g;d.b++;d.L=null;k=h.I();od(h.logger,k+" BEGIN "+T(b)+" "+g);a(h);for(a=null;hf(h);)c=h.c.shift(),c.L&&h.h.push(c.L),F(h.logger,"pop tx queue"+(h.c.length+1)+" reusing T"+h.f),c.ab()},e,g,function(a,b){od(h.logger,k+" "+a);var c=h.b;c.a?(c.a=null,c.R=null,c.mode=null,fa(c.L)&&c.L(a,b),c.L=null):E(c.logger,c+" has no TX to be unlocked for "+
a);for(c=0;c<h.h.length;c++)(0,h.h[c])(a,b);h.h.length=0;(c=h.c.shift())&&h.pa(c.ab,c.R,c.mode,c.L);h.a=0})}};l.I=function(){var a=this.b;return"B"+a.c+"T"+a.b};l.request=function(a,b,c,d){function e(a,b){ve(f);d&&d(a,b)}var f=new se(a);a=c||Zd;var g=this;$e(this.b)&&gf(this,b,a)?(b=this.b.a,this.a++,te(f,b,this.I()+"R"+this.a),this.h.push(e)):g.pa(function(){var a=g.b.a;g.a++;te(f,a,g.I()+"R"+g.a)},b,a,e);return f};
l.Da=function(a,b,c,d,e){d=d||Zd;var f=this,g;if($e(f.b)&&gf(this,c,d)){var h=f.b.a;f.a++;g=f.I()+"R"+f.a;G(f.logger,g+" BEGIN");b(h,g,function(b,c){f.i=h;c?(G(f.logger,g+" ERROR"),a.o(b)):(G(f.logger,g+" SUCCESS"),a.callback(b));f.i=null});G(f.logger,g+" END");b=null}else f.pa(function(){var c=f.b.a;f.a++;g=f.I()+"R"+f.a;G(f.logger,g+" BEGIN");b(c,g,function(b,d){f.i=c;d?(G(f.logger,g+" ERROR"),a.o(b)):(G(f.logger,g+" SUCCESS"),a.callback(b));f.i=null});G(f.logger,g+" END");b=null},c,d,e)};
l.getName=function(){return this.l().getName()};l.toString=function(){return"Serial:"+this.I()+(this.i?"*":"")};function lf(a,b){ff.call(this,a,b)}z(lf,ff);lf.prototype.logger=D("ydn.db.tr.AtomicSerial");lf.prototype.request=function(a,b,c){var d,e,f,g=lf.B.request.call(this,a,b,c,function(a,b){ve(g);if(d)"complete"!=a&&(f=!0,e=b),d(e,f);else{var c=new Ve;P(g,c,!0)}});xe(g,function(a,b,c){f=b;e=a;d=c});return g};
lf.prototype.Da=function(a,b,c,d,e){var f,g,h=new C;Lb(h,function(a){g=!1;f=a},function(a){g=!0;f=a});lf.B.Da.call(this,h,b,c,d,function(b,c){if("complete"!=b)a.o(c);else if(!0===g)a.o(f);else if(!1===g)a.callback(f);else{var d=new Ve;a.o(d)}e&&(e(b,c),e=void 0)})};lf.prototype.toString=function(){return"Atomic"+lf.B.toString.call(this)};function mf(a,b,c){this.f=a;this.b=b;this.a=c;this.c=null}l=mf.prototype;l.logger=D("ydn.db.tr.DbOperator");l.Oc=function(){return this.a.f};l.abort=function(){this.a.abort()};function U(a){a.c||(a.c=a.f.u());return a.c}l.l=function(){return this.f};
function nf(a,b){var c=x(b)?b:y(b)?b.name:void 0;if(!x(c))throw new J("store name "+c+" must be a string, but "+typeof c);var d=V(a.b,c);if(!d){if(!a.b.a())throw new J('store name "'+c+'" not found.');d=of(y(b)?b:{name:c});G(a.logger,"Adding object store: "+c);var e=d;var f=a.l(),g=e instanceof pf?e:of(e),e=e.name,h=V(f.a,e);if(0==qf(g,h).length)Tb(!1);else if(h=h?"update":"add",f.a instanceof rf)sf(f.a,g),f.b?(f.b.close(),f.b=null,tf(f)):Tb(!1);else throw new uf("Cannot "+h+" store: "+e+". Not auto schema generation mode.");
}else if(a.b.a()&&y(b)&&(f=of(b),f=qf(d,f)))throw new qd(f);if(!d)throw new Re(c);return d}l.toString=function(){return"TxStorage:"+this.l().getName()};function W(a,b,c){mf.call(this,a,b,c)}z(W,mf);l=W.prototype;l.logger=D("ydn.db.crud.DbOperator");
l.count=function(a,b,c,d){var e,f,g,h;if(null!=a)if(v(a)){if(t(c)||t(b))throw new J("too many arguments.");f=a;for(var k=0;k<f.length;k++)if(!vf(this.b,f[k]))throw new J('store name "'+f[k]+'" at '+k+" not found.");G(this.logger,"countStores: "+T(f));e=this.a.request("count",f);Q(e,function(){U(this).Ya(e,f)},this)}else if(x(a)){k=V(this.b,a);if(!k)throw new J('store name "'+a+'" not found.');if(t(d)&&!da(d))throw new J('unique value "'+d+'" must be boolean, but found '+typeof d+".");f=[a];if(x(b))if(g=
b,y(c)){var m=Fd(c);if(m)throw new J("invalid key range: "+wf(c)+" "+m);h=yd(c)}else{if(null!=c)throw new J("invalid key range: "+wf(c)+" of type "+typeof c);h=null}else if(y(b)||null==b)if(y(b)){if(m=Fd(b))throw new J("invalid key range: "+wf(b)+" "+m);h=yd(b)}else{if(null!=b)throw new J("key range must be  an object but found "+wf(b)+" of type "+typeof b);h=null}else throw new J('invalid second argument for count "'+wf(c)+'" of type '+typeof b);G(this.logger,"countKeyRange: "+a+" "+(g?g:"")+T(h));
e=this.a.request("count",f);xf(k,e,arguments);Q(e,function(){U(this).Fa(e,f[0],h,g,!!d)},this)}else throw new J("Invalid store name or store names.");else E(this.logger,"count method requires store name(s)"),k=yf(this.b),e=this.a.request("count",k),xe(e,function(a,b,c){if(b)c(a,!0);else{for(var d=b=0;d<a.length;d++)b+=a[d];c(b,!1)}},this),Q(e,function(){U(this).Ya(e,f)},this);return e};
l.get=function(a,b){var c=this,d;if(a instanceof We){var e=a,f=e.s,g=V(this.b,f);if(!g){if(this.b.a()){if(kf(this.l()))return ye("get",void 0);d=new se("get");this.l().ib(function(){Lb(c.get(a,b),function(a){d.callback(a)},function(a){d.o(a)})});return d}throw new J("Store: "+f+" not found.");}var h=e.id;G(this.logger,"getByKey: "+f+":"+h);d=this.a.request("get:key",[f]);xf(g,d,arguments,void 0,this);Q(d,function(){U(this).bb(d,f,h)},this)}else if(x(a)&&t(b)){var k=a,g=V(this.b,k);if(!g){if(this.b.a()){if(kf(this.l()))return ye("get",
void 0);d=new se("get");this.l().ib(function(){Lb(c.get(a,b),function(a){d.callback(a)},function(a){d.o(a)})});return d}throw new J('Store name "'+k+'" not found.');}var m=b;G(this.logger,"getById: "+k+":"+m);d=this.a.request("get",[k]);xf(g,d,arguments,void 0,this);Q(d,function(){U(this).bb(d,k,m)},this)}else throw new J("get require valid input arguments.");return d};
l.rc=function(a,b,c,d,e){var f=V(this.b,a),g,h,k,m=null;if(y(b)){var n=Fd(b);if(n)throw new J("invalid key range: "+b+" "+n);m=yd(b)}else if(null!=b)throw new J('expect key range object, but found "'+wf(b)+'" of type '+typeof b);if(t(c))if(ea(c))g=c;else throw new J("limit must be a number, but "+c+" is "+typeof c);else g=100;if(t(d))if(ea(d))h=d;else throw new J("offset must be a number, but "+d+" is "+typeof d);else h=0;if(t(e))if(da(e))k=e;else throw new J("reverse must be a boolean, but "+e+" is "+
typeof e);G(this.logger,"keysByKeyRange: "+a);var p=this.a.request("keys",[a]);xf(f,p,arguments);Q(p,function(){U(this).$(p,2,a,null,m,g,h,k,!1)},this);return p};
l.Ja=function(a,b,c,d,e,f,g){var h,k,m,n,p,q=Fd(c);if(q)throw new J("invalid key range: "+c+" "+q);q=V(this.b,a);h=yd(c);if(ea(d))k=d;else{if(t(d))throw new J("limit must be a number");k=100}if(ea(e))m=e;else{if(t(e))throw new J("offset must be a number");m=0}if(t(f))if(da(f))n=f;else throw new J("reverse must be a boolean");if(t(g))if(da(g))p=g;else throw new J("unique must be a boolean");G(this.logger,"keysByIndex: "+a);var u=this.a.request("keys:iter:index",[a]);xf(q,u,arguments);Q(u,function(){U(this).$(u,
2,a,b,h,k,m,n,p)},this);return u};l.keys=function(a,b,c,d,e,f,g){var h=V(this.b,a);if(!x(a))throw new J("store name must be a string, but "+a+" of type "+typeof a+" is not.");if(!this.b.a()){if(!h)throw new J('store name "'+a+'" not found.');if(x(b)&&!ge(h,b))throw new J('index "'+b+'" not found in store "'+a+'".');}return this.b.a()&&!h?ye("keys",[]):x(b)?this.Ja(a,b,c,d,e,f,g):this.rc(a,b,c,d,e)};
l.values=function(a,b,c,d,e,f,g){var h=this,k;if(x(a)){var m=a,n=V(this.b,m);if(!n){if(this.b.a()){if(kf(this.l()))return ye("values",[]);k=new se("values");this.l().ib(function(){Lb(h.values(a,b,c,d,e,f),function(a){k.callback(a)},function(a){k.o(a)})});return k}throw new Re(m);}if(v(b)){if(t(c)||t(d))throw new J("too many input arguments");var p=b;G(this.logger,"listByIds: "+m+" "+p.length+" ids");k=this.a.request("values:array",[m]);xf(n,k,arguments,void 0,this);Q(k,function(){U(this).Eb(k,m,p)},
this)}else k=x(b)?this.Ma(m,b,c,d,e,f,g):this.yc(m,b,c,d,e)}else if(v(a))if(a[0]instanceof We){for(var n=[],q=a,u=0;u<q.length;u++){var A=q[u].s;if(!vf(this.b,A)){if(this.b.a())return n=[],n[q.length-1]=void 0,ye("get",n);throw new J("Store: "+A+" not found.");}0<=Na(n,A)||n.push(A)}G(this.logger,"listByKeys: "+T(n)+" "+q.length+" keys");k=this.a.request("values:keys",n);Q(k,function(){U(this).Fb(k,q)},this)}else throw new J("first argumentmust be array of ydn.db.Key, but "+a[0]+" of "+typeof a[0]+
" found.");else throw new J("first argument "+a+" is invalid.");return k};
l.yc=function(a,b,c,d,e){var f=V(this.b,a),g,h,k,m=null;if(y(b)){var n=Fd(b);if(n)throw new J("invalid key range: "+b+" "+n);m=yd(b)}else if(null!=b)throw new J('expect key range object, but found "'+wf(b)+'" of type '+typeof b);if(t(c))if(ea(c))g=c;else throw new J("limit must be a number, but "+c+" is "+typeof c);else g=100;if(t(d))if(ea(d))h=d;else throw new J("offset must be a number, but "+d+" is "+typeof d);else h=0;if(t(e))if(da(e))k=e;else throw new J("reverse must be a boolean, but "+e+" is "+
typeof e);G(this.logger,(m?"listByKeyRange: ":"listByStore: ")+a);var p=this.a.request("values",[a]);xf(f,p,arguments);Q(p,function(){U(this).$(p,4,a,null,m,g,h,k,!1)},this);return p};
l.Ma=function(a,b,c,d,e,f,g){var h=V(this.b,a),k,m,n,p;if(!zf(h,b))throw new J('index "'+b+'" not found in store "'+a+'"');var q=Fd(c);if(q)throw new J("invalid key range: "+c+" "+q);var u=yd(c);if(t(d))if(ea(d))k=d;else throw new J("limit must be a number.");else k=100;if(t(e))if(ea(e))m=e;else throw new J("offset must be a number.");else m=0;if(da(f))n=f;else if(t(f))throw new J("reverse must be a boolean, but "+f);if(t(g))if(da(g))p=g;else throw new J("unique must be a boolean");G(this.logger,
"listByIndexKeyRange: "+a+":"+b);var A=this.a.request("values:iter:index",[a]);xf(h,A,arguments);Q(A,function(){U(this).$(A,4,a,b,u,k,m,n,p)},this);return A};
l.add=function(a,b,c){if(v(b))return this.Ta(a,b,c);var d=nf(this,a),e=d.getName(),f;if(x(d.keyPath)&&t(c))throw new J("key must not be provided while the store uses in-line key.");if(!d.keyPath&&!d.b&&!t(c))throw new J("out-of-line key must be provided for store: "+e);if(v(b)){G(this.logger,"addObjects: "+e+" "+b.length+" objects");for(a=0;a<b.length;a++)Af(d,b[a]);f=this.a.request("add:array",[e],M);Q(f,function(){U(this).P(f,!1,!1,e,b,c)},this);d.aa&&f.H(function(a){a=new Bf(Cf,this.l(),e,a,b);
this.l().J(a)},this)}else if(y(b))a="store: "+e+" key: "+Df(d,b,c),G(this.logger,"addObject: "+a),Af(d,b),f=this.a.request("add",[e],M),Q(f,function(){U(this).P(f,!1,!0,e,[b],[c])},this),d.aa&&f.H(function(a){a=new Ef(Cf,this.l(),d.getName(),a,b);this.l().J(a)},this);else throw new J("record must be an object or array list of objects, but "+b+" of type "+typeof b+" found.");return f};
l.Ta=function(a,b,c){var d=nf(this,a),e=d.getName(),f;if(x(d.keyPath)&&t(c))throw new J("key must not be provided while the store uses in-line key.");if(!d.keyPath&&!d.b&&!t(c))throw new J("out-of-line key must be provided for store: "+e);if(v(b)){G(this.logger,"addObjects: "+e+" "+b.length+" objects");for(a=0;a<b.length;a++)Af(d,b[a]);f=this.a.request("add:array",[e],M);Q(f,function(){U(this).P(f,!1,!1,e,b,c)},this);d.aa&&f.H(function(a){a=new Bf(Cf,this.l(),d.getName(),a,b);this.l().J(a)},this)}else throw new J("record must be an array list of objects, but "+
b+" of type "+typeof b+" found.");return f};
l.put=function(a,b,c){var d,e=this;if(a instanceof We){var f=a,g=f.s,h=V(this.b,g);if(!h)throw new J('store "'+g+'" not found.');if(h.keyPath){var k=Df(h,b);if(null!=k){if(0!=L(k,f.id))throw new J("Inline key must be "+f+" but "+k+" found.");}else Ff(h,b,f.id);return this.put(g,b)}return this.put(g,b,f.id)}if(v(a)){if(t(c))throw new J("too many arguments");var m=a;if(!t(b))throw new J("record values required");for(var n=b,f=[],g=0,h=m.length;g<h;g++){k=m[g].s;-1==Na(f,k)&&f.push(k);var p=V(this.b,
k);if(!p)throw new J('store "'+k+'" not found.');p.keyPath&&Ff(p,n[g],m[g].id)}G(this.logger,"putByKeys: to "+T(f)+" "+n.length+" objects");for(g=0;g<n.length;g++)Af(p,n[g]);d=this.a.request("put:keys",f,M);xf(p,d,arguments);Q(d,function(){U(e).Gb(d,n,m)},this)}else if(x(a)||y(a)){var p=nf(this,a),q=p.getName();if(p.keyPath&&t(c))throw new J("key must not be provided while the store uses in-line key.");if(!p.keyPath&&!p.b&&!t(c))throw new J("out-of-line key must be provided for store: "+q);if(v(b)){var u=
b,A=c;G(this.logger,"putObjects: "+q+" "+u.length+" objects");for(g=0;g<u.length;g++)Af(p,u[g]);d=this.a.request("put:array",[q],M);xf(p,d,arguments);Q(d,function(){U(this).P(d,!0,!1,q,u,A)},this);p.aa&&d.H(function(a){a=new Bf(Gf,this.l(),q,a,u);this.l().J(a)},this)}else if(y(b)){var B=b,H=c;G(this.logger,"putObject: "+q+" "+(t(H)?H:"(without-key)"));if(t(r.Blob)&&B instanceof Blob&&p.sa&&!p.keyPath&&0==p.a.length&&Ic)d=new se("put"),f=new FileReader,f.onload=function(a){var b=a.target.result,c=
e.a.request("put",[q],M);xf(p,c,[q,B,H]);Q(c,function(){U(e).P(c,!0,!0,q,[b],[H])},this);Lb(c,function(a){d.callback(a)},function(a){d.o(a)})},f.onerror=function(a){d.o(a)},f.onabort=function(a){d.o(a)},f.readAsDataURL(B);else{Af(p,B);d=this.a.request("put",[q],M);var I=[q,B,H];xf(p,d,I);Q(d,function(){var a=t(H)?[I[2]]:void 0;U(e).P(d,!0,!0,q,[I[1]],a)},this)}p.aa&&d.H(function(a){a=new Ef(Gf,this.l(),q,a,B);this.l().J(a)},this)}else throw new J("put record value must be Object or array of Objects");
}else throw new J("the first argument of put must be store name, store schema or array of keys.");return d};
l.kb=function(a,b,c){var d,e=nf(this,a),f=e.getName();if(e.keyPath&&t(c))throw new J("key must not be provided while the store uses in-line key.");if(!e.keyPath&&!e.b&&!t(c))throw new J("out-of-line key must be provided for store: "+f);var g=b,h=c;G(this.logger,"putObjects: "+f+" "+g.length+" objects");for(var k=0;k<g.length;k++)Af(e,g[k]);d=this.a.request("put:array",[f],M);xf(e,d,arguments);Q(d,function(){U(this).P(d,!0,!1,f,g,h)},this);e.aa&&d.H(function(a){a=new Bf(Gf,this.l(),f,a,g);this.l().J(a)},
this);return d};
l.clear=function(a,b,c){if(t(c))throw new J("too many input arguments");var d;if(x(a)){c=V(this.b,a);if(!c)throw new J('store name "'+a+'" not found.');if(y(b)){var e=yd(b);if(null===e)throw new J("clear method requires a valid non-null KeyRange object.");G(this.logger,"clearByKeyRange: "+a+":"+T(e));d=this.a.request("clear",[a],M);xf(c,d,[a,e]);Q(d,function(){U(this).vb(d,a,e)},this)}else{if(t(b))throw new J("clear method requires a valid KeyRange object as second argument, but found "+b+" of type "+
typeof b);G(this.logger,"clearByStore: "+a);d=this.a.request("clear",[a],M);Q(d,function(){U(this).Wa(d,[a])},this)}}else if(!t(a)||v(a)&&x(a[0])){var f=a||yf(this.b);G(this.logger,"clearByStores: "+T(f));d=this.a.request("clear",f,M);Q(d,function(){U(this).Wa(d,f)},this)}else throw new J('first argument "'+a+'" is invalid.');return d};
l.sb=function(a,b,c){var d;if(x(a)){var e=V(this.b,a);if(!e)throw new J('store name "'+a+'" not found.');if(t(c))if(x(b)){var f=ge(e,b);if(!f)throw new J("index: "+b+" not found in "+a);if(y(c)||null===c){var g=yd(c);G(this.logger,"removeByIndexKeyRange: "+a+":"+f.getName()+" "+a);d=this.a.request("rm:iter:index",[a],M);Q(d,function(){U(this).Hb(d,a,f.getName(),g)},this)}else throw new J("key range "+c+' is invalid type "'+typeof c+'".');}else throw new J('index name "'+b+'" must be a string, but '+
typeof b+" found.");else if(x(b)||ea(b)||w(b)||b instanceof Date){G(this.logger,"removeById: "+a+":"+b);d=this.a.request("rm",[a],M);var h=[a,b];xf(e,d,h);Q(d,function(){U(this).lb(d,a,h[1])},this);e.aa&&d.H(function(c){c=1==c?b:void 0;c=new Ef(Hf,this.l(),a,c,void 0);this.l().J(c)},this)}else if(y(b))g=yd(b),G(this.logger,"removeByKeyRange: "+a+":"+T(g)),d=this.a.request("rm:iter",[a],M),xf(e,d,[a,g]),Q(d,function(){U(this).mb(d,a,g)},this),e.aa&&d.H(function(b){var c=[];c.length=b;b=new Bf(Hf,this.l(),
a,c,void 0);this.l().J(b)},this);else throw new J('Invalid key or key range "'+b+'" of type '+typeof b);}else if(a instanceof We){var k=a.s,e=V(this.b,k);d=this.a.request("rm",[k],M);var m=[k,a.id];xf(e,d,m);Q(d,function(){U(this).lb(d,k,m[1])},this)}else if(v(a)){c=[];for(var e=0,n=a.length;e<n;e++){if(!(a[e]instanceof We))throw new J("key list element at "+e+" of "+n+' must be yn.db.Key, but "'+wf(a[e])+'" ('+ca(a[e])+") is not ydn.db.Key.");var p=a[e].s;-1==Na(c,p)&&c.push(p)}if(1>c.length)throw new J('at least one valid key required in key list "'+
wf(a)+'"');d=this.a.request("rm:keys",c,M);Q(d,function(){U(this).Ib(d,a)},this)}else throw new J('first argument requires store name, key (ydn.db.Key) or list of keys (array) , but "'+wf(a)+'" ('+ca(a)+") found.");return d};l.toString=function(){return"DbOperator:"+this.l().getName()};function If(a,b,c){mf.call(this,a,b,c)}z(If,W);l=If.prototype;l.logger=D("ydn.db.core.DbOperator");l.get=function(a,b){if(a instanceof N){var c=a.b,d=V(this.b,c);if(!d)throw new J('store "'+c+'" not found.');var e=a.c;if(t(e)&&!zf(d,e))throw new J('index "'+e+'" not found in store "'+c+'".');G(this.logger,"getByIterator:"+a);var f=this.a.request("get:iter",[c]);Q(f,function(){Jf(this,5,f,a,1)},this);return f}return If.B.get.call(this,a,b)};
l.Ka=function(a,b){var c=100;if(ea(b)){if(c=b,1>c)throw new J("limit must be a positive value, but "+b);}else if(t(b))throw new J("limit must be a number,  but "+b);G(this.logger,"keysOf:"+a);var d=this.a.request("keys:iter",[a.b]);Q(d,function(){a.u?Jf(this,1,d,a,c):Jf(this,2,d,a,c)},this);return d};l.keys=function(a,b,c,d,e,f,g){return a instanceof N?this.Ka(a,b):If.B.keys.call(this,a,b,c,d,e,f,g)};
l.Ga=function(a){G(this.logger,"countIterator:"+a);var b=this.a.request("count",[a.b]);Q(b,function(){Jf(this,6,b,a)},this);return b};l.count=function(a,b,c,d){if(a instanceof N){if(t(b)||t(c))throw new J("too many arguments.");return this.Ga(a)}return If.B.count.call(this,a,b,c,d)};
l.Na=function(a,b){var c;if(ea(b)){if(c=b,1>c)throw new J("limit must be a positive value, but "+c);}else if(t(b))throw new J("limit must be a number, but "+b);G(this.logger,"listByIterator:"+a);var d=this.a.request("values:iter",[a.b]);Q(d,function(){a.f?Jf(this,2,d,a,c):Jf(this,4,d,a,c)},this);return d};l.values=function(a,b,c,d,e,f){return a instanceof N?this.Na(a,b):If.B.values.call(this,a,b,c,d,e,f)};
l.Nb=function(a,b,c){if(!v(b))throw new J("iterators argument must be an array, but "+b+" of type "+typeof b+" found");for(var d=0;d<b.length;d++)if(!(b[d]instanceof N))throw new J("Iterator at "+d+" must be cursor range iterator.");c=c||Zd;for(var e=[],d=0;d<b.length;d++)for(var f=b[d].stores(),g=0;g<f.length;g++)0<=Na(e,f[g])||e.push(f[g]);G(this.logger,this+": scan for "+b.length+" iterators on "+e);var h=this,d=this.a.request("scan",e);this.a.Da(d,function(c,d,e){function f(){for(var a=0,e=0;e<
b.length;e++){var n=b[e],p=[U(h).b(c,d,n.b)],n=n.load(p);n.Y=g;n.G=ma(u,a);sa[e]=n;I[a]=e;a++}H=b.length}function g(a){for(var b=0;b<sa.length;b++)ke(sa[b]);Ta(sa);G(h.logger,A+" error");e(a,!0)}function u(c,d){if(B)throw new Fe;aa++;var f=aa===H,g=I[c],k=b[g],m=sa[g],g=m.T(),m=m.Ca();O[c]=d;ha[c]=k.u?k.f?g:m:k.f?d:m;if(f){var p;a instanceof Le?p=a.c(O,ha):p=a(O,ha);f=[];k=[];g=[];m=[];if(v(p))for(var q=0;q<p.length;q++)!0===p[q]?g[q]=1:!1===p[q]?m[q]=!0:k[q]=p[q];else if(null===p)f=[];else if(t(p))if(y(p)){f=
["advance","continue","continuePrimary","restart"];for(q in p)if(!(0<=Na(f,q)))throw new sd('Unknown attribute "'+q+'" in cursor advancement object');f=p.continuePrimary||[];k=p["continue"]||[];g=p.advance||[];m=p.restart||[]}else throw new sd("scan callback output");else for(f=[],q=0;q<b.length;q++)t(I[q])&&(g[q]=1);for(q=aa=p=0;q<b.length;q++)null!=f[q]||t(k[q])||null!=m[q]||null!=g[q]||aa++;for(q=0;q<b.length;q++)if(null!=f[q]||t(k[q])||null!=m[q]||null!=g[q]){var u=I[q];if(!t(u))throw new Kf(q+
" is not an iterator.");var u=b[u],Qb=sa[q];if(null==O[q]){var df=q+"/"+b.length;if(null!=g[q])throw new Je(Qb+" "+df+" must not advance "+g[q]+" steps");if(t(k[q]))throw new Je(Qb+" "+df+" must not continue to key "+k[q]);if(null!=f[q])throw new Je(Qb+" "+df+" must not continue to primary key "+f[q]);}O[q]=void 0;ha[q]=void 0;if(null!=m[q])le(Qb);else if(t(k[q]))Qb.ra(k[q]);else if(null!=f[q])Qb.Sa(f[q]);else if(null!=g[q])Qb.advance(1);else throw new Fe(u+": has no action");p++}if(0==p){for(p=0;p<
sa.length;p++)ke(sa[p]);B=!0;Ta(sa);G(h.logger,"success "+A);e(void 0)}}}var A=d+" "+h+" scanning";F(h.logger,A);var B=!1,H,I=[],O=[],ha=[],sa=[],aa=0;a instanceof Le?a.h(c,b,function(){f()})||f():f()},e,c);return d};
l.open=function(a,b,c,d){if(!(b instanceof N))throw new J("Second argument must be cursor range iterator.");for(var e=b.stores(),f=0;f<e.length;f++)if(!V(this.b,e[f]))throw new J('Store "'+e[f]+'" not found.');c=c||Zd;var g=this,h=this.a.request("open",b.stores(),c);G(this.logger,"open:"+c+" "+b);Q(h,function(c){var e=R(h);G(g.logger,e+" iterating "+b);for(var f=b.stores(),p=[],q=0;q<f.length;q++)p[q]=U(g).b(c,e,f[q]);var u=b.load(p);u.Y=function(a){P(h,a,!0)};u.G=function(b){null!=b?(b=a.call(d,
u),!0===b?le(u):y(b)?!0===b.restart?le(u,b["continue"],b.continuePrimary):null!=b["continue"]?u.ra(b["continue"]):null!=b.continuePrimary?u.Sa(b.continuePrimary):(ke(u),P(h,void 0)):null===b?(ke(u),P(h,void 0)):null!=b?u.ra(b):u.advance(1)):(ke(u),P(h,void 0))}},this);return h};
function Lf(a,b,c,d){var e=c.b,f=c.c||null,g=d||100;G(a.logger,"listIter:"+b+" "+c+(d?" limit="+g:"")+"");var h=a.a.request("values:iter:index",[e]),k="done"==c.g||c.g==ne?[]:[c.i,c.j];Q(h,function(){U(this).$(h,b,e,f,c.gc(),g,0,c.da(),c.za(),k)},a);h.H(function(){null!=k[0]?c.Jb("rest",k[0],k[1]):c.Jb()});return h}
function Jf(a,b,c,d,e){var f=[],g=c.a,h=R(c),k=h+" "+b+"ByIterator "+d;0<e&&(k+=" limit "+e);G(a.logger,k);for(var m=U(a),n=[],p=d.stores(),q=0;q<p.length;q++)n[q]=m.b(g,h,p[q]);var u=d.load(n);u.Y=function(a){ke(u);P(c,a,!0)};var A=0,B=!1;u.G=function(d){B||(F(a.logger,k+" starting"),B=!0);null!=d?(u.T(),A++,1==b?f.push(d):2==b?f.push(u.T()):3==b?f.push([d,u.T()]):6!=b&&f.push(u.Ca()),5==b?(ke(u),P(c,f[0])):6==b||!t(e)||A<e?u.ra():(G(a.logger,"success:"+k+" yields "+f.length+" records"),ke(u),P(c,
f))):(G(a.logger,"success:"+k+" yields "+f.length+" records"),ke(u),P(c,5==b?f[0]:6==b?A:f))}};function Mf(a,b){this.type=a;this.b=this.target=b;this.ec=!0}Mf.prototype.preventDefault=function(){this.ec=!1};var Cf="created",Hf="deleted",Gf="updated";function Nf(a,b){Mf.call(this,a,b)}z(Nf,Mf);Nf.prototype.a=function(){return this.s};function Of(a,b,c,d,e){Mf.call(this,a,b);this.version=c;this.ic=d;this.bc=e}z(Of,Nf);l=Of.prototype;l.name="ReadyEvent";l.version=NaN;l.ic=NaN;l.bc=null;l.Nc=function(){return this.version};l.oc=function(){return this.ic};l.nc=function(){return this.bc};function Pf(a,b,c){Mf.call(this,c||"error",a);this.error=b}z(Pf,Nf);
Pf.prototype.toString=function(){return this.name+":"+(this.error?this.error:"")};Pf.prototype.name="ErrorEvent";Pf.prototype.error=null;Pf.prototype.c=function(){return this.error};function Qf(a,b){Pf.call(this,a,b,"fail")}z(Qf,Pf);Qf.prototype.name="FailEvent";function Ef(a,b,c,d,e){Mf.call(this,a,b);this.s=c;this.key=d;this.value=e}z(Ef,Nf);Ef.prototype.name="RecordEvent";Ef.prototype.c=function(){return this.key};Ef.prototype.f=function(){return this.value};
function Bf(a,b,c,d,e){Mf.call(this,a,b);this.s=c;this.keys=d;this.values=e}z(Bf,Nf);Bf.prototype.name="StoreEvent";Bf.prototype.na=function(){return this.keys};Bf.prototype.cb=function(){return this.values};var Rf;Rf=!1;var Sf=Za;Sf&&(-1!=Sf.indexOf("Firefox")||-1!=Sf.indexOf("Camino")||-1!=Sf.indexOf("iPad")||-1!=Sf.indexOf("iPhone")||-1!=Sf.indexOf("iPod")||-1!=Sf.indexOf("Chrome")||-1!=Sf.indexOf("Android")||-1!=Sf.indexOf("Safari")&&(Rf=!0));var Tf=Rf;function Uf(a,b,c,d,e,f){t(e)||(e=v(a)?a.join(", "):a);if(null!=a&&!x(a)&&!w(a))throw new J("index keyPath for "+e+" must be a string or array, but "+a+" is "+typeof a);v(a)&&Object.freeze&&Object.freeze(a);!t(a)&&t(e)&&(a=e);this.keyPath=a;this.h=w(this.keyPath);this.b=e;this.type=Vf(b);if(t(b)){if(!t(this.type))throw new J("type invalid in index: "+this.b);if(v(this.keyPath))throw new J('composite key for store "'+this.b+'" must not specified type');}this.unique=!!c;this.multiEntry=!!d;this.i=x(this.type)?
this.type:Wf;this.f=x(e)?e:v(a)?this.keyPath.join(","):a;this.c=Ia(this.f);this.a=this.h?null:this.keyPath.split(".");this.g=f||null}function Xf(a,b){if(null!=b){if(w(a.keyPath)){for(var c=[],d=0,e=a.keyPath.length;d<e;d++){var f=Kd(b,a.keyPath[d]);c[d]=f}return c}return Kd(b,a.keyPath)}}function Yf(a,b,c){for(var d=0;d<a.a.length;d++)d==a.a.length-1?b[a.a[d]]=c:y(b[a.a[d]])||(b[a.a[d]]={})}var Wf="TEXT";function Id(a,b){if("DATE"==b){if(a instanceof Date)return+a}else return null!=b?a:Nd(a)}
function Zf(a,b){return"DATE"==b?new Date(a):t(b)?a:Qd(a)}var $f=["BLOB","DATE","INTEGER","NUMERIC",Wf];function Vf(a){if(x(a))return a=Na($f,a),$f[a]}l=Uf.prototype;l.getName=function(){return this.b};l.toJSON=function(){return{name:this.b,keyPath:this.keyPath,type:this.type,unique:this.unique,multiEntry:this.multiEntry}};l.clone=function(){var a=v(this.keyPath)?Va(this.keyPath):this.keyPath;return new Uf(a,this.type,this.unique,this.multiEntry,this.b,this.g)};
function ag(a,b){return null!=a||null!=b?null!=a?null!=b?w(a)&&w(b)?Xa(a,b)?null:"expect: "+a+", but: "+b:bg(a,b)?null:"expect: "+a+", but: "+b:"keyPath: "+a+" no longer defined":"newly define "+b:null}l.hint=function(a){if(!a)return this;var b=v(this.keyPath)?Va(this.keyPath):this.keyPath,c=this.type;t(a.type)||"TEXT"!=c||(c=void 0);return new Uf(b,c,this.unique,this.multiEntry,a.b)};
l.toString=function(){var a=this.multiEntry?"MultiEntry":"";this.a&&1<this.a.length&&(a+="Compound");return a+"Index:"+this.b};function pf(a,b,c,d,e,f,g,h){if(!x(a))throw new J("store name must be a string");this.c=a;this.keyPath=t(b)?b:null;this.i=w(this.keyPath);if(null!==this.keyPath&&!x(this.keyPath)&&!this.i)throw new J("keyPath must be a string or array");if(null!=c&&!da(c))throw new J('invalid autoIncrement value in store "'+a+'"');this.b=!!c;var k;if(null!=d){k=Vf(d);if(!t(k))throw new J('type "'+d+'" for primary key in store "'+this.c+'" is invalid.');if(this.i)throw new J('composite key for store "'+this.c+'" must not specified type');
}this.type=null!=k?k:this.b?"INTEGER":void 0;this.h=x(this.keyPath)?this.keyPath.split("."):[];this.a=e||[];a=[];for(b=0;b<this.a.length;b++){c=this.a[b].getName();if(0<=a.indexOf(c))throw new J('index "'+c+'" already defined in store: '+this.c);a.push(c)}this.aa=!!f;this.sa=!!g;this.u=x(this.type)?this.type:Wf;this.g=v(this.keyPath)?this.keyPath.join(","):x(this.keyPath)?this.keyPath:"_ROWID_";this.f=Ia(this.g);if(this.m=!!h){if(this.keyPath)throw new J('encrypted store "'+this.c+'" must not use inline key');
if(this.b)throw new J('encrypted store "'+this.c+'" must not use key generator');}this.j=[]}l=pf.prototype;l.aa=!1;l.sa=!1;l.toJSON=function(){for(var a=[],b=0;b<this.a.length;b++)a.push(this.a[b].toJSON());return{name:this.c,keyPath:this.keyPath,autoIncrement:this.b,type:this.type,indexes:a}};
function of(a){var b="name keyPath autoIncrement type indexes dispatchEvents fixed Sync encrypted".split(" "),c;for(c in a)if(a.hasOwnProperty(c)&&-1==Na(b,c))throw new J('Unknown attribute "'+c+'"');b=[];c=a.indexes||[];if(v(c))for(var d=0;d<c.length;d++){var e;e=c[d];var f="name unique type keyPath multiEntry generator".split(" "),g=void 0;for(g in e)if(e.hasOwnProperty(g)&&-1==Na(f,g))throw new J("Unknown field: "+g+" in "+T(e));e=new Uf(e.keyPath,e.type,e.unique,e.multiEntry,e.name,e.generator);
t(e.keyPath)&&e.keyPath===a.keyPath||b.push(e)}return new pf(a.name,a.keyPath,a.autoIncrement,"undefined"===a.type||"null"===a.type?void 0:a.type,b,a.dispatchEvents,a.fixed,a.encrypted)}function cg(a,b,c,d,e,f,g){a=dg(a,b,c,d,e,f,g);b="";0!=c&&(b+="SELECT "+a.select);b+=" FROM "+a.V;a.v&&(b+=" WHERE "+a.v);a.group&&(b+=" GROUP BY "+a.group);a.X&&(b+=" ORDER BY "+a.X);return b}
function dg(a,b,c,d,e,f,g){var h={select:"",V:"",v:"",group:"",X:""},k=a.g,m=a.f,n=null;d!==k&&x(d)&&(n=ge(a,d));var p=!!n,q=d||k,u=Ia(q),A=p?n.type:a.type,B=p&&n.multiEntry;h.V=eg(a);6===c?h.select="COUNT("+m+")":3===c||1===c||2===c?(h.select=m,null!=d&&d!=k&&(h.select+=", "+u)):h.select="*";d=g?"DISTINCT ":"";k=[];B?(B=Ia("ydn.db.me:"+a.getName()+":"+n.getName()),h.select=6===c?"COUNT("+d+B+"."+u+")":3===c||1===c||2===c?"DISTINCT "+eg(a)+"."+m+", "+B+"."+u+" AS "+q:"DISTINCT "+eg(a)+".*, "+B+"."+
u+" AS "+q,h.V=B+" INNER JOIN "+eg(a)+" USING ("+m+")",null!=e&&(Hd(B+"."+u,A,e,k,b),0<k.length&&(h.v=h.v?h.v+(" AND "+k.join(" AND ")):k.join(" AND ")))):null!=e&&(Hd(u,A,e,k,b),0<k.length&&(h.v=h.v?h.v+(" AND "+k.join(" AND ")):k.join(" AND ")));p&&!n.unique&&g&&(h.group=u);a=f?"DESC":"ASC";h.X=u+" "+a;p&&(h.X+=", "+m+" "+a);return h}
function fg(a,b,c,d,e,f,g,h,k){var m,n,p,q;null!=e?(m=e.lower,n=e.upper,p=e.lowerOpen,q=e.upperOpen,f?null!=n?(e=L(h,n),-1==e?(n=h,q=k):0==e&&(q=k||q)):(n=h,q=k):null!=m?(e=L(h,m),1==e?(m=h,p=k):0==e&&(p=k||p)):(m=h,p=k)):f?(n=h,q=k):(m=h,p=k);e=new K(m,n,!!p,!!q);d=d?ge(a,d):null;b=dg(a,c,b,d?d.f:a.g,e,f,g);b="SELECT "+b.select+" FROM "+b.V+(b.v?" WHERE "+b.v:"")+(b.group?" GROUP BY "+b.group:"")+" ORDER BY "+b.X;d&&(b+=", "+a.f+(f?"DESC":"ASC"));return b}
function gg(a,b,c,d,e,f,g,h,k,m){var n=ge(a,d),p=n.f;d=n.c;var q=a.f,u=k?" <":" >",u=g?u+" ":u+"= ";g=Id(f,n.type);h=Id(h,a.type);n="";e?(a=dg(a,c,b,p,e,k,m),a.v+=" AND ",n=d+u+"?",c.push(g)):(e=k?Bd(f,!0):Cd(f,!0),a=dg(a,c,b,p,e,k,m),n=a.v,a.v="");a.v+="("+n+" OR ("+d+" = ? AND "+q+u+"?))";c.push(g);c.push(h);return"SELECT "+a.select+" FROM "+a.V+" WHERE "+a.v+(a.group?" GROUP BY "+a.group:"")+" ORDER BY "+a.X}l.clone=function(){return of(this.toJSON())};l.index=function(a){return this.a[a]||null};
function ge(a,b){return Ra(a.a,function(a){return a.getName()==b})}function fe(a,b){for(var c=0;c<a.a.length;c++)if(!ag(a.a[c].keyPath,b))return a.a[c];return null}function zf(a,b){return b===a.keyPath?!0:Qa(a.a,function(a){return a.getName()==b})}function eg(a){return Ia(a.c)}
function hg(a,b){if(!b)return a;var c=a.b,d=v(a.keyPath)?Va(a.keyPath):a.keyPath,e=a.type,f=Pa(a.a,function(a){return a.clone()});t(b.type)||"TEXT"!=e||(e=void 0);v(b.keyPath)&&x(d)&&d==b.keyPath.join(",")&&(d=Va(b.keyPath));for(var g=0,h=b.a.length;g<h;g++)if(b.a[g].h)for(var k=b.a[g].getName(),m=f.length-1;0<=m;m--)if(0<=k.indexOf(f[m].getName())){f[m]=b.a[g].clone();break}for(g=0;g<f.length;g++)(h=ge(b,f[g].getName()))&&(f[g]=f[g].hint(h));return new pf(b.c,d,c,e,f)}l.getName=function(){return this.c};
function ig(a){return!!a.keyPath}function Df(a,b,c){if(b){if(!a.keyPath&&null!=c)return c;if(a.i){c=[];for(var d=0;d<a.keyPath.length;d++)c.push(Kd(b,a.keyPath[d]));return c}if(a.keyPath)return db(b,a.h)}}function Ff(a,b,c){for(var d=0;d<a.h.length;d++){var e=a.h[d];if(d==a.h.length-1){b[e]=c;break}t(b[e])||(b[e]={});b=b[e]}}
function jg(a,b,c){var d=[],e=[];c=t(c)?c:Df(a,b);t(c)&&(e.push(a.f),d.push(Id(c,a.type)));for(var f=0;f<a.a.length;f++){var g=a.a[f];if(!g.multiEntry&&g.getName()!==a.keyPath&&"_default_"!=g.getName()){var h=Xf(g,b);null!=h&&(d.push(Id(h,g.type)),e.push(g.c))}}a.sa?a.sa&&!a.keyPath&&0==a.a.length&&(x(b)&&-1==b.indexOf(";base64,")?d.push(b):d.push(T(b)),e.push("_default_")):(d.push(T(b)),e.push("_default_"));a=[];for(f=d.length-1;0<=f;f--)a[f]="?";return{Vb:e,fc:a,values:d,key:c}}
function qf(a,b){if(!b)return"missing store: "+a.c;if(a.c!=b.c)return"store name, expect: "+a.c+", but: "+b.c;var c=ag(a.keyPath,b.keyPath);if(c)return"keyPath, "+c;if(t(a.b)&&t(b.b)&&a.b!=b.b)return"autoIncrement, expect:  "+a.b+", but: "+b.b;if(a.a.length!=b.a.length)return"indexes length, expect:  "+a.a.length+", but: "+b.a.length;if(t(a.type)&&t(b.type)&&(w(a.type)?!Xa(a.type,b.type):a.type!=b.type))return"data type, expect:  "+a.type+", but: "+b.type;for(c=0;c<a.a.length;c++){var d=ge(b,a.a[c].getName()),
e;e=a.a[c];if(d)if(e.b!=d.b)e="name, expect: "+e.b+", but: "+d.b;else{var f=ag(e.keyPath,d.keyPath);e=f?"keyPath, "+f:null!=e.unique&&null!=d.unique&&e.unique!=d.unique?"unique, expect: "+e.unique+", but: "+d.unique:null!=e.multiEntry&&null!=d.multiEntry&&e.multiEntry!=d.multiEntry?"multiEntry, expect: "+e.multiEntry+", but: "+d.multiEntry:t(e.type)&&t(d.type)&&(w(e.type)?!Xa(e.type,d.type):e.type!=d.type)?"data type, expect: "+e.type+", but: "+d.type:""}else e="no index for "+e.b;if(0<e.length)return'index "'+
a.a[c].getName()+'" '+e}return""}function Af(a,b){if(b)for(var c=0;c<a.a.length;c++){var d=a.a[c],e=b;if(d.g){var f=d.g(e),g=typeof f;if("string"==g||"number"==g||f instanceof Date||v(f)){for(g=0;g<d.a.length-1;g++)y(e[d.a[g]])||(e[d.a[g]]={});e[d.a[d.a.length-1]]=f}}}}function xf(a,b,c,d,e){for(var f=0;f<a.j.length;f++)d!==f&&a.j[f].call(e,b,c)}l.toString=function(){return"Store:"+this.c+"["+this.a.length+"index]"};function kg(a){return!x(a)||va(a)?{}:JSON.parse(a)}function wf(a){var b;try{b=T(a)}catch(c){b=""}return b?b.substr(0,70)+(70<b.length?"...":""):""}function T(a){return JSON.stringify(a,void 0,void 0)};function lg(a,b){if(!a||va(a))throw new J("store_name must be provided for primary full text index");if(!b||va(b))throw new J("index_name must be provided for primary full text index");this.s=a};function mg(a,b,c){this.name=a;this.a=b;this.b=c||"";if(-1==["","en","fr"].indexOf(this.b))throw new J('Unsupported lang "'+c+" for full text search index "+a);}mg.prototype.getName=function(){return this.name};mg.prototype.count=function(){return this.a.length};mg.prototype.index=function(a){return this.a[a]};
function ng(a){var b=["name","sources","lang"],c;for(c in a)if(a.hasOwnProperty(c)&&-1==Na(b,c))throw new J("Unknown field: "+c+" in "+T(a));if(!v(a.sources))throw new J("indexes require for full text search index "+a.name+", but "+a.sources+" of type "+typeof a.sources+" found.");b=a.sources.map(function(a){var b=["storeName","keyPath","weight"],c;for(c in a)if(a.hasOwnProperty(c)&&-1==Na(b,c))throw new J("Unknown field: "+c+" in "+wf(a));return new lg(a.storeName,a.keyPath)});return new mg(a.name,
b,a.lang)};function og(a,b){var c,d,e=b;if(y(a)){d=a;c=["version","stores","fullTextCatalogs"];for(var f in d)if(d.hasOwnProperty(f)&&-1==Na(c,f))throw new J("Unknown field: "+f+" in schema.");c=d.version;var e=[],g=d.stores||[];if(!v(g))throw new J("stores must be array");for(f=0;f<g.length;f++){var h=of(g[f]);if(-1!=Sa(e,function(a){return a.name==h.getName()}))throw new J('duplicate store name "'+h.getName()+'".');e.push(h)}}else x(a)?c=0==a.length?void 0:parseFloat(a):ea(a)&&(c=a);if(t(c)){if(!ea(c)||0>
c)throw new J("Invalid version: "+c+" ("+a+")");isNaN(c)&&(c=void 0)}if(t(b)&&(!v(b)||0<b.length&&!(b[0]instanceof pf)))throw new J("stores");this.version=c;this.b=!t(this.version);this.stores=e||[];c=[];if(d&&d.fullTextCatalogs)for(f=0;f<d.fullTextCatalogs.length;f++)e=ng(d.fullTextCatalogs[f]),c[f]=e,V(this,e.getName())||(g=[new Uf("k",Wf),new Uf("v",Wf)],e=new pf(e.getName(),"id",!1,void 0,g,!1,!1,!1),this.stores.push(e));this.c=c}
og.prototype.toJSON=function(){var a=Pa(this.stores,function(a){return a.toJSON()}),b={};b.stores=a;t(this.version)&&(b.version=this.version);return b};og.prototype.b=!1;og.prototype.a=function(){return!1};function yf(a){return Pa(a.stores,function(a){return a.getName()})}og.prototype.count=function(){return this.stores.length};function V(a,b){return Ra(a.stores,function(a){return a.getName()==b})}function vf(a,b){return Qa(a.stores,function(a){return a.getName()==b})}
function pg(a,b,c,d){if(!b||a.stores.length!=b.stores.length)return"Number of store: "+a.stores.length+" vs "+b.stores.length;for(var e=0;e<a.stores.length;e++){var f=V(b,a.stores[e].getName());if(f){c&&(f=hg(f,a.stores[e]));if(d)for(var g=f,h=a.stores[e],k=0;k<h.a.length;k++){var m=h.a[k];zf(g,m.getName())||"BLOB"!=m.type||(m=new Uf(m.keyPath,m.type,m.unique,m.multiEntry,m.getName()),g.a.push(m))}f=qf(a.stores[e],f);if(0<f.length)return'store: "'+a.stores[e].getName()+'" '+f}else return'missing object store "'+
a.stores[e].getName()+'"'}return""};function rf(a,b){og.call(this,a,b)}z(rf,og);rf.prototype.a=function(){return!0};function sf(a,b){a.stores.push(b)};function Be(a){Error.captureStackTrace?Error.captureStackTrace(this,Be):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.ArgumentException"}z(Be,Error);function qg(a){Error.captureStackTrace?Error.captureStackTrace(this,qg):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.NotSupportedException"}z(Be,Error);qg.prototype.name="ydn.error.NotSupportedException";
function Ke(a){Error.captureStackTrace?Error.captureStackTrace(this,Ke):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.NotImplementedException"}z(Ke,Error);function Fe(a){Error.captureStackTrace?Error.captureStackTrace(this,Fe):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.InternalError"}z(Fe,Error);Fe.prototype.name="ydn.InternalError";
function uf(a){Error.captureStackTrace?Error.captureStackTrace(this,uf):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.ConstraintError"}z(uf,Error);uf.prototype.name="ydn.error.ConstraintError";function Kf(a){Error.captureStackTrace?Error.captureStackTrace(this,Kf):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.InvalidOperationException"}z(Be,Error);
function Je(a){Error.captureStackTrace?Error.captureStackTrace(this,Je):this.stack=Error().stack||"";a&&(this.message=String(a));this.name="ydn.error.InvalidOperationError"}z(Je,Error);function bg(a,b){var c;c=c||{};if(null!=a&&null!=b){if(w(a)&&w(b)){if(a.length!=b.length)return!1;for(var d=0;d<a.length;d++)if(-1==Sa(b,function(b){return bg(b,a[d])}))return!1;return!0}if(w(a))return 1==a.length&&bg(a[0],b);if(w(b))return 1==b.length&&bg(b[0],a);if(y(a)&&y(a)){for(var e in a)if(a.hasOwnProperty(e)&&!c[e]){var f=bg(a[e],b[e]);if(!f)return!1}for(e in b)if(b.hasOwnProperty(e)&&!c[e]&&(f=bg(a[e],b[e]),!f))return!1;return!0}return a===b}return!1}
function rg(a){if(a)for(var b in a)if(a.hasOwnProperty(b))return a[b]};/*
 Copyright 2012 YDN Authors, Yathit. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");.
*/
function S(a,b,c){c=c||{};var d="autoSchema connectionTimeout size mechanisms policy isSerial Encryption".split(" "),e;for(e in c)if(c.hasOwnProperty(e)&&-1==Na(d,e))throw new J('Unknown attribute "'+e+'" in options.');if(c.mechanisms){if(!v(c.mechanisms))throw new J("mechanisms attribute must be an array but "+ca(c.mechanisms)+" found.");for(e=0;e<c.mechanisms.length;e++)if(!(0<=Na(sg,c.mechanisms[e])))throw new J('Invalid mechanism "'+c.mechanisms[e]+'"');}this.G=c.mechanisms||(Tf?Wa(sg,1):sg);
this.j=c.size;this.K=t(c.connectionTimeout)?c.connectionTimeout:3E3;this.b=null;this.f=[];this.hb=!1;var f;if(b instanceof og)f=b;else if(y(b))for(c.autoSchema||!t(b.stores)?f=new rf(b):f=new og(b),c=b.stores?b.stores.length:0,e=0;e<c;e++)d=V(f,b.stores[e].name),b.stores[e].Sync&&E(this.logger,"Synchronization option for "+d.getName()+" ignored.");else f=new rf;this.a=f;for(e=0;e<this.a.count();e++)if((this.a.stores[e]||null).m)throw Error("encryption option must be defined");t(a)&&this.C(a);this.h=
null;this.g=new C}S.prototype.logger=D("ydn.db.con.Storage");S.prototype.N=function(a){if(t(a)){var b=function(b){a(b.toJSON());a=void 0};if(this.b)this.b.S(b);else{var c=this;this.transaction(function(a){c.b.S(b,a)},null,Zd)}}return this.a?this.a.toJSON():null};S.prototype.C=function(a){if(this.b)throw new sd("Already connected with "+this.i);this.i=a;tf(this)};S.prototype.getName=function(){return this.i};var sg="indexeddb sqlite websql localstorage sessionstorage userdata memory".split(" ");
l=S.prototype;l.xb=function(){return null};
function tf(a){function b(b,e){b?(F(a.logger,a+": ready."),a.Zb=NaN,d.Ra=function(b){a.J(new Pf(a,b))},d.qb=function(b){a.J(new Qf(a,b));a.b=null},d.jb=function(b){a.J(b)},setTimeout(function(){tg(a,e);ug(a)},10),c.callback(e)):(E(a.logger,a+": database connection fail "+e.name),setTimeout(function(){tg(a,new Qf(a,e));if(a.f){var b=a.logger;for(b&&b.log(ad,"Purging "+a.f.length+" transactions request.",void 0);b=a.f.shift();)b.L&&b.L("error",e)}},10),c.o(e))}for(var c=new C,d=null,e=a.G,f=0;f<e.length;f++){var g=
e[f].toLowerCase();if(d=a.xb(g)){d=a.xb(g);break}}null===d?(e=new uf("No storage mechanism found."),b(!1,new Qf(a,e))):Lb(d.connect(a.i,a.a),function(a){this.b=d;b(!0,new Of("ready",this,parseFloat(d.ob()),parseFloat(a),null))},function(a){E(this.logger,this+": opening fail");b(!1,a)},a)}l.Ba=function(){if(this.b)return this.b.Aa()};l.ib=function(a,b){this.g.ia().Rb(a,b)};function tg(a,b){setTimeout(function(){a.a.b&&a.g.c||(b instanceof Pf?a.g.o(b.error):a.g.callback(),a.J(b))},4)}
function kf(a){return!!a.b&&a.b.pb()}l.close=function(){this.b&&(this.b.close(),this.b=null,F(this.logger,this+" closed"))};l.Kc=function(){return this.b?this.b.Mb():null};l.Zb=NaN;function ug(a){var b=a.f.shift();b&&(F(a.logger,"pop tx queue["+(a.f.length+1)+"]"),a.transaction(b.ab,b.uc,b.mode,b.L));a.Zb=na()}
function vg(a,b,c,d,e){F(a.logger,"push tx queue["+a.f.length+"]");a.f.push({ab:b,uc:c,mode:d,L:e});100<a.f.length&&0==a.f.length%100&&E(a.logger,"Transaction queue stack size is "+a.f.length+". It is too large, possibility due to incorrect usage.")}l.hb=!1;
l.transaction=function(a,b,c,d){var e=b;if(x(b))e=[b];else if(null!=b)if(w(b)){if(0==b.length)throw new J("number of store names must more than 0");for(var f=0;f<b.length;f++)if(!x(b[f]))throw new J("store name at "+f+" must be string but found "+typeof b[f]);}else throw new J("store names must be an array");else e=null;if(this.b&&this.b.pb()&&!this.hb){var g=this,h=t(c)?c:Zd;h==$d&&(this.hb=!0);this.b.$a(function(b){a(b);a=null},e,h,function(a,b){fa(d)&&(d(a,b),d=void 0);h==$d&&(g.hb=!1);ug(g)})}else vg(this,
a,e,c,d)};l.J=function(){};l.toString=function(){return"Storage:"+this.b};function wg(a,b,c,d){this.f=a;this.g=b;this.a=Va(c);this.b=d;this.c=[]}wg.prototype.f=null;function xg(a,b,c){if(a.f)c&&a.c.push(c),b(a.f);else throw new td("tx committed on ParallelTxExecutor");}wg.prototype.toString=function(){return"ParallelTxExecutor: txNo:"+this.g+" mode:"+this.b+" scopes:"+T(this.a)};function yg(a,b,c,d,e,f){af.call(this,a,b,c,d,e,f);this.c=this.b=null}z(yg,af);l=yg.prototype;l.logger=D("ydn.db.tr.Parallel");l.abort=function(){G(this.logger,this+": aborting");ef(this.c)};
l.jc=function(a,b){var c;if("multi"==this.g)a:if(c=this.b,!c.a||!c.b||b!=c.b&&(c.b!=M||b!=Zd)||a.length>c.a.length)c=!1;else{for(var d=0;d<a.length;d++)if(-1==c.a.indexOf(a[d])){c=!1;break a}c=!0}else if("repeat"==this.g)a:if(c=this.b,c.a&&c.b&&b==c.b&&c.a.length==a.length){for(d=0;d<a.length;d++)if(-1==c.a.indexOf(a[d])){c=!1;break a}c=!0}else c=!1;else c="all"==this.g?!0:!1;return c};
l.pa=function(a,b,c,d){function e(c){k.f++;m=new wg(c,k.f,b,h);g=k.I();od(k.logger,g+" BEGIN "+T(b)+" "+h);k.b=m;xg(k.b,a,d)}function f(a,b){od(k.logger,g+" "+a);if(m){for(var c=m,d=0;d<c.c.length;d++)c.c[d](a,b);c.c.length=0;c.f=null;c.a=null;c.c=null}k.a=0}var g;this.G&&(b=this.G);this.C&&(c=this.C);var h=t(c)?c:Zd,k=this,m;if(this.b&&this.b.f&&this.jc(b,h))xg(this.b,a,d);else{if(this.j&&this.f>=this.j)throw new sd("Exceed maximum number of transactions of "+this.j);this.l().transaction(e,b,h,f)}};
l.request=function(a,b,c,d){var e=new se(a),f=this;this.pa(function(a){f.a++;te(e,a,f.I()+"R"+f.a)},b,c||Zd,function(a,b){ve(e);d&&d(a,b)});return e};l.Da=function(a,b,c,d,e){var f=this,g;this.pa(function(c){f.a++;g=f.I()+"R"+f.a;G(f.logger,g+" BEGIN");b(c,g,function(b,d){f.c=c;g=f.I()+"R"+f.a;d?(G(f.logger,g+" ERROR"),a.o(b)):(G(f.logger,g+" SUCCESS"),a.callback(b));f.c=null});b=null;G(f.logger,g+" END")},c,d,e)};l.toString=function(){return"Parallel:"+this.g+":"+this.I()+(this.c?"*":"")};function zg(a,b){yg.call(this,a,b,bf)}z(zg,yg);l=zg.prototype;l.logger=D("ydn.db.tr.AtomicParallel");l.jc=function(){return!1};l.request=function(a,b,c){var d,e,f,g=this,h=zg.B.request.call(this,a,b,c,function(a,b){ve(h);G(g.logger,"transaction "+a);if(d)"complete"!=a&&(f=!0,e=b),d(e,f);else{var c=new Ve;P(h,c,!0)}});xe(h,function(a,b,c){f=b;e=a;d=c});return h};
l.Da=function(a,b,c,d,e){var f,g,h=new C;Lb(h,function(a){g=!1;f=a},function(a){g=!0;f=a});zg.B.Da.call(this,h,b,c,d,function(b,c){if("complete"!=b)a.o(c);else if(!0===g)a.o(f);else if(!1===g)a.callback(f);else{var d=new Ve;a.o(d)}e&&(e(b,c),e=void 0)})};l.toString=function(){return"Atomic"+zg.B.toString.call(this)};function Ag(a,b,c){S.call(this,a,b,c);this.wa=0;a=!0;b=bf;c&&(t(c.isSerial)&&(a=!!c.isSerial),c.policy&&(b=c.policy));c=Bg(this,b,a);this.m=Bg(this,"atomic",!1);this.c=this.va(c,this.m)}z(Ag,S);l=Ag.prototype;l.wa=0;l.kc=function(a,b,c,d,e,f){a=a||bf;var g;"readonly"==d?g=Zd:"readwrite"==d&&(g=M);a=Bg(this,a,b,c,g,e);return this.va(a,f?null:this.m)};l.va=function(a){return new mf(this,this.a,a)};
function Bg(a,b,c,d,e,f){if(c){if("multi"==b||"repeat"==b||"all"==b||b==bf)return new ff(a,a.wa++,b,d,e,f);if("atomic"==b)return new lf(a,a.wa++);throw new J('Invalid requestType "'+b+'"');}if("multi"==b||"repeat"==b||"all"==b||b==bf)return new yg(a,a.wa++,b,d,e,f);if("atomic"==b)return new zg(a,a.wa++);throw new J('Invalid requestType "'+b+'"');}
l.tc=function(a,b,c){if(3<arguments.length)throw new J("too many input arguments, run accept not more than 3 input arguments, but "+arguments.length+" found.");this.wa++;var d=b||yf(this.a),e=Zd;if(c)if("readwrite"==c)e=M;else if("readonly"!=c)throw new J('Invalid transaction mode "'+c+'"');var f=Bg(this,"all",!1,d,e,1),g=this.va(f,this.m),h=new se("run"),k=this;f.pa(function(b){F(k.logger,"executing run in transaction on "+f);te(h,b,f.I()+"R0");a(g)},d,e,function(a){ve(h);P(h,f.f,"complete"!==a)});
return h};l.Pc=function(){return this.c?this.c.a.f:NaN};function X(a,b,c){Ag.call(this,a,b,c);a=this.a;for(b=0;b<a.c.length;b++){c=a.c[b];var d=V(a,c.getName());if(d){if(!zf(d,"k"))throw new J('full text index store "'+d.getName()+'" must have "keyword" index');if(!zf(d,"v"))throw new J('full text index store "'+d.getName()+'" must have "keyword" index');if("id"!=d.keyPath)throw new J('full text index store "'+d.getName()+'" must use "id" as key path.');}else throw new J('full text index store "'+c.getName()+'" required.');for(d=0;d<c.count();d++){var e=
c.index(d),f=V(a,e.s);if(f)E(this.logger,"Full text indexer option for "+f.getName()+" ignored.");else throw new J('full text source store "'+e.s+'" does not exist for full text index "'+c.getName()+'"');}}}z(X,Ag);l=X.prototype;l.va=function(a){return new W(this,this.a,a)};l.add=function(a,b,c){return this.c.add(a,b,c)};l.Ta=function(a,b,c){return this.c.Ta(a,b,c)};l.count=function(a,b,c,d){return this.c.count(a,b,c,d)};l.get=function(a,b){return this.c.get(a,b)};
l.keys=function(a,b,c,d,e,f,g){return this.c.keys(a,b,c,d,e,f,g)};l.Ja=function(a,b,c,d,e,f,g){return this.c.Ja(a,b,c,d,e,f,g)};l.values=function(a,b,c,d,e,f){return this.c.values(a,b,c,d,e,f)};l.Ma=function(a,b,c,d,e,f){return this.c.Ma(a,b,c,d,e,f)};l.put=function(a,b,c){return this.c.put(a,b,c)};l.kb=function(a,b,c){return this.c.kb(a,b,c)};l.clear=function(a,b,c){return this.c.clear(a,b,c)};l.sb=function(a,b,c){return this.c.sb(a,b,c)};
l.toString=function(){var a="Storage:"+this.getName();kf(this)&&(a+=" ["+this.Ba()+"]");return a};function Cg(a,b,c){X.call(this,a,b,c)}z(Cg,X);l=Cg.prototype;l.va=function(a){return new If(this,this.a,a)};l.open=function(a,b,c,d){return this.c.open(a,b,c,d)};l.Ga=function(a){return this.c.Ga(a)};l.Na=function(a,b){return this.c.Na(a,b)};l.Ka=function(a,b){return this.c.Ka(a,b)};l.Lc=function(a,b){return this.c.Nb(a,b)};function Dg(a,b,c,d){ee.call(this,a,b,c,d);this.h=null}z(Dg,ee);l=Dg.prototype;l.logger=D("ydn.db.core.req.IDBCursor");l.Za=function(a){(a=a.target.result)?this.W(a.key,a.primaryKey,a.value):this.W()};
l.openCursor=function(a,b){function c(a,b,c){p.h=n;p.h.onsuccess=la(p.Za,p);p.W(a,p.g?b:void 0,c);n=null}var d=this+" opening ";null!=a&&(d+="{"+a,d=null!=b?d+(";"+b+"}"):d+"}");F(this.logger,d);var e=this.w,d=this.f.objectStore(this.s),f=x(this.O)?d.index(this.O):null;if(t(a))var g=f?!t(b):!0,h=e?e.lower:void 0,k=e?e.upper:void 0,m=e?!!e.lowerOpen:!1,e=e?!!e.upperOpen:!1,e=xd(this.reverse?new K(h,a,m,g):new K(a,k,g,e));var n;this.Ia?f?n=null!=this.Z?f.openKeyCursor(e,this.Z):null!=e?f.openKeyCursor(e):
f.openKeyCursor():n=null!=this.Z?d.openCursor(e,this.Z):null!=e?d.openCursor(e):d.openCursor():f?n=null!=this.Z?f.openCursor(e,this.Z):null!=e?f.openCursor(e):f.openCursor():n=null!=this.Z?d.openCursor(e,this.Z):null!=e?d.openCursor(e):d.openCursor();var p=this;n.onerror=function(a){var b=n.error;a.preventDefault();he(p,b)};null!=a?n.onsuccess=function(d){if(d=d.target.result){var e=ae.cmp(d.key,a),f=p.reverse?-1:1;if(e==f)c(d.key,d.primaryKey,d.value);else if(e==-f)d["continue"](a);else if(null!=
b)if(ae.cmp(d.primaryKey,b)==f)c(d.key,d.primaryKey,d.value);else d["continue"]();else d["continue"]()}else c()}:(p.h=n,p.h.onsuccess=la(p.Za,p))};l.fb=function(){return!!this.h};l.update=function(a){var b=this.h.result;if(b){var c=new C;a=b.update(a);a.onsuccess=function(a){c.callback(a.target.result)};a.onerror=function(a){a.preventDefault();c.o(a)};return c}throw new Qe("cursor gone");};
l.clear=function(){var a=this.h.result;if(a){var b=new C,a=a["delete"]();a.onsuccess=function(){b.callback(1)};a.onerror=function(a){a.preventDefault();b.o(a)};return b}throw new Qe("cursor gone");};l.advance=function(a){var b=this.h.result;if(1==a)b["continue"]();else b.advance(a)};
l.Sa=function(a){var b=this.h.result,c=ae.cmp(a,b.primaryKey);if(c!=(this.reverse?-1:1))throw new td('continuing primary key "'+a+'" must '+(this.reverse?"lower":"higher")+' than current primary key "'+b.primaryKey+'"');var d=this;this.h.onsuccess=function(e){if(b=e.target.result)if(c=ae.cmp(b.primaryKey,a),0==c||1==c&&!d.reverse||-1==c&&d.reverse)d.h.onsuccess=la(d.Za,d),d.W(b.key,d.g?b.primaryKey:void 0,b.value);else b["continue"]();else d.h.onsuccess=la(d.Za,d),d.W()};b["continue"]()};
l.ra=function(a){var b=this.h.result;if(null!=a)b["continue"](a);else b["continue"]()};l.fa=function(){Dg.B.fa.call(this);this.h=null};l.toString=function(){return"IDB"+Dg.B.toString.call(this)};function Eg(a,b){this.a=b}z(Eg,Ye);l=Eg.prototype;l.logger=D("ydn.db.crud.req.IndexedDb");l.Ya=function(a,b){function c(e){var f=a.a.objectStore(b[e]).count();f.onsuccess=function(f){d[e]=f.target.result;e++;e==b.length?P(a,d):c(e)};f.onerror=function(b){b.preventDefault();P(a,f.error,!0)}}var d=[];0==b.length?P(a,[]):c(0)};
l.P=function(a,b,c,d,e,f){function g(u){if(null==e[u])if(F(n.logger,"empty object at "+u+" of "+e.length),k++,k==e.length)P(a,h,m);else{var B=u+10;B<e.length&&g(B)}var H,B=e[u];H=f&&null!=f[u]?b?q.put(B,f[u]):q.add(B,f[u]):b?q.put(B):q.add(B);H.onsuccess=function(b){k++;h[u]=b.target.result;k==e.length?P(a,c?h[0]:h,m):(b=u+10,b<e.length&&g(b))};H.onerror=function(b){k++;var f=H.error;F(n.logger,R(a)+p+' request to "'+d+'" cause '+f.name+' for object "'+wf(e[u])+'" at index '+u+" of "+e.length+" objects.");
h[u]=f;m=!0;b.preventDefault();k==e.length?P(a,c?h[0]:h,m):(b=u+10,b<e.length&&g(b))}}var h=[],k=0,m=!1,n=this,p=b?"put":"add",q=a.a.objectStore(d);F(this.logger,R(a)+" "+p+" "+e.length+' objects to store "'+d+'"');if(0<e.length)for(var u=0;10>u&&u<e.length;u++)g(u);else P(a,[])};
l.Gb=function(a,b,c){function d(k){var n=c[k],p=n.s,q=a.a.objectStore(p),u;u=null===q.keyPath?q.put(b[k],n.id):q.put(b[k]);u.onsuccess=function(c){f++;e[k]=c.target.result;f==b.length?P(a,e,g):(c=k+10,c<b.length&&d(c))};u.onerror=function(c){f++;E(h.logger,"request result "+c.name+' error when put keys to "'+p+'" for object "'+wf(b[k])+'" at index '+k+" of "+b.length+" objects.");e[k]=u.error;g=!0;c.preventDefault();f==b.length?P(a,e,g):(c=k+10,c<b.length&&d(c))}}var e=[],f=0,g=!1,h=this;F(this.logger,
R(a)+" putByKeys: of "+b.length+" objects");if(0<b.length)for(var k=0;10>k&&k<b.length;k++)d(k);else P(a,e,g)};l.lb=function(a,b,c){var d=a.a.objectStore(b);F(this.logger,R(a)+" clearById: "+b+" "+c);var e=d.openCursor(Ed.only(c));e.onsuccess=function(b){if(b=b.target.result){var c=b["delete"]();c.onsuccess=function(){P(a,1)};c.onerror=function(){P(a,c.error,!0)}}else P(a,0)};e.onerror=function(b){b.preventDefault();P(a,e.error,!0)}};
l.Ib=function(a,b){function c(h){h++;if(h>=b.length)0<g.length?P(a,g,!0):P(a,d);else{b[h].s!=e&&(e=b[h].s,f=a.a.objectStore(e));var k=f["delete"](b[h].id);k.onsuccess=function(){d++;c(h)};k.onerror=function(a){a.preventDefault();g[h]=k.error;c(h)}}}var d=0,e,f;F(this.logger,R(a)+" removeByKeys: "+b.length+" keys");var g=[];c(-1)};
l.mb=function(a,b,c){var d=a.a.objectStore(b),e=d.count(c);F(this.logger,R(a)+" clearByKeyRange: "+b+" "+c);e.onsuccess=function(b){var e=b.target.result,h=d["delete"](c);h.onsuccess=function(){P(a,e)};h.onerror=function(){P(a,h.error,!0)}};e.onerror=function(b){b.preventDefault();P(a,e.error,!0)}};l.vb=function(a,b,c){var d=a.a.objectStore(b);F(this.logger,R(a)+" "+b+" "+c);var e=d["delete"](c);e.onsuccess=function(){P(a,void 0)};e.onerror=function(b){b.preventDefault();P(a,e.error,!0)}};
l.Hb=function(a,b,c,d){var e=a.a.objectStore(b).index(c);F(this.logger,R(a)+" clearByIndexKeyRange: "+b+":"+c+" "+d);var f=[],g=e.openCursor(d),h=0;g.onsuccess=function(b){var c=b.target.result;if(c){var d=c["delete"]();d.onsuccess=function(){h++;c["continue"]()};d.onerror=function(a){f.push(d.error);a.preventDefault();c["continue"]()}}else 0<f.length?P(a,f,!0):P(a,h)};g.onerror=function(b){b.preventDefault();P(a,g.error,!0)}};
l.Wa=function(a,b){var c=b.length,d=0;F(this.logger,R(a)+" clearByStores: "+b);for(var e=0;e<c;e++){var f=a.a.objectStore(b[e]).clear();f.onsuccess=function(){d++;d==c&&P(a,d)};f.onerror=function(b){d++;b.preventDefault();d==c&&P(a,f.error,!0)}}};
l.bb=function(a,b,c){var d=this;F(this.logger,R(a)+b+":"+c);var e=a.a.objectStore(b),f=e.get(c);f.onsuccess=function(b){F(d.logger,R(a)+" record "+c+(null!=b.target.result?" ":" not ")+" exists.");var f=b.target.result;if(!e.keyPath&&0==e.indexNames.length&&Ic&&x(f)&&0<=f.indexOf(";base64,")){'"'==f.charAt(0)&&'"'==f.charAt(f.length-1)&&(f=f.substr(1,f.length-2));f=f.split(";base64,");b=f[0].split(":")[1];for(var f=window.atob(f[1]),k=f.length,m=new Uint8Array(k),n=0;n<k;++n)m[n]=f.charCodeAt(n);
P(a,new Blob([m.buffer],{type:b}))}else P(a,b.target.result)};f.onerror=function(b){b.preventDefault();P(a,f.error,!0)}};
l.Eb=function(a,b,c){function d(b){if(null==c[b])if(f++,e[b]=void 0,f==h)P(a,e);else{var m=b+10;m<h&&d(m)}var n;n=g.get(c[b]);n.onsuccess=function(c){f++;e[b]=c.target.result;f==h?P(a,e):(c=b+10,c<h&&d(c))};n.onerror=function(b){f++;b.preventDefault();P(a,n.error,!0)}}var e=[];e.length=c.length;var f=0,g=a.a.objectStore(b),h=c.length;F(this.logger,R(a)+" "+b+":"+h+" ids");if(0<h)for(b=0;10>b&&b<h;b++)d(b);else P(a,[])};
l.Fb=function(a,b){function c(f){var h=b[f],k=a.a.objectStore(h.s).get(h.id);k.onsuccess=function(h){e++;d[f]=h.target.result;e==b.length?P(a,d):(h=f+10,h<b.length&&c(h))};k.onerror=function(b){e++;b.preventDefault();P(a,k.error,!0)}}var d=[];d.length=b.length;var e=0;F(this.logger,R(a)+" "+b.length+" ids");if(0<b.length)for(var f=0;10>f&&f<b.length;f++)c(f);else P(a,[])};
l.Fa=function(a,b,c,d,e){if(d&&e)throw new sd("unique count not available in IndexedDB");e=a.a.objectStore(b);b=R(a)+" "+b+(d?":"+d:"")+(c?":"+T(c):"");F(this.logger,b);var f;null!=d?(d=e.index(d),f=null!=c?d.count(c):d.count()):f=null!=c?e.count(c):e.count();f.onsuccess=function(b){P(a,b.target.result)};f.onerror=function(b){b.preventDefault();P(a,f.error,!0)}};
l.$=function(a,b,c,d,e,f,g,h,k,m){var n=[],p=a.a.objectStore(c),q=h?k?"prevunique":"prev":k?"nextunique":"next";c=R(a)+" "+b+" "+c+(d?":"+d:"")+(e?T(e):"");h&&(c+=" reverse");k&&(c+=" unique");if(m&&t(m[0])){k=d?!t(m[1]):!0;var u=m[0],A=e?e.lower:void 0,B=e?e.upper:void 0,H=e?!!e.lowerOpen:!1;e=e?!!e.upperOpen:!1;e=xd(h?new K(A,u,H,k):new K(u,B,k,e));c+=" starting from "+T(m[0]);t(m[1])&&(c+=", "+T(m[1]))}F(this.logger,c);var I;I=1==b||2==b||3==b?d?p.index(d).openKeyCursor(e,q):p.openCursor(e,q):
d?p.index(d).openCursor(e,q):p.openCursor(e,q);var O=!1;I.onsuccess=function(c){if(c=c.target.result){if(!O){if(0<g){O=!0;c.advance(g);return}if(m&&d&&t(m[0]))if(t(m[1])){var e=ae.cmp(c.key,m[0]),k=h?-1:1;if(0==e){e=ae.cmp(c.primaryKey,m[1]);if(0==e){O=!0;c["continue"]();return}if(e==k)O=!0;else{c["continue"]();return}}else O=!0}else O=!0;else O=!0}1==b?n.push(c.key):2==b?n.push(c.primaryKey):3==b?(k={},d&&(k[d]=c.key),p.keyPath?k[p.keyPath]=c.primaryKey:k._ROWID_=c.primaryKey,n.push(k)):4==b?n.push(c.value):
n.push([c.key,c.primaryKey,c.value]);if(n.length<f)c["continue"]();else m&&(m[0]=je(c.key),m[1]=je(c.primaryKey)),P(a,n)}else m&&(m[0]=void 0,m[1]=void 0),P(a,n)};I.onerror=function(b){b.preventDefault();P(a,I.error,!0)}};function Fg(a,b){this.a=b}z(Fg,Eg);Fg.prototype.logger=D("ydn.db.core.req.IndexedDb");Fg.prototype.b=function(a,b,c,d){c=V(this.a,c);return new Dg(a,b,c,d)};function Gg(){this.a=!1}Gg.prototype.a=!1;Gg.prototype.state=function(){return this.a};function Hg(a,b,c,d){ee.call(this,a,b,c,d);this.j=this.c=this.a=void 0;this.i=this.h=null;this.m=new Gg;this.nb=this.la=null}z(Hg,ee);l=Hg.prototype;l.logger=D("ydn.db.core.req.SimpleCursor");l.fb=function(){return!!this.f};l.update=function(a){Ig(this.nb,this.T(),a);return Tb()};l.advance=function(a){function b(b){d++;if(!b||d>=a)return Jg(c,b)}var c=this,d=this.h?-1:0;this.reverse?Kg(this.la,b,this.h):Lg(this.la,b,this.h)};
l.ra=function(a){if(null!=a){var b=this,c=new Y(a),d=function(c){b.h=c;if(!c)return Jg(b,c);var d=L(c.value.key,a);if(b.reverse){if(1!=d)return Jg(b,c)}else if(-1!=d)return Jg(b,c)};this.reverse?Kg(this.la,d,c):Lg(this.la,d,c)}else this.advance(1)};function Mg(a){setTimeout(function(){a.m.state()?(a.m.a=!1,a.W(a.a,a.c,a.j),Mg(a)):(a.i(),a.i=null)},4)}
function Jg(a,b){if(a.h=b){var c=b.value;if(a.w)if(a.reverse||null==a.w.upper)a.reverse&&null!=a.w.lower&&(d=L(c.key,a.w.lower),-1==d||0==d&&a.w.lowerOpen)&&(a.h=null);else{var d=L(c.key,a.w.upper);if(1==d||0==d&&a.w.upperOpen)a.h=null}if(a.h){if(a.unique&&null!=a.a&&null!=c.key&&0==L(a.a,c.key))return;a.a=c.key;a.c=a.g?c.a:a.a;4==a.u&&(a.Ia?a.j=a.c:a.j=Ng(a.nb,a.c))}}a.h||(a.a=void 0,a.c=void 0,a.j=void 0);return a.m.a=!0}
l.openCursor=function(a,b){var c=null;if(this.w)if(this.reverse){var d=this.g?"\uffff":void 0;null!=this.w.upper&&(c=new Y(this.w.upper,d))}else null!=this.w.lower&&(c=new Y(this.w.lower));null!=a&&(c=this.g?new Y(a,b):new Y(a));this.i=this.f.l(function(b){function d(b){var e=b.value,f=e.key;if(b&&null!=f)if(null!=a){if(0==Og(c,e))return}else if(this.w&&(!this.reverse&&this.w.lowerOpen&&null!=this.w.lower&&(e=L(f,this.w.lower),0==e)||this.reverse&&this.w.upperOpen&&null!=this.w.upper&&(e=L(f,this.w.upper),
0==e)))return;return Jg(this,b)}this.nb=Pg(b,this.s);this.la=Qg(this.nb,this.O);this.reverse?Kg(this.la,la(d,this),c):Lg(this.la,la(d,this),c);Mg(this)},this)};l.clear=function(){throw new rd;};l.Sa=function(){throw new rd;};l.toString=function(){return"Simple"+Hg.B.toString.call(this)};function Rg(a,b,c){a=["ydn.db",a];t(b)&&(a.push(b),t(c)&&(a.push(c),t(void 0)&&a.push(Nd(void 0))));return a.join("^|")};function Y(a,b){this.key=a;this.a=b}Y.prototype.toString=function(){return"ydn.db.con.simple.Node("+this.key+(null!=this.a?", "+this.a+")":")")};function Og(a,b){var c=L(a.key,b.key);return 0===c?null!=a.a?null!=b.a?L(a.a,b.a):1:null!=b.a?-1:0:c};function Sg(a){this.U=a||Tg}function Tg(a,b){return String(a)<String(b)?-1:String(a)>String(b)?1:0}l=Sg.prototype;l.D=null;l.U=null;l.ca=null;l.ba=null;
l.add=function(a){if(null==this.D)return this.ba=this.ca=this.D=new Ug(a),!0;var b=null;Vg(this,function(c){var d=null,e=this.U(c.value,a);0<e?(d=c.left,null==c.left&&(b=new Ug(a,c),c.left=b,c==this.ca&&(this.ca=b))):0>e&&(d=c.right,null==c.right&&(b=new Ug(a,c),c.right=b,c==this.ba&&(this.ba=b)));return d});b&&(Vg(this,function(a){a.count++;return a.parent},b.parent),Wg(this,b.parent));return!!b};
function Xg(a,b){Vg(a,function(a){var d=null,e=this.U(a.value,b);0<e?d=a.left:0>e?d=a.right:Yg(this,a);return d})}l.clear=function(){this.ba=this.ca=this.D=null};l.contains=function(a){var b=!1;Vg(this,function(c){var d=null,e=this.U(c.value,a);0<e?d=c.left:0>e?d=c.right:b=!0;return d});return b};l.indexOf=function(a){var b=-1,c=0;Vg(this,function(d){var e=this.U(d.value,a);if(0<e)return d.left;d.left&&(c+=d.left.count);if(0>e)return c++,d.right;b=c;return null});return b};
l.zb=function(){return this.D?this.D.count:0};l.cb=function(){var a=[];Zg(this,function(b){a.push(b)});return a};function Zg(a,b){if(a.D){var c,d=c=$g(a);for(c=c.left?c.left:c;null!=d;)if(null!=d.left&&d.left!=c&&d.right!=c)d=d.left;else{if(d.right!=c&&b(d.value))break;var e=d,d=null!=d.right&&d.right!=c?d.right:d.parent;c=e}}}function Vg(a,b,c){for(c=c?c:a.D;c&&null!=c;)c=b.call(a,c)}
function Wg(a,b){Vg(a,function(a){var b=a.left?a.left.height:0,e=a.right?a.right.height:0;1<b-e?(a.left.right&&(!a.left.left||a.left.left.height<a.left.right.height)&&ah(this,a.left),bh(this,a)):1<e-b&&(a.right.left&&(!a.right.right||a.right.right.height<a.right.left.height)&&bh(this,a.right),ah(this,a));b=a.left?a.left.height:0;e=a.right?a.right.height:0;a.height=Math.max(b,e)+1;return a.parent},b)}
function ah(a,b){ch(b)?(b.parent.left=b.right,b.right.parent=b.parent):dh(b)?(b.parent.right=b.right,b.right.parent=b.parent):(a.D=b.right,a.D.parent=null);var c=b.right;b.right=b.right.left;null!=b.right&&(b.right.parent=b);c.left=b;b.parent=c;c.count=b.count;b.count-=(c.right?c.right.count:0)+1}
function bh(a,b){ch(b)?(b.parent.left=b.left,b.left.parent=b.parent):dh(b)?(b.parent.right=b.left,b.left.parent=b.parent):(a.D=b.left,a.D.parent=null);var c=b.left;b.left=b.left.right;null!=b.left&&(b.left.parent=b);c.right=b;b.parent=c;c.count=b.count;b.count-=(c.left?c.left.count:0)+1}
function Yg(a,b){if(null!=b.left||null!=b.right){var c=null,d;if(null!=b.left){d=eh(a,b.left);Vg(a,function(a){a.count--;return a.parent},d);if(d!=b.left){if(d.parent.right=d.left)d.left.parent=d.parent;d.left=b.left;d.left.parent=d;c=d.parent}d.parent=b.parent;d.right=b.right;d.right&&(d.right.parent=d);b==a.ba&&(a.ba=d)}else{d=$g(a,b.right);Vg(a,function(a){a.count--;return a.parent},d);if(d!=b.right){if(d.parent.left=d.right)d.right.parent=d.parent;d.right=b.right;d.right.parent=d;c=d.parent}d.parent=
b.parent;d.left=b.left;d.left&&(d.left.parent=d);b==a.ca&&(a.ca=d)}d.count=b.count;ch(b)?b.parent.left=d:dh(b)?b.parent.right=d:a.D=d;Wg(a,c?c:d)}else Vg(a,function(a){a.count--;return a.parent},b.parent),ch(b)?(b.parent.left=null,b==a.ca&&(a.ca=b.parent),Wg(a,b.parent)):dh(b)?(b.parent.right=null,b==a.ba&&(a.ba=b.parent),Wg(a,b.parent)):a.clear()}function $g(a,b){if(!b)return a.ca;var c=b;Vg(a,function(a){var b=null;a.left&&(b=c=a.left);return b},b);return c}
function eh(a,b){if(!b)return a.ba;var c=b;Vg(a,function(a){var b=null;a.right&&(b=c=a.right);return b},b);return c}function Ug(a,b){this.value=a;this.parent=b?b:null;this.count=1}Ug.prototype.left=null;Ug.prototype.right=null;Ug.prototype.height=1;function dh(a){return!!a.parent&&a.parent.right==a}function ch(a){return!!a.parent&&a.parent.left==a};function fh(a){this.U=a||Tg}z(fh,Sg);function Lg(a,b,c){if(a.D){var d;if(c instanceof Ug)d=c;else if(c){if(Vg(a,function(a){var b=null;0<this.U(a.value,c)?(b=a.left,d=a):0>this.U(a.value,c)?b=a.right:d=a;return b}),!d)return}else d=$g(a);a=d;for(var e=d.left?d.left:d;null!=a;)if(null!=a.left&&a.left!=e&&a.right!=e)a=a.left;else{if(a.right!=e&&b(a))return;var f=a;a=null!=a.right&&a.right!=e?a.right:a.parent;e=f}b(null)}}
function Kg(a,b,c){if(a.D){var d;if(c instanceof Ug)d=c;else if(c){if(Vg(a,la(function(a){var b=null;0<this.U(a.value,c)?b=a.left:(0>this.U(a.value,c)&&(b=a.right),d=a);return b},a)),!d)return}else d=eh(a);a=d;for(var e=d.right?d.right:d;null!=a;)if(null!=a.right&&a.right!=e&&a.left!=e)a=a.right;else{if(a.left!=e&&b(a))return;var f=a;a=null!=a.left&&a.left!=e?a.left:a.parent;e=f}b(null)}};function gh(a,b,c){this.g=a;this.storage=b;this.b=c;this.a={};a=this.b.keyPath;this.c=v(a)?a.join(","):a||"_ROWID_";this.a[this.c]=null;this.f=Rg(this.g,this.b.getName(),this.c)+"^|"}
function Qg(a,b){var c=b||a.c;if(!a.a[c]){a.a[c]=new fh(Og);for(var d=a.storage.length,e=0;e<d;e++){var f=a.storage.key(e);if(null!==f&&0==f.lastIndexOf(a.f,0)){var g=Qd(f.substr(a.f.length));if(c==a.c)a.a[c].add(new Y(g));else{var h=a.storage.getItem(f);if(null!==h)if(f=ge(a.b,c),h=kg(h),h=Xf(f,h),f.multiEntry){if(v(h))for(f=0;f<h.length;f++)a.a[c].add(new Y(h[f],g))}else a.a[c].add(new Y(h,g))}}}}return a.a[c]}
function hh(a,b,c){for(var d in a.a){var e=a.a[d];if(e)if(d==a.c)Xg(e,new Y(b));else{var f=ge(a.b,d),f=Kd(c,f.keyPath);Xg(e,new Y(b,f))}}}function ih(a){for(var b in a.a){var c=a.a[b];c&&c.clear()}a.a={}}
function Ig(a,b,c,d){if(null==b&&(a.b.keyPath&&(b=Df(a.b,c)),a.b.b&&null==b)){b=a.f+Nd(void 0);var e=kg(a.storage.getItem(b));e.key_count||(e.key_count=0);e.key_count++;a.storage.setItem(b,T(e));b=e.key_count}d&&(d=null!==a.storage.getItem(a.f+Nd(b)));if(d)return null;a.storage.setItem(a.f+Nd(b),T(c));d=b;for(var f in a.a)if(e=a.a[f])if(f==a.c)e.add(new Y(d));else{var g=ge(a.b,f),g=Kd(c,g.keyPath);null!=g&&e.add(new Y(d,g))}return b}
function jh(a,b){var c=a.f+Nd(b),d=a.storage.getItem(c);if(null===d)return 0;a.storage.removeItem(c);c=kg(d);hh(a,b,c);return 1}gh.prototype.clear=function(){ih(this);kh(this)};function Ng(a,b){var c=a.storage.getItem(a.f+Nd(b)),d=void 0;if(null!==c)for(var d=kg(c),c=0,e=a.b.a.length;c<e;c++){var f=a.b.index(c);if("DATE"==f.type){var g=Xf(f,d);g&&Yf(f,d,new Date(g))}}return d}gh.prototype.getName=function(){return this.b.getName()};
function lh(a,b,c){b=b||a.c;a=Qg(a,b);var d=null,e=null,f=0,g=!1,h=!1;null!=c&&(null!=c.lower&&(d=new Y(c.lower)),null!=c.upper&&(e=new Y(c.upper)),g=c.lowerOpen,h=c.upperOpen);Lg(a,function(a){if(null!=a&&(a=a.value,!g||null==d||0!=L(a.key,d.key))){if(null!=e&&(a=L(a.key,e.key),1===a||0===a&&h))return!0;f++}},d);return f}
function kh(a,b){var c=Qg(a,a.c),d=null,e=null,f=0,g=[],h=[],k=!1,m=!1;null!=b&&(null!=b.lower&&(d=new Y(b.lower)),null!=b.upper&&(e=new Y(b.upper)),k=b.lowerOpen,m=b.upperOpen);Lg(c,function(b){if(null!=b&&(b=b.value,!k||null==d||0!=Og(b,d))){if(null!=e){var c=Og(b,e);if(1===c||0===c&&m)return!0}var c=a.f+Nd(b.key),q=a.storage.getItem(c);null!==q&&(a.storage.removeItem(c),f++,10>g.length&&(g.push(b.key),h.push(kg(q))))}},d);if(10>g.length)for(c=0;c<g.length;c++)hh(a,g[c],h[c]);else ih(a);return f}
function mh(a,b,c,d,e,f,g,h,k){function m(c){if(c&&(H++,!(H<g))){var d=c.value;if(e){if(O&&null!=B&&(c=q?Og(d,B):L(d.key,B.key),0==c))return;if(null!=A&&(c=q?Og(d,A):L(d.key,A.key),-1==c||0==c&&I))return k&&(k[0]=void 0,k[1]=void 0),!0}else{if(I&&null!=A&&(c=q?Og(d,A):L(d.key,A.key),0==c))return;if(null!=B&&(c=q?Og(d,B):L(d.key,B.key),1==c||0==c&&O))return k&&(k[0]=void 0,k[1]=void 0),!0}c=d.key;if(!h||!u||null==p||0!=L(p,c)){d=u?d.a:c;if(2==b)n.push(d);else if(1==b)n.push(c);else if(3==b)n.push([c,
d]);else if(4==b){var m=Ng(a,d);n.push(m)}else n.push([c,d,Ng(a,d)]);k&&(k[0]=c,k[1]=d)}p=c;if(t(f)&&n.length>=f)return!0}}var n=[],p,q=!!k&&null!=k[0];c=c||a.c;var u=c!=a.c;c=Qg(a,c);var A=null,B=null;t(g)||(g=0);var H=-1,I=!1,O=!1;null!=d&&(null!=d.lower&&(A=u&&e?new Y(d.lower,"\uffff"):new Y(d.lower)),null!=d.upper&&(B=u&&!e?new Y(d.upper,"\uffff"):new Y(d.upper)),I=!!d.lowerOpen,O=!!d.upperOpen);if(q){e?O=!0:I=!0;d=k[0];var ha=t(k[1])?k[1]:"\uffff";e?B=u?new Y(d,ha):new Y(d):A=u?new Y(d,ha):new Y(d)}e?
Kg(c,m,B):Lg(c,m,A);return n}gh.prototype.na=function(a,b,c,d,e){return mh(this,2,a,b,c,d,e)};gh.prototype.toString=function(){return"ydn.db.con.simple.Store:"+this.g+":"+this.b.getName()};function nh(){this.clear()}l=nh.prototype;l.wb=function(){return this};l.setItem=function(a,b){t(this.a[a])||(this.keys.push(a.toString()),this.length=this.keys.length);this.a[a]=b};l.getItem=function(a){return t(this.a[a])?this.a[a]:null};l.removeItem=function(a){delete this.a[a];Ua(this.keys,a.toString());this.length=this.keys.length};l.length=0;l.key=function(a){a=this.keys[a];return t(a)?this.a[a]:null};l.clear=function(){this.a={};this.keys=[];this.length=0};function oh(a){this.h=a||new nh;this.g={}}function Pg(a,b){var c=V(a.a,b);if(c)a.g[b]||(a.g[b]=new gh(a.f,a.c,c));else throw new td('store name "'+b+'" not found.');return a.g[b]}oh.prototype.S=function(a){var b=this;setTimeout(function(){var c=Rg(b.f),c=b.c.getItem(c),c=new og(c);a(c)},10)};function ph(a,b){this.b=a;this.a=b}ph.prototype.l=function(a,b){var c=this.b;setTimeout(function(){a.call(b,c)},4);var d=this;return function(){d.a("complete",null);d.a=null;d.b=null}};function qh(a,b){this.a=b}z(qh,Ye);l=qh.prototype;l.logger=D("ydn.db.crud.req.SimpleStore");l.Gb=function(a,b,c){this.P(a,!0,!1,null,b,c)};
l.P=function(a,b,c,d,e,f){F(this.logger,R(a)+" "+(b?"put":"add")+"Object"+(c?"":"s "+e.length+" objects"));var g=a.a.l(function(h){var k;if(c)k=Pg(h,d),h=f?f[0]:void 0,h=Ig(k,h,e[0],!b),null!=h?P(a,h):(k=wf(h),k=new Ne(k),P(a,k,!0));else{for(var m=d,n=[],p=!1,q=f||{},u=0;u<e.length;u++){var A;d?A=q[u]:(m=f[u],A=m.id,m=m.s);k&&k.getName()==m||(k=Pg(h,m));A=Ig(k,A,e[u],!b);null!=A?n.push(A):(p=!0,n.push(new Ne))}P(a,n,p)}g();g=null},this)};
l.bb=function(a,b,c){var d=a.a.l(function(e){e=Ng(Pg(e,b),c);P(a,e);d();d=null},this)};function rh(a,b,c,d){var e=b.a.l(function(a){for(var g=[],h=c,k,m=0;m<d.length;m++){var n=d[m];n instanceof We&&(h=n,n=h.id,h=h.s);k&&k.getName()==h||(k=Pg(a,h));n=Ng(k,n);g[m]=n}P(b,g,!1);e();e=null},a)}l.Eb=function(a,b,c){rh(this,a,b,c)};l.Fb=function(a,b){rh(this,a,null,b)};
l.lb=function(a,b,c){var d=R(a)+" removeById "+b+" "+c;F(this.logger,d);var e=this,f=a.a.l(function(g){g=jh(Pg(g,b),c);G(e.logger,"success "+d+(0==g?" [not found]":""));P(a,g);f();f=null},this)};l.Ib=function(a,b){F(this.logger,R(a)+" removeByKeys "+b.length+" keys");var c,d=0,e=a.a.l(function(f){for(var g=0;g<b.length;g++){var h=b[g].s,k=b[g].id;c&&c.getName()==h||(c=Pg(f,h));d+=jh(c,k)}P(a,d);e();e=null},this)};l.vb=function(a,b,c){this.mb(a,b,c)};
l.mb=function(a,b,c){var d=R(a)+" removeByKeyRange "+(c?T(c):"");F(this.logger,d);var e=this,f=a.a.l(function(g){g=kh(Pg(g,b),c);G(e.logger,d+" deleted "+g+" records.");P(a,g);f();f=null},this)};l.Hb=function(a,b,c,d){var e=R(a)+" removeByIndexKeyRange "+(d?T(d):"");F(this.logger,e);var f=a.a.l(function(e){e=Pg(e,b);for(var h=e.na(c,d),k=h.length,m=0;m<k;m++)jh(e,h[m]);P(a,k);f();f=null},this)};
l.Wa=function(a,b){var c=R(a)+" clearByStores";F(this.logger,c);var d=a.a.l(function(e){for(var f=0;f<b.length;f++)Pg(e,b[f]).clear();G(this.logger,"success "+c);P(a,b.length);d();d=null},this)};l.Ya=function(a,b){var c=a.a.l(function(d){for(var e=[],f=0;f<b.length;f++){var g=Pg(d,b[f]);e.push(lh(g))}P(a,e);c();c=null},this)};
l.Fa=function(a,b,c,d){var e=R(a)+" count"+(null!=d?"Index":"")+(null!=c?"KeyRange":"Store");F(this.logger,e);var f=a.a.l(function(g){g=lh(Pg(g,b),d,c);G(this.logger,"success "+e);P(a,g);f();f=null},this)};l.$=function(a,b,c,d,e,f,g,h,k,m){var n=R(a)+" "+c+" "+(e?wf(e):"");F(this.logger,n);var p=a.a.l(function(q){q=mh(Pg(q,c),b,d,e,h,f,g,k,m);G(this.logger,n+" "+q.length+" records found.");P(a,q);p();p=null},this)};function sh(a,b){this.a=b}z(sh,qh);sh.prototype.b=function(a,b,c,d){c=V(this.a,c);return new Hg(a,b,c,d)};function th(a,b,c,d){ee.call(this,a,b,c,d);this.K=null;this.h=this.i=void 0}z(th,ee);l=th.prototype;l.logger=D("ydn.db.core.req.WebsqlCursor");l.T=function(){return this.h};l.Ob=function(a,b,c,d,e){th.B.Ob.call(this,a,b,c,d,e);this.K=x(b)?ge(this.b,b):null};l.Ca=function(){return this.m};function uh(a,b){a.i=void 0;a.h=void 0;a.m=void 0;if(t(b))if(y(b)){var c=Zf(b[a.b.g],a.b.type);a.h=c;if(a.g){var d=ge(a.b,a.O);a.i=Zf(b[a.O],d.type)}else a.i=c;a.m=a.Ia?c:vh(b,a.b)}else a.m=b}
function wh(a,b,c){ge(a.b,a.O);var d=[],e=a.O,f=a.w,g=a.i;if(null!=f){var h=f.lower,k=f.upper,m=f.lowerOpen,n=f.upperOpen;a.reverse?k=null!=k&&-1==L(k,g)?k:g:h=null!=h&&1==L(h,g)?h:g;null!=h&&null!=k?f=Ad(h,k,!!m,!!n):f=null!=h?Ed.lowerBound(h,!!m):Ed.upperBound(k,!!n)}else f=a.reverse?Ed.upperBound(g):Ed.lowerBound(g);e=dg(a.b,d,a.u,e,f,a.reverse,a.unique);c=a.reverse?Ed.upperBound(c,!1):Ed.lowerBound(c,!1);c=dg(a.b,d,a.u,a.b.g,c,a.reverse,a.unique);e.v=e.v?e.v+(" AND "+c.v):c.v;c="SELECT "+e.select+
" FROM "+e.V+(e.v?" WHERE "+e.v:"")+(e.group?" GROUP BY "+e.group:"")+" ORDER BY "+e.X;c+=" LIMIT 1";F(a.logger,a+": continuePrimary:  SQL: "+c+" : "+T(d));a.f.executeSql(c,d,function(c,d){0<d.rows.length?uh(a,d.rows.item(0)):uh(a);b.call(a,a.i,a.h,a.m);b=null},function(c,d){E(a.logger,"get error: "+d.message);he(a,d);uh(a);b.call(a,a.h,a.i,a.m);b=null;return!1})}
function xh(a,b,c,d,e,f){var g=!d;d=[];a.g&&null!=f&&null!=c?c=gg(a.b,a.u,d,a.K.getName(),a.w,c,g,f,a.reverse,a.unique):null!=c?(f=a.K?a.K.getName():null,c=fg(a.b,a.u,d,f,a.w,a.reverse,a.unique,c,g)):(c=cg(a.b,d,a.u,a.g?a.K.f:a.b.g,a.w,a.reverse,a.unique),a.g&&(c+=", "+a.b.f+" ASC"));c+=" LIMIT 1";0<e&&(c+=" OFFSET "+e);F(a.logger,a+": continue:  SQL: "+c+" : "+T(d));a.f.executeSql(c,d,function(c,d){0<d.rows.length?uh(a,d.rows.item(0)):uh(a);b.call(a,a.i,a.h,a.m);b=null},function(c,d){E(a.logger,
"get error: "+d.message);he(a,d);uh(a);b.call(a,a.h,a.i,a.m);b=null;return!1})}l.fb=function(){return!!this.f};l.update=function(a){if(!this.fb())throw new Qe;var b=new C,c=this.T();a=jg(this.b,a,c);var d="REPLACE INTO "+eg(this.b)+" ("+a.Vb.join(", ")+") VALUES ("+a.fc.join(", ")+")";F(this.logger,this+': update "'+d+'" : '+T(a.values));this.f.executeSql(d,a.values,function(){b.callback(c)},function(a,c){b.o(c);return!1});return b};
l.advance=function(a){var b=this.i,c=this.h,d=!0;null==this.i||this.g&&null==this.h||(--a,d=!1);xh(this,function(a,d,g){var h=null!=b&&null!=a&&0==L(b,a);if(this.g){var k=null!=d&&null!=c&&0==L(d,c);if(h&&k)throw new td("current: "+b+";"+c+" next: "+a+";"+d);}else if(h)throw new td("current: "+b+" next: "+a);this.W(a,d,g)},this.i,d,a,this.h)};l.ra=function(a){null!=a?xh(this,this.W,a,!0):this.advance(1)};l.openCursor=function(a,b){xh(this,this.W,a,!1,0,b)};
l.clear=function(){if(!this.fb())throw new Qe;var a=new C,b=this.b.g,b="DELETE FROM "+eg(this.b)+" WHERE "+b+" = ?",c=[this.T()];F(this.logger,this+': clear "'+b+'" : '+T(c));this.f.executeSql(b,c,function(b,c){a.callback(c.rowsAffected)},function(b,c){a.o(c);return!1});return a};l.Sa=function(a){var b=L(a,this.h);if(0==b||1==b&&this.reverse||-1==b&&!this.reverse)throw new Je(this+" to continuePrimaryKey  from "+this.h+" to "+a+" on "+this.Z+" direction is wrong");wh(this,this.W,a)};
l.toString=function(){return"WebSql"+th.B.toString.call(this)};function yh(a,b){this.a=b}z(yh,Ye);l=yh.prototype;l.logger=D("ydn.db.crud.req.WebSql");
function vh(a,b){if(b.sa&&!b.keyPath&&0==b.a.length&&a._default_){var c=a._default_;if(-1==c.indexOf(";base64,"))return kg(c);'"'==c.charAt(0)&&'"'==c.charAt(c.length-1)&&(c=c.substr(1,c.length-2));for(var d=c.split(";base64,"),c=d[0].split(":")[1],d=window.atob(d[1]),e=d.length,f=new Uint8Array(e),g=0;g<e;++g)f[g]=d.charCodeAt(g);return new Blob([f.buffer],{type:c})}c=a._default_?kg(a._default_):{};null!=b.keyPath&&(d=Zf(a[b.keyPath],b.type),null!=d&&Ff(b,c,d));for(d=0;d<b.a.length;d++)e=b.index(d),
f=e.f,"_default_"==f||e.h||e.multiEntry||"DATE"!=e.type&&!b.sa||(f=Zf(a[f],e.type),t(f)&&Yf(e,c,f));return c}
l.P=function(a,b,c,d,e,f){function g(b,d){if(null==e[b])if(F(m.logger,"empty object at "+b+" of "+e.length),p++,p==e.length)G(m.logger,q+" success "+q),P(a,n,u);else{var H=b+2;H<e.length&&g(H,d)}var I;I=t(f)?jg(h,e[b],f[b]):jg(h,e[b]);H=k+eg(h)+" ("+I.Vb.join(", ")+") VALUES ("+I.fc.join(", ")+");";F(m.logger,R(a)+" SQL: "+H+" PARAMS: "+I.values+" REQ: "+b+" of "+e.length);d.executeSql(H,I.values,function(f,q){function H(b,c){var e="ydn.db.me:"+h.getName()+":"+b.getName(),e=k+Ia(e)+" ("+h.f+", "+
b.c+") VALUES (?, ?)",f=[Id(aa,h.type),Id(c,b.type)];F(m.logger,R(a)+" multiEntry "+e+" "+f);d.executeSql(e,f,function(){},function(a,b){E(m.logger,"multiEntry index insert error: "+b.message);return!1})}p++;var aa=t(I.key)?I.key:q.insertId;1>q.rowsAffected&&(u=!0,aa=new Ne(aa+" no-op"));for(var mb=0,Rd=h.a.length;mb<Rd;mb++){var ub=h.index(mb);if(ub.multiEntry)for(var Pb=Kd(e[b],ub.keyPath),Ri=(Pb?Pb.length:0)||0,cf=0;cf<Ri;cf++)H(ub,Pb[cf])}c?P(a,aa):(n[b]=aa,p==e.length?P(a,n,u):(mb=b+2,mb<e.length&&
g(mb,f)))},function(d,f){p++;u=!0;6==f.code?f.name="ConstraintError":E(m.logger,"error: "+f.message+" "+q);if(c)P(a,f,!0);else if(n[b]=f,p==e.length)F(m.logger,"success "+q),P(a,n,u);else{var h=b+2;h<e.length&&g(h,d)}return!1})}b=!b;var h=V(this.a,d),k=b?"INSERT INTO ":"INSERT OR REPLACE INTO ";d=a.a;var m=this,n=[],p=0,q=R(a)+" inserting "+e.length+" objects.",u=!1;if(0<e.length)for(b=0;2>b&&b<e.length;b++)g(b,d);else G(this.logger,"success"),P(a,[])};
l.Gb=function(a,b,c){if(0==c.length)P(a,[]);else{for(var d=[],e=0,f=0,g=this,h=function(h,k){var m=[];F(g.logger,"put "+k.length+" objects to "+h);for(var n=ig(V(g.a,h)),p=n?void 0:[],q=0;q<k.length;q++)m.push(b[k[q]]),n||p.push(c[k[q]].id);n=ue(a);Lb(n,function(b){for(var c=0;c<k.length;c++)d[k[c]]=b[c];e++;e==f&&P(a,d)},function(){e++;e==f&&P(a,d,!0)});g.P(n,!1,!1,h,m,p)},k="",m=[],n=[],p=0;p<c.length;p++){var q=c[p].s,u=c[p].id;q!=k?(f++,0<m.length&&h(k,m),m=[p],n=[u],k=q):(m.push(p),n.push(u))}0<
m.length&&h(k,m)}};l.bb=function(a,b,c){var d=a.a,e=V(this.a,b),f=this;b=e.f;c=[Id(c,e.type)];b="SELECT * FROM "+eg(e)+" WHERE "+b+" = ?";var g=R(a)+" SQL: "+b+" PARAMS: "+c;F(this.logger,g);d.executeSql(b,c,function(b,c){if(0<c.rows.length){var d=c.rows.item(0);null!=d?(d=vh(d,e),P(a,d)):(G(f.logger,"success no result: "+g),P(a,void 0))}else G(f.logger,"success no result: "+g),P(a,void 0)},function(b,c){E(f.logger,"error: "+g+" "+c.message);P(a,c,!0);return!1})};
l.Eb=function(a,b,c){function d(b,e){var p=k.f,q=[Id(c[b],k.type)],u="SELECT * FROM "+eg(k)+" WHERE "+p+" = ?";F(f.logger,"SQL: "+u+" PARAMS: "+q);e.executeSql(u,q,function(e,f){h++;if(0<f.rows.length){var n=f.rows.item(0);null!=n&&(g[b]=vh(n,k))}else g[b]=void 0;h==c.length?P(a,g):(n=b+10,n<c.length&&d(n,e))},function(e,k){h++;E(f.logger,"error: "+u+" "+k.message);if(h==c.length)P(a,g);else{var n=b+10;n<c.length&&d(n,e)}return!1})}var e=a.a,f=this,g=[],h=0,k=V(this.a,b);if(0<c.length)for(b=0;10>
b&&b<c.length;b++)d(b,e);else G(f.logger,"success"),P(a,[])};
l.Fb=function(a,b){function c(d,h){var n=b[d],p=V(e.a,n.s),q=Xe(n),n=p.f,q=[Id(q,p.type)],u="SELECT * FROM "+eg(p)+" WHERE "+n+" = ?";F(e.logger,"SQL: "+u+" PARAMS: "+q);h.executeSql(u,q,function(h,m){g++;if(0<m.rows.length){var n=m.rows.item(0);null!=n&&(f[d]=vh(n,p))}else f[d]=void 0;g==b.length?(F(e.logger,"success "+u),P(a,f)):(n=d+10,n<b.length&&c(n,h))},function(b,c){P(a,c,!0);return!1})}var d=a.a,e=this,f=[],g=0;if(0<b.length)for(var h=0;10>h&&h<b.length;h++)c(h,d);else F(this.logger,"success"),
P(a,[])};
l.Wa=function(a,b){function c(d,g){function h(a){a="ydn.db.me:"+k.getName()+":"+a.getName();a="DELETE FROM  "+Ia(a);F(e.logger,"SQL: "+a);g.executeSql(a,[])}var k=V(e.a,b[d]),m="DELETE FROM  "+eg(k);F(e.logger,"SQL: "+m+" PARAMS: []");g.executeSql(m,[],function(g){d==b.length-1?(F(e.logger,"success "+m),P(a,b.length)):c(d+1,g)},function(b,c){P(a,c,!0);return!1});for(var n=0,p=k.a.length;n<p;n++){var q=k.index(n);q.multiEntry&&h(q)}}var d=a.a,e=this;0<b.length?c(0,d):(F(this.logger,"success"),P(a,
0))};
l.Ib=function(a,b){function c(h){if(h>=b.length)P(a,f,g);else{var k=V(e.a,b[h].s),m=Id(b[h].id,k.type),n=" WHERE "+k.f+" = ?",p="DELETE FROM "+eg(k)+n,q=R(a)+" SQL: "+p+" PARAMS: "+[m];d.executeSql(p,[m],function(){f++;c(h)},function(a,b){E(e.logger,"error: "+q+b.message);g=!0;c(h);return!1});h++;for(var p=function(b){b="ydn.db.me:"+k.getName()+":"+b.getName();b="DELETE FROM  "+Ia(b)+n;F(e.logger,R(a)+NaN+b);d.executeSql(b,[m])},u=0,A=k.a.length;u<A;u++){var B=k.index(u);B.multiEntry&&p(B)}}}var d=
a.a,e=this,f=0,g=!1;F(this.logger,R(a)+" removeByKeys: "+b.length+" keys");c(0)};
l.lb=function(a,b,c){function d(b){b="ydn.db.me:"+f.getName()+":"+b.getName();b="DELETE FROM  "+Ia(b)+k;F(h.logger,R(a)+NaN+b);e.executeSql(b,[g])}var e=a.a,f=V(this.a,b),g=Id(c,f.type),h=this,k=" WHERE "+f.f+" = ?";b="DELETE FROM "+eg(f)+k;F(this.logger,R(a)+" SQL: "+b+" PARAMS: "+[g]);e.executeSql(b,[g],function(b,c){P(a,c.rowsAffected)},function(b,c){P(a,c,!0);return!1});b=0;for(c=f.a.length;b<c;b++){var m=f.index(b);m.multiEntry&&d(m)}};l.vb=function(a,b,c){zh(this,a,b,void 0,c)};
l.mb=function(a,b,c){zh(this,a,b,void 0,c)};l.Hb=function(a,b,c,d){zh(this,a,b,c,d)};
function zh(a,b,c,d,e){function f(c){c="ydn.db.me:"+h.getName()+":"+c.getName();c="DELETE FROM  "+Ia(c)+n;F(a.logger,R(b)+NaN+c);g.executeSql(c,m)}var g=b.a,h=V(a.a,c);c="DELETE FROM "+eg(h);var k=[],m=[],n="";null!=e&&(t(d)?(d=ge(h,d),Hd(d.c,d.type,e,m,k)):Hd(h.f,h.type,e,m,k),n=" WHERE "+m.join(" AND "));c+=n;var p=R(b)+" SQL: "+c+" PARAMS: "+k;F(a.logger,p);g.executeSql(c,k,function(c,d){F(a.logger,"success "+p);P(b,d.rowsAffected)},function(c,d){E(a.logger,"error: "+p+d.message);P(b,d,!0);return!1});
e=0;for(d=h.a.length;e<d;e++)c=h.index(e),c.multiEntry&&f(c)}l.Ya=function(a,b){function c(g){var h="SELECT COUNT(*) FROM "+Ia(b[g]);F(e.logger,"SQL: "+h+" PARAMS: []");d.executeSql(h,[],function(d,e){var h=e.rows.item(0);f[g]=parseInt(h["COUNT(*)"],10);g++;g==b.length?P(a,f):c(g)},function(b,c){P(a,c,!0);return!1})}var d=a.a,e=this,f=[];0==b.length?(F(this.logger,"success"),P(a,0)):c(0)};
l.Fa=function(a,b,c,d,e){var f=[];b=cg(V(this.a,b),f,6,d,c,!1,e);F(this.logger,R(a)+" SQL: "+b+" PARAMS: "+f);a.a.executeSql(b,f,function(b,c){var d=c.rows.item(0);P(a,rg(d))},function(b,c){P(a,c,!0);return!1})};
l.$=function(a,b,c,d,e,f,g,h,k,m){var n=this,p=[],q=V(this.a,c),u=q.g,A=q.type,B=A,H=null!=d&&d!==u?ge(q,d):null,I=d||u;H&&(B=H.type);c=[];if(m&&t(m[0])){var O=m[0];H&&t(m[1])?(d=m[1],e=gg(q,b,c,H.getName(),e,O,!0,d,h,k)):e=fg(q,b,c,d,e,h,k,O,!0)}else e=cg(q,c,b,I,e,h,k);ea(f)&&(e+=" LIMIT "+f);ea(g)&&(e+=" OFFSET "+g);var ha=a+" SQL: "+e+" ;params= "+T(c);F(this.logger,ha);a.a.executeSql(e,c,function(c,d){for(var e=d.rows.length,f,g=0;g<e;g++)f=d.rows.item(g),2==b?p[g]=Zf(f[u],A):1==b?p[g]=Zf(f[I],
B):3==b?p[g]=[Zf(f[I],B),Zf(f[u],A)]:null!=f&&(p[g]=vh(f,q));G(n.logger,"success "+a);m&&f&&(m[0]=Zf(f[I],B),m[1]=Zf(f[u],A));P(a,p)},function(b,c){E(n.logger,"error: "+ha+c.message);P(a,c,!0);return!1})};function Ah(a,b){this.a=b}z(Ah,yh);Ah.prototype.logger=D("ydn.db.core.req.WebSql");Ah.prototype.b=function(a,b,c,d){c=V(this.a,c);return new th(a,b,c,d)};Cg.prototype.u=function(){var a=this.Ba();if("indexeddb"==a)return new Fg(0,this.a);if("websql"==a||"sqlite"==a)return new Ah(0,this.a);if("memory"==a||"localstorage"==a||"userdata"==a||"sessionstorage"==a)return new sh(0,this.a);throw new td("No executor for "+a);};function Bh(a){if(!x(a))throw new Be;this.M=a;this.f=M;this.a=[];Ch(this,a);this.Oa=""}l=Bh.prototype;l.M="";l.$b=NaN;l.ac=NaN;l.Kb=!1;l.Oa="";
function Ch(a,b){var c=b.split(/\sFROM\s/i);if(2==c.length){var d=c[1],c=c[0].match(/\s*?(SELECT|INSERT|UPDATE|DELETE)\s+(.*)/i);if(3==c.length){a.g=c[1].toUpperCase();if("SELECT"==a.g)a.f=Zd;else if("INSERT"==a.g)a.f=M;else if("UPDATE"==a.g)a.f=M;else if("DELETE"==a.g)a.f=M;else return;var c=c[2].trim(),e=c.match(/^(MIN|MAX|COUNT|AVG|SUM)/i);e?(a.c=e[0].toUpperCase(),c=c.replace(/^(MIN|MAX|COUNT|AVG|SUM)/i,"").trim()):a.c=void 0;"("==c.charAt(0)&&(")"==c.charAt(c.length-1)?c=c.substring(1,c.length-
1):new Ue("missing closing parentheses"));a.m=c;c=d.search(/(ORDER BY|LIMIT|OFFSET)/i);0<c?(a.b=d.substring(c),d=d.substring(0,c)):a.b="";c=d.search(/WHERE/i);0<c?(a.h=d.substring(c+6).trim(),d=d.substring(0,c)):a.h="";a.a=d.trim().split(",").map(function(a){a=Fa(a,'"');a=Fa(a,"'");return a.trim()})}}}
function Dh(a,b){if(b){for(var c=0;c<b.length;c++)a.M=a.M.replace("?",b[c]);Ch(a,a.M)}a.i=Eh(a);if(!a.i)return a.Oa;var c=a.b.length,d=/OFFSET\s+(\d+)/i.exec(a.b);d&&(a.ac=parseInt(d[1],10),c=a.b.search(/OFFSET/i));if(d=/LIMIT\s+(\d+)/i.exec(a.b))a.$b=parseInt(d[1],10),d=a.b.search(/LIMIT/i),d<c&&(c=d);(c=/ORDER BY\s+(.+)/i.exec(a.b.substr(0,c)))?(c=c[1].trim(),(d=c.match(/(ASC|DESC)/i))?(a.Kb="DESC"==d[0].toUpperCase(),c=c.replace(/\s+(ASC|DESC)/i,"")):a.Kb=!1,a.j=Fa(Fa(c,'"'),"'")):a.j=void 0;return""}
function Fh(a){if("*"==a.m)return null;a=a.m.split(",");return a=a.map(function(a){return Fa(a.trim(),'"')})}l.toJSON=function(){return{sql:this.M}};
function Eh(a){function b(a){return Sa(c,function(b){return b.ma==a})}var c=[],d=/(.+?)(<=|>=|=|>|<)(.+)/i;if(0<a.h.length)for(var e=a.h.split("AND"),f=0;f<e.length;f++){var g=e[f],h=d.exec(g);if(h){var k=h[1].trim(),k=Fa(k,'"'),k=Fa(k,"'");if(0<k.length){var m=h[3].trim();0==m.lastIndexOf('"',0)?m=Fa(m,'"'):0==m.lastIndexOf("'",0)?m=Fa(m,"'"):m=parseFloat(m);h=new Xd(k,h[2],m);k=b(k);if(0<=k){if(c[k]=c[k].ka(h),!c[k])return a.Oa='where clause "'+g+'" conflict',null}else c.push(h)}else return a.Oa=
'Invalid clause "'+g+'"',null}else return a.Oa='Invalid clause "'+g+'"',null}return c}l.toString=function(){return"query:"+this.M};function Gh(a,b){this.a=b;this.c=a}Gh.prototype.logger=D("ydn.db.sql.req.nosql.Node");Gh.prototype.toJSON=function(){return{sql:this.a}};Gh.prototype.toString=function(){return"idb.Node:"};
Gh.prototype.b=function(a,b){var c=Va(this.a.a)[0],d=this.a.i,e=this.a.$b,e=isNaN(e)?100:e,f=this.a.ac,f=isNaN(f)?0:f,g=this.a.j,h=Fh(this.a),k=null,m=this.a.Kb;if(0==d.length)k=null;else if(1==d.length)k=yd(d[0].a);else throw new qd("too many conditions.");null===h||xe(a,function(a,b,c){var d=a;b||(d=a.map(function(a){var b=h.length;if(1==b)return Kd(a,h[0]);for(var c={},d=0;d<b;d++)c[h[d]]=Kd(a,h[d]);return c}));c(d,b)});var d=0<d.length?d[0].ma:void 0,n=R(a)+" executing on"+c;d&&(n+=":"+d);n+=
" "+Gd(k);G(this.logger,n);g&&g!=this.c.keyPath?b.$(a,4,c,g,k,e,f,m,!1):t(d)&&d!=this.c.keyPath?b.$(a,4,c,d,k,e,f,m,!1):b.$(a,4,c,null,k,e,f,m,!1)};function Hh(a,b){Gh.call(this,a,b)}z(Hh,Gh);
Hh.prototype.b=function(a,b){var c,d=Va(this.a.a)[0],e=this.a.i,f=null;if(0==e.length)f=null;else if(1==e.length)f=yd(e[0].a);else throw new qd("too many conditions.");var g=this.a.c,e=0<e.length?e[0].ma:void 0,h=R(a)+" executing "+g+" on "+d;e&&(h+=":"+e);h+=" "+Gd(f);G(this.logger,h);if("COUNT"==g)f?b.Fa(a,d,f,e,!1):b.Fa(a,d,null,void 0,!1);else{var k,h=Fh(this.a);if(!h||0==h.length)throw new Je("field name require for reduce operation: "+g);h=h[0];if("MIN"==g)k=Ih(h);else if("MAX"==g)k=Jh(h);else if("AVG"==
g)c=0,k=Kh(h);else if("SUM"==g)c=0,k=Lh(h);else throw new qg(g);var m;t(e)?m=new re(d,e,f):m=new qe(d,f);var d=b.b(a.a,R(a),d,4),n=m.load([d]);n.Y=function(b){P(a,b,!0)};var p=0;n.G=function(b){null!=b?(b=m.f?n.T():n.Ca(),c=k(b,c,p),n.advance(1),p++):P(a,c)}}};function Kh(a){return function(b,c,d){t(c)||(c=0);return(c*d+b[a])/(d+1)}}function Lh(a){return function(b,c){return c+b[a]}}function Ih(a){return function(b,c){var d=b[a];return t(c)?c<d?c:d:d}}
function Jh(a){return function(b,c){var d=b[a];return t(c)?c>d?c:d:d}};function Mh(a,b){this.a=b}z(Mh,Fg);Mh.prototype.logger=D("ydn.db.sql.req.IndexedDb");Mh.prototype.executeSql=function(a,b,c){if(c=Dh(b,c))throw new Ue(c);c=Va(b.a);if(1==c.length){var d=V(this.a,c[0]);if(!d)throw new Re(c[0]);var e=Fh(b);if(e)for(var f=0;f<e.length;f++)if(!zf(d,e[f]))throw new Re('Index "'+e[f]+'" not found in '+c[0]);var g;b.c?g=new Hh(d,b):g=new Gh(d,b);g.b(a,this)}else throw new qg(b.M);};function Nh(a,b){this.b=b;this.f=a;this.a=Fh(b)}Nh.prototype.logger=D("ydn.db.sql.req.websql.Node");Nh.prototype.toJSON=function(){return{sql:this.b.M}};Nh.prototype.toString=function(){return"websql.Node:"};function Oh(a,b){if(a.a){if(1==a.a.length){if(y(b))return db(b,a.a[0]);return}for(var c={},d=0;d<a.a.length;d++)c[a.a[d]]=db(b,a.a[d]);return c}return vh(b,a.f)}
Nh.prototype.c=function(a,b,c){var d=this,e=[];b.executeSql(this.b.M,c,function(b,c){for(var h=c.rows.length,k=0;k<h;k++){var m=c.rows.item(k);if(y(m))var n=Oh(d,m);e.push(n)}a(e)},function(b,c){E(d.logger,"Sqlite error: "+c.message);a(c,!0);return!0})};function Ph(a,b){Nh.call(this,a,b)}z(Ph,Nh);Ph.prototype.c=function(a,b,c){var d=this;b.executeSql(this.b.M,c,function(b,c){var d=c.rows.length;if(1==d)d=rg(c.rows.item(0)),a(d);else if(0==d)a(void 0);else throw new Pe;},function(b,c){E(d.logger,"Sqlite error: "+c.message);a(c,!0);return!0})};function Qh(a,b){this.a=b}z(Qh,Ah);Qh.prototype.logger=D("ydn.db.sql.req.WebSql");Qh.prototype.executeSql=function(a,b,c){var d=Va(b.a);if(1==d.length){var e=V(this.a,d[0]);if(!e)throw new Re(d[0]);var f=Fh(b);if(f)for(var g=0;g<f.length;g++)if(!zf(e,f[g]))throw new Re('Index "'+f[g]+'" not found in '+d[0]);var h;b.c?h=new Ph(e,b):h=new Nh(e,b);h.c(function(b,c){P(a,b,c)},a.a,c)}else throw new qg(b.M);};function Rh(a,b){this.a=b}z(Rh,sh);Rh.prototype.logger=D("ydn.db.sql.req.SimpleStore");Rh.prototype.executeSql=function(a,b,c){if(c=Dh(b,c))throw new Ue(c);c=Va(b.a);if(1==c.length){var d=V(this.a,c[0]);if(!d)throw new Re(c[0]);var e=Fh(b);if(e)for(var f=0;f<e.length;f++)if(!zf(d,e[f]))throw new J('Index "'+e[f]+'" not found in '+c[0]);var g;b.c?g=new Hh(d,b):g=new Gh(d,b);g.b(a,this)}else throw new qd(b.M);};function Sh(a,b,c){mf.call(this,a,b,c)}z(Sh,If);Sh.prototype.executeSql=function(a,b){for(var c=new Bh(a),d=Va(c.a),e=0;e<d.length;e++){var f=V(this.b,d[e]);if(!f)throw new J("store: "+f+" not exists.");}G(this.logger,"executeSql: "+a+" params: "+b);var g=this.a.request("sql",Va(c.a),c.f);Q(g,function(){U(this).executeSql(g,c,b||[])},this);return g};function Th(a,b,c){X.call(this,a,b,c)}z(Th,Cg);Th.prototype.va=function(a){return new Sh(this,this.a,a)};Th.prototype.executeSql=function(a,b){return this.c.executeSql(a,b)};Th.prototype.u=function(){var a=this.Ba();if("indexeddb"==a)return new Mh(0,this.a);if("websql"==a||"sqlite"==a)return new Qh(0,this.a);if("memory"==a||"localstorage"==a||"sessionstorage"==a)return new Rh(0,this.a);throw new td("No executor for "+a);};function Uh(a,b){t(a)&&5242880<a&&md(this.logger,$c,"storage size request ignored, use Quota Management API instead");this.A=null;this.La=b||NaN}l=Uh.prototype;
l.connect=function(a,b){function c(a,c,d){G(e.logger,(d?"changing":"upgrading")+" version to "+a.version+" from "+g);for(d=0;d<b.stores.length;d++)Vh(e,a,c,b.stores[d]);c=a.objectStoreNames;var f=c.length;for(d=0;d<f;d++)vf(b,c[d])||(a.deleteObjectStore(c[d]),G(e.logger,"store: "+c[d]+" deleted."))}function d(a,b){f.c?E(e.logger,"database already set."):t(b)?(E(e.logger,b?b.message:"Error received."),e.A=null,f.o(b)):(e.A=a,e.A.onabort=function(a){F(e.logger,e+": abort");e.Ra(a.target.error)},e.A.onerror=
function(a){F(e.logger,e+": error");e.Ra(a.target.error)},e.A.onversionchange=function(a){F(e.logger,e+" closing connection for onversionchange to: "+a.version);if(e.A&&(e.A.onabort=null,e.A.onblocked=null,e.A.onerror=null,e.A.onversionchange=null,e.jb(a),!a.defaultPrevented)){e.A.close();e.A=null;var b=Error();b.name=a.type;e.qb(b)}},f.callback(parseFloat(g)))}var e=this,f=new C,g=void 0,h=b.version;md(this.logger,dd,"Opening database: "+a+" ver: "+(b.b?"auto":h));var k;k=t(h)?ae.open(a,h):ae.open(a);
k.onsuccess=function(f){var h=f.target.result;t(g)||(g=h.version);md(e.logger,dd,"Database: "+h.name+", ver: "+h.version+" opened.");if(b.b)e.S(function(f){if(b instanceof rf)for(var g=0;g<f.stores.length;g++)vf(b,f.stores[g].getName())||sf(b,f.stores[g].clone());f=pg(b,f,!1,!0);if(0<f.length){md(e.logger,dd,"Schema change require for difference in "+f);var k=ea(h.version)?h.version+1:1;if("IDBOpenDBRequest"in r){h.close();var m=ae.open(a,k);m.onupgradeneeded=function(a){a=a.target.result;md(e.logger,
dd,"re-open for version "+a.version);c(a,m.transaction,!1)};m.onsuccess=function(a){d(a.target.result)};m.onerror=function(){md(e.logger,dd,e+": fail.");d(null)}}else{var p=h.setVersion(k+"");p.a=function(a){E(e.logger,"migrating from "+h.version+" to "+k+" failed.");d(null,a)};p.onsuccess=function(){p.transaction.oncomplete=I;c(h,p.transaction,!0)};var I=function(){var b=ae.open(a);b.onsuccess=function(a){a=a.target.result;md(e.logger,dd,e+": OK.");d(a)};b.onerror=function(){md(e.logger,dd,e+": fail.");
d(null)}};null!=p.transaction&&(p.transaction.oncomplete=I)}}else d(h)},void 0,h);else if(b.version>h.version){var k=h.setVersion(b.version);k.a=function(a){E(e.logger,"migrating from "+h.version+" to "+b.version+" failed.");d(null,a)};k.onsuccess=function(){c(h,k.transaction,!0)}}else b.version==h.version?md(e.logger,dd,"database version "+h.version+" ready to go"):E(e.logger,"connected database version "+h.version+" is higher than requested version."),e.S(function(a){a=pg(b,a,!1,!0);0<a.length?
(md(e.logger,dd,a),d(null,new uf("different schema: "+a))):d(h)},void 0,h)};k.onupgradeneeded=function(a){a=a.target.result;g=NaN;md(this.logger,dd,"upgrade needed for version "+a.version);c(a,k.transaction,!1)};k.onerror=function(c){nd(e.logger,'open request to database "'+a+'" '+(t(b.version)?" with version "+b.version:"")+" cause error of "+k.error.name);d(null,c)};k.onblocked=function(c){nd(e.logger,"database "+a+" "+b.version+" block, close other connections.");d(null,c)};ea(this.La)&&!isNaN(this.La)&&
setTimeout(function(){"done"!=k.readyState&&(nd(e.logger,e+": database state is still "+k.readyState),d(null,new Ve("connection timeout after "+e.La)))},this.La);return f};l.La=18E4;l.qb=function(){};l.Ra=function(){};l.jb=function(){};l.Aa=function(){return"indexeddb"};l.Mb=function(){return this.A||null};l.pb=function(){return!!this.A};l.logger=D("ydn.db.con.IndexedDb");l.A=null;l.ob=function(){return this.A?parseFloat(this.A.version):void 0};
l.S=function(a,b,c){c=c||this.A;if(t(b)){if(null===b){if(0==c.objectStoreNames.length){a(new og(c.version));return}throw new Fe;}c=b.db}else{b=[];for(var d=c.objectStoreNames.length-1;0<=d;d--)b[d]=c.objectStoreNames[d];if(0==b.length){a(new og(c.version));return}b=c.transaction(b,Zd)}for(var e=c.objectStoreNames,f=[],g=e.length,d=0;d<g;d++){for(var h=b.objectStore(e[d]),k=[],m=0,n=h.indexNames.length;m<n;m++){var p=h.index(h.indexNames[m]);k[m]=new Uf(p.keyPath,void 0,p.unique,p.multiEntry,p.name)}f[d]=
new pf(h.name,h.keyPath,h.autoIncrement,void 0,k)}b=new og(c.version,f);a(b)};
function Vh(a,b,c,d){function e(){var a={autoIncrement:!!d.b};null!=d.keyPath&&(a.keyPath=d.keyPath);return b.createObjectStore(d.getName(),a)}md(a.logger,ed,"Creating Object Store for "+d.getName()+" keyPath: "+d.keyPath);if(b.objectStoreNames.contains(d.getName())){c=c.objectStore(d.getName());ag(d.keyPath||"",c.keyPath||"")?(b.deleteObjectStore(d.getName()),md(a.logger,$c,"store: "+d.getName()+" deleted due to keyPath change."),c=e()):da(c.autoIncrement)&&da(d.b)&&c.autoIncrement!=d.b&&(b.deleteObjectStore(d.getName()),
md(a.logger,$c,"store: "+d.getName()+" deleted due to autoIncrement change."),c=e());for(var f=c.indexNames,g=0;g<d.a.length;g++){var h=d.index(g);!f.contains(h.getName())&&h.g&&(c.clear(),md(a.logger,$c,"store: "+d.getName()+" cleared since generator index need re-indexing."))}for(var k=0,m=0,n=0,g=0;g<d.a.length;g++){var h=d.index(g),p=!1;if(f.contains(h.getName())){var q=c.index(h.getName()),u=null!=q.unique&&null!=h.unique&&q.unique!=h.unique,A=null!=q.multiEntry&&null!=h.multiEntry&&q.multiEntry!=
h.multiEntry,q=null!=q.keyPath&&null!=h.keyPath&&!!ag(q.keyPath,h.keyPath);if(u||A||q)c.deleteIndex(h.getName()),p=!0,k--,n++}else"BLOB"!=h.type&&(p=!0);p&&(h.unique||h.multiEntry?(p={unique:h.unique,multiEntry:h.multiEntry},c.createIndex(h.getName(),h.keyPath,p)):c.createIndex(h.getName(),h.keyPath),k++)}for(g=0;g<f.length;g++)zf(d,f[g])||(c.deleteIndex(f[g]),m++);md(a.logger,ed,"Updated store: "+c.name+", "+k+" index created, "+m+" index deleted, "+n+" modified.")}else{c=e();for(g=0;g<d.a.length;g++)h=
d.index(g),"BLOB"==h.type?md(a.logger,ad,"Index "+h+" of blob data type ignored."):(F(a.logger,"Creating index: "+h+" for "+d.getName()),h.unique||h.multiEntry?(p={unique:h.unique,multiEntry:h.multiEntry},c.createIndex(h.getName(),h.keyPath,p)):c.createIndex(h.getName(),h.keyPath));G(a.logger,"Created store: "+c)}}
l.$a=function(a,b,c,d){var e=this.A;if(!b){b=[];for(var f=e.objectStoreNames.length-1;0<=f;f--)b[f]=e.objectStoreNames[f]}0==b.length?a(null):(b=e.transaction(b,c),b.oncomplete=function(a){d("complete",a)},b.onabort=function(a){d("abort",a)},a(b),a=null)};l.close=function(){md(this.logger,ed,this+" closing connection");this.A.close()};l.toString=function(){return"IndexedDB:"+(this.A?this.A.name+":"+this.A.version:"")};
ze.push(function(a,b){if(!ae||b&&"indexeddb"!=b)return null;var c=ae.deleteDatabase(a),d=new se("IDBVersionChangeEvent ");c.onblocked=function(a){vd(d,a)};c.onerror=function(a){d.o(a)};c.onsuccess=function(a){d.callback(a)};return d});function Wh(a){oh.call(this,a);this.b=NaN}z(Wh,oh);l=Wh.prototype;l.logger=D("ydn.db.con.SimpleStorage");l.ob=function(){return this.b};
l.connect=function(a,b){function c(a,b){setTimeout(function(){b?(G(d.logger,d+" opening fail"),e.o(b)):(G(d.logger,d+" version "+d.ob()+" open"),e.callback(a))},10)}var d=this,e=new C;this.c=this.h.wb(a);this.f=a;this.a=b;var f=Rg(this.f);this.b=NaN;var g=kg(this.c.getItem(f));t(g.version)&&!ea(g.version)&&(g.version=NaN);if(g)if(g=new og(g),pg(this.a,g,!1,!1))if(!this.a.b&&!isNaN(g.version)&&this.a.version>g.version)c(NaN,new Oe("existing version "+g.version+" is larger than "+this.a.version));else{var h=
this.a.version;this.b=t(h)?h:g.version+1;for(h=0;h<this.a.count();h++)var k=this.a.stores[h]||null;if(this.a instanceof rf)for(h=0;h<g.count();h++)k=g.stores[h]||null,sf(this.a,k);h=this.a.toJSON();h.version=this.b||NaN;this.c.setItem(f,T(h));c(g.version||NaN)}else{for(h=0;h<this.a.count();h++)k=this.a.stores[h]||null;this.b=g.version||NaN;c(this.b)}else g=b.toJSON(),this.b=1,g.version=this.b,this.c.setItem(f,T(g)),c(NaN);return e};l.pb=function(){return!!this.f};l.Mb=function(){return this.c||null};
l.qb=function(){};l.Ra=function(){};l.jb=function(){};l.Aa=function(){return"memory"};l.close=function(){};l.$a=function(a,b,c,d){a(new ph(this,function(a,b){d(a,b)}))};l.toString=function(){return"SimpleStorage:"+this.Aa()+":"+(this.f+":"+this.b)};function Xh(){Wh.call(this,this)}z(Xh,Wh);Xh.prototype.wb=function(){return window.localStorage};Xh.prototype.Aa=function(){return"localstorage"};ze.push(function(a,b){if(!b||"localstorage"==b){var c=new Xh,d=new rf;c.connect(a,d);c.S(function(a){for(var b=0;b<a.stores.length;b++)Pg(c,a.stores[b].getName()).clear()})}});function Yh(){Wh.call(this,this)}z(Yh,Wh);Yh.prototype.wb=function(){return window.sessionStorage};Yh.prototype.Aa=function(){return"sessionstorage"};
ze.push(function(a,b){if(!b||"sessionstorage"==b){var c=new Yh,d=new rf;c.connect(a,d);c.S(function(a){for(var b=0;b<a.stores.length;b++)Pg(c,a.stores[b].getName()).clear()})}});function Zh(a,b){this.a=t(a)?a:4194304;this.b=b||"websql"}l=Zh.prototype;
l.connect=function(a,b){function c(b,c){var f=b.version?parseInt(b.version,10):0,g=c.b?isNaN(f)?1:f+1:c.version;od(e.logger,a+": changing version from "+b.version+" to "+g);var h=!1,k=0;b.changeVersion(b.version,g+"",function(a){e.S(function(b){h=!0;for(var d=0;d<c.count();d++){var f=V(b,(c.stores[d]||null).getName()),f=f?hg(f,c.stores[d]||null):null;$h(e,a,c.stores[d]||null,function(a){a&&k++},f)}for(d=0;d<b.count();d++)f=b.stores[d]||null,vf(c,f.getName())||(c instanceof rf?sf(c,f):(f="DROP TABLE "+
eg(f),G(e.logger,f),a.executeSql(f,[],function(){},function(a,b){throw b;})))},a,b)},function(c){nd(e.logger,"SQLError "+c+" "+c.code+"("+c.message+") while changing version from "+b.version+" to "+g+" on "+a);throw c;},function(){if(h){var f=".";k!=c.stores.length&&(f=" but unexpected stores exists.");F(e.logger,a+":"+b.version+" ready"+f);d(b)}else E(e.logger,a+": changing version voided.")})}function d(a,b){t(b)?(e.F=null,g.o(b)):(e.F=a,g.callback(parseFloat(f)))}var e=this,f=NaN,g=new C,h=null;
try{"sqlite"==this.b?r.sqlitePlugin?(h=r.sqlitePlugin.openDatabase(a,"",a,this.a),h.readTransaction||(h.readTransaction=h.transaction),h.changeVersion=function(a,b,c,d,e){h.transaction(c,d,e)}):(E(this.logger,"sqlitePlugin not found."),h=null,this.rb=Error("sqlitePlugin not found.")):h=r.openDatabase(a,"",a,this.a)}catch(k){if("SECURITY_ERR"==k.name)E(this.logger,"SECURITY_ERR for opening "+a),h=null,this.rb=new Te(k);else throw k;}if(h){var f=h.version||"",m="database "+a+(0==f.length?"":" version "+
h.version);null!=b.version&&b.version==h.version?(od(e.logger,"Existing "+m+" opened as requested."),d(h)):this.S(function(a){(a=pg(b,a,!0,!1))?(0==f?od(e.logger,"New "+m+" created."):b.b?od(e.logger,"Existing "+m+" opened and schema change for "+a):od(e.logger,"Existing "+m+" opened and  schema change to version "+b.version+" for "+a),c(h,b)):(od(e.logger,"Existing "+m+" with same schema opened."),d(h))},null,h)}else d(null,this.rb);return g};l.Aa=function(){return this.b};l.rb=null;l.F=null;
l.Mb=function(){return this.F||null};l.logger=D("ydn.db.con.WebSql");l.qb=function(){};l.Ra=function(){};
function ai(a){var b=a.u,c="CREATE TABLE IF NOT EXISTS "+eg(a)+" (",d=a.f,c=c+(d+" "+b+" PRIMARY KEY ");a.b&&(c+=" AUTOINCREMENT ");if(!a.sa||!a.keyPath&&0==a.a.length)c+=" ,_default_ BLOB";for(var e=[],f=[d],g=0,h=a.a.length;g<h;g++){var k=a.index(g),m="";if(k.multiEntry){var m="ydn.db.me:"+a.getName()+":"+k.getName(),n=k.unique?" UNIQUE ":"",k="CREATE TABLE IF NOT EXISTS "+Ia(m)+" ("+d+" "+b+", "+k.c+" "+k.i+n+")";e.push(k)}else k.unique&&(m=" UNIQUE "),n=k.c,-1==f.indexOf(n)&&(c+=", "+n+" "+k.i+
m,f.push(n))}e.unshift(c+")");return e}l.ob=function(){return this.F?parseFloat(this.F.version):void 0};
l.S=function(a,b,c){function d(a,b){throw b;}function e(b,c){if(c&&c.rows){for(var d=0;d<c.rows.length;d++){var e=c.rows.item(d);if("__WebKitDatabaseInfoTable__"!=e.name&&"sqlite_sequence"!=e.name&&"table"==e.type){var q="sql"in e?e.sql:void 0;F(f.logger,"Parsing table schema from SQL: "+q);for(var u=q.substr(q.indexOf("("),q.lastIndexOf(")")).match(/(?:"[^"]*"|[^,])+/g),A=void 0,B,q=[],H=!1,I=!1,O=0;O<u.length;O++){var ha=u[O].match(/\w+|"[^"]+"/g),sa=Pa(ha,function(a){return a.toUpperCase()}),aa=
Fa(ha[0],'"'),ha=Vf(sa[1]);if(-1!=sa.indexOf("PRIMARY")&&-1!=sa.indexOf("KEY")){B=ha;if(x(aa)&&!va(aa)&&"_ROWID_"!=aa){var mb=aa.split(","),A=aa;1<mb.length&&(A=mb,B=void 0)}-1!=sa.indexOf("AUTOINCREMENT")&&(H=!0)}else if("_ROWID_"!=aa)if("_default_"==aa)I=!0;else{var Rd="UNIQUE"==sa[2];0==aa.lastIndexOf(e.tbl_name+"-",0)&&(aa=aa.substr(e.tbl_name.length+1));sa=new Uf(aa,ha,Rd);q.push(sa)}}if(0==e.name.lastIndexOf("ydn.db.me:",0)){var ub=e.name.split(":");if(3<=ub.length){var Pb=ub[1],A=new Uf(ub[2],
ha,Rd,!0),u=Sa(q,function(a){return a.getName()==ub[2]});0<=u?q[u]=A:q.push(A);u=Sa(h,function(a){return a.getName()===Pb});0<=u?(O=h[u],h[u]=new pf(O.getName(),O.keyPath,H,B,q,void 0,!I)):h.push(new pf(Pb,void 0,!1,void 0,[A]));F(f.logger,'multi entry index "'+A.getName()+'" found in '+Pb+(-1==u?"*":""))}else E(f.logger,'Invalid multiEntry store name "'+e.name+'"')}else O=Sa(h,function(a){return a.getName()===e.name}),0<=O?(u=h[O].index(0),q.push(u),h[O]=new pf(e.name,A,H,B,q,void 0,!I)):(q=new pf(e.name,
A,H,B,q,void 0,!I),h.push(q))}}d=new og(g,h);a(d)}}var f=this,g=(c=c||this.F)&&c.version?parseFloat(c.version):void 0,g=isNaN(g)?void 0:g,h=[];b?b.executeSql("SELECT * FROM sqlite_master",[],e,d):c.readTransaction(function(b){f.S(a,b,c)},function(a){nd(f.logger,"opening tx: "+a.message);throw a;},e)};
function $h(a,b,c,d,e){function f(a){b.executeSql(a,[],function(){g++;g==h.length&&(d(!0),d=null)},function(b,e){g++;g==h.length&&(d(!1),d=null);var f="SQLError creating table: "+c.getName()+" "+e.message+' for executing "'+a;throw new Se(e,f);})}var g=0,h=ai(c),k="Create";if(e){e=qf(c,e);if(0==e.length){F(a.logger,"same table "+c.getName()+" exists.");d(!0);d=null;return}k="Modify";E(a.logger,"table: "+c.getName()+" has changed by "+e+" ALTER TABLE cannot run in WebSql, dropping old table.");h.unshift("DROP TABLE IF EXISTS "+
Ia(c.getName()))}F(a.logger,k+" table: "+c.getName()+": "+h.join(";"));for(a=0;a<h.length;a++)f(h[a])}l.pb=function(){return!!this.F};l.close=function(){this.F=null};
l.$a=function(a,b,c,d){function e(a){F(h.logger,h+": Tx "+c+" request cause error.");d("abort",a)}function f(){d("complete",{type:"complete"})}function g(b){a(b)}var h=this;null===this.F&&(a(null),d("abort",this.rb));c==Zd?this.F.readTransaction(g,e,f):c==$d?this.F.changeVersion(this.F.version,this.F.version+1+"",g,e,f):this.F.transaction(g,e,f)};
ze.push(function(a,b){if(fa(r.openDatabase)&&(!b||"websql"==b)){var c=new Zh,d=new rf;G(c.logger,"deleting websql database: "+a);var d=c.connect(a,d),e=function(){var b=c.logger;b&&b.log(ad,"all tables in "+a+" deleted.",void 0)};d.H(function(){c.$a(function(b){b.executeSql('SELECT * FROM sqlite_master WHERE type = "table"',[],function(d,e){if(e&&e.rows){for(var k=e.rows.length,m=0,n=0;n<k;n++){var p=e.rows.item(n);"__WebKitDatabaseInfoTable__"!=p.name&&"sqlite_sequence"!=p.name&&(m++,F(c.logger,
"deleting table: "+p.name),b.executeSql("DROP TABLE "+p.name))}G(c.logger,m+' tables deleted from "'+a+'"')}},function(a,b){throw b;})},[],M,e)});d.Sb(function(){E(c.logger,"Connecting "+a+" failed.")})}});Zh.prototype.jb=function(){};Zh.prototype.toString=function(){return"WebSql:"+(this.F?":"+this.F.version:"")};Ag.prototype.xb=function(a){return"indexeddb"==a&&ae?new Uh(this.j,this.K):"sqlite"==a&&r.sqlitePlugin?new Zh(this.j,"sqlite"):"websql"==a&&fa(r.openDatabase)?new Zh(this.j):"localstorage"==a&&window.localStorage?new Xh:"sessionstorage"==a&&window.sessionStorage?new Yh:"memory"==a?new Wh:null};function bi(a,b){be.call(this);this.f=b;this.b=[];if(a>this.f)throw Error("[goog.structs.SimplePool] Initial cannot be greater than max");for(var c=0;c<a;c++)this.b.push(this.a())}z(bi,be);bi.prototype.a=function(){return{}};bi.prototype.c=function(a){if(y(a))if(fa(a.Wb))a.Wb();else for(var b in a)delete a[b]};bi.prototype.fa=function(){bi.B.fa.call(this);for(var a=this.b;a.length;)this.c(a.pop());delete this.b};function ci(){this.a=[];this.c=new Dc;this.f=new Dc;this.h=1;this.g=new bi(0,4E3);this.g.a=function(){return new di};this.i=new bi(0,50);this.i.a=function(){return new ei};var a=this;this.b=new bi(0,2E3);this.b.a=function(){return String(a.h++)};this.b.c=function(){}}D("goog.debug.Trace");function ei(){this.time=this.count=0}ei.prototype.toString=function(){var a=[];a.push(this.type," ",this.count," (",Math.round(10*this.time)/10," ms)");return a.join("")};function di(){}
function fi(a,b,c){var d=[];-1==b?d.push("    "):d.push(gi(a.b-b));d.push(" ",hi(a.b-0));0==a.a?d.push(" Start        "):1==a.a?(d.push(" Done "),d.push(gi(a.g-a.startTime)," ms ")):d.push(" Comment      ");d.push(c,a);0<a.f&&d.push("[VarAlloc ",a.f,"] ");return d.join("")}di.prototype.toString=function(){return null==this.type?this.c:"["+this.type+"] "+this.c};
ci.prototype.toString=function(){for(var a=[],b=-1,c=[],d=0;d<this.a.length;d++){var e=this.a[d];1==e.a&&c.pop();a.push(" ",fi(e,b,c.join("")));b=e.b;a.push("\n");0==e.a&&c.push("|  ")}if(0!=this.c.zb()){var f=na();a.push(" Unstopped timers:\n");Cc(this.c,function(b){a.push("  ",b," (",f-b.startTime," ms, started at ",hi(b.startTime),")\n")})}b=this.f.na();for(d=0;d<b.length;d++)c=this.f.get(b[d]),1<c.count&&a.push(" TOTAL ",c,"\n");a.push("Total tracers created ",0,"\n","Total comments created ",
0,"\n","Overhead start: ",0," ms\n","Overhead end: ",0," ms\n","Overhead comment: ",0," ms\n");return a.join("")};function gi(a){a=Math.round(a);var b="";1E3>a&&(b=" ");100>a&&(b="  ");10>a&&(b="   ");return b+a}function hi(a){a=Math.round(a);return String(100+a/1E3%60).substring(1,3)+"."+String(1E3+a%1E3).substring(1,4)}new ci;var ii=!Gc||Gc&&9<=Pc,ji=Gc&&!Nc("9");!Ic||Nc("528");Hc&&Nc("1.9b")||Gc&&Nc("8")||Fc&&Nc("9.5")||Ic&&Nc("528");Hc&&!Nc("8")||Gc&&Nc("9");function ki(a){ki[" "](a);return a}ki[" "]=function(){};function li(a,b){Mf.call(this,a?a.type:"");this.b=this.target=null;this.clientY=this.clientX=this.Cb=this.Bb=0;this.a=this.state=null;if(a){this.a=a;this.type=a.type;this.target=a.target||a.srcElement;this.b=b;var c=a.relatedTarget;if(c&&Hc)try{ki(c.nodeName)}catch(d){}Object.defineProperties?Object.defineProperties(this,{Bb:{configurable:!0,enumerable:!0,get:this.Xb,set:this.vc},Cb:{configurable:!0,enumerable:!0,get:this.Yb,set:this.wc}}):(this.Bb=this.Xb(),this.Cb=this.Yb());this.clientX=void 0!==
a.clientX?a.clientX:a.pageX;this.clientY=void 0!==a.clientY?a.clientY:a.pageY;this.state=a.state;a.defaultPrevented&&this.preventDefault()}}z(li,Mf);l=li.prototype;l.preventDefault=function(){li.B.preventDefault.call(this);var a=this.a;if(a.preventDefault)a.preventDefault();else if(a.returnValue=!1,ji)try{if(a.ctrlKey||112<=a.keyCode&&123>=a.keyCode)a.keyCode=-1}catch(b){}};l.Xb=function(){return Ic||void 0!==this.a.offsetX?this.a.offsetX:this.a.layerX};
l.vc=function(a){Object.defineProperties(this,{Bb:{writable:!0,enumerable:!0,configurable:!0,value:a}})};l.Yb=function(){return Ic||void 0!==this.a.offsetY?this.a.offsetY:this.a.layerY};l.wc=function(a){Object.defineProperties(this,{Cb:{writable:!0,enumerable:!0,configurable:!0,value:a}})};var mi="closure_listenable_"+(1E6*Math.random()|0),ni=0;function oi(a,b,c,d,e){this.listener=a;this.a=null;this.src=b;this.type=c;this.Va=!!d;this.eb=e;this.key=++ni;this.xa=this.Ua=!1}function pi(a){a.xa=!0;a.listener=null;a.a=null;a.src=null;a.eb=null};function qi(a){this.src=a;this.a={};this.b=0}qi.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.a[f];a||(a=this.a[f]=[],this.b++);var g=ri(a,b,d,e);-1<g?(b=a[g],c||(b.Ua=!1)):(b=new oi(b,this.src,f,!!d,e),b.Ua=c,a.push(b));return b};function si(a,b){var c=b.type;c in a.a&&Ua(a.a[c],b)&&(pi(b),0==a.a[c].length&&(delete a.a[c],a.b--))}function ri(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.xa&&f.listener==b&&f.Va==!!c&&f.eb==d)return e}return-1};var ti="closure_lm_"+(1E6*Math.random()|0),ui={},vi=0;function wi(a,b,c,d,e){if(v(b))for(var f=0;f<b.length;f++)wi(a,b[f],c,d,e);else c=xi(c),a&&a[mi]?a.ga.add(String(b),c,!1,d,e):yi(a,b,c,!1,d,e)}function yi(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var g=!!e,h=zi(a);h||(a[ti]=h=new qi(a));c=h.add(b,c,d,e,f);c.a||(d=Ai(),c.a=d,d.src=a,d.listener=c,a.addEventListener?a.addEventListener(b.toString(),d,g):a.attachEvent(Bi(b.toString()),d),vi++)}
function Ai(){var a=Ci,b=ii?function(c){return a.call(b.src,b.listener,c)}:function(c){c=a.call(b.src,b.listener,c);if(!c)return c};return b}function Di(a,b,c,d,e){if(v(b))for(var f=0;f<b.length;f++)Di(a,b[f],c,d,e);else c=xi(c),a&&a[mi]?a.ga.add(String(b),c,!0,d,e):yi(a,b,c,!0,d,e)}
function Ei(a,b,c,d,e){if(v(b))for(var f=0;f<b.length;f++)Ei(a,b[f],c,d,e);else(c=xi(c),a&&a[mi])?(a=a.ga,b=String(b).toString(),b in a.a&&(f=a.a[b],c=ri(f,c,d,e),-1<c&&(pi(f[c]),Ma.splice.call(f,c,1),0==f.length&&(delete a.a[b],a.b--)))):a&&(a=zi(a))&&(b=a.a[b.toString()],a=-1,b&&(a=ri(b,c,!!d,e)),(c=-1<a?b[a]:null)&&Fi(c))}
function Fi(a){if(!ea(a)&&a&&!a.xa){var b=a.src;if(b&&b[mi])si(b.ga,a);else{var c=a.type,d=a.a;b.removeEventListener?b.removeEventListener(c,d,a.Va):b.detachEvent&&b.detachEvent(Bi(c),d);vi--;(c=zi(b))?(si(c,a),0==c.b&&(c.src=null,b[ti]=null)):pi(a)}}}function Bi(a){return a in ui?ui[a]:ui[a]="on"+a}function Gi(a,b,c,d){var e=!0;if(a=zi(a))if(b=a.a[b.toString()])for(b=b.concat(),a=0;a<b.length;a++){var f=b[a];f&&f.Va==c&&!f.xa&&(f=Hi(f,d),e=e&&!1!==f)}return e}
function Hi(a,b){var c=a.listener,d=a.eb||a.src;a.Ua&&Fi(a);return c.call(d,b)}
function Ci(a,b){if(a.xa)return!0;if(!ii){var c=b||ba("window.event"),d=new li(c,this),e=!0;if(!(0>c.keyCode||void 0!=c.returnValue)){a:{var f=!1;if(0==c.keyCode)try{c.keyCode=-1;break a}catch(g){f=!0}if(f||void 0==c.returnValue)c.returnValue=!0}c=[];for(f=d.b;f;f=f.parentNode)c.push(f);for(var f=a.type,h=c.length-1;0<=h;h--){d.b=c[h];var k=Gi(c[h],f,!0,d),e=e&&k}for(h=0;h<c.length;h++)d.b=c[h],k=Gi(c[h],f,!1,d),e=e&&k}return e}return Hi(a,new li(b,this))}
function zi(a){a=a[ti];return a instanceof qi?a:null}var Ii="__closure_events_fn_"+(1E9*Math.random()>>>0);function xi(a){if(fa(a))return a;a[Ii]||(a[Ii]=function(b){return a.handleEvent(b)});return a[Ii]};function Ji(){be.call(this);this.ga=new qi(this);this.b=this;this.a=null}z(Ji,be);Ji.prototype[mi]=!0;Ji.prototype.addEventListener=function(a,b,c,d){wi(this,a,b,c,d)};Ji.prototype.removeEventListener=function(a,b,c,d){Ei(this,a,b,c,d)};Ji.prototype.fa=function(){Ji.B.fa.call(this);if(this.ga){var a=this.ga,b=0,c;for(c in a.a){for(var d=a.a[c],e=0;e<d.length;e++)++b,pi(d[e]);delete a.a[c];a.b--}}this.a=null};
function Ki(a,b,c,d){b=a.ga.a[String(b)];if(!b)return!0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var g=b[f];if(g&&!g.xa&&g.Va==c){var h=g.listener,k=g.eb||g.src;g.Ua&&si(a.ga,g);e=!1!==h.call(k,d)&&e}}return e&&0!=d.ec};/*
 Copyright 2012 YDN Authors, Yathit. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");.
*/
function Li(a){a.h||(a.h=new Ji);return a.h}Ag.prototype.addEventListener=function(a,b,c,d){if("ready"==a)Di(Li(this),a,b,c,d);else{var e="created error fail ready deleted updated versionchange".split(" "),f=function(a){if(!(0<=Na(e,a)))throw new J('Invalid event type "'+a+'"');};if(w(a))for(var g=0;g<a.length;g++)f(a[g]);else f(a);wi(Li(this),a,b,c,d)}};Ag.prototype.removeEventListener=function(a,b,c,d){Ei(Li(this),a,b,c,d)};
Ag.prototype.J=function(a){var b=Li(this),c,d=b.a;if(d)for(c=[];d;d=d.a)c.push(d);b=b.b;d=a.type||a;if(x(a))a=new Mf(a,b);else if(a instanceof Mf)a.target=a.target||b;else{var e=a;a=new Mf(d,b);fb(a,e)}var e=!0,f;if(c)for(var g=c.length-1;0<=g;g--)f=a.b=c[g],e=Ki(f,d,!0,a)&&e;f=a.b=b;e=Ki(f,d,!0,a)&&e;e=Ki(f,d,!1,a)&&e;if(c)for(g=0;g<c.length;g++)f=a.b=c[g],e=Ki(f,d,!1,a)&&e};function Mi(a,b,c){X.call(this,a,b,c)}z(Mi,Th);function Ni(a,b){Le.call(this,a,b)}z(Ni,Le);Ni.prototype.h=function(){return!1};Ni.prototype.c=function(a,b){function c(b){t(a[b])?(e=!1,d[b]=!0):(d[b]=!1,0<=b-1&&c(b-1))}var d=[],e=!0;c(a.length-1);e&&(d=[]);return Me(this,d,b)};function Oi(a,b){Le.call(this,a,b)}z(Oi,Le);
Oi.prototype.c=function(a,b){var c=[],d=b[0];if(null==d)return[];for(var e=!0,f=!1,g=d,h=[],k=1;k<a.length;k++)if(null!=b[k]){var m=L(d,b[k]);h[k]=m;this.b?-1==m?e=!1:1==m&&(e=!1,f=!0,-1==L(b[k],g)&&(g=b[k])):1==m?e=!1:-1==m&&(e=!1,f=!0,1==L(b[k],g)&&(g=b[k]))}else e=!1,f=!0;if(e)for(f=0;f<a.length;f++)null!=b[f]&&(c[f]=!0);else if(f)for(f=0;f<a.length;f++)null!=b[f]&&(this.b?-1==L(g,b[f])&&(c[f]=g):1==L(g,b[f])&&(c[f]=g));else for(k=this.b?-1:1,f=1;f<a.length;f++)h[f]===k&&(c[f]=d);return e?(this.g++,
this.a&&this.a.push(g),c):{continuePrimary:c}};function Pi(a,b){Le.call(this,a,b)}z(Pi,Le);Pi.prototype.logger=D("ydn.db.algo.ZigzagMerge");
Pi.prototype.c=function(a,b){function c(a,b){var c=a.slice(0,a.length-1);c.push(b);return c}function d(a){return a[a.length-1]}var e=[];if(0==a.length||null==a[0]||null==a[0])return[];for(var f=!0,g=0,h=d(a[g]),k=[],m=1;m<a.length;m++)if(null!=a[m]){var n=d(a[m]),p=L(h,n);k[m]=p;this.b?-1==p?f=!1:1==p&&(f=!1,h=n,g=1):1==p?f=!1:-1==p&&(f=!1,h=n,g=1)}else return[];m=this.b?-1:1;if(f){for(f=0;f<a.length;f++)null!=a[f]&&(e[f]=!0);this.a&&(this.f?this.a.push(b[0],h):this.a.push(b[0]));return e}if(0==g)for(f=
1;f<a.length;f++)k[f]==m&&(e[f]=c(a[f],h));else for(f=0;f<a.length;f++)f!=g&&null!=a[f]&&L(h,d(a[f]))===m&&(e[f]=c(a[f],h));return{"continue":e}};oa("ydn.db.algo.NestedLoop",Ni);oa("ydn.db.algo.ZigzagMerge",Pi);oa("ydn.db.algo.SortedMerge",Oi);S.prototype.close=S.prototype.close;S.prototype.getType=S.prototype.Ba;S.prototype.getName=S.prototype.getName;S.prototype.getSchema=S.prototype.N;S.prototype.onReady=S.prototype.ib;S.prototype.setName=S.prototype.C;S.prototype.transaction=S.prototype.transaction;S.prototype.db=S.prototype.Kc;oa("ydn.db.version","1.3.0");oa("ydn.db.cmp",L);oa("ydn.db.deleteDatabase",function(a,b){for(var c,d=0;d<ze.length;d++){var e=ze[d](a,b);e&&(c=e)}return c||ye("IDBVersionChangeEvent ",null)});
Of.prototype.name=Of.prototype.name;Of.prototype.getVersion=Of.prototype.Nc;Of.prototype.getOldVersion=Of.prototype.oc;Of.prototype.getOldSchema=Of.prototype.nc;Pf.prototype.getError=Pf.prototype.c;se.prototype.abort=se.prototype.abort;se.prototype.canAbort=se.prototype.lc;ud.prototype.progress=ud.prototype.Tb;ud.prototype.promise=ud.prototype.zc;oa("ydn.db.KeyRange",K);K.only=zd;K.bound=Ad;K.upperBound=Bd;K.lowerBound=Cd;Cg.prototype.countOf=Cg.prototype.Ga;Cg.prototype.keysOf=Cg.prototype.Ka;Cg.prototype.open=Cg.prototype.open;Cg.prototype.scan=Cg.prototype.Lc;Cg.prototype.valuesOf=Cg.prototype.Na;If.prototype.countOf=If.prototype.Ga;If.prototype.keysOf=If.prototype.Ka;If.prototype.open=If.prototype.open;If.prototype.scan=If.prototype.Nb;If.prototype.valuesOf=If.prototype.Na;ee.prototype.getKey=ee.prototype.Mc;ee.prototype.getPrimaryKey=ee.prototype.T;ee.prototype.getValue=ee.prototype.Ca;ee.prototype.update=ee.prototype.update;
ee.prototype.clear=ee.prototype.clear;oa("ydn.db.Iterator",N);oa("ydn.db.KeyIterator",oe);oa("ydn.db.ValueIterator",qe);oa("ydn.db.IndexIterator",pe);oa("ydn.db.IndexValueIterator",re);N.prototype.getState=N.prototype.pc;N.prototype.getKeyRange=N.prototype.gc;N.prototype.getIndexName=N.prototype.Ac;N.prototype.getStoreName=N.prototype.Dc;N.prototype.isReversed=N.prototype.da;N.prototype.isUnique=N.prototype.za;N.prototype.isKeyIterator=N.prototype.Ec;N.prototype.isIndexIterator=N.prototype.qc;
N.prototype.getPrimaryKey=N.prototype.Cc;N.prototype.getKey=N.prototype.Bc;N.prototype.resume=N.prototype.hc;N.prototype.reset=N.prototype.Jb;N.prototype.reverse=N.prototype.reverse;oe.where=function(a,b,c,d,e){return new oe(a,Jd(b,c,d,e))};qe.where=function(a,b,c,d,e){return new qe(a,Jd(b,c,d,e))};pe.where=function(a,b,c,d,e,f){return new pe(a,b,Jd(c,d,e,f))};re.where=function(a,b,c,d,e,f){return new re(a,b,Jd(c,d,e,f))};oa("ydn.db.Streamer",Ge);Ge.prototype.push=Ge.prototype.push;
Ge.prototype.collect=Ge.prototype.Jc;Ge.prototype.setSink=Ge.prototype.xc;Ag.prototype.branch=Ag.prototype.kc;Ag.prototype.getTxNo=Ag.prototype.Pc;mf.prototype.getTxNo=mf.prototype.Oc;Ag.prototype.run=Ag.prototype.tc;X.prototype.branch=X.prototype.kc;X.prototype.add=X.prototype.add;X.prototype.addAll=X.prototype.Ta;X.prototype.get=X.prototype.get;X.prototype.keys=X.prototype.keys;X.prototype.keysByIndex=X.prototype.Ja;X.prototype.values=X.prototype.values;X.prototype.valuesByIndex=X.prototype.Ma;X.prototype.put=X.prototype.put;X.prototype.putAll=X.prototype.kb;X.prototype.clear=X.prototype.clear;X.prototype.remove=X.prototype.sb;X.prototype.count=X.prototype.count;W.prototype.add=W.prototype.add;
W.prototype.addAll=W.prototype.Ta;W.prototype.get=W.prototype.get;W.prototype.keys=W.prototype.keys;W.prototype.keysByIndex=W.prototype.Ja;W.prototype.values=W.prototype.values;W.prototype.valuesByIndex=W.prototype.Ma;W.prototype.put=W.prototype.put;W.prototype.putAll=W.prototype.kb;W.prototype.clear=W.prototype.clear;W.prototype.remove=W.prototype.sb;W.prototype.count=W.prototype.count;oa("ydn.db.Key",We);We.prototype.id=We.prototype.mc;We.prototype.parent=We.prototype.Fc;
We.prototype.storeName=We.prototype.Gc;oa("ydn.db.KeyRange",K);K.upperBound=Bd;K.lowerBound=Cd;K.bound=Ad;K.only=zd;K.starts=Dd;Nf.prototype.store_name=Nf.prototype.s;Nf.prototype.getStoreName=Nf.prototype.a;Ef.prototype.name=Ef.prototype.name;Ef.prototype.getKey=Ef.prototype.c;Ef.prototype.getValue=Ef.prototype.f;Bf.prototype.name=Bf.prototype.name;Bf.prototype.getKeys=Bf.prototype.na;Bf.prototype.getValues=Bf.prototype.cb;function Qi(a,b,c){this.db=a;this.b=b;this.type=c||0;this.c=null};function Si(a,b,c,d){this.c=a;this.a=b||null;this.h=!!c;this.g=!!d;this.b=[];this.f=[]}function Ti(a,b){for(var c=b.length-1;0<=c;c--)if(b[c]==a.b[a.b.length-1])b=b.slice(0,c);else break;a.f=b;if(a.a&&a.b[0]){if(a.a.lower!=a.a.upper)throw new Ne("Ordering no allowed with range query");a.a=Dd([a.a.lower])}return null}
function Ui(a,b){if((0!=a.b.length||0!=a.f.length)&&Vi(a)&&!Wi(a))throw new Ne('Require index "'+a.b.concat(a.f).join(", ")+'" not found in store "'+a.c.getName()+'"');var c=new N(a.c.getName(),Xi(a),a.a,a.h,a.g,!!b);c.C=a.b.length;return c}Si.prototype.clone=function(){var a=new Si(this.c,this.a,this.h,this.g);a.f=this.f.slice();a.b=this.b.slice();return a};function Wi(a){var b=a.b.concat(a.f),c=fe(a.c,b);return c||b[b.length-1]==a.c.keyPath&&(c=fe(a.c,b.slice(0,b.length-1)))?c:null}
function Xi(a){return(a=Wi(a))?a.getName():void 0}Si.prototype.reverse=function(){var a=this.clone();a.h=!this.h;return a};Si.prototype.unique=function(a){var b=this.clone();b.g=!!a;return b};function Vi(a){return 0<a.b.length?!0:1==a.f.length?a.f[0]!=a.c.keyPath:1<a.f.length?!0:!1}
Si.prototype.v=function(a,b,c,d,e){c=Jd(b,c,d,e);if(0<this.b.length)if(this.a)if(null!=this.a.lower&&null!=this.a.upper&&0==L(this.a.lower,this.a.upper))a=v(this.a.lower)?this.a.lower.slice().push(b):[this.a.lower,b],d=null!=d?d:"\uffff",c=v(this.a.upper)?this.a.upper.slice().push(d):[this.a.upper,d],this.a=Jd(b,a,d,c);else if(1==this.b.length&&this.b[0]==a||v(a)&&Xa(this.b,a))this.a=this.a.ka(c);else return"cannot use where clause with existing filter";else return"cannot use where clause with existing filter";
else this.b=v(a)?a:[a],this.a=this.a?this.a.ka(c):c;return null};function Yi(a,b,c,d){Qi.call(this,a,b,c);this.a=d}z(Yi,Qi);Yi.prototype.open=function(){var a={push:function(){}},a=Zi(this)?new Pi(a):new Oi(a);return this.db.Nb(a,$i(this),M)};function $i(a){for(var b=[],c=0;c<a.a.length;c++)b[c]=Ui(a.a[c]);return b}function Zi(a){for(var b=0;b<a.a.length;b++)if(0<a.a[b].b.length)return!0;return!1}Yi.prototype.Ab=function(){return this.a.slice()};Yi.prototype.select=function(){throw Error("not impl");};
Yi.prototype.reverse=function(){var a=this.a.map(function(a){return a.reverse()});return new Yi(this.db,this.b,this.type,a)};function Z(a,b,c,d){Qi.call(this,a,b,c);this.a=d}z(Z,Qi);l=Z.prototype;l.Hc=function(){return new Z(this.db,this.b,this.type,this.a.clone())};l.reverse=function(){var a=this.a.reverse();return new Z(this.db,this.b,this.type,a)};l.unique=function(a){if(!da(a))throw new J("unique value must be a boolean, but "+typeof a+" found");a=this.a.unique(a);return new Z(this.db,this.b,this.type,a)};
l.X=function(a){var b=x(a)?[a]:a;a=this.a.clone();if(b=Ti(a,b))throw Error(b);return new Z(this.db,this.b,this.type,a)};
l.v=function(a,b,c,d,e){if(Xi(this.a)&&Xi(this.a)!=a){var f=Jd(b,c,d,e),f=new Si(V(this.b,this.a.c.getName()),f,this.a.h,this.a.g);return this.ka(new Z(this.db,this.b,this.type,f))}if(!Xi(this.a)&&!zf(V(this.b,this.a.c.getName()),a))throw new J('index "'+a+'" not exists in '+this.a.c.getName());f=this.a.clone();if(a=f.v(a,b,c,d,e))throw new J(a);return new Z(this.db,this.b,this.type,f)};
l.select=function(a){var b=V(this.b,this.a.c.getName()),c=x(a)?[a]:a,d=this.type;a=this.a.clone();d=Xi(this.a);if(1==c.length)if(d=c[0],"_ROWID_"==d||d==b.keyPath)d=2;else if(d&&"*"!=d)if(zf(b,d)){if(b=Ti(a,c))throw new J(b);d=1}else throw new J('Invalid select "'+d+'", index not found in store "'+b.getName()+'"');else d=4;else if(2==c.length){if(!d)throw new J("Only primary key can be selected for this query.");for(var e=0;2>e;e++){var f;if(f="_ROWID_"!=c[e]){f=b;var g=c[e];f=!(t(f.keyPath)&&(1==
f.h.length?f.keyPath===g:w(g)&&Xa(f.h,g)))}if(f&&c[e]!=d)throw new J('select field name must be "'+d+'", but "'+c[e]+'" found.');}d=3}else throw new J("Selecting more than 2 field names is not supported, but "+c.length+" fields selected.");return new Z(this.db,this.b,d,a)};l.Ic=function(a){a=a||100;var b=4,c=aj(this);this.c&&this.c[0]&&(c=c.hc(this.c[0],this.c[1]));if(2==this.type||3==this.type||1==this.type)b=this.type;a=Lf(this.db,b,c,a);a.H(function(){"rest"==c.g&&(this.c=[c.i,c.j])},this);return a};
l.Ab=function(){return[this.a.clone()]};function aj(a){return Ui(a.a,!(2==a.type||3==a.type||1==a.type))}
l.sc=function(a,b){var c=aj(this);c.f&&(c=new N(c.b,c.c,c.a,c.da(),c.za(),!1,c.h));if(1>arguments.length)throw new J("too few arguments");if(2==arguments.length){if(!x(a)&&v(a)){if(!v(b))throw new J("an array is expected for second argument but, "+wf(b)+" of type "+typeof b+" found");if(a.length!=b.length)throw new J("length of two input arguments must be equal but, "+a.length+" and "+b.length+" found");}}else if(1==arguments.length){if(!y(a))throw new J("an object is expected but, "+wf(a)+" of type "+
typeof a+" found");}else throw new J("too many arguments");var d=this.db.open(function(c){var f=c.Ca();if(x(a))Ld(f,a,b);else if(v(a))for(var g=0;g<a.length;g++)Ld(f,a[g],b[g]);else if(y(a))for(g in a)a.hasOwnProperty(g)&&(f[g]=a[g]);Mb(d,c.update(f))},c,M,this);return d};l.open=function(a,b){return this.db.open(a,aj(this),M,b)};l.count=function(){return Vi(this.a)?this.a.g?this.db.count(Ui(this.a)):this.db.count(this.a.c.getName(),Xi(this.a),this.a.a):this.db.count(this.a.c.getName(),this.a.a)};
l.clear=function(){return Vi(this.a)?this.db.clear(this.a.c.getName(),Xi(this.a),this.a.a):this.db.clear(this.a.c.getName(),this.a.a)};l.ka=function(a){a=a.Ab().concat(this.Ab());return new Yi(this.db,this.b,this.type,a)};
Cg.prototype.V=function(a,b,c,d,e){if(!x(a))throw new TypeError('store name "'+a+'"');if(!vf(this.a,a))throw new J('Store "'+a+'" not found.');var f=null;if(t(b)){if(!t(c))throw new J("boundary value must be defined.");f=Jd(b,c,d,e)}else if(t(d))throw new J("second boundary must not be defined.");a=new Si(V(this.a,a),f);return new Z(this.c,this.a,null,a)};
If.prototype.V=function(a,b,c,d,e){if(!x(a))throw new TypeError('store name "'+a+'"');if(!vf(this.b,a))throw new J('Store "'+a+'" not found.');var f=null;if(t(b)){if(!t(c))throw new J("boundary value must be defined.");f=Jd(b,c,d,e)}else if(t(d))throw new J("second boundary must not be defined.");a=new Si(V(this.b,a),f);return new Z(this,this.b,null,a)};D("ydn.db.query.ConjunctionCursor");Z.prototype.copy=Z.prototype.Hc;Z.prototype.count=Z.prototype.count;Z.prototype.list=Z.prototype.Ic;Z.prototype.order=Z.prototype.X;Z.prototype.patch=Z.prototype.sc;Z.prototype.reverse=Z.prototype.reverse;Z.prototype.unique=Z.prototype.unique;Z.prototype.where=Z.prototype.v;Cg.prototype.from=Cg.prototype.V;If.prototype.from=If.prototype.V;Th.prototype.executeSql=Th.prototype.executeSql;Sh.prototype.executeSql=Sh.prototype.executeSql;Ag.prototype.addEventListener=Ag.prototype.addEventListener;Ag.prototype.removeEventListener=Ag.prototype.removeEventListener;function bj(){this.a=na()}var cj=new bj;bj.prototype.set=function(a){this.a=a};bj.prototype.get=function(){return this.a};function dj(a){this.g=a||"";this.h=cj}dj.prototype.c=!0;dj.prototype.a=!0;dj.prototype.b=!1;function ej(a){a=new Date(a.g);return fj(a.getFullYear()-2E3)+fj(a.getMonth()+1)+fj(a.getDate())+" "+fj(a.getHours())+":"+fj(a.getMinutes())+":"+fj(a.getSeconds())+"."+fj(Math.floor(a.getMilliseconds()/10))}function fj(a){return 10>a?"0"+a:String(a)}function gj(a,b){var c=(a.g-b)/1E3,d=c.toFixed(3),e=0;if(1>c)e=2;else for(;100>c;)e++,c*=10;for(;0<e--;)d=" "+d;return d}function hj(a){dj.call(this,a)}z(hj,dj);
hj.prototype.b=!0;hj.prototype.f=function(a){return a?ij(this,a).ha():""};
function ij(a,b){var c;switch(b.f.value){case Yc.value:c="dbg-sh";break;case Zc.value:c="dbg-sev";break;case $c.value:c="dbg-w";break;case ad.value:c="dbg-i";break;default:c="dbg-f"}var d=[];d.push(a.g," ");a.a&&d.push("[",ej(b),"] ");d.push("[",gj(b,a.h.get()),"s] ");d.push("[",b.b,"] ");var d=sc(d.join("")),e=yc;if(a.b&&b.a){var e=wc("br"),f;try{var g;var h=b.a,k=ba("window.location.href");if(x(h))g={message:h,name:"Unknown error",lineNumber:"Not available",fileName:k,stack:"Not available"};else{var m,
n,p=!1;try{m=h.lineNumber||h.Rc||"Not available"}catch(q){m="Not available",p=!0}try{n=h.fileName||h.filename||h.sourceURL||r.$googDebugFname||k}catch(u){n="Not available",p=!0}g=!p&&h.lineNumber&&h.fileName&&h.stack&&h.message&&h.name?h:{message:h.message||"Not available",name:h.name||"UnknownError",lineNumber:m,fileName:n,stack:h.stack||"Not available"}}var A;var B=g.fileName;null!=B||(B="");if(/^https?:\/\//i.test(B)){var H;h=B;h instanceof dc?H=h:(h=h.oa?h.ha():String(h),h=gc.test(h)?hc(h):"about:invalid#zClosurez",
H=kc(h));Yb("view-source scheme plus HTTP/HTTPS URL");var I="view-source:"+fc(H);A=kc(I)}else{var O=Yb("sanitizedviewsrc");A=kc(Xb(O))}f=xc(sc("Message: "+g.message+"\nUrl: "),wc("a",{href:A,target:"_new"},g.fileName),sc("\nLine: "+g.lineNumber+"\n\nBrowser stack:\n"+g.stack+"-> [end]\n\nJS stack traversal:\n"+Qc(void 0)+"-> "))}catch(ha){f=sc("Exception trying to expose exception! You win, we lose. "+ha)}e=xc(e,f)}f=sc(b.c);c=wc("span",{"class":c},xc(f,e));return a.c?xc(d,c,wc("br")):xc(d,c)}
function jj(a){dj.call(this,a)}z(jj,dj);jj.prototype.f=function(a){var b=[];b.push(this.g," ");this.a&&b.push("[",ej(a),"] ");b.push("[",gj(a,this.h.get()),"s] ");b.push("[",a.b,"] ");b.push(a.c);this.b&&(a=a.a)&&b.push("\n",a instanceof Error?a.message:a.toString());this.c&&b.push("\n");return b.join("")};function kj(){this.g=la(this.h,this);this.a=new jj;this.a.a=!1;this.a.b=!1;this.b=this.a.c=!1;this.c="";this.f={}}kj.prototype.h=function(a){if(!this.f[a.b]){var b=this.a.f(a),c=lj;if(c)switch(a.f){case Yc:mj(c,"info",b);break;case Zc:mj(c,"error",b);break;case $c:mj(c,"warn",b);break;default:mj(c,"debug",b)}else this.c+=b}};var lj=r.console;function mj(a,b,c){if(a[b])a[b](c);else a.log(c)};var nj=!Gc||Gc&&9<=Pc;!Hc&&!Gc||Gc&&Gc&&9<=Pc||Hc&&Nc("1.9.1");Gc&&Nc("9");function oj(a,b){cb(b,function(b,d){"style"==d?a.style.cssText=b:"class"==d?a.className=b:"for"==d?a.htmlFor=b:d in pj?a.setAttribute(pj[d],b):0==d.lastIndexOf("aria-",0)||0==d.lastIndexOf("data-",0)?a.setAttribute(d,b):a[d]=b})}var pj={cellpadding:"cellPadding",cellspacing:"cellSpacing",colspan:"colSpan",frameborder:"frameBorder",height:"height",maxlength:"maxLength",role:"role",rowspan:"rowSpan",type:"type",usemap:"useMap",valign:"vAlign",width:"width"};
function qj(a,b,c){function d(c){c&&b.appendChild(x(c)?a.createTextNode(c):c)}for(var e=2;e<c.length;e++){var f=c[e];!w(f)||y(f)&&0<f.nodeType?d(f):Oa(rj(f)?Va(f):f,d)}}function rj(a){if(a&&"number"==typeof a.length){if(y(a))return"function"==typeof a.item||"string"==typeof a.item;if(fa(a))return"function"==typeof a.item}return!1}function sj(a){this.a=a||r.document||document}
function tj(a,b){var c;c=a.a;var d=b&&"*"!=b?b.toUpperCase():"";c.querySelectorAll&&c.querySelector&&d?c=c.querySelectorAll(d+""):c=c.getElementsByTagName(d||"*");return c}
sj.prototype.b=function(a,b,c){var d=this.a,e=arguments,f=e[0],g=e[1];if(!nj&&g&&(g.name||g.type)){f=["<",f];g.name&&f.push(' name="',xa(g.name),'"');if(g.type){f.push(' type="',xa(g.type),'"');var h={};fb(h,g);delete h.type;g=h}f.push(">");f=f.join("")}f=d.createElement(f);g&&(x(g)?f.className=g:v(g)?f.className=g.join(" "):oj(f,g));2<e.length&&qj(d,f,e);return f};
sj.prototype.contains=function(a,b){if(a.contains&&1==b.nodeType)return a==b||a.contains(b);if("undefined"!=typeof a.compareDocumentPosition)return a==b||Boolean(a.compareDocumentPosition(b)&16);for(;b&&a!=b;)b=b.parentNode;return b==a};function uj(a){Gc&&t(a.cssText)?a.cssText=".dbg-sev{color:#F00}.dbg-w{color:#C40}.dbg-sh{font-weight:bold;color:#000}.dbg-i{color:#444}.dbg-f{color:#999}.dbg-ev{color:#0A0}.dbg-m{color:#990}.logmsg{border-bottom:1px solid #CCC;padding:2px}.logsep{background-color: #8C8;}.logdiv{border:1px solid #CCC;background-color:#FCFCFC;font:medium monospace}":a.innerHTML=".dbg-sev{color:#F00}.dbg-w{color:#C40}.dbg-sh{font-weight:bold;color:#000}.dbg-i{color:#444}.dbg-f{color:#999}.dbg-ev{color:#0A0}.dbg-m{color:#990}.logmsg{border-bottom:1px solid #CCC;padding:2px}.logsep{background-color: #8C8;}.logdiv{border:1px solid #CCC;background-color:#FCFCFC;font:medium monospace}"}
;function vj(a){this.g=la(this.h,this);this.b=new hj;this.c=this.b.a=!1;this.a=a;this.f=this.a.ownerDocument||this.a.document;a=(a=this.a)?new sj(9==a.nodeType?a:a.ownerDocument||a.document):ta||(ta=new sj);var b=null,c=a.a;Gc&&c.createStyleSheet?(b=c.createStyleSheet(),uj(b)):(c=tj(a,"head")[0],c||(b=tj(a,"body")[0],c=a.b("head"),b.parentNode.insertBefore(c,b)),b=a.b("style"),uj(b),c.appendChild(b));this.a.className+=" logdiv"}
vj.prototype.h=function(a){if(a){var b=100>=this.a.scrollHeight-this.a.scrollTop-this.a.clientHeight,c=this.f.createElement("div");c.className="logmsg";a=ij(this.b,a);c.innerHTML=pc(a);this.a.appendChild(c);b&&(this.a.scrollTop=this.a.scrollHeight)}};vj.prototype.clear=function(){this.a&&(this.a.innerHTML=pc(yc))};var wj=null,xj=null;D("ydn.debug");oa("ydn.debug.log",function(a,b,c){a=a||"ydn";if(ea(b))b=new Xc("log",b);else if(x(b)){b=b.toUpperCase();if(!gd){gd={};for(var d=0,e;e=fd[d];d++)gd[e.value]=e,gd[e.name]=e}b=gd[b]||null}else b=cd;(d=D(a))?d.b=b:window.console.log("logger "+a+" not available.");t(c)?!xj&&(a=xj=new vj(c),1!=a.c&&(c=ld(),b=a.g,c.a||(c.a=[]),c.a.push(b),a.c=!0),a=ld())&&(a.b=$c):!wj&&!xj&&(a=wj=new kj,1!=a.b&&(c=ld(),b=a.g,c.a||(c.a=[]),c.a.push(b),a.b=!0),a=ld())&&(a.b=$c)});oa("ydn.db.Storage",Mi);})();

                //# sourceMappingURL=ydn.db-dev.js.map
            
/* @preserve
 * The MIT License (MIT)
 * 
 * Copyright (c) 2013-2015 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
/**
 * bluebird build version 3.1.5
 * Features enabled: core, race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, using, timers, filter, any, each
*/
!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;"undefined"!=typeof window?e=window:"undefined"!=typeof global?e=global:"undefined"!=typeof self&&(e=self),e.Promise=t()}}(function(){var t,e,n;return function r(t,e,n){function i(s,a){if(!e[s]){if(!t[s]){var c="function"==typeof _dereq_&&_dereq_;if(!a&&c)return c(s,!0);if(o)return o(s,!0);var l=new Error("Cannot find module '"+s+"'");throw l.code="MODULE_NOT_FOUND",l}var u=e[s]={exports:{}};t[s][0].call(u.exports,function(e){var n=t[s][1][e];return i(n?n:e)},u,u.exports,r,t,e,n)}return e[s].exports}for(var o="function"==typeof _dereq_&&_dereq_,s=0;s<n.length;s++)i(n[s]);return i}({1:[function(t,e,n){"use strict";e.exports=function(t){function e(t){var e=new n(t),r=e.promise();return e.setHowMany(1),e.setUnwrap(),e.init(),r}var n=t._SomePromiseArray;t.any=function(t){return e(t)},t.prototype.any=function(){return e(this)}}},{}],2:[function(t,e,n){"use strict";function r(){this._isTickUsed=!1,this._lateQueue=new u(16),this._normalQueue=new u(16),this._haveDrainedQueues=!1,this._trampolineEnabled=!0;var t=this;this.drainQueues=function(){t._drainQueues()},this._schedule=l}function i(t,e,n){this._lateQueue.push(t,e,n),this._queueTick()}function o(t,e,n){this._normalQueue.push(t,e,n),this._queueTick()}function s(t){this._normalQueue._pushOne(t),this._queueTick()}var a;try{throw new Error}catch(c){a=c}var l=t("./schedule"),u=t("./queue"),p=t("./util");r.prototype.enableTrampoline=function(){this._trampolineEnabled=!0},r.prototype.disableTrampolineIfNecessary=function(){p.hasDevTools&&(this._trampolineEnabled=!1)},r.prototype.haveItemsQueued=function(){return this._isTickUsed||this._haveDrainedQueues},r.prototype.fatalError=function(t,e){e?(process.stderr.write("Fatal "+(t instanceof Error?t.stack:t)),process.exit(2)):this.throwLater(t)},r.prototype.throwLater=function(t,e){if(1===arguments.length&&(e=t,t=function(){throw e}),"undefined"!=typeof setTimeout)setTimeout(function(){t(e)},0);else try{this._schedule(function(){t(e)})}catch(n){throw new Error("No async scheduler available\n\n    See http://goo.gl/MqrFmX\n")}},p.hasDevTools?(r.prototype.invokeLater=function(t,e,n){this._trampolineEnabled?i.call(this,t,e,n):this._schedule(function(){setTimeout(function(){t.call(e,n)},100)})},r.prototype.invoke=function(t,e,n){this._trampolineEnabled?o.call(this,t,e,n):this._schedule(function(){t.call(e,n)})},r.prototype.settlePromises=function(t){this._trampolineEnabled?s.call(this,t):this._schedule(function(){t._settlePromises()})}):(r.prototype.invokeLater=i,r.prototype.invoke=o,r.prototype.settlePromises=s),r.prototype.invokeFirst=function(t,e,n){this._normalQueue.unshift(t,e,n),this._queueTick()},r.prototype._drainQueue=function(t){for(;t.length()>0;){var e=t.shift();if("function"==typeof e){var n=t.shift(),r=t.shift();e.call(n,r)}else e._settlePromises()}},r.prototype._drainQueues=function(){this._drainQueue(this._normalQueue),this._reset(),this._haveDrainedQueues=!0,this._drainQueue(this._lateQueue)},r.prototype._queueTick=function(){this._isTickUsed||(this._isTickUsed=!0,this._schedule(this.drainQueues))},r.prototype._reset=function(){this._isTickUsed=!1},e.exports=r,e.exports.firstLineError=a},{"./queue":26,"./schedule":29,"./util":36}],3:[function(t,e,n){"use strict";e.exports=function(t,e,n,r){var i=!1,o=function(t,e){this._reject(e)},s=function(t,e){e.promiseRejectionQueued=!0,e.bindingPromise._then(o,o,null,this,t)},a=function(t,e){0===(50397184&this._bitField)&&this._resolveCallback(e.target)},c=function(t,e){e.promiseRejectionQueued||this._reject(t)};t.prototype.bind=function(o){i||(i=!0,t.prototype._propagateFrom=r.propagateFromFunction(),t.prototype._boundValue=r.boundValueFunction());var l=n(o),u=new t(e);u._propagateFrom(this,1);var p=this._target();if(u._setBoundTo(l),l instanceof t){var h={promiseRejectionQueued:!1,promise:u,target:p,bindingPromise:l};p._then(e,s,void 0,u,h),l._then(a,c,void 0,u,h),u._setOnCancel(l)}else u._resolveCallback(p);return u},t.prototype._setBoundTo=function(t){void 0!==t?(this._bitField=2097152|this._bitField,this._boundTo=t):this._bitField=-2097153&this._bitField},t.prototype._isBound=function(){return 2097152===(2097152&this._bitField)},t.bind=function(e,n){return t.resolve(n).bind(e)}}},{}],4:[function(t,e,n){"use strict";function r(){try{Promise===o&&(Promise=i)}catch(t){}return o}var i;"undefined"!=typeof Promise&&(i=Promise);var o=t("./promise")();o.noConflict=r,e.exports=o},{"./promise":22}],5:[function(t,e,n){"use strict";var r=Object.create;if(r){var i=r(null),o=r(null);i[" size"]=o[" size"]=0}e.exports=function(e){function n(t,n){var r;if(null!=t&&(r=t[n]),"function"!=typeof r){var i="Object "+a.classString(t)+" has no method '"+a.toString(n)+"'";throw new e.TypeError(i)}return r}function r(t){var e=this.pop(),r=n(t,e);return r.apply(t,this)}function i(t){return t[this]}function o(t){var e=+this;return 0>e&&(e=Math.max(0,e+t.length)),t[e]}var s,a=t("./util"),c=a.canEvaluate;a.isIdentifier;e.prototype.call=function(t){var e=[].slice.call(arguments,1);return e.push(t),this._then(r,void 0,void 0,e,void 0)},e.prototype.get=function(t){var e,n="number"==typeof t;if(n)e=o;else if(c){var r=s(t);e=null!==r?r:i}else e=i;return this._then(e,void 0,void 0,t,void 0)}}},{"./util":36}],6:[function(t,e,n){"use strict";e.exports=function(e,n,r,i){var o=t("./util"),s=o.tryCatch,a=o.errorObj,c=e._async;e.prototype["break"]=e.prototype.cancel=function(){if(!i.cancellation())return this._warn("cancellation is disabled");for(var t=this,e=t;t.isCancellable();){if(!t._cancelBy(e)){e._isFollowing()?e._followee().cancel():e._cancelBranched();break}var n=t._cancellationParent;if(null==n||!n.isCancellable()){t._isFollowing()?t._followee().cancel():t._cancelBranched();break}t._isFollowing()&&t._followee().cancel(),e=t,t=n}},e.prototype._branchHasCancelled=function(){this._branchesRemainingToCancel--},e.prototype._enoughBranchesHaveCancelled=function(){return void 0===this._branchesRemainingToCancel||this._branchesRemainingToCancel<=0},e.prototype._cancelBy=function(t){return t===this?(this._branchesRemainingToCancel=0,this._invokeOnCancel(),!0):(this._branchHasCancelled(),this._enoughBranchesHaveCancelled()?(this._invokeOnCancel(),!0):!1)},e.prototype._cancelBranched=function(){this._enoughBranchesHaveCancelled()&&this._cancel()},e.prototype._cancel=function(){this.isCancellable()&&(this._setCancelled(),c.invoke(this._cancelPromises,this,void 0))},e.prototype._cancelPromises=function(){this._length()>0&&this._settlePromises()},e.prototype._unsetOnCancel=function(){this._onCancelField=void 0},e.prototype.isCancellable=function(){return this.isPending()&&!this.isCancelled()},e.prototype._doInvokeOnCancel=function(t,e){if(o.isArray(t))for(var n=0;n<t.length;++n)this._doInvokeOnCancel(t[n],e);else if(void 0!==t)if("function"==typeof t){if(!e){var r=s(t).call(this._boundValue());r===a&&(this._attachExtraTrace(r.e),c.throwLater(r.e))}}else t._resultCancelled(this)},e.prototype._invokeOnCancel=function(){var t=this._onCancel();this._unsetOnCancel(),c.invoke(this._doInvokeOnCancel,this,t)},e.prototype._invokeInternalOnCancel=function(){this.isCancellable()&&(this._doInvokeOnCancel(this._onCancel(),!0),this._unsetOnCancel())},e.prototype._resultCancelled=function(){this.cancel()}}},{"./util":36}],7:[function(t,e,n){"use strict";e.exports=function(e){function n(t,n,a){return function(c){var l=a._boundValue();t:for(var u=0;u<t.length;++u){var p=t[u];if(p===Error||null!=p&&p.prototype instanceof Error){if(c instanceof p)return o(n).call(l,c)}else if("function"==typeof p){var h=o(p).call(l,c);if(h===s)return h;if(h)return o(n).call(l,c)}else if(r.isObject(c)){for(var f=i(p),_=0;_<f.length;++_){var d=f[_];if(p[d]!=c[d])continue t}return o(n).call(l,c)}}return e}}var r=t("./util"),i=t("./es5").keys,o=r.tryCatch,s=r.errorObj;return n}},{"./es5":13,"./util":36}],8:[function(t,e,n){"use strict";e.exports=function(t){function e(){this._trace=new e.CapturedTrace(r())}function n(){return i?new e:void 0}function r(){var t=o.length-1;return t>=0?o[t]:void 0}var i=!1,o=[];return t.prototype._promiseCreated=function(){},t.prototype._pushContext=function(){},t.prototype._popContext=function(){return null},t._peekContext=t.prototype._peekContext=function(){},e.prototype._pushContext=function(){void 0!==this._trace&&(this._trace._promiseCreated=null,o.push(this._trace))},e.prototype._popContext=function(){if(void 0!==this._trace){var t=o.pop(),e=t._promiseCreated;return t._promiseCreated=null,e}return null},e.CapturedTrace=null,e.create=n,e.deactivateLongStackTraces=function(){},e.activateLongStackTraces=function(){var n=t.prototype._pushContext,o=t.prototype._popContext,s=t._peekContext,a=t.prototype._peekContext,c=t.prototype._promiseCreated;e.deactivateLongStackTraces=function(){t.prototype._pushContext=n,t.prototype._popContext=o,t._peekContext=s,t.prototype._peekContext=a,t.prototype._promiseCreated=c,i=!1},i=!0,t.prototype._pushContext=e.prototype._pushContext,t.prototype._popContext=e.prototype._popContext,t._peekContext=t.prototype._peekContext=r,t.prototype._promiseCreated=function(){var t=this._peekContext();t&&null==t._promiseCreated&&(t._promiseCreated=this)}},e}},{}],9:[function(t,e,n){"use strict";e.exports=function(e,n){function r(t,e,n){var r=this;try{t(e,n,function(t){if("function"!=typeof t)throw new TypeError("onCancel must be a function, got: "+I.toString(t));r._attachCancellationCallback(t)})}catch(i){return i}}function i(t){if(!this.isCancellable())return this;var e=this._onCancel();void 0!==e?I.isArray(e)?e.push(t):this._setOnCancel([e,t]):this._setOnCancel(t)}function o(){return this._onCancelField}function s(t){this._onCancelField=t}function a(){this._cancellationParent=void 0,this._onCancelField=void 0}function c(t,e){if(0!==(1&e)){this._cancellationParent=t;var n=t._branchesRemainingToCancel;void 0===n&&(n=0),t._branchesRemainingToCancel=n+1}0!==(2&e)&&t._isBound()&&this._setBoundTo(t._boundTo)}function l(t,e){0!==(2&e)&&t._isBound()&&this._setBoundTo(t._boundTo)}function u(){var t=this._boundTo;return void 0!==t&&t instanceof e?t.isFulfilled()?t.value():void 0:t}function p(){this._trace=new R(this._peekContext())}function h(t,e){if(L(t)){var n=this._trace;if(void 0!==n&&e&&(n=n._parent),void 0!==n)n.attachExtraTrace(t);else if(!t.__stackCleaned__){var r=w(t);I.notEnumerableProp(t,"stack",r.message+"\n"+r.stack.join("\n")),I.notEnumerableProp(t,"__stackCleaned__",!0)}}}function f(t,e,n,r,i){if(void 0===t&&null!==e&&$){if(void 0!==i&&i._returnedNonUndefined())return;n&&(n+=" ");var o="a promise was created in a "+n+"handler but was not returned from it";r._warn(o,!0,e)}}function _(t,e){var n=t+" is deprecated and will be removed in a future version.";return e&&(n+=" Use "+e+" instead."),d(n)}function d(t,n,r){if(Z.warnings){var i,o=new V(t);if(n)r._attachExtraTrace(o);else if(Z.longStackTraces&&(i=e._peekContext()))i.attachExtraTrace(o);else{var s=w(o);o.stack=s.message+"\n"+s.stack.join("\n")}C(o,"",!0)}}function v(t,e){for(var n=0;n<e.length-1;++n)e[n].push("From previous event:"),e[n]=e[n].join("\n");return n<e.length&&(e[n]=e[n].join("\n")),t+"\n"+e.join("\n")}function y(t){for(var e=0;e<t.length;++e)(0===t[e].length||e+1<t.length&&t[e][0]===t[e+1][0])&&(t.splice(e,1),e--)}function g(t){for(var e=t[0],n=1;n<t.length;++n){for(var r=t[n],i=e.length-1,o=e[i],s=-1,a=r.length-1;a>=0;--a)if(r[a]===o){s=a;break}for(var a=s;a>=0;--a){var c=r[a];if(e[i]!==c)break;e.pop(),i--}e=r}}function m(t){for(var e=[],n=0;n<t.length;++n){var r=t[n],i="    (No stack trace)"===r||N.test(r),o=i&&X(r);i&&!o&&(B&&" "!==r.charAt(0)&&(r="    "+r),e.push(r))}return e}function b(t){for(var e=t.stack.replace(/\s+$/g,"").split("\n"),n=0;n<e.length;++n){var r=e[n];if("    (No stack trace)"===r||N.test(r))break}return n>0&&(e=e.slice(n)),e}function w(t){var e=t.stack,n=t.toString();return e="string"==typeof e&&e.length>0?b(t):["    (No stack trace)"],{message:n,stack:m(e)}}function C(t,e,n){if("undefined"!=typeof console){var r;if(I.isObject(t)){var i=t.stack;r=e+U(i,t)}else r=e+String(t);"function"==typeof S?S(r,n):("function"==typeof console.log||"object"==typeof console.log)&&console.log(r)}}function j(t,e,n,r){var i=!1;try{"function"==typeof e&&(i=!0,"rejectionHandled"===t?e(r):e(n,r))}catch(o){D.throwLater(o)}var s=!1;try{s=Y(t,n,r)}catch(o){s=!0,D.throwLater(o)}var a=!1;if(K)try{a=K(t.toLowerCase(),{reason:n,promise:r})}catch(o){a=!0,D.throwLater(o)}s||i||a||"unhandledRejection"!==t||C(n,"Unhandled rejection ")}function k(t){var e;if("function"==typeof t)e="[function "+(t.name||"anonymous")+"]";else{e=t&&"function"==typeof t.toString?t.toString():I.toString(t);var n=/\[object [a-zA-Z0-9$_]+\]/;if(n.test(e))try{var r=JSON.stringify(t);e=r}catch(i){}0===e.length&&(e="(empty array)")}return"(<"+F(e)+">, no stack trace)"}function F(t){var e=41;return t.length<e?t:t.substr(0,e-3)+"..."}function E(){return"function"==typeof J}function x(t){var e=t.match(W);return e?{fileName:e[1],line:parseInt(e[2],10)}:void 0}function T(t,e){if(E()){for(var n,r,i=t.stack.split("\n"),o=e.stack.split("\n"),s=-1,a=-1,c=0;c<i.length;++c){var l=x(i[c]);if(l){n=l.fileName,s=l.line;break}}for(var c=0;c<o.length;++c){var l=x(o[c]);if(l){r=l.fileName,a=l.line;break}}0>s||0>a||!n||!r||n!==r||s>=a||(X=function(t){if(H.test(t))return!0;var e=x(t);return e&&e.fileName===n&&s<=e.line&&e.line<=a?!0:!1})}}function R(t){this._parent=t,this._promisesCreated=0;var e=this._length=1+(void 0===t?0:t._length);J(this,R),e>32&&this.uncycle()}var P,O,S,A=e._getDomain,D=e._async,V=t("./errors").Warning,I=t("./util"),L=I.canAttachTrace,H=/[\\\/]bluebird[\\\/]js[\\\/](release|debug|instrumented)/,N=null,U=null,B=!1,M=!(0==I.env("BLUEBIRD_DEBUG")||!I.env("BLUEBIRD_DEBUG")&&"development"!==I.env("NODE_ENV")),q=!(0==I.env("BLUEBIRD_WARNINGS")||!M&&!I.env("BLUEBIRD_WARNINGS")),Q=!(0==I.env("BLUEBIRD_LONG_STACK_TRACES")||!M&&!I.env("BLUEBIRD_LONG_STACK_TRACES")),$=0!=I.env("BLUEBIRD_W_FORGOTTEN_RETURN")&&(q||!!I.env("BLUEBIRD_W_FORGOTTEN_RETURN"));e.prototype.suppressUnhandledRejections=function(){var t=this._target();t._bitField=-1048577&t._bitField|524288},e.prototype._ensurePossibleRejectionHandled=function(){0===(524288&this._bitField)&&(this._setRejectionIsUnhandled(),D.invokeLater(this._notifyUnhandledRejection,this,void 0))},e.prototype._notifyUnhandledRejectionIsHandled=function(){j("rejectionHandled",P,void 0,this)},e.prototype._setReturnedNonUndefined=function(){this._bitField=268435456|this._bitField},e.prototype._returnedNonUndefined=function(){return 0!==(268435456&this._bitField)},e.prototype._notifyUnhandledRejection=function(){if(this._isRejectionUnhandled()){var t=this._settledValue();this._setUnhandledRejectionIsNotified(),j("unhandledRejection",O,t,this)}},e.prototype._setUnhandledRejectionIsNotified=function(){this._bitField=262144|this._bitField},e.prototype._unsetUnhandledRejectionIsNotified=function(){this._bitField=-262145&this._bitField},e.prototype._isUnhandledRejectionNotified=function(){return(262144&this._bitField)>0},e.prototype._setRejectionIsUnhandled=function(){this._bitField=1048576|this._bitField},e.prototype._unsetRejectionIsUnhandled=function(){this._bitField=-1048577&this._bitField,this._isUnhandledRejectionNotified()&&(this._unsetUnhandledRejectionIsNotified(),this._notifyUnhandledRejectionIsHandled())},e.prototype._isRejectionUnhandled=function(){return(1048576&this._bitField)>0},e.prototype._warn=function(t,e,n){return d(t,e,n||this)},e.onPossiblyUnhandledRejection=function(t){var e=A();O="function"==typeof t?null===e?t:e.bind(t):void 0},e.onUnhandledRejectionHandled=function(t){var e=A();P="function"==typeof t?null===e?t:e.bind(t):void 0};var z=function(){};e.longStackTraces=function(){if(D.haveItemsQueued()&&!Z.longStackTraces)throw new Error("cannot enable long stack traces after promises have been created\n\n    See http://goo.gl/MqrFmX\n");if(!Z.longStackTraces&&E()){var t=e.prototype._captureStackTrace,r=e.prototype._attachExtraTrace;Z.longStackTraces=!0,z=function(){if(D.haveItemsQueued()&&!Z.longStackTraces)throw new Error("cannot enable long stack traces after promises have been created\n\n    See http://goo.gl/MqrFmX\n");e.prototype._captureStackTrace=t,e.prototype._attachExtraTrace=r,n.deactivateLongStackTraces(),D.enableTrampoline(),Z.longStackTraces=!1},e.prototype._captureStackTrace=p,e.prototype._attachExtraTrace=h,n.activateLongStackTraces(),D.disableTrampolineIfNecessary()}},e.hasLongStackTraces=function(){return Z.longStackTraces&&E()},e.config=function(t){if(t=Object(t),"longStackTraces"in t&&(t.longStackTraces?e.longStackTraces():!t.longStackTraces&&e.hasLongStackTraces()&&z()),"warnings"in t){var n=t.warnings;Z.warnings=!!n,$=Z.warnings,I.isObject(n)&&"wForgottenReturn"in n&&($=!!n.wForgottenReturn)}if("cancellation"in t&&t.cancellation&&!Z.cancellation){if(D.haveItemsQueued())throw new Error("cannot enable cancellation after promises are in use");e.prototype._clearCancellationData=a,e.prototype._propagateFrom=c,e.prototype._onCancel=o,e.prototype._setOnCancel=s,e.prototype._attachCancellationCallback=i,e.prototype._execute=r,G=c,Z.cancellation=!0}},e.prototype._execute=function(t,e,n){try{t(e,n)}catch(r){return r}},e.prototype._onCancel=function(){},e.prototype._setOnCancel=function(t){},e.prototype._attachCancellationCallback=function(t){},e.prototype._captureStackTrace=function(){},e.prototype._attachExtraTrace=function(){},e.prototype._clearCancellationData=function(){},e.prototype._propagateFrom=function(t,e){};var G=l,X=function(){return!1},W=/[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;I.inherits(R,Error),n.CapturedTrace=R,R.prototype.uncycle=function(){var t=this._length;if(!(2>t)){for(var e=[],n={},r=0,i=this;void 0!==i;++r)e.push(i),i=i._parent;t=this._length=r;for(var r=t-1;r>=0;--r){var o=e[r].stack;void 0===n[o]&&(n[o]=r)}for(var r=0;t>r;++r){var s=e[r].stack,a=n[s];if(void 0!==a&&a!==r){a>0&&(e[a-1]._parent=void 0,e[a-1]._length=1),e[r]._parent=void 0,e[r]._length=1;var c=r>0?e[r-1]:this;t-1>a?(c._parent=e[a+1],c._parent.uncycle(),c._length=c._parent._length+1):(c._parent=void 0,c._length=1);for(var l=c._length+1,u=r-2;u>=0;--u)e[u]._length=l,l++;return}}}},R.prototype.attachExtraTrace=function(t){if(!t.__stackCleaned__){this.uncycle();for(var e=w(t),n=e.message,r=[e.stack],i=this;void 0!==i;)r.push(m(i.stack.split("\n"))),i=i._parent;g(r),y(r),I.notEnumerableProp(t,"stack",v(n,r)),I.notEnumerableProp(t,"__stackCleaned__",!0)}};var K,J=function(){var t=/^\s*at\s*/,e=function(t,e){return"string"==typeof t?t:void 0!==e.name&&void 0!==e.message?e.toString():k(e)};if("number"==typeof Error.stackTraceLimit&&"function"==typeof Error.captureStackTrace){Error.stackTraceLimit+=6,N=t,U=e;var n=Error.captureStackTrace;return X=function(t){return H.test(t)},function(t,e){Error.stackTraceLimit+=6,n(t,e),Error.stackTraceLimit-=6}}var r=new Error;if("string"==typeof r.stack&&r.stack.split("\n")[0].indexOf("stackDetection@")>=0)return N=/@/,U=e,B=!0,function(t){t.stack=(new Error).stack};var i;try{throw new Error}catch(o){i="stack"in o}return"stack"in r||!i||"number"!=typeof Error.stackTraceLimit?(U=function(t,e){return"string"==typeof t?t:"object"!=typeof e&&"function"!=typeof e||void 0===e.name||void 0===e.message?k(e):e.toString()},null):(N=t,U=e,function(t){Error.stackTraceLimit+=6;try{throw new Error}catch(e){t.stack=e.stack}Error.stackTraceLimit-=6})}([]),Y=function(){if(I.isNode)return function(t,e,n){return"rejectionHandled"===t?process.emit(t,n):process.emit(t,e,n)};var t="undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:void 0!==this?this:null;if(!t)return function(){return!1};try{var e=document.createEvent("CustomEvent");e.initCustomEvent("testingtheevent",!1,!0,{}),t.dispatchEvent(e),K=function(e,n){var r=document.createEvent("CustomEvent");return r.initCustomEvent(e,!1,!0,n),!t.dispatchEvent(r)}}catch(n){}var r={};return r.unhandledRejection="onunhandledRejection".toLowerCase(),r.rejectionHandled="onrejectionHandled".toLowerCase(),function(e,n,i){var o=r[e],s=t[o];return s?("rejectionHandled"===e?s.call(t,i):s.call(t,n,i),!0):!1}}();"undefined"!=typeof console&&"undefined"!=typeof console.warn&&(S=function(t){console.warn(t)},I.isNode&&process.stderr.isTTY?S=function(t,e){var n=e?"[33m":"[31m";console.warn(n+t+"[0m\n")}:I.isNode||"string"!=typeof(new Error).stack||(S=function(t,e){console.warn("%c"+t,e?"color: darkorange":"color: red")}));var Z={warnings:q,longStackTraces:!1,cancellation:!1};return Q&&e.longStackTraces(),{longStackTraces:function(){return Z.longStackTraces},warnings:function(){return Z.warnings},cancellation:function(){return Z.cancellation},propagateFromFunction:function(){return G},boundValueFunction:function(){return u},checkForgottenReturns:f,setBounds:T,warn:d,deprecated:_,CapturedTrace:R}}},{"./errors":12,"./util":36}],10:[function(t,e,n){"use strict";e.exports=function(t){function e(){return this.value}function n(){throw this.reason}t.prototype["return"]=t.prototype.thenReturn=function(n){return n instanceof t&&n.suppressUnhandledRejections(),this._then(e,void 0,void 0,{value:n},void 0)},t.prototype["throw"]=t.prototype.thenThrow=function(t){return this._then(n,void 0,void 0,{reason:t},void 0)},t.prototype.catchThrow=function(t){if(arguments.length<=1)return this._then(void 0,n,void 0,{reason:t},void 0);var e=arguments[1],r=function(){throw e};return this.caught(t,r)},t.prototype.catchReturn=function(n){if(arguments.length<=1)return n instanceof t&&n.suppressUnhandledRejections(),this._then(void 0,e,void 0,{value:n},void 0);var r=arguments[1];r instanceof t&&r.suppressUnhandledRejections();var i=function(){return r};return this.caught(n,i)}}},{}],11:[function(t,e,n){"use strict";e.exports=function(t,e){function n(){return o(this)}function r(t,n){return i(t,n,e,e)}var i=t.reduce,o=t.all;t.prototype.each=function(t){return this.mapSeries(t)._then(n,void 0,void 0,this,void 0)},t.prototype.mapSeries=function(t){return i(this,t,e,e)},t.each=function(t,e){return r(t,e)._then(n,void 0,void 0,t,void 0)},t.mapSeries=r}},{}],12:[function(t,e,n){"use strict";function r(t,e){function n(r){return this instanceof n?(p(this,"message","string"==typeof r?r:e),p(this,"name",t),void(Error.captureStackTrace?Error.captureStackTrace(this,this.constructor):Error.call(this))):new n(r)}return u(n,Error),n}function i(t){return this instanceof i?(p(this,"name","OperationalError"),p(this,"message",t),this.cause=t,this.isOperational=!0,void(t instanceof Error?(p(this,"message",t.message),p(this,"stack",t.stack)):Error.captureStackTrace&&Error.captureStackTrace(this,this.constructor))):new i(t)}var o,s,a=t("./es5"),c=a.freeze,l=t("./util"),u=l.inherits,p=l.notEnumerableProp,h=r("Warning","warning"),f=r("CancellationError","cancellation error"),_=r("TimeoutError","timeout error"),d=r("AggregateError","aggregate error");try{o=TypeError,s=RangeError}catch(v){o=r("TypeError","type error"),s=r("RangeError","range error")}for(var y="join pop push shift unshift slice filter forEach some every map indexOf lastIndexOf reduce reduceRight sort reverse".split(" "),g=0;g<y.length;++g)"function"==typeof Array.prototype[y[g]]&&(d.prototype[y[g]]=Array.prototype[y[g]]);a.defineProperty(d.prototype,"length",{value:0,configurable:!1,writable:!0,enumerable:!0}),d.prototype.isOperational=!0;var m=0;d.prototype.toString=function(){var t=Array(4*m+1).join(" "),e="\n"+t+"AggregateError of:\n";m++,t=Array(4*m+1).join(" ");for(var n=0;n<this.length;++n){for(var r=this[n]===this?"[Circular AggregateError]":this[n]+"",i=r.split("\n"),o=0;o<i.length;++o)i[o]=t+i[o];r=i.join("\n"),e+=r+"\n"}return m--,e},u(i,Error);var b=Error.__BluebirdErrorTypes__;b||(b=c({CancellationError:f,TimeoutError:_,OperationalError:i,RejectionError:i,AggregateError:d}),p(Error,"__BluebirdErrorTypes__",b)),e.exports={Error:Error,TypeError:o,RangeError:s,CancellationError:b.CancellationError,OperationalError:b.OperationalError,TimeoutError:b.TimeoutError,AggregateError:b.AggregateError,Warning:h}},{"./es5":13,"./util":36}],13:[function(t,e,n){var r=function(){"use strict";return void 0===this}();if(r)e.exports={freeze:Object.freeze,defineProperty:Object.defineProperty,getDescriptor:Object.getOwnPropertyDescriptor,keys:Object.keys,names:Object.getOwnPropertyNames,getPrototypeOf:Object.getPrototypeOf,isArray:Array.isArray,isES5:r,propertyIsWritable:function(t,e){var n=Object.getOwnPropertyDescriptor(t,e);return!(n&&!n.writable&&!n.set)}};else{var i={}.hasOwnProperty,o={}.toString,s={}.constructor.prototype,a=function(t){var e=[];for(var n in t)i.call(t,n)&&e.push(n);return e},c=function(t,e){return{value:t[e]}},l=function(t,e,n){return t[e]=n.value,t},u=function(t){return t},p=function(t){try{return Object(t).constructor.prototype}catch(e){return s}},h=function(t){try{return"[object Array]"===o.call(t)}catch(e){return!1}};e.exports={isArray:h,keys:a,names:a,defineProperty:l,getDescriptor:c,freeze:u,getPrototypeOf:p,isES5:r,propertyIsWritable:function(){return!0}}}},{}],14:[function(t,e,n){"use strict";e.exports=function(t,e){var n=t.map;t.prototype.filter=function(t,r){return n(this,t,r,e)},t.filter=function(t,r,i){return n(t,r,i,e)}}},{}],15:[function(t,e,n){"use strict";e.exports=function(e,n){function r(t,e,n){this.promise=t,this.type=e,this.handler=n,this.called=!1,this.cancelPromise=null}function i(t){this.finallyHandler=t}function o(t,e){return null!=t.cancelPromise?(arguments.length>1?t.cancelPromise._reject(e):t.cancelPromise._cancel(),t.cancelPromise=null,!0):!1}function s(){return c.call(this,this.promise._target()._settledValue())}function a(t){return o(this,t)?void 0:(p.e=t,p)}function c(t){var r=this.promise,c=this.handler;if(!this.called){this.called=!0;var l=0===this.type?c.call(r._boundValue()):c.call(r._boundValue(),t);if(void 0!==l){r._setReturnedNonUndefined();var h=n(l,r);if(h instanceof e){if(null!=this.cancelPromise){if(h.isCancelled()){var f=new u("late cancellation observer");return r._attachExtraTrace(f),p.e=f,p}h.isPending()&&h._attachCancellationCallback(new i(this))}return h._then(s,a,void 0,this,void 0)}}}return r.isRejected()?(o(this),p.e=t,p):(o(this),t)}var l=t("./util"),u=e.CancellationError,p=l.errorObj;return i.prototype._resultCancelled=function(){o(this.finallyHandler)},e.prototype._passThrough=function(t,e,n,i){return"function"!=typeof t?this.then():this._then(n,i,void 0,new r(this,e,t),void 0)},e.prototype.lastly=e.prototype["finally"]=function(t){return this._passThrough(t,0,c,c)},e.prototype.tap=function(t){return this._passThrough(t,1,c)},r}},{"./util":36}],16:[function(t,e,n){"use strict";e.exports=function(e,n,r,i,o,s){function a(t,n,r){for(var o=0;o<n.length;++o){r._pushContext();var s=f(n[o])(t);if(r._popContext(),s===h){r._pushContext();var a=e.reject(h.e);return r._popContext(),a}var c=i(s,r);if(c instanceof e)return c}return null}function c(t,n,i,o){var s=this._promise=new e(r);s._captureStackTrace(),s._setOnCancel(this),this._stack=o,this._generatorFunction=t,this._receiver=n,this._generator=void 0,this._yieldHandlers="function"==typeof i?[i].concat(_):_,this._yieldedPromise=null}var l=t("./errors"),u=l.TypeError,p=t("./util"),h=p.errorObj,f=p.tryCatch,_=[];p.inherits(c,o),c.prototype._isResolved=function(){return null===this._promise},c.prototype._cleanup=function(){this._promise=this._generator=null},c.prototype._promiseCancelled=function(){if(!this._isResolved()){var t,n="undefined"!=typeof this._generator["return"];if(n)this._promise._pushContext(),t=f(this._generator["return"]).call(this._generator,void 0),this._promise._popContext();else{var r=new e.CancellationError("generator .return() sentinel");e.coroutine.returnSentinel=r,this._promise._attachExtraTrace(r),this._promise._pushContext(),t=f(this._generator["throw"]).call(this._generator,r),this._promise._popContext(),t===h&&t.e===r&&(t=null)}var i=this._promise;this._cleanup(),t===h?i._rejectCallback(t.e,!1):i.cancel()}},c.prototype._promiseFulfilled=function(t){this._yieldedPromise=null,this._promise._pushContext();var e=f(this._generator.next).call(this._generator,t);this._promise._popContext(),this._continue(e)},c.prototype._promiseRejected=function(t){this._yieldedPromise=null,this._promise._attachExtraTrace(t),this._promise._pushContext();var e=f(this._generator["throw"]).call(this._generator,t);this._promise._popContext(),this._continue(e)},c.prototype._resultCancelled=function(){if(this._yieldedPromise instanceof e){var t=this._yieldedPromise;this._yieldedPromise=null,t.cancel()}},c.prototype.promise=function(){return this._promise},c.prototype._run=function(){this._generator=this._generatorFunction.call(this._receiver),this._receiver=this._generatorFunction=void 0,this._promiseFulfilled(void 0)},c.prototype._continue=function(t){var n=this._promise;if(t===h)return this._cleanup(),n._rejectCallback(t.e,!1);var r=t.value;if(t.done===!0)return this._cleanup(),n._resolveCallback(r);var o=i(r,this._promise);if(!(o instanceof e)&&(o=a(o,this._yieldHandlers,this._promise),null===o))return void this._promiseRejected(new u("A value %s was yielded that could not be treated as a promise\n\n    See http://goo.gl/MqrFmX\n\n".replace("%s",r)+"From coroutine:\n"+this._stack.split("\n").slice(1,-7).join("\n")));o=o._target();var s=o._bitField;0===(50397184&s)?(this._yieldedPromise=o,o._proxy(this,null)):0!==(33554432&s)?this._promiseFulfilled(o._value()):0!==(16777216&s)?this._promiseRejected(o._reason()):this._promiseCancelled()},e.coroutine=function(t,e){if("function"!=typeof t)throw new u("generatorFunction must be a function\n\n    See http://goo.gl/MqrFmX\n");var n=Object(e).yieldHandler,r=c,i=(new Error).stack;return function(){var e=t.apply(this,arguments),o=new r(void 0,void 0,n,i),s=o.promise();return o._generator=e,o._promiseFulfilled(void 0),s}},e.coroutine.addYieldHandler=function(t){if("function"!=typeof t)throw new u("expecting a function but got "+p.classString(t));_.push(t)},e.spawn=function(t){if(s.deprecated("Promise.spawn()","Promise.coroutine()"),"function"!=typeof t)return n("generatorFunction must be a function\n\n    See http://goo.gl/MqrFmX\n");var r=new c(t,this),i=r.promise();return r._run(e.spawn),i}}},{"./errors":12,"./util":36}],17:[function(t,e,n){"use strict";e.exports=function(e,n,r,i){var o=t("./util");o.canEvaluate,o.tryCatch,o.errorObj;e.join=function(){var t,e=arguments.length-1;if(e>0&&"function"==typeof arguments[e]){t=arguments[e];var r}var i=[].slice.call(arguments);t&&i.pop();var r=new n(i).promise();return void 0!==t?r.spread(t):r}}},{"./util":36}],18:[function(t,e,n){"use strict";e.exports=function(e,n,r,i,o,s){function a(t,e,n,r){this.constructor$(t),this._promise._captureStackTrace();var i=l();this._callback=null===i?e:i.bind(e),this._preservedValues=r===o?new Array(this.length()):null,this._limit=n,this._inFlight=0,this._queue=n>=1?[]:f,this._init$(void 0,-2)}function c(t,e,n,i){if("function"!=typeof e)return r("expecting a function but got "+u.classString(e));var o="object"==typeof n&&null!==n?n.concurrency:0;return o="number"==typeof o&&isFinite(o)&&o>=1?o:0,new a(t,e,o,i).promise()}var l=e._getDomain,u=t("./util"),p=u.tryCatch,h=u.errorObj,f=[];u.inherits(a,n),a.prototype._init=function(){},a.prototype._promiseFulfilled=function(t,n){var r=this._values,o=this.length(),a=this._preservedValues,c=this._limit;if(0>n){if(n=-1*n-1,r[n]=t,c>=1&&(this._inFlight--,this._drainQueue(),this._isResolved()))return!0}else{if(c>=1&&this._inFlight>=c)return r[n]=t,this._queue.push(n),!1;null!==a&&(a[n]=t);var l=this._promise,u=this._callback,f=l._boundValue();l._pushContext();var _=p(u).call(f,t,n,o),d=l._popContext();if(s.checkForgottenReturns(_,d,null!==a?"Promise.filter":"Promise.map",l),_===h)return this._reject(_.e),!0;var v=i(_,this._promise);if(v instanceof e){v=v._target();var y=v._bitField;if(0===(50397184&y))return c>=1&&this._inFlight++,r[n]=v,v._proxy(this,-1*(n+1)),!1;if(0===(33554432&y))return 0!==(16777216&y)?(this._reject(v._reason()),
!0):(this._cancel(),!0);_=v._value()}r[n]=_}var g=++this._totalResolved;return g>=o?(null!==a?this._filter(r,a):this._resolve(r),!0):!1},a.prototype._drainQueue=function(){for(var t=this._queue,e=this._limit,n=this._values;t.length>0&&this._inFlight<e;){if(this._isResolved())return;var r=t.pop();this._promiseFulfilled(n[r],r)}},a.prototype._filter=function(t,e){for(var n=e.length,r=new Array(n),i=0,o=0;n>o;++o)t[o]&&(r[i++]=e[o]);r.length=i,this._resolve(r)},a.prototype.preservedValues=function(){return this._preservedValues},e.prototype.map=function(t,e){return c(this,t,e,null)},e.map=function(t,e,n,r){return c(t,e,n,r)}}},{"./util":36}],19:[function(t,e,n){"use strict";e.exports=function(e,n,r,i,o){var s=t("./util"),a=s.tryCatch;e.method=function(t){if("function"!=typeof t)throw new e.TypeError("expecting a function but got "+s.classString(t));return function(){var r=new e(n);r._captureStackTrace(),r._pushContext();var i=a(t).apply(this,arguments),s=r._popContext();return o.checkForgottenReturns(i,s,"Promise.method",r),r._resolveFromSyncValue(i),r}},e.attempt=e["try"]=function(t){if("function"!=typeof t)return i("expecting a function but got "+s.classString(t));var r=new e(n);r._captureStackTrace(),r._pushContext();var c;if(arguments.length>1){o.deprecated("calling Promise.try with more than 1 argument");var l=arguments[1],u=arguments[2];c=s.isArray(l)?a(t).apply(u,l):a(t).call(u,l)}else c=a(t)();var p=r._popContext();return o.checkForgottenReturns(c,p,"Promise.try",r),r._resolveFromSyncValue(c),r},e.prototype._resolveFromSyncValue=function(t){t===s.errorObj?this._rejectCallback(t.e,!1):this._resolveCallback(t,!0)}}},{"./util":36}],20:[function(t,e,n){"use strict";function r(t){return t instanceof Error&&u.getPrototypeOf(t)===Error.prototype}function i(t){var e;if(r(t)){e=new l(t),e.name=t.name,e.message=t.message,e.stack=t.stack;for(var n=u.keys(t),i=0;i<n.length;++i){var o=n[i];p.test(o)||(e[o]=t[o])}return e}return s.markAsOriginatingFromRejection(t),t}function o(t,e){return function(n,r){if(null!==t){if(n){var o=i(a(n));t._attachExtraTrace(o),t._reject(o)}else if(e){var s=[].slice.call(arguments,1);t._fulfill(s)}else t._fulfill(r);t=null}}}var s=t("./util"),a=s.maybeWrapAsError,c=t("./errors"),l=c.OperationalError,u=t("./es5"),p=/^(?:name|message|stack|cause)$/;e.exports=o},{"./errors":12,"./es5":13,"./util":36}],21:[function(t,e,n){"use strict";e.exports=function(e){function n(t,e){var n=this;if(!o.isArray(t))return r.call(n,t,e);var i=a(e).apply(n._boundValue(),[null].concat(t));i===c&&s.throwLater(i.e)}function r(t,e){var n=this,r=n._boundValue(),i=void 0===t?a(e).call(r,null):a(e).call(r,null,t);i===c&&s.throwLater(i.e)}function i(t,e){var n=this;if(!t){var r=new Error(t+"");r.cause=t,t=r}var i=a(e).call(n._boundValue(),t);i===c&&s.throwLater(i.e)}var o=t("./util"),s=e._async,a=o.tryCatch,c=o.errorObj;e.prototype.asCallback=e.prototype.nodeify=function(t,e){if("function"==typeof t){var o=r;void 0!==e&&Object(e).spread&&(o=n),this._then(o,i,void 0,this,t)}return this}}},{"./util":36}],22:[function(t,e,n){"use strict";e.exports=function(){function e(){}function n(t,e){if("function"!=typeof e)throw new y("expecting a function but got "+h.classString(e));if(t.constructor!==r)throw new y("the promise constructor cannot be invoked directly\n\n    See http://goo.gl/MqrFmX\n")}function r(t){this._bitField=0,this._fulfillmentHandler0=void 0,this._rejectionHandler0=void 0,this._promise0=void 0,this._receiver0=void 0,t!==m&&(n(this,t),this._resolveFromExecutor(t)),this._promiseCreated()}function i(t){this.promise._resolveCallback(t)}function o(t){this.promise._rejectCallback(t,!1)}function s(t){var e=new r(m);e._fulfillmentHandler0=t,e._rejectionHandler0=t,e._promise0=t,e._receiver0=t}var a,c=function(){return new y("circular promise resolution chain\n\n    See http://goo.gl/MqrFmX\n")},l=function(){return new r.PromiseInspection(this._target())},u=function(t){return r.reject(new y(t))},p={},h=t("./util");a=h.isNode?function(){var t=process.domain;return void 0===t&&(t=null),t}:function(){return null},h.notEnumerableProp(r,"_getDomain",a);var f=t("./es5"),_=t("./async"),d=new _;f.defineProperty(r,"_async",{value:d});var v=t("./errors"),y=r.TypeError=v.TypeError;r.RangeError=v.RangeError;var g=r.CancellationError=v.CancellationError;r.TimeoutError=v.TimeoutError,r.OperationalError=v.OperationalError,r.RejectionError=v.OperationalError,r.AggregateError=v.AggregateError;var m=function(){},b={},w={},C=t("./thenables")(r,m),j=t("./promise_array")(r,m,C,u,e),k=t("./context")(r),F=k.create,E=t("./debuggability")(r,k),x=(E.CapturedTrace,t("./finally")(r,C)),T=t("./catch_filter")(w),R=t("./nodeback"),P=h.errorObj,O=h.tryCatch;return r.prototype.toString=function(){return"[object Promise]"},r.prototype.caught=r.prototype["catch"]=function(t){var e=arguments.length;if(e>1){var n,r=new Array(e-1),i=0;for(n=0;e-1>n;++n){var o=arguments[n];if(!h.isObject(o))return u("expecting an object but got "+h.classString(o));r[i++]=o}return r.length=i,t=arguments[n],this.then(void 0,T(r,t,this))}return this.then(void 0,t)},r.prototype.reflect=function(){return this._then(l,l,void 0,this,void 0)},r.prototype.then=function(t,e){if(E.warnings()&&arguments.length>0&&"function"!=typeof t&&"function"!=typeof e){var n=".then() only accepts functions but was passed: "+h.classString(t);arguments.length>1&&(n+=", "+h.classString(e)),this._warn(n)}return this._then(t,e,void 0,void 0,void 0)},r.prototype.done=function(t,e){var n=this._then(t,e,void 0,void 0,void 0);n._setIsFinal()},r.prototype.spread=function(t){return"function"!=typeof t?u("expecting a function but got "+h.classString(t)):this.all()._then(t,void 0,void 0,b,void 0)},r.prototype.toJSON=function(){var t={isFulfilled:!1,isRejected:!1,fulfillmentValue:void 0,rejectionReason:void 0};return this.isFulfilled()?(t.fulfillmentValue=this.value(),t.isFulfilled=!0):this.isRejected()&&(t.rejectionReason=this.reason(),t.isRejected=!0),t},r.prototype.all=function(){return arguments.length>0&&this._warn(".all() was passed arguments but it does not take any"),new j(this).promise()},r.prototype.error=function(t){return this.caught(h.originatesFromRejection,t)},r.is=function(t){return t instanceof r},r.fromNode=r.fromCallback=function(t){var e=new r(m);e._captureStackTrace();var n=arguments.length>1?!!Object(arguments[1]).multiArgs:!1,i=O(t)(R(e,n));return i===P&&e._rejectCallback(i.e,!0),e._isFateSealed()||e._setAsyncGuaranteed(),e},r.all=function(t){return new j(t).promise()},r.cast=function(t){var e=C(t);return e instanceof r||(e=new r(m),e._captureStackTrace(),e._setFulfilled(),e._rejectionHandler0=t),e},r.resolve=r.fulfilled=r.cast,r.reject=r.rejected=function(t){var e=new r(m);return e._captureStackTrace(),e._rejectCallback(t,!0),e},r.setScheduler=function(t){if("function"!=typeof t)throw new y("expecting a function but got "+h.classString(t));var e=d._schedule;return d._schedule=t,e},r.prototype._then=function(t,e,n,i,o){var s=void 0!==o,c=s?o:new r(m),l=this._target(),u=l._bitField;s||(c._propagateFrom(this,3),c._captureStackTrace(),void 0===i&&0!==(2097152&this._bitField)&&(i=0!==(50397184&u)?this._boundValue():l===this?void 0:this._boundTo));var p=a();if(0!==(50397184&u)){var h,f,_=l._settlePromiseCtx;0!==(33554432&u)?(f=l._rejectionHandler0,h=t):0!==(16777216&u)?(f=l._fulfillmentHandler0,h=e,l._unsetRejectionIsUnhandled()):(_=l._settlePromiseLateCancellationObserver,f=new g("late cancellation observer"),l._attachExtraTrace(f),h=e),d.invoke(_,l,{handler:null===p?h:"function"==typeof h&&p.bind(h),promise:c,receiver:i,value:f})}else l._addCallbacks(t,e,c,i,p);return c},r.prototype._length=function(){return 65535&this._bitField},r.prototype._isFateSealed=function(){return 0!==(117506048&this._bitField)},r.prototype._isFollowing=function(){return 67108864===(67108864&this._bitField)},r.prototype._setLength=function(t){this._bitField=-65536&this._bitField|65535&t},r.prototype._setFulfilled=function(){this._bitField=33554432|this._bitField},r.prototype._setRejected=function(){this._bitField=16777216|this._bitField},r.prototype._setFollowing=function(){this._bitField=67108864|this._bitField},r.prototype._setIsFinal=function(){this._bitField=4194304|this._bitField},r.prototype._isFinal=function(){return(4194304&this._bitField)>0},r.prototype._unsetCancelled=function(){this._bitField=-65537&this._bitField},r.prototype._setCancelled=function(){this._bitField=65536|this._bitField},r.prototype._setAsyncGuaranteed=function(){this._bitField=134217728|this._bitField},r.prototype._receiverAt=function(t){var e=0===t?this._receiver0:this[4*t-4+3];return e===p?void 0:void 0===e&&this._isBound()?this._boundValue():e},r.prototype._promiseAt=function(t){return this[4*t-4+2]},r.prototype._fulfillmentHandlerAt=function(t){return this[4*t-4+0]},r.prototype._rejectionHandlerAt=function(t){return this[4*t-4+1]},r.prototype._boundValue=function(){},r.prototype._migrateCallback0=function(t){var e=(t._bitField,t._fulfillmentHandler0),n=t._rejectionHandler0,r=t._promise0,i=t._receiverAt(0);void 0===i&&(i=p),this._addCallbacks(e,n,r,i,null)},r.prototype._migrateCallbackAt=function(t,e){var n=t._fulfillmentHandlerAt(e),r=t._rejectionHandlerAt(e),i=t._promiseAt(e),o=t._receiverAt(e);void 0===o&&(o=p),this._addCallbacks(n,r,i,o,null)},r.prototype._addCallbacks=function(t,e,n,r,i){var o=this._length();if(o>=65531&&(o=0,this._setLength(0)),0===o)this._promise0=n,this._receiver0=r,"function"==typeof t&&(this._fulfillmentHandler0=null===i?t:i.bind(t)),"function"==typeof e&&(this._rejectionHandler0=null===i?e:i.bind(e));else{var s=4*o-4;this[s+2]=n,this[s+3]=r,"function"==typeof t&&(this[s+0]=null===i?t:i.bind(t)),"function"==typeof e&&(this[s+1]=null===i?e:i.bind(e))}return this._setLength(o+1),o},r.prototype._proxy=function(t,e){this._addCallbacks(void 0,void 0,e,t,null)},r.prototype._resolveCallback=function(t,e){if(0===(117506048&this._bitField)){if(t===this)return this._rejectCallback(c(),!1);var n=C(t,this);if(!(n instanceof r))return this._fulfill(t);e&&this._propagateFrom(n,2);var i=n._target(),o=i._bitField;if(0===(50397184&o)){var s=this._length();s>0&&i._migrateCallback0(this);for(var a=1;s>a;++a)i._migrateCallbackAt(this,a);this._setFollowing(),this._setLength(0),this._setFollowee(i)}else if(0!==(33554432&o))this._fulfill(i._value());else if(0!==(16777216&o))this._reject(i._reason());else{var l=new g("late cancellation observer");i._attachExtraTrace(l),this._reject(l)}}},r.prototype._rejectCallback=function(t,e,n){var r=h.ensureErrorObject(t),i=r===t;if(!i&&!n&&E.warnings()){var o="a promise was rejected with a non-error: "+h.classString(t);this._warn(o,!0)}this._attachExtraTrace(r,e?i:!1),this._reject(t)},r.prototype._resolveFromExecutor=function(t){var e=this;this._captureStackTrace(),this._pushContext();var n=!0,r=this._execute(t,function(t){e._resolveCallback(t)},function(t){e._rejectCallback(t,n)});n=!1,this._popContext(),void 0!==r&&e._rejectCallback(r,!0)},r.prototype._settlePromiseFromHandler=function(t,e,n,r){var i=r._bitField;if(0===(65536&i)){r._pushContext();var o;e===b?n&&"number"==typeof n.length?o=O(t).apply(this._boundValue(),n):(o=P,o.e=new y("cannot .spread() a non-array: "+h.classString(n))):o=O(t).call(e,n);var s=r._popContext();if(i=r._bitField,0===(65536&i))if(o===w)r._reject(n);else if(o===P||o===r){var a=o===r?c():o.e;r._rejectCallback(a,!1)}else E.checkForgottenReturns(o,s,"",r,this),r._resolveCallback(o)}},r.prototype._target=function(){for(var t=this;t._isFollowing();)t=t._followee();return t},r.prototype._followee=function(){return this._rejectionHandler0},r.prototype._setFollowee=function(t){this._rejectionHandler0=t},r.prototype._settlePromise=function(t,n,i,o){var s=t instanceof r,a=this._bitField,c=0!==(134217728&a);0!==(65536&a)?(s&&t._invokeInternalOnCancel(),i instanceof x?(i.cancelPromise=t,O(n).call(i,o)===P&&t._reject(P.e)):n===l?t._fulfill(l.call(i)):i instanceof e?i._promiseCancelled(t):s||t instanceof j?t._cancel():i.cancel()):"function"==typeof n?s?(c&&t._setAsyncGuaranteed(),this._settlePromiseFromHandler(n,i,o,t)):n.call(i,o,t):i instanceof e?i._isResolved()||(0!==(33554432&a)?i._promiseFulfilled(o,t):i._promiseRejected(o,t)):s&&(c&&t._setAsyncGuaranteed(),0!==(33554432&a)?t._fulfill(o):t._reject(o))},r.prototype._settlePromiseLateCancellationObserver=function(t){var e=t.handler,n=t.promise,i=t.receiver,o=t.value;"function"==typeof e?n instanceof r?this._settlePromiseFromHandler(e,i,o,n):e.call(i,o,n):n instanceof r&&n._reject(o)},r.prototype._settlePromiseCtx=function(t){this._settlePromise(t.promise,t.handler,t.receiver,t.value)},r.prototype._settlePromise0=function(t,e,n){var r=this._promise0,i=this._receiverAt(0);this._promise0=void 0,this._receiver0=void 0,this._settlePromise(r,t,i,e)},r.prototype._clearCallbackDataAtIndex=function(t){var e=4*t-4;this[e+2]=this[e+3]=this[e+0]=this[e+1]=void 0},r.prototype._fulfill=function(t){var e=this._bitField;if(!((117506048&e)>>>16)){if(t===this){var n=c();return this._attachExtraTrace(n),this._reject(n)}this._setFulfilled(),this._rejectionHandler0=t,(65535&e)>0&&(0!==(134217728&e)?this._settlePromises():d.settlePromises(this))}},r.prototype._reject=function(t){var e=this._bitField;if(!((117506048&e)>>>16))return this._setRejected(),this._fulfillmentHandler0=t,this._isFinal()?d.fatalError(t,h.isNode):void((65535&e)>0?0!==(134217728&e)?this._settlePromises():d.settlePromises(this):this._ensurePossibleRejectionHandled())},r.prototype._fulfillPromises=function(t,e){for(var n=1;t>n;n++){var r=this._fulfillmentHandlerAt(n),i=this._promiseAt(n),o=this._receiverAt(n);this._clearCallbackDataAtIndex(n),this._settlePromise(i,r,o,e)}},r.prototype._rejectPromises=function(t,e){for(var n=1;t>n;n++){var r=this._rejectionHandlerAt(n),i=this._promiseAt(n),o=this._receiverAt(n);this._clearCallbackDataAtIndex(n),this._settlePromise(i,r,o,e)}},r.prototype._settlePromises=function(){var t=this._bitField,e=65535&t;if(e>0){if(0!==(16842752&t)){var n=this._fulfillmentHandler0;this._settlePromise0(this._rejectionHandler0,n,t),this._rejectPromises(e,n)}else{var r=this._rejectionHandler0;this._settlePromise0(this._fulfillmentHandler0,r,t),this._fulfillPromises(e,r)}this._setLength(0)}this._clearCancellationData()},r.prototype._settledValue=function(){var t=this._bitField;return 0!==(33554432&t)?this._rejectionHandler0:0!==(16777216&t)?this._fulfillmentHandler0:void 0},r.defer=r.pending=function(){E.deprecated("Promise.defer","new Promise");var t=new r(m);return{promise:t,resolve:i,reject:o}},h.notEnumerableProp(r,"_makeSelfResolutionError",c),t("./method")(r,m,C,u,E),t("./bind")(r,m,C,E),t("./cancel")(r,j,u,E),t("./direct_resolve")(r),t("./synchronous_inspection")(r),t("./join")(r,j,C,m,E),r.Promise=r,t("./map.js")(r,j,u,C,m,E),t("./using.js")(r,u,C,F,m,E),t("./timers.js")(r,m,E),t("./generators.js")(r,u,m,C,e,E),t("./nodeify.js")(r),t("./call_get.js")(r),t("./props.js")(r,j,C,u),t("./race.js")(r,m,C,u),t("./reduce.js")(r,j,u,C,m,E),t("./settle.js")(r,j,E),t("./some.js")(r,j,u),t("./promisify.js")(r,m),t("./any.js")(r),t("./each.js")(r,m),t("./filter.js")(r,m),h.toFastProperties(r),h.toFastProperties(r.prototype),s({a:1}),s({b:2}),s({c:3}),s(1),s(function(){}),s(void 0),s(!1),s(new r(m)),E.setBounds(_.firstLineError,h.lastLineError),r}},{"./any.js":1,"./async":2,"./bind":3,"./call_get.js":5,"./cancel":6,"./catch_filter":7,"./context":8,"./debuggability":9,"./direct_resolve":10,"./each.js":11,"./errors":12,"./es5":13,"./filter.js":14,"./finally":15,"./generators.js":16,"./join":17,"./map.js":18,"./method":19,"./nodeback":20,"./nodeify.js":21,"./promise_array":23,"./promisify.js":24,"./props.js":25,"./race.js":27,"./reduce.js":28,"./settle.js":30,"./some.js":31,"./synchronous_inspection":32,"./thenables":33,"./timers.js":34,"./using.js":35,"./util":36}],23:[function(t,e,n){"use strict";e.exports=function(e,n,r,i,o){function s(t){switch(t){case-2:return[];case-3:return{}}}function a(t){var r=this._promise=new e(n);t instanceof e&&r._propagateFrom(t,3),r._setOnCancel(this),this._values=t,this._length=0,this._totalResolved=0,this._init(void 0,-2)}var c=t("./util");c.isArray;return c.inherits(a,o),a.prototype.length=function(){return this._length},a.prototype.promise=function(){return this._promise},a.prototype._init=function l(t,n){var o=r(this._values,this._promise);if(o instanceof e){o=o._target();var a=o._bitField;if(this._values=o,0===(50397184&a))return this._promise._setAsyncGuaranteed(),o._then(l,this._reject,void 0,this,n);if(0===(33554432&a))return 0!==(16777216&a)?this._reject(o._reason()):this._cancel();o=o._value()}if(o=c.asArray(o),null===o){var u=i("expecting an array or an iterable object but got "+c.classString(o)).reason();return void this._promise._rejectCallback(u,!1)}return 0===o.length?void(-5===n?this._resolveEmptyArray():this._resolve(s(n))):void this._iterate(o)},a.prototype._iterate=function(t){var n=this.getActualLength(t.length);this._length=n,this._values=this.shouldCopyValues()?new Array(n):this._values;for(var i=this._promise,o=!1,s=null,a=0;n>a;++a){var c=r(t[a],i);c instanceof e?(c=c._target(),s=c._bitField):s=null,o?null!==s&&c.suppressUnhandledRejections():null!==s?0===(50397184&s)?(c._proxy(this,a),this._values[a]=c):o=0!==(33554432&s)?this._promiseFulfilled(c._value(),a):0!==(16777216&s)?this._promiseRejected(c._reason(),a):this._promiseCancelled(a):o=this._promiseFulfilled(c,a)}o||i._setAsyncGuaranteed()},a.prototype._isResolved=function(){return null===this._values},a.prototype._resolve=function(t){this._values=null,this._promise._fulfill(t)},a.prototype._cancel=function(){!this._isResolved()&&this._promise.isCancellable()&&(this._values=null,this._promise._cancel())},a.prototype._reject=function(t){this._values=null,this._promise._rejectCallback(t,!1)},a.prototype._promiseFulfilled=function(t,e){this._values[e]=t;var n=++this._totalResolved;return n>=this._length?(this._resolve(this._values),!0):!1},a.prototype._promiseCancelled=function(){return this._cancel(),!0},a.prototype._promiseRejected=function(t){return this._totalResolved++,this._reject(t),!0},a.prototype._resultCancelled=function(){if(!this._isResolved()){var t=this._values;if(this._cancel(),t instanceof e)t.cancel();else for(var n=0;n<t.length;++n)t[n]instanceof e&&t[n].cancel()}},a.prototype.shouldCopyValues=function(){return!0},a.prototype.getActualLength=function(t){return t},a}},{"./util":36}],24:[function(t,e,n){"use strict";e.exports=function(e,n){function r(t){return!C.test(t)}function i(t){try{return t.__isPromisified__===!0}catch(e){return!1}}function o(t,e,n){var r=f.getDataPropertyOrDefault(t,e+n,b);return r?i(r):!1}function s(t,e,n){for(var r=0;r<t.length;r+=2){var i=t[r];if(n.test(i))for(var o=i.replace(n,""),s=0;s<t.length;s+=2)if(t[s]===o)throw new g("Cannot promisify an API that has normal methods with '%s'-suffix\n\n    See http://goo.gl/MqrFmX\n".replace("%s",e))}}function a(t,e,n,r){for(var a=f.inheritedDataKeys(t),c=[],l=0;l<a.length;++l){var u=a[l],p=t[u],h=r===j?!0:j(u,p,t);"function"!=typeof p||i(p)||o(t,u,e)||!r(u,p,t,h)||c.push(u,p)}return s(c,e,n),c}function c(t,r,i,o,s,a){function c(){var i=r;r===h&&(i=this);var o=new e(n);o._captureStackTrace();var s="string"==typeof u&&this!==l?this[u]:t,c=_(o,a);try{s.apply(i,d(arguments,c))}catch(p){o._rejectCallback(v(p),!0,!0)}return o._isFateSealed()||o._setAsyncGuaranteed(),o}var l=function(){return this}(),u=t;return"string"==typeof u&&(t=o),f.notEnumerableProp(c,"__isPromisified__",!0),c}function l(t,e,n,r,i){for(var o=new RegExp(k(e)+"$"),s=a(t,e,o,n),c=0,l=s.length;l>c;c+=2){var u=s[c],p=s[c+1],_=u+e;if(r===F)t[_]=F(u,h,u,p,e,i);else{var d=r(p,function(){return F(u,h,u,p,e,i)});f.notEnumerableProp(d,"__isPromisified__",!0),t[_]=d}}return f.toFastProperties(t),t}function u(t,e,n){return F(t,e,void 0,t,null,n)}var p,h={},f=t("./util"),_=t("./nodeback"),d=f.withAppended,v=f.maybeWrapAsError,y=f.canEvaluate,g=t("./errors").TypeError,m="Async",b={__isPromisified__:!0},w=["arity","length","name","arguments","caller","callee","prototype","__isPromisified__"],C=new RegExp("^(?:"+w.join("|")+")$"),j=function(t){return f.isIdentifier(t)&&"_"!==t.charAt(0)&&"constructor"!==t},k=function(t){return t.replace(/([$])/,"\\$")},F=y?p:c;e.promisify=function(t,e){if("function"!=typeof t)throw new g("expecting a function but got "+f.classString(t));if(i(t))return t;e=Object(e);var n=void 0===e.context?h:e.context,o=!!e.multiArgs,s=u(t,n,o);return f.copyDescriptors(t,s,r),s},e.promisifyAll=function(t,e){if("function"!=typeof t&&"object"!=typeof t)throw new g("the target of promisifyAll must be an object or a function\n\n    See http://goo.gl/MqrFmX\n");e=Object(e);var n=!!e.multiArgs,r=e.suffix;"string"!=typeof r&&(r=m);var i=e.filter;"function"!=typeof i&&(i=j);var o=e.promisifier;if("function"!=typeof o&&(o=F),!f.isIdentifier(r))throw new RangeError("suffix must be a valid identifier\n\n    See http://goo.gl/MqrFmX\n");for(var s=f.inheritedDataKeys(t),a=0;a<s.length;++a){var c=t[s[a]];"constructor"!==s[a]&&f.isClass(c)&&(l(c.prototype,r,i,o,n),l(c,r,i,o,n))}return l(t,r,i,o,n)}}},{"./errors":12,"./nodeback":20,"./util":36}],25:[function(t,e,n){"use strict";e.exports=function(e,n,r,i){function o(t){var e,n=!1;if(void 0!==a&&t instanceof a)e=p(t),n=!0;else{var r=u.keys(t),i=r.length;e=new Array(2*i);for(var o=0;i>o;++o){var s=r[o];e[o]=t[s],e[o+i]=s}}this.constructor$(e),this._isMap=n,this._init$(void 0,-3)}function s(t){var n,s=r(t);return l(s)?(n=s instanceof e?s._then(e.props,void 0,void 0,void 0,void 0):new o(s).promise(),s instanceof e&&n._propagateFrom(s,2),n):i("cannot await properties of a non-object\n\n    See http://goo.gl/MqrFmX\n")}var a,c=t("./util"),l=c.isObject,u=t("./es5");"function"==typeof Map&&(a=Map);var p=function(){function t(t,r){this[e]=t,this[e+n]=r,e++}var e=0,n=0;return function(r){n=r.size,e=0;var i=new Array(2*r.size);return r.forEach(t,i),i}}(),h=function(t){for(var e=new a,n=t.length/2|0,r=0;n>r;++r){var i=t[n+r],o=t[r];e.set(i,o)}return e};c.inherits(o,n),o.prototype._init=function(){},o.prototype._promiseFulfilled=function(t,e){this._values[e]=t;var n=++this._totalResolved;if(n>=this._length){var r;if(this._isMap)r=h(this._values);else{r={};for(var i=this.length(),o=0,s=this.length();s>o;++o)r[this._values[o+i]]=this._values[o]}return this._resolve(r),!0}return!1},o.prototype.shouldCopyValues=function(){return!1},o.prototype.getActualLength=function(t){return t>>1},e.prototype.props=function(){return s(this)},e.props=function(t){return s(t)}}},{"./es5":13,"./util":36}],26:[function(t,e,n){"use strict";function r(t,e,n,r,i){for(var o=0;i>o;++o)n[o+r]=t[o+e],t[o+e]=void 0}function i(t){this._capacity=t,this._length=0,this._front=0}i.prototype._willBeOverCapacity=function(t){return this._capacity<t},i.prototype._pushOne=function(t){var e=this.length();this._checkCapacity(e+1);var n=this._front+e&this._capacity-1;this[n]=t,this._length=e+1},i.prototype._unshiftOne=function(t){var e=this._capacity;this._checkCapacity(this.length()+1);var n=this._front,r=(n-1&e-1^e)-e;this[r]=t,this._front=r,this._length=this.length()+1},i.prototype.unshift=function(t,e,n){this._unshiftOne(n),this._unshiftOne(e),this._unshiftOne(t)},i.prototype.push=function(t,e,n){var r=this.length()+3;if(this._willBeOverCapacity(r))return this._pushOne(t),this._pushOne(e),void this._pushOne(n);var i=this._front+r-3;this._checkCapacity(r);var o=this._capacity-1;this[i+0&o]=t,this[i+1&o]=e,this[i+2&o]=n,this._length=r},i.prototype.shift=function(){var t=this._front,e=this[t];return this[t]=void 0,this._front=t+1&this._capacity-1,this._length--,e},i.prototype.length=function(){return this._length},i.prototype._checkCapacity=function(t){this._capacity<t&&this._resizeTo(this._capacity<<1)},i.prototype._resizeTo=function(t){var e=this._capacity;this._capacity=t;var n=this._front,i=this._length,o=n+i&e-1;r(this,0,this,e,o)},e.exports=i},{}],27:[function(t,e,n){"use strict";e.exports=function(e,n,r,i){function o(t,o){var c=r(t);if(c instanceof e)return a(c);if(t=s.asArray(t),null===t)return i("expecting an array or an iterable object but got "+s.classString(t));var l=new e(n);void 0!==o&&l._propagateFrom(o,3);for(var u=l._fulfill,p=l._reject,h=0,f=t.length;f>h;++h){var _=t[h];(void 0!==_||h in t)&&e.cast(_)._then(u,p,void 0,l,null)}return l}var s=t("./util"),a=function(t){return t.then(function(e){return o(e,t)})};e.race=function(t){return o(t,void 0)},e.prototype.race=function(){return o(this,void 0)}}},{"./util":36}],28:[function(t,e,n){"use strict";e.exports=function(e,n,r,i,o,s){function a(t,n,r,i){this.constructor$(t);var s=h();this._fn=null===s?n:s.bind(n),void 0!==r&&(r=e.resolve(r),r._attachCancellationCallback(this)),this._initialValue=r,this._currentCancellable=null,this._eachValues=i===o?[]:void 0,this._promise._captureStackTrace(),this._init$(void 0,-5)}function c(t,e){this.isFulfilled()?e._resolve(t):e._reject(t)}function l(t,e,n,i){if("function"!=typeof e)return r("expecting a function but got "+f.classString(e));var o=new a(t,e,n,i);return o.promise()}function u(t){this.accum=t,this.array._gotAccum(t);var n=i(this.value,this.array._promise);return n instanceof e?(this.array._currentCancellable=n,n._then(p,void 0,void 0,this,void 0)):p.call(this,n)}function p(t){var n=this.array,r=n._promise,i=_(n._fn);r._pushContext();var o;o=void 0!==n._eachValues?i.call(r._boundValue(),t,this.index,this.length):i.call(r._boundValue(),this.accum,t,this.index,this.length),o instanceof e&&(n._currentCancellable=o);var a=r._popContext();return s.checkForgottenReturns(o,a,void 0!==n._eachValues?"Promise.each":"Promise.reduce",r),o}var h=e._getDomain,f=t("./util"),_=f.tryCatch;f.inherits(a,n),a.prototype._gotAccum=function(t){void 0!==this._eachValues&&t!==o&&this._eachValues.push(t)},a.prototype._eachComplete=function(t){return this._eachValues.push(t),this._eachValues},a.prototype._init=function(){},a.prototype._resolveEmptyArray=function(){this._resolve(void 0!==this._eachValues?this._eachValues:this._initialValue)},a.prototype.shouldCopyValues=function(){return!1},a.prototype._resolve=function(t){this._promise._resolveCallback(t),this._values=null},a.prototype._resultCancelled=function(t){return t===this._initialValue?this._cancel():void(this._isResolved()||(this._resultCancelled$(),this._currentCancellable instanceof e&&this._currentCancellable.cancel(),this._initialValue instanceof e&&this._initialValue.cancel()))},a.prototype._iterate=function(t){this._values=t;var n,r,i=t.length;if(void 0!==this._initialValue?(n=this._initialValue,r=0):(n=e.resolve(t[0]),r=1),this._currentCancellable=n,!n.isRejected())for(;i>r;++r){var o={accum:null,value:t[r],index:r,length:i,array:this};n=n._then(u,void 0,void 0,o,void 0)}void 0!==this._eachValues&&(n=n._then(this._eachComplete,void 0,void 0,this,void 0)),n._then(c,c,void 0,n,this)},e.prototype.reduce=function(t,e){return l(this,t,e,null)},e.reduce=function(t,e,n,r){return l(t,e,n,r)}}},{"./util":36}],29:[function(t,e,n){"use strict";var r,i=t("./util"),o=function(){throw new Error("No async scheduler available\n\n    See http://goo.gl/MqrFmX\n")};if(i.isNode&&"undefined"==typeof MutationObserver){var s=global.setImmediate,a=process.nextTick;r=i.isRecentNode?function(t){s.call(global,t)}:function(t){a.call(process,t)}}else r="undefined"==typeof MutationObserver||"undefined"!=typeof window&&window.navigator&&window.navigator.standalone?"undefined"!=typeof setImmediate?function(t){setImmediate(t)}:"undefined"!=typeof setTimeout?function(t){setTimeout(t,0)}:o:function(){var t=document.createElement("div"),e={attributes:!0},n=!1,r=document.createElement("div"),i=new MutationObserver(function(){t.classList.toggle("foo"),n=!1});i.observe(r,e);var o=function(){n||(n=!0,r.classList.toggle("foo"))};return function(n){var r=new MutationObserver(function(){r.disconnect(),n()});r.observe(t,e),o()}}();e.exports=r},{"./util":36}],30:[function(t,e,n){"use strict";e.exports=function(e,n,r){function i(t){this.constructor$(t)}var o=e.PromiseInspection,s=t("./util");s.inherits(i,n),i.prototype._promiseResolved=function(t,e){this._values[t]=e;var n=++this._totalResolved;return n>=this._length?(this._resolve(this._values),!0):!1},i.prototype._promiseFulfilled=function(t,e){var n=new o;return n._bitField=33554432,n._settledValueField=t,this._promiseResolved(e,n)},i.prototype._promiseRejected=function(t,e){var n=new o;return n._bitField=16777216,n._settledValueField=t,this._promiseResolved(e,n)},e.settle=function(t){return r.deprecated(".settle()",".reflect()"),new i(t).promise()},e.prototype.settle=function(){return e.settle(this)}}},{"./util":36}],31:[function(t,e,n){"use strict";e.exports=function(e,n,r){function i(t){this.constructor$(t),this._howMany=0,this._unwrap=!1,this._initialized=!1}function o(t,e){if((0|e)!==e||0>e)return r("expecting a positive integer\n\n    See http://goo.gl/MqrFmX\n");var n=new i(t),o=n.promise();return n.setHowMany(e),n.init(),o}var s=t("./util"),a=t("./errors").RangeError,c=t("./errors").AggregateError,l=s.isArray,u={};s.inherits(i,n),i.prototype._init=function(){if(this._initialized){if(0===this._howMany)return void this._resolve([]);this._init$(void 0,-5);var t=l(this._values);!this._isResolved()&&t&&this._howMany>this._canPossiblyFulfill()&&this._reject(this._getRangeError(this.length()))}},i.prototype.init=function(){this._initialized=!0,this._init()},i.prototype.setUnwrap=function(){this._unwrap=!0},i.prototype.howMany=function(){return this._howMany},i.prototype.setHowMany=function(t){this._howMany=t},i.prototype._promiseFulfilled=function(t){return this._addFulfilled(t),this._fulfilled()===this.howMany()?(this._values.length=this.howMany(),1===this.howMany()&&this._unwrap?this._resolve(this._values[0]):this._resolve(this._values),!0):!1},i.prototype._promiseRejected=function(t){return this._addRejected(t),this._checkOutcome()},i.prototype._promiseCancelled=function(){return this._values instanceof e||null==this._values?this._cancel():(this._addRejected(u),this._checkOutcome())},i.prototype._checkOutcome=function(){if(this.howMany()>this._canPossiblyFulfill()){for(var t=new c,e=this.length();e<this._values.length;++e)this._values[e]!==u&&t.push(this._values[e]);return t.length>0?this._reject(t):this._cancel(),!0}return!1},i.prototype._fulfilled=function(){return this._totalResolved},i.prototype._rejected=function(){return this._values.length-this.length()},i.prototype._addRejected=function(t){this._values.push(t)},i.prototype._addFulfilled=function(t){this._values[this._totalResolved++]=t},i.prototype._canPossiblyFulfill=function(){return this.length()-this._rejected()},i.prototype._getRangeError=function(t){var e="Input array must contain at least "+this._howMany+" items but contains only "+t+" items";return new a(e)},i.prototype._resolveEmptyArray=function(){this._reject(this._getRangeError(0))},e.some=function(t,e){return o(t,e)},e.prototype.some=function(t){return o(this,t)},e._SomePromiseArray=i}},{"./errors":12,"./util":36}],32:[function(t,e,n){"use strict";e.exports=function(t){function e(t){void 0!==t?(t=t._target(),this._bitField=t._bitField,this._settledValueField=t._isFateSealed()?t._settledValue():void 0):(this._bitField=0,this._settledValueField=void 0)}e.prototype._settledValue=function(){return this._settledValueField};var n=e.prototype.value=function(){if(!this.isFulfilled())throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\n\n    See http://goo.gl/MqrFmX\n");return this._settledValue()},r=e.prototype.error=e.prototype.reason=function(){if(!this.isRejected())throw new TypeError("cannot get rejection reason of a non-rejected promise\n\n    See http://goo.gl/MqrFmX\n");return this._settledValue()},i=e.prototype.isFulfilled=function(){return 0!==(33554432&this._bitField)},o=e.prototype.isRejected=function(){return 0!==(16777216&this._bitField)},s=e.prototype.isPending=function(){return 0===(50397184&this._bitField)},a=e.prototype.isResolved=function(){return 0!==(50331648&this._bitField)};e.prototype.isCancelled=t.prototype._isCancelled=function(){
return 65536===(65536&this._bitField)},t.prototype.isCancelled=function(){return this._target()._isCancelled()},t.prototype.isPending=function(){return s.call(this._target())},t.prototype.isRejected=function(){return o.call(this._target())},t.prototype.isFulfilled=function(){return i.call(this._target())},t.prototype.isResolved=function(){return a.call(this._target())},t.prototype.value=function(){return n.call(this._target())},t.prototype.reason=function(){var t=this._target();return t._unsetRejectionIsUnhandled(),r.call(t)},t.prototype._value=function(){return this._settledValue()},t.prototype._reason=function(){return this._unsetRejectionIsUnhandled(),this._settledValue()},t.PromiseInspection=e}},{}],33:[function(t,e,n){"use strict";e.exports=function(e,n){function r(t,r){if(u(t)){if(t instanceof e)return t;var i=o(t);if(i===l){r&&r._pushContext();var c=e.reject(i.e);return r&&r._popContext(),c}if("function"==typeof i){if(s(t)){var c=new e(n);return t._then(c._fulfill,c._reject,void 0,c,null),c}return a(t,i,r)}}return t}function i(t){return t.then}function o(t){try{return i(t)}catch(e){return l.e=e,l}}function s(t){return p.call(t,"_promise0")}function a(t,r,i){function o(t){a&&(a._resolveCallback(t),a=null)}function s(t){a&&(a._rejectCallback(t,p,!0),a=null)}var a=new e(n),u=a;i&&i._pushContext(),a._captureStackTrace(),i&&i._popContext();var p=!0,h=c.tryCatch(r).call(t,o,s);return p=!1,a&&h===l&&(a._rejectCallback(h.e,!0,!0),a=null),u}var c=t("./util"),l=c.errorObj,u=c.isObject,p={}.hasOwnProperty;return r}},{"./util":36}],34:[function(t,e,n){"use strict";e.exports=function(e,n,r){function i(t){var e=this;return e instanceof Number&&(e=+e),clearTimeout(e),t}function o(t){var e=this;throw e instanceof Number&&(e=+e),clearTimeout(e),t}var s=t("./util"),a=e.TimeoutError,c=function(t,e,n){if(t.isPending()){var i;i="string"!=typeof e?e instanceof Error?e:new a("operation timed out"):new a(e),s.markAsOriginatingFromRejection(i),t._attachExtraTrace(i),t._reject(i),r.cancellation()&&n.cancel()}},l=function(t){return u(+this).thenReturn(t)},u=e.delay=function(t,r){var i;return void 0!==r?i=e.resolve(r)._then(l,null,null,t,void 0):(i=new e(n),setTimeout(function(){i._fulfill()},+t)),i._setAsyncGuaranteed(),i};e.prototype.delay=function(t){return u(t,this)},e.prototype.timeout=function(t,e){t=+t;var n=this.then(),s=n.then(),a=setTimeout(function(){c(s,e,n)},t);return r.cancellation()&&s._setOnCancel({_resultCancelled:function(){clearTimeout(a)}}),s._then(i,o,void 0,a,void 0)}}},{"./util":36}],35:[function(t,e,n){"use strict";e.exports=function(e,n,r,i,o,s){function a(t){setTimeout(function(){throw t},0)}function c(t){var e=r(t);return e!==t&&"function"==typeof t._isDisposable&&"function"==typeof t._getDisposer&&t._isDisposable()&&e._setDisposable(t._getDisposer()),e}function l(t,n){function i(){if(s>=l)return u._fulfill();var o=c(t[s++]);if(o instanceof e&&o._isDisposable()){try{o=r(o._getDisposer().tryDispose(n),t.promise)}catch(p){return a(p)}if(o instanceof e)return o._then(i,a,null,null,null)}i()}var s=0,l=t.length,u=new e(o);return i(),u}function u(t,e,n){this._data=t,this._promise=e,this._context=n}function p(t,e,n){this.constructor$(t,e,n)}function h(t){return u.isDisposer(t)?(this.resources[this.index]._setDisposable(t),t.promise()):t}function f(t){this.length=t,this.promise=null,this[t-1]=null}var _=t("./util"),d=t("./errors").TypeError,v=t("./util").inherits,y=_.errorObj,g=_.tryCatch;u.prototype.data=function(){return this._data},u.prototype.promise=function(){return this._promise},u.prototype.resource=function(){return this.promise().isFulfilled()?this.promise().value():null},u.prototype.tryDispose=function(t){var e=this.resource(),n=this._context;void 0!==n&&n._pushContext();var r=null!==e?this.doDispose(e,t):null;return void 0!==n&&n._popContext(),this._promise._unsetDisposable(),this._data=null,r},u.isDisposer=function(t){return null!=t&&"function"==typeof t.resource&&"function"==typeof t.tryDispose},v(p,u),p.prototype.doDispose=function(t,e){var n=this.data();return n.call(t,t,e)},f.prototype._resultCancelled=function(){for(var t=this.length,n=0;t>n;++n){var r=this[n];r instanceof e&&r.cancel()}},e.using=function(){var t=arguments.length;if(2>t)return n("you must pass at least 2 arguments to Promise.using");var i=arguments[t-1];if("function"!=typeof i)return n("expecting a function but got "+_.classString(i));var o,a=!0;2===t&&Array.isArray(arguments[0])?(o=arguments[0],t=o.length,a=!1):(o=arguments,t--);for(var c=new f(t),p=0;t>p;++p){var d=o[p];if(u.isDisposer(d)){var v=d;d=d.promise(),d._setDisposable(v)}else{var m=r(d);m instanceof e&&(d=m._then(h,null,null,{resources:c,index:p},void 0))}c[p]=d}for(var b=new Array(c.length),p=0;p<b.length;++p)b[p]=e.resolve(c[p]).reflect();var w=e.all(b).then(function(t){for(var e=0;e<t.length;++e){var n=t[e];if(n.isRejected())return y.e=n.error(),y;if(!n.isFulfilled())return void w.cancel();t[e]=n.value()}C._pushContext(),i=g(i);var r=a?i.apply(void 0,t):i(t),o=C._popContext();return s.checkForgottenReturns(r,o,"Promise.using",C),r}),C=w.lastly(function(){var t=new e.PromiseInspection(w);return l(c,t)});return c.promise=C,C._setOnCancel(c),C},e.prototype._setDisposable=function(t){this._bitField=131072|this._bitField,this._disposer=t},e.prototype._isDisposable=function(){return(131072&this._bitField)>0},e.prototype._getDisposer=function(){return this._disposer},e.prototype._unsetDisposable=function(){this._bitField=-131073&this._bitField,this._disposer=void 0},e.prototype.disposer=function(t){if("function"==typeof t)return new p(t,this,i());throw new d}}},{"./errors":12,"./util":36}],36:[function(t,e,n){"use strict";function r(){try{var t=E;return E=null,t.apply(this,arguments)}catch(e){return F.e=e,F}}function i(t){return E=t,r}function o(t){return null==t||t===!0||t===!1||"string"==typeof t||"number"==typeof t}function s(t){return"function"==typeof t||"object"==typeof t&&null!==t}function a(t){return o(t)?new Error(v(t)):t}function c(t,e){var n,r=t.length,i=new Array(r+1);for(n=0;r>n;++n)i[n]=t[n];return i[n]=e,i}function l(t,e,n){if(!j.isES5)return{}.hasOwnProperty.call(t,e)?t[e]:void 0;var r=Object.getOwnPropertyDescriptor(t,e);return null!=r?null==r.get&&null==r.set?r.value:n:void 0}function u(t,e,n){if(o(t))return t;var r={value:n,configurable:!0,enumerable:!1,writable:!0};return j.defineProperty(t,e,r),t}function p(t){throw t}function h(t){try{if("function"==typeof t){var e=j.names(t.prototype),n=j.isES5&&e.length>1,r=e.length>0&&!(1===e.length&&"constructor"===e[0]),i=R.test(t+"")&&j.names(t).length>0;if(n||r||i)return!0}return!1}catch(o){return!1}}function f(t){function e(){}e.prototype=t;for(var n=8;n--;)new e;return t}function _(t){return P.test(t)}function d(t,e,n){for(var r=new Array(t),i=0;t>i;++i)r[i]=e+i+n;return r}function v(t){try{return t+""}catch(e){return"[no string representation]"}}function y(t){try{u(t,"isOperational",!0)}catch(e){}}function g(t){return null==t?!1:t instanceof Error.__BluebirdErrorTypes__.OperationalError||t.isOperational===!0}function m(t){return t instanceof Error&&j.propertyIsWritable(t,"stack")}function b(t){return{}.toString.call(t)}function w(t,e,n){for(var r=j.names(t),i=0;i<r.length;++i){var o=r[i];if(n(o))try{j.defineProperty(e,o,j.getDescriptor(t,o))}catch(s){}}}function C(t,e){return D?process.env[t]:e}var j=t("./es5"),k="undefined"==typeof navigator,F={e:{}},E,x=function(t,e){function n(){this.constructor=t,this.constructor$=e;for(var n in e.prototype)r.call(e.prototype,n)&&"$"!==n.charAt(n.length-1)&&(this[n+"$"]=e.prototype[n])}var r={}.hasOwnProperty;return n.prototype=e.prototype,t.prototype=new n,t.prototype},T=function(){var t=[Array.prototype,Object.prototype,Function.prototype],e=function(e){for(var n=0;n<t.length;++n)if(t[n]===e)return!0;return!1};if(j.isES5){var n=Object.getOwnPropertyNames;return function(t){for(var r=[],i=Object.create(null);null!=t&&!e(t);){var o;try{o=n(t)}catch(s){return r}for(var a=0;a<o.length;++a){var c=o[a];if(!i[c]){i[c]=!0;var l=Object.getOwnPropertyDescriptor(t,c);null!=l&&null==l.get&&null==l.set&&r.push(c)}}t=j.getPrototypeOf(t)}return r}}var r={}.hasOwnProperty;return function(n){if(e(n))return[];var i=[];t:for(var o in n)if(r.call(n,o))i.push(o);else{for(var s=0;s<t.length;++s)if(r.call(t[s],o))continue t;i.push(o)}return i}}(),R=/this\s*\.\s*\S+\s*=/,P=/^[a-z$_][a-z$_0-9]*$/i,O=function(){return"stack"in new Error?function(t){return m(t)?t:new Error(v(t))}:function(t){if(m(t))return t;try{throw new Error(v(t))}catch(e){return e}}}(),S=function(t){return j.isArray(t)?t:null};if("undefined"!=typeof Symbol&&Symbol.iterator){var A="function"==typeof Array.from?function(t){return Array.from(t)}:function(t){for(var e,n=[],r=t[Symbol.iterator]();!(e=r.next()).done;)n.push(e.value);return n};S=function(t){return j.isArray(t)?t:null!=t&&"function"==typeof t[Symbol.iterator]?A(t):null}}var D="undefined"!=typeof process&&"[object process]"===b(process).toLowerCase(),V={isClass:h,isIdentifier:_,inheritedDataKeys:T,getDataPropertyOrDefault:l,thrower:p,isArray:j.isArray,asArray:S,notEnumerableProp:u,isPrimitive:o,isObject:s,canEvaluate:k,errorObj:F,tryCatch:i,inherits:x,withAppended:c,maybeWrapAsError:a,toFastProperties:f,filledRange:d,toString:v,canAttachTrace:m,ensureErrorObject:O,originatesFromRejection:g,markAsOriginatingFromRejection:y,classString:b,copyDescriptors:w,hasDevTools:"undefined"!=typeof chrome&&chrome&&"function"==typeof chrome.loadTimes,isNode:D,env:C};V.isRecentNode=V.isNode&&function(){var t=process.versions.node.split(".").map(Number);return 0===t[0]&&t[1]>10||t[0]>0}(),V.isNode&&V.toFastProperties(process);try{throw new Error}catch(I){V.lastLineError=I}e.exports=V},{"./es5":13}]},{},[4])(4)}),"undefined"!=typeof window&&null!==window?window.P=window.Promise:"undefined"!=typeof self&&null!==self&&(self.P=self.Promise);
/**
 * @license
 * lodash lodash.com/license | Underscore.js 1.8.3 underscorejs.org/LICENSE
 */
;(function(){function t(t,n){return t.set(n[0],n[1]),t}function n(t,n){return t.add(n),t}function r(t,n,r){switch(r.length){case 0:return t.call(n);case 1:return t.call(n,r[0]);case 2:return t.call(n,r[0],r[1]);case 3:return t.call(n,r[0],r[1],r[2])}return t.apply(n,r)}function e(t,n,r,e){for(var u=-1,o=t?t.length:0;++u<o;){var i=t[u];n(e,i,r(i),t)}return e}function u(t,n){for(var r=-1,e=t?t.length:0;++r<e&&false!==n(t[r],r,t););return t}function o(t,n){for(var r=t?t.length:0;r--&&false!==n(t[r],r,t););
return t}function i(t,n){for(var r=-1,e=t?t.length:0;++r<e;)if(!n(t[r],r,t))return false;return true}function f(t,n){for(var r=-1,e=t?t.length:0,u=0,o=[];++r<e;){var i=t[r];n(i,r,t)&&(o[u++]=i)}return o}function c(t,n){return!(!t||!t.length)&&-1<d(t,n,0)}function a(t,n,r){for(var e=-1,u=t?t.length:0;++e<u;)if(r(n,t[e]))return true;return false}function l(t,n){for(var r=-1,e=t?t.length:0,u=Array(e);++r<e;)u[r]=n(t[r],r,t);return u}function s(t,n){for(var r=-1,e=n.length,u=t.length;++r<e;)t[u+r]=n[r];return t}function h(t,n,r,e){
var u=-1,o=t?t.length:0;for(e&&o&&(r=t[++u]);++u<o;)r=n(r,t[u],u,t);return r}function p(t,n,r,e){var u=t?t.length:0;for(e&&u&&(r=t[--u]);u--;)r=n(r,t[u],u,t);return r}function _(t,n){for(var r=-1,e=t?t.length:0;++r<e;)if(n(t[r],r,t))return true;return false}function v(t,n,r){var e;return r(t,function(t,r,u){return n(t,r,u)?(e=r,false):void 0}),e}function g(t,n,r,e){var u=t.length;for(r+=e?1:-1;e?r--:++r<u;)if(n(t[r],r,t))return r;return-1}function d(t,n,r){if(n!==n)return M(t,r);--r;for(var e=t.length;++r<e;)if(t[r]===n)return r;
return-1}function y(t,n,r,e){--r;for(var u=t.length;++r<u;)if(e(t[r],n))return r;return-1}function b(t,n){var r=t?t.length:0;return r?w(t,n)/r:V}function x(t,n,r,e,u){return u(t,function(t,u,o){r=e?(e=false,t):n(r,t,u,o)}),r}function j(t,n){var r=t.length;for(t.sort(n);r--;)t[r]=t[r].c;return t}function w(t,n){for(var r,e=-1,u=t.length;++e<u;){var o=n(t[e]);o!==T&&(r=r===T?o:r+o)}return r}function m(t,n){for(var r=-1,e=Array(t);++r<t;)e[r]=n(r);return e}function A(t,n){return l(n,function(n){return[n,t[n]];
})}function O(t){return function(n){return t(n)}}function k(t,n){return l(n,function(n){return t[n]})}function E(t,n){return t.has(n)}function S(t,n){for(var r=-1,e=t.length;++r<e&&-1<d(n,t[r],0););return r}function I(t,n){for(var r=t.length;r--&&-1<d(n,t[r],0););return r}function R(t){return t&&t.Object===Object?t:null}function W(t){return zt[t]}function B(t){return Ut[t]}function L(t){return"\\"+Dt[t]}function M(t,n,r){var e=t.length;for(n+=r?1:-1;r?n--:++n<e;){var u=t[n];if(u!==u)return n}return-1;
}function C(t){var n=false;if(null!=t&&typeof t.toString!="function")try{n=!!(t+"")}catch(r){}return n}function z(t){for(var n,r=[];!(n=t.next()).done;)r.push(n.value);return r}function U(t){var n=-1,r=Array(t.size);return t.forEach(function(t,e){r[++n]=[e,t]}),r}function $(t,n){for(var r=-1,e=t.length,u=0,o=[];++r<e;){var i=t[r];i!==n&&"__lodash_placeholder__"!==i||(t[r]="__lodash_placeholder__",o[u++]=r)}return o}function D(t){var n=-1,r=Array(t.size);return t.forEach(function(t){r[++n]=t}),r}function F(t){
var n=-1,r=Array(t.size);return t.forEach(function(t){r[++n]=[t,t]}),r}function N(t){if(!t||!Wt.test(t))return t.length;for(var n=It.lastIndex=0;It.test(t);)n++;return n}function P(t){return $t[t]}function Z(R){function At(t,n){return R.setTimeout.call(Kt,t,n)}function Ot(t){if(Te(t)&&!yi(t)&&!(t instanceof Ut)){if(t instanceof zt)return t;if(Wu.call(t,"__wrapped__"))return ae(t)}return new zt(t)}function kt(){}function zt(t,n){this.__wrapped__=t,this.__actions__=[],this.__chain__=!!n,this.__index__=0,
this.__values__=T}function Ut(t){this.__wrapped__=t,this.__actions__=[],this.__dir__=1,this.__filtered__=false,this.__iteratees__=[],this.__takeCount__=4294967295,this.__views__=[]}function $t(t){var n=-1,r=t?t.length:0;for(this.clear();++n<r;){var e=t[n];this.set(e[0],e[1])}}function Dt(t){var n=-1,r=t?t.length:0;for(this.clear();++n<r;){var e=t[n];this.set(e[0],e[1])}}function Pt(t){var n=-1,r=t?t.length:0;for(this.clear();++n<r;){var e=t[n];this.set(e[0],e[1])}}function Zt(t){var n=-1,r=t?t.length:0;
for(this.__data__=new Pt;++n<r;)this.add(t[n])}function qt(t){this.__data__=new Dt(t)}function Vt(t,n,r,e){return t===T||Ce(t,ku[r])&&!Wu.call(e,r)?n:t}function Jt(t,n,r){(r===T||Ce(t[n],r))&&(typeof n!="number"||r!==T||n in t)||(t[n]=r)}function Yt(t,n,r){var e=t[n];Wu.call(t,n)&&Ce(e,r)&&(r!==T||n in t)||(t[n]=r)}function Ht(t,n){for(var r=t.length;r--;)if(Ce(t[r][0],n))return r;return-1}function Qt(t,n,r,e){return Ao(t,function(t,u,o){n(e,t,r(t),o)}),e}function Xt(t,n){return t&&sr(n,iu(n),t)}
function tn(t,n){for(var r=-1,e=null==t,u=n.length,o=Array(u);++r<u;)o[r]=e?T:uu(t,n[r]);return o}function nn(t,n,r){return t===t&&(r!==T&&(t=r>=t?t:r),n!==T&&(t=t>=n?t:n)),t}function rn(t,n,r,e,o,i,f){var c;if(e&&(c=i?e(t,o,i,f):e(t)),c!==T)return c;if(!Ze(t))return t;if(o=yi(t)){if(c=Kr(t),!n)return lr(t,c)}else{var a=qr(t),l="[object Function]"==a||"[object GeneratorFunction]"==a;if(bi(t))return or(t,n);if("[object Object]"==a||"[object Arguments]"==a||l&&!i){if(C(t))return i?t:{};if(c=Gr(l?{}:t),
!n)return hr(t,Xt(c,t))}else{if(!Ct[a])return i?t:{};c=Jr(t,a,rn,n)}}if(f||(f=new qt),i=f.get(t))return i;if(f.set(t,c),!o)var s=r?gn(t,iu,Tr):iu(t);return u(s||t,function(u,o){s&&(o=u,u=t[o]),Yt(c,o,rn(u,n,r,e,o,t,f))}),c}function en(t){var n=iu(t),r=n.length;return function(e){if(null==e)return!r;for(var u=r;u--;){var o=n[u],i=t[o],f=e[o];if(f===T&&!(o in Object(e))||!i(f))return false}return true}}function un(t){return Ze(t)?Tu(t):{}}function on(t,n,r){if(typeof t!="function")throw new Au("Expected a function");
return At(function(){t.apply(T,r)},n)}function fn(t,n,r,e){var u=-1,o=c,i=true,f=t.length,s=[],h=n.length;if(!f)return s;r&&(n=l(n,O(r))),e?(o=a,i=false):n.length>=200&&(o=E,i=false,n=new Zt(n));t:for(;++u<f;){var p=t[u],_=r?r(p):p,p=e||0!==p?p:0;if(i&&_===_){for(var v=h;v--;)if(n[v]===_)continue t;s.push(p)}else o(n,_,e)||s.push(p)}return s}function cn(t,n){var r=true;return Ao(t,function(t,e,u){return r=!!n(t,e,u)}),r}function an(t,n,r){for(var e=-1,u=t.length;++e<u;){var o=t[e],i=n(o);if(null!=i&&(f===T?i===i&&!Je(i):r(i,f)))var f=i,c=o;
}return c}function ln(t,n){var r=[];return Ao(t,function(t,e,u){n(t,e,u)&&r.push(t)}),r}function sn(t,n,r,e,u){var o=-1,i=t.length;for(r||(r=Hr),u||(u=[]);++o<i;){var f=t[o];n>0&&r(f)?n>1?sn(f,n-1,r,e,u):s(u,f):e||(u[u.length]=f)}return u}function hn(t,n){return t&&ko(t,n,iu)}function pn(t,n){return t&&Eo(t,n,iu)}function _n(t,n){return f(n,function(n){return Fe(t[n])})}function vn(t,n){n=ne(n,t)?[n]:er(n);for(var r=0,e=n.length;null!=t&&e>r;)t=t[fe(n[r++])];return r&&r==e?t:T}function gn(t,n,r){
return n=n(t),yi(t)?n:s(n,r(t))}function dn(t,n){return t>n}function yn(t,n){return null!=t&&(Wu.call(t,n)||typeof t=="object"&&n in t&&null===Ju(Object(t)))}function bn(t,n){return null!=t&&n in Object(t)}function xn(t,n,r){for(var e=r?a:c,u=t[0].length,o=t.length,i=o,f=Array(o),s=1/0,h=[];i--;){var p=t[i];i&&n&&(p=l(p,O(n))),s=to(p.length,s),f[i]=!r&&(n||u>=120&&p.length>=120)?new Zt(i&&p):T}var p=t[0],_=-1,v=f[0];t:for(;++_<u&&s>h.length;){var g=p[_],d=n?n(g):g,g=r||0!==g?g:0;if(v?!E(v,d):!e(h,d,r)){
for(i=o;--i;){var y=f[i];if(y?!E(y,d):!e(t[i],d,r))continue t}v&&v.push(d),h.push(g)}}return h}function jn(t,n,r){var e={};return hn(t,function(t,u,o){n(e,r(t),u,o)}),e}function wn(t,n,e){return ne(n,t)||(n=er(n),t=ie(t,n),n=ve(n)),n=null==t?t:t[fe(n)],null==n?T:r(n,t,e)}function mn(t,n,r,e,u){if(t===n)n=true;else if(null==t||null==n||!Ze(t)&&!Te(n))n=t!==t&&n!==n;else t:{var o=yi(t),i=yi(n),f="[object Array]",c="[object Array]";o||(f=qr(t),f="[object Arguments]"==f?"[object Object]":f),i||(c=qr(n),
c="[object Arguments]"==c?"[object Object]":c);var a="[object Object]"==f&&!C(t),i="[object Object]"==c&&!C(n);if((c=f==c)&&!a)u||(u=new qt),n=o||Ye(t)?zr(t,n,mn,r,e,u):Ur(t,n,f,mn,r,e,u);else{if(!(2&e)&&(o=a&&Wu.call(t,"__wrapped__"),f=i&&Wu.call(n,"__wrapped__"),o||f)){t=o?t.value():t,n=f?n.value():n,u||(u=new qt),n=mn(t,n,r,e,u);break t}if(c)n:if(u||(u=new qt),o=2&e,f=iu(t),i=f.length,c=iu(n).length,i==c||o){for(a=i;a--;){var l=f[a];if(!(o?l in n:yn(n,l))){n=false;break n}}if(c=u.get(t))n=c==n;else{
c=true,u.set(t,n);for(var s=o;++a<i;){var l=f[a],h=t[l],p=n[l];if(r)var _=o?r(p,h,l,n,t,u):r(h,p,l,t,n,u);if(_===T?h!==p&&!mn(h,p,r,e,u):!_){c=false;break}s||(s="constructor"==l)}c&&!s&&(r=t.constructor,e=n.constructor,r!=e&&"constructor"in t&&"constructor"in n&&!(typeof r=="function"&&r instanceof r&&typeof e=="function"&&e instanceof e)&&(c=false)),u["delete"](t),n=c}}else n=false;else n=false}}return n}function An(t,n,r,e){var u=r.length,o=u,i=!e;if(null==t)return!o;for(t=Object(t);u--;){var f=r[u];if(i&&f[2]?f[1]!==t[f[0]]:!(f[0]in t))return false;
}for(;++u<o;){var f=r[u],c=f[0],a=t[c],l=f[1];if(i&&f[2]){if(a===T&&!(c in t))return false}else{if(f=new qt,e)var s=e(a,l,c,t,n,f);if(s===T?!mn(l,a,e,3,f):!s)return false}}return true}function On(t){return!Ze(t)||Iu&&Iu in t?false:(Fe(t)||C(t)?zu:yt).test(ce(t))}function kn(t){return typeof t=="function"?t:null==t?pu:typeof t=="object"?yi(t)?Wn(t[0],t[1]):Rn(t):du(t)}function En(t){t=null==t?t:Object(t);var n,r=[];for(n in t)r.push(n);return r}function Sn(t,n){return n>t}function In(t,n){var r=-1,e=Ue(t)?Array(t.length):[];
return Ao(t,function(t,u,o){e[++r]=n(t,u,o)}),e}function Rn(t){var n=Pr(t);return 1==n.length&&n[0][2]?ue(n[0][0],n[0][1]):function(r){return r===t||An(r,t,n)}}function Wn(t,n){return ne(t)&&n===n&&!Ze(n)?ue(fe(t),n):function(r){var e=uu(r,t);return e===T&&e===n?ou(r,t):mn(n,e,T,3)}}function Bn(t,n,r,e,o){if(t!==n){if(!yi(n)&&!Ye(n))var i=fu(n);u(i||n,function(u,f){if(i&&(f=u,u=n[f]),Ze(u)){o||(o=new qt);var c=f,a=o,l=t[c],s=n[c],h=a.get(s);if(h)Jt(t,c,h);else{var h=e?e(l,s,c+"",t,n,a):T,p=h===T;p&&(h=s,
yi(s)||Ye(s)?yi(l)?h=l:$e(l)?h=lr(l):(p=false,h=rn(s,true)):Ve(s)||ze(s)?ze(l)?h=ru(l):!Ze(l)||r&&Fe(l)?(p=false,h=rn(s,true)):h=l:p=false),a.set(s,h),p&&Bn(h,s,r,e,a),a["delete"](s),Jt(t,c,h)}}else c=e?e(t[f],u,f+"",t,n,o):T,c===T&&(c=u),Jt(t,f,c)})}}function Ln(t,n){var r=t.length;return r?(n+=0>n?r:0,Xr(n,r)?t[n]:T):void 0}function Mn(t,n,r){var e=-1;return n=l(n.length?n:[pu],O(Fr())),t=In(t,function(t){return{a:l(n,function(n){return n(t)}),b:++e,c:t}}),j(t,function(t,n){var e;t:{e=-1;for(var u=t.a,o=n.a,i=u.length,f=r.length;++e<i;){
var c=fr(u[e],o[e]);if(c){e=e>=f?c:c*("desc"==r[e]?-1:1);break t}}e=t.b-n.b}return e})}function Cn(t,n){return t=Object(t),h(n,function(n,r){return r in t&&(n[r]=t[r]),n},{})}function zn(t,n){for(var r=-1,e=gn(t,fu,Bo),u=e.length,o={};++r<u;){var i=e[r],f=t[i];n(f,i)&&(o[i]=f)}return o}function Un(t){return function(n){return null==n?T:n[t]}}function $n(t){return function(n){return vn(n,t)}}function Dn(t,n,r,e){var u=e?y:d,o=-1,i=n.length,f=t;for(t===n&&(n=lr(n)),r&&(f=l(t,O(r)));++o<i;)for(var c=0,a=n[o],a=r?r(a):a;-1<(c=u(f,a,c,e));)f!==t&&Vu.call(f,c,1),
Vu.call(t,c,1);return t}function Fn(t,n){for(var r=t?n.length:0,e=r-1;r--;){var u=n[r];if(r==e||u!==o){var o=u;if(Xr(u))Vu.call(t,u,1);else if(ne(u,t))delete t[fe(u)];else{var u=er(u),i=ie(t,u);null!=i&&delete i[fe(ve(u))]}}}}function Nn(t,n){return t+Gu(ro()*(n-t+1))}function Pn(t,n){var r="";if(!t||1>n||n>9007199254740991)return r;do n%2&&(r+=t),(n=Gu(n/2))&&(t+=t);while(n);return r}function Zn(t,n,r,e){n=ne(n,t)?[n]:er(n);for(var u=-1,o=n.length,i=o-1,f=t;null!=f&&++u<o;){var c=fe(n[u]);if(Ze(f)){
var a=r;if(u!=i){var l=f[c],a=e?e(l,c,f):T;a===T&&(a=null==l?Xr(n[u+1])?[]:{}:l)}Yt(f,c,a)}f=f[c]}return t}function Tn(t,n,r){var e=-1,u=t.length;for(0>n&&(n=-n>u?0:u+n),r=r>u?u:r,0>r&&(r+=u),u=n>r?0:r-n>>>0,n>>>=0,r=Array(u);++e<u;)r[e]=t[e+n];return r}function qn(t,n){var r;return Ao(t,function(t,e,u){return r=n(t,e,u),!r}),!!r}function Vn(t,n,r){var e=0,u=t?t.length:e;if(typeof n=="number"&&n===n&&2147483647>=u){for(;u>e;){var o=e+u>>>1,i=t[o];null!==i&&!Je(i)&&(r?n>=i:n>i)?e=o+1:u=o}return u}
return Kn(t,n,pu,r)}function Kn(t,n,r,e){n=r(n);for(var u=0,o=t?t.length:0,i=n!==n,f=null===n,c=Je(n),a=n===T;o>u;){var l=Gu((u+o)/2),s=r(t[l]),h=s!==T,p=null===s,_=s===s,v=Je(s);(i?e||_:a?_&&(e||h):f?_&&h&&(e||!p):c?_&&h&&!p&&(e||!v):p||v?0:e?n>=s:n>s)?u=l+1:o=l}return to(o,4294967294)}function Gn(t,n){for(var r=-1,e=t.length,u=0,o=[];++r<e;){var i=t[r],f=n?n(i):i;if(!r||!Ce(f,c)){var c=f;o[u++]=0===i?0:i}}return o}function Jn(t){return typeof t=="number"?t:Je(t)?V:+t}function Yn(t){if(typeof t=="string")return t;
if(Je(t))return mo?mo.call(t):"";var n=t+"";return"0"==n&&1/t==-q?"-0":n}function Hn(t,n,r){var e=-1,u=c,o=t.length,i=true,f=[],l=f;if(r)i=false,u=a;else if(o>=200){if(u=n?null:Io(t))return D(u);i=false,u=E,l=new Zt}else l=n?[]:f;t:for(;++e<o;){var s=t[e],h=n?n(s):s,s=r||0!==s?s:0;if(i&&h===h){for(var p=l.length;p--;)if(l[p]===h)continue t;n&&l.push(h),f.push(s)}else u(l,h,r)||(l!==f&&l.push(h),f.push(s))}return f}function Qn(t,n,r,e){for(var u=t.length,o=e?u:-1;(e?o--:++o<u)&&n(t[o],o,t););return r?Tn(t,e?0:o,e?o+1:u):Tn(t,e?o+1:0,e?u:o);
}function Xn(t,n){var r=t;return r instanceof Ut&&(r=r.value()),h(n,function(t,n){return n.func.apply(n.thisArg,s([t],n.args))},r)}function tr(t,n,r){for(var e=-1,u=t.length;++e<u;)var o=o?s(fn(o,t[e],n,r),fn(t[e],o,n,r)):t[e];return o&&o.length?Hn(o,n,r):[]}function nr(t,n,r){for(var e=-1,u=t.length,o=n.length,i={};++e<u;)r(i,t[e],o>e?n[e]:T);return i}function rr(t){return $e(t)?t:[]}function er(t){return yi(t)?t:Co(t)}function ur(t,n,r){var e=t.length;return r=r===T?e:r,!n&&r>=e?t:Tn(t,n,r)}function or(t,n){
if(n)return t.slice();var r=new t.constructor(t.length);return t.copy(r),r}function ir(t){var n=new t.constructor(t.byteLength);return new Fu(n).set(new Fu(t)),n}function fr(t,n){if(t!==n){var r=t!==T,e=null===t,u=t===t,o=Je(t),i=n!==T,f=null===n,c=n===n,a=Je(n);if(!f&&!a&&!o&&t>n||o&&i&&c&&!f&&!a||e&&i&&c||!r&&c||!u)return 1;if(!e&&!o&&!a&&n>t||a&&r&&u&&!e&&!o||f&&r&&u||!i&&u||!c)return-1}return 0}function cr(t,n,r,e){var u=-1,o=t.length,i=r.length,f=-1,c=n.length,a=Xu(o-i,0),l=Array(c+a);for(e=!e;++f<c;)l[f]=n[f];
for(;++u<i;)(e||o>u)&&(l[r[u]]=t[u]);for(;a--;)l[f++]=t[u++];return l}function ar(t,n,r,e){var u=-1,o=t.length,i=-1,f=r.length,c=-1,a=n.length,l=Xu(o-f,0),s=Array(l+a);for(e=!e;++u<l;)s[u]=t[u];for(l=u;++c<a;)s[l+c]=n[c];for(;++i<f;)(e||o>u)&&(s[l+r[i]]=t[u++]);return s}function lr(t,n){var r=-1,e=t.length;for(n||(n=Array(e));++r<e;)n[r]=t[r];return n}function sr(t,n,r,e){r||(r={});for(var u=-1,o=n.length;++u<o;){var i=n[u],f=e?e(r[i],t[i],i,r,t):t[i];Yt(r,i,f)}return r}function hr(t,n){return sr(t,Tr(t),n);
}function pr(t,n){return function(r,u){var o=yi(r)?e:Qt,i=n?n():{};return o(r,t,Fr(u),i)}}function _r(t){return Me(function(n,r){var e=-1,u=r.length,o=u>1?r[u-1]:T,i=u>2?r[2]:T,o=t.length>3&&typeof o=="function"?(u--,o):T;for(i&&te(r[0],r[1],i)&&(o=3>u?T:o,u=1),n=Object(n);++e<u;)(i=r[e])&&t(n,i,e,o);return n})}function vr(t,n){return function(r,e){if(null==r)return r;if(!Ue(r))return t(r,e);for(var u=r.length,o=n?u:-1,i=Object(r);(n?o--:++o<u)&&false!==e(i[o],o,i););return r}}function gr(t){return function(n,r,e){
var u=-1,o=Object(n);e=e(n);for(var i=e.length;i--;){var f=e[t?i:++u];if(false===r(o[f],f,o))break}return n}}function dr(t,n,r){function e(){return(this&&this!==Kt&&this instanceof e?o:t).apply(u?r:this,arguments)}var u=1&n,o=xr(t);return e}function yr(t){return function(n){n=eu(n);var r=Wt.test(n)?n.match(It):T,e=r?r[0]:n.charAt(0);return n=r?ur(r,1).join(""):n.slice(1),e[t]()+n}}function br(t){return function(n){return h(su(lu(n).replace(Et,"")),t,"")}}function xr(t){return function(){var n=arguments;
switch(n.length){case 0:return new t;case 1:return new t(n[0]);case 2:return new t(n[0],n[1]);case 3:return new t(n[0],n[1],n[2]);case 4:return new t(n[0],n[1],n[2],n[3]);case 5:return new t(n[0],n[1],n[2],n[3],n[4]);case 6:return new t(n[0],n[1],n[2],n[3],n[4],n[5]);case 7:return new t(n[0],n[1],n[2],n[3],n[4],n[5],n[6])}var r=un(t.prototype),n=t.apply(r,n);return Ze(n)?n:r}}function jr(t,n,e){function u(){for(var i=arguments.length,f=Array(i),c=i,a=Dr(u);c--;)f[c]=arguments[c];return c=3>i&&f[0]!==a&&f[i-1]!==a?[]:$(f,a),
i-=c.length,e>i?Br(t,n,Ar,u.placeholder,T,f,c,T,T,e-i):r(this&&this!==Kt&&this instanceof u?o:t,this,f)}var o=xr(t);return u}function wr(t){return function(n,r,e){var u=Object(n);if(r=Fr(r,3),!Ue(n))var o=iu(n);return e=t(o||n,function(t,n){return o&&(n=t,t=u[n]),r(t,n,u)},e),e>-1?n[o?o[e]:e]:T}}function mr(t){return Me(function(n){n=sn(n,1);var r=n.length,e=r,u=zt.prototype.thru;for(t&&n.reverse();e--;){var o=n[e];if(typeof o!="function")throw new Au("Expected a function");if(u&&!i&&"wrapper"==$r(o))var i=new zt([],true);
}for(e=i?e:r;++e<r;)var o=n[e],u=$r(o),f="wrapper"==u?Ro(o):T,i=f&&re(f[0])&&424==f[1]&&!f[4].length&&1==f[9]?i[$r(f[0])].apply(i,f[3]):1==o.length&&re(o)?i[u]():i.thru(o);return function(){var t=arguments,e=t[0];if(i&&1==t.length&&yi(e)&&e.length>=200)return i.plant(e).value();for(var u=0,t=r?n[u].apply(this,t):e;++u<r;)t=n[u].call(this,t);return t}})}function Ar(t,n,r,e,u,o,i,f,c,a){function l(){for(var d=arguments.length,y=Array(d),b=d;b--;)y[b]=arguments[b];if(_){var x,j=Dr(l),b=y.length;for(x=0;b--;)y[b]===j&&x++;
}if(e&&(y=cr(y,e,u,_)),o&&(y=ar(y,o,i,_)),d-=x,_&&a>d)return j=$(y,j),Br(t,n,Ar,l.placeholder,r,y,j,f,c,a-d);if(j=h?r:this,b=p?j[t]:t,d=y.length,f){x=y.length;for(var w=to(f.length,x),m=lr(y);w--;){var A=f[w];y[w]=Xr(A,x)?m[A]:T}}else v&&d>1&&y.reverse();return s&&d>c&&(y.length=c),this&&this!==Kt&&this instanceof l&&(b=g||xr(b)),b.apply(j,y)}var s=128&n,h=1&n,p=2&n,_=24&n,v=512&n,g=p?T:xr(t);return l}function Or(t,n){return function(r,e){return jn(r,t,n(e))}}function kr(t){return function(n,r){var e;
if(n===T&&r===T)return 0;if(n!==T&&(e=n),r!==T){if(e===T)return r;typeof n=="string"||typeof r=="string"?(n=Yn(n),r=Yn(r)):(n=Jn(n),r=Jn(r)),e=t(n,r)}return e}}function Er(t){return Me(function(n){return n=1==n.length&&yi(n[0])?l(n[0],O(Fr())):l(sn(n,1,Qr),O(Fr())),Me(function(e){var u=this;return t(n,function(t){return r(t,u,e)})})})}function Sr(t,n){n=n===T?" ":Yn(n);var r=n.length;return 2>r?r?Pn(n,t):n:(r=Pn(n,Ku(t/N(n))),Wt.test(n)?ur(r.match(It),0,t).join(""):r.slice(0,t))}function Ir(t,n,e,u){
function o(){for(var n=-1,c=arguments.length,a=-1,l=u.length,s=Array(l+c),h=this&&this!==Kt&&this instanceof o?f:t;++a<l;)s[a]=u[a];for(;c--;)s[a++]=arguments[++n];return r(h,i?e:this,s)}var i=1&n,f=xr(t);return o}function Rr(t){return function(n,r,e){e&&typeof e!="number"&&te(n,r,e)&&(r=e=T),n=nu(n),n=n===n?n:0,r===T?(r=n,n=0):r=nu(r)||0,e=e===T?r>n?1:-1:nu(e)||0;var u=-1;r=Xu(Ku((r-n)/(e||1)),0);for(var o=Array(r);r--;)o[t?r:++u]=n,n+=e;return o}}function Wr(t){return function(n,r){return typeof n=="string"&&typeof r=="string"||(n=nu(n),
r=nu(r)),t(n,r)}}function Br(t,n,r,e,u,o,i,f,c,a){var l=8&n,s=l?i:T;i=l?T:i;var h=l?o:T;return o=l?T:o,n=(n|(l?32:64))&~(l?64:32),4&n||(n&=-4),n=[t,n,u,h,s,o,i,f,c,a],r=r.apply(T,n),re(t)&&Mo(r,n),r.placeholder=e,r}function Lr(t){var n=wu[t];return function(t,r){if(t=nu(t),r=to(Xe(r),292)){var e=(eu(t)+"e").split("e"),e=n(e[0]+"e"+(+e[1]+r)),e=(eu(e)+"e").split("e");return+(e[0]+"e"+(+e[1]-r))}return n(t)}}function Mr(t){return function(n){var r=qr(n);return"[object Map]"==r?U(n):"[object Set]"==r?F(n):A(n,t(n));
}}function Cr(t,n,r,e,u,o,i,f){var c=2&n;if(!c&&typeof t!="function")throw new Au("Expected a function");var a=e?e.length:0;if(a||(n&=-97,e=u=T),i=i===T?i:Xu(Xe(i),0),f=f===T?f:Xe(f),a-=u?u.length:0,64&n){var l=e,s=u;e=u=T}var h=c?T:Ro(t);return o=[t,n,r,e,u,l,s,o,i,f],h&&(r=o[1],t=h[1],n=r|t,e=128==t&&8==r||128==t&&256==r&&h[8]>=o[7].length||384==t&&h[8]>=h[7].length&&8==r,131>n||e)&&(1&t&&(o[2]=h[2],n|=1&r?0:4),(r=h[3])&&(e=o[3],o[3]=e?cr(e,r,h[4]):r,o[4]=e?$(o[3],"__lodash_placeholder__"):h[4]),
(r=h[5])&&(e=o[5],o[5]=e?ar(e,r,h[6]):r,o[6]=e?$(o[5],"__lodash_placeholder__"):h[6]),(r=h[7])&&(o[7]=r),128&t&&(o[8]=null==o[8]?h[8]:to(o[8],h[8])),null==o[9]&&(o[9]=h[9]),o[0]=h[0],o[1]=n),t=o[0],n=o[1],r=o[2],e=o[3],u=o[4],f=o[9]=null==o[9]?c?0:t.length:Xu(o[9]-a,0),!f&&24&n&&(n&=-25),(h?So:Mo)(n&&1!=n?8==n||16==n?jr(t,n,f):32!=n&&33!=n||u.length?Ar.apply(T,o):Ir(t,n,r,e):dr(t,n,r),o)}function zr(t,n,r,e,u,o){var i=2&u,f=t.length,c=n.length;if(f!=c&&!(i&&c>f))return false;if(c=o.get(t))return c==n;
var c=-1,a=true,l=1&u?new Zt:T;for(o.set(t,n);++c<f;){var s=t[c],h=n[c];if(e)var p=i?e(h,s,c,n,t,o):e(s,h,c,t,n,o);if(p!==T){if(p)continue;a=false;break}if(l){if(!_(n,function(t,n){return l.has(n)||s!==t&&!r(s,t,e,u,o)?void 0:l.add(n)})){a=false;break}}else if(s!==h&&!r(s,h,e,u,o)){a=false;break}}return o["delete"](t),a}function Ur(t,n,r,e,u,o,i){switch(r){case"[object DataView]":if(t.byteLength!=n.byteLength||t.byteOffset!=n.byteOffset)break;t=t.buffer,n=n.buffer;case"[object ArrayBuffer]":if(t.byteLength!=n.byteLength||!e(new Fu(t),new Fu(n)))break;
return true;case"[object Boolean]":case"[object Date]":return+t==+n;case"[object Error]":return t.name==n.name&&t.message==n.message;case"[object Number]":return t!=+t?n!=+n:t==+n;case"[object RegExp]":case"[object String]":return t==n+"";case"[object Map]":var f=U;case"[object Set]":if(f||(f=D),t.size!=n.size&&!(2&o))break;return(r=i.get(t))?r==n:(o|=1,i.set(t,n),zr(f(t),f(n),e,u,o,i));case"[object Symbol]":if(wo)return wo.call(t)==wo.call(n)}return false}function $r(t){for(var n=t.name+"",r=_o[n],e=Wu.call(_o,n)?r.length:0;e--;){
var u=r[e],o=u.func;if(null==o||o==t)return u.name}return n}function Dr(t){return(Wu.call(Ot,"placeholder")?Ot:t).placeholder}function Fr(){var t=Ot.iteratee||_u,t=t===_u?kn:t;return arguments.length?t(arguments[0],arguments[1]):t}function Nr(t,n){var r=t.__data__,e=typeof n;return("string"==e||"number"==e||"symbol"==e||"boolean"==e?"__proto__"!==n:null===n)?r[typeof n=="string"?"string":"hash"]:r.map}function Pr(t){for(var n=iu(t),r=n.length;r--;){var e=n[r],u=t[e];n[r]=[e,u,u===u&&!Ze(u)]}return n;
}function Zr(t,n){var r=null==t?T:t[n];return On(r)?r:T}function Tr(t){return Pu(Object(t))}function qr(t){return Mu.call(t)}function Vr(t,n,r){n=ne(n,t)?[n]:er(n);for(var e,u=-1,o=n.length;++u<o;){var i=fe(n[u]);if(!(e=null!=t&&r(t,i)))break;t=t[i]}return e?e:(o=t?t.length:0,!!o&&Pe(o)&&Xr(i,o)&&(yi(t)||Ge(t)||ze(t)))}function Kr(t){var n=t.length,r=t.constructor(n);return n&&"string"==typeof t[0]&&Wu.call(t,"index")&&(r.index=t.index,r.input=t.input),r}function Gr(t){return typeof t.constructor!="function"||ee(t)?{}:un(Ju(Object(t)));
}function Jr(r,e,u,o){var i=r.constructor;switch(e){case"[object ArrayBuffer]":return ir(r);case"[object Boolean]":case"[object Date]":return new i(+r);case"[object DataView]":return e=o?ir(r.buffer):r.buffer,new r.constructor(e,r.byteOffset,r.byteLength);case"[object Float32Array]":case"[object Float64Array]":case"[object Int8Array]":case"[object Int16Array]":case"[object Int32Array]":case"[object Uint8Array]":case"[object Uint8ClampedArray]":case"[object Uint16Array]":case"[object Uint32Array]":
return e=o?ir(r.buffer):r.buffer,new r.constructor(e,r.byteOffset,r.length);case"[object Map]":return e=o?u(U(r),true):U(r),h(e,t,new r.constructor);case"[object Number]":case"[object String]":return new i(r);case"[object RegExp]":return e=new r.constructor(r.source,_t.exec(r)),e.lastIndex=r.lastIndex,e;case"[object Set]":return e=o?u(D(r),true):D(r),h(e,n,new r.constructor);case"[object Symbol]":return wo?Object(wo.call(r)):{}}}function Yr(t){var n=t?t.length:T;return Pe(n)&&(yi(t)||Ge(t)||ze(t))?m(n,String):null;
}function Hr(t){return yi(t)||ze(t)}function Qr(t){return yi(t)&&!(2==t.length&&!Fe(t[0]))}function Xr(t,n){return n=null==n?9007199254740991:n,!!n&&(typeof t=="number"||xt.test(t))&&t>-1&&0==t%1&&n>t}function te(t,n,r){if(!Ze(r))return false;var e=typeof n;return("number"==e?Ue(r)&&Xr(n,r.length):"string"==e&&n in r)?Ce(r[n],t):false}function ne(t,n){if(yi(t))return false;var r=typeof t;return"number"==r||"symbol"==r||"boolean"==r||null==t||Je(t)?true:ut.test(t)||!et.test(t)||null!=n&&t in Object(n)}function re(t){
var n=$r(t),r=Ot[n];return typeof r=="function"&&n in Ut.prototype?t===r?true:(n=Ro(r),!!n&&t===n[0]):false}function ee(t){var n=t&&t.constructor;return t===(typeof n=="function"&&n.prototype||ku)}function ue(t,n){return function(r){return null==r?false:r[t]===n&&(n!==T||t in Object(r))}}function oe(t,n,r,e,u,o){return Ze(t)&&Ze(n)&&Bn(t,n,T,oe,o.set(n,t)),t}function ie(t,n){return 1==n.length?t:vn(t,Tn(n,0,-1))}function fe(t){if(typeof t=="string"||Je(t))return t;var n=t+"";return"0"==n&&1/t==-q?"-0":n}function ce(t){
if(null!=t){try{return Ru.call(t)}catch(n){}return t+""}return""}function ae(t){if(t instanceof Ut)return t.clone();var n=new zt(t.__wrapped__,t.__chain__);return n.__actions__=lr(t.__actions__),n.__index__=t.__index__,n.__values__=t.__values__,n}function le(t,n,r){var e=t?t.length:0;return e?(n=r||n===T?1:Xe(n),Tn(t,0>n?0:n,e)):[]}function se(t,n,r){var e=t?t.length:0;return e?(n=r||n===T?1:Xe(n),n=e-n,Tn(t,0,0>n?0:n)):[]}function he(t,n,r){var e=t?t.length:0;return e?(r=null==r?0:Xe(r),0>r&&(r=Xu(e+r,0)),
g(t,Fr(n,3),r)):-1}function pe(t,n,r){var e=t?t.length:0;if(!e)return-1;var u=e-1;return r!==T&&(u=Xe(r),u=0>r?Xu(e+u,0):to(u,e-1)),g(t,Fr(n,3),u,true)}function _e(t){return t&&t.length?t[0]:T}function ve(t){var n=t?t.length:0;return n?t[n-1]:T}function ge(t,n){return t&&t.length&&n&&n.length?Dn(t,n):t}function de(t){return t?uo.call(t):t}function ye(t){if(!t||!t.length)return[];var n=0;return t=f(t,function(t){return $e(t)?(n=Xu(t.length,n),true):void 0}),m(n,function(n){return l(t,Un(n))})}function be(t,n){
if(!t||!t.length)return[];var e=ye(t);return null==n?e:l(e,function(t){return r(n,T,t)})}function xe(t){return t=Ot(t),t.__chain__=true,t}function je(t,n){return n(t)}function we(){return this}function me(t,n){return(yi(t)?u:Ao)(t,Fr(n,3))}function Ae(t,n){return(yi(t)?o:Oo)(t,Fr(n,3))}function Oe(t,n){return(yi(t)?l:In)(t,Fr(n,3))}function ke(t,n,r){var e=-1,u=He(t),o=u.length,i=o-1;for(n=(r?te(t,n,r):n===T)?1:nn(Xe(n),0,o);++e<n;)t=Nn(e,i),r=u[t],u[t]=u[e],u[e]=r;return u.length=n,u}function Ee(){
return xu.now()}function Se(t,n,r){return n=r?T:n,n=t&&null==n?t.length:n,Cr(t,128,T,T,T,T,n)}function Ie(t,n){var r;if(typeof n!="function")throw new Au("Expected a function");return t=Xe(t),function(){return 0<--t&&(r=n.apply(this,arguments)),1>=t&&(n=T),r}}function Re(t,n,r){return n=r?T:n,t=Cr(t,8,T,T,T,T,T,n),t.placeholder=Re.placeholder,t}function We(t,n,r){return n=r?T:n,t=Cr(t,16,T,T,T,T,T,n),t.placeholder=We.placeholder,t}function Be(t,n,r){function e(n){var r=c,e=a;return c=a=T,_=n,s=t.apply(e,r);
}function u(t){var r=t-p;return t-=_,p===T||r>=n||0>r||g&&t>=l}function o(){var t=Ee();if(u(t))return i(t);var r;r=t-_,t=n-(t-p),r=g?to(t,l-r):t,h=At(o,r)}function i(t){return h=T,d&&c?e(t):(c=a=T,s)}function f(){var t=Ee(),r=u(t);if(c=arguments,a=this,p=t,r){if(h===T)return _=t=p,h=At(o,n),v?e(t):s;if(g)return h=At(o,n),e(p)}return h===T&&(h=At(o,n)),s}var c,a,l,s,h,p,_=0,v=false,g=false,d=true;if(typeof t!="function")throw new Au("Expected a function");return n=nu(n)||0,Ze(r)&&(v=!!r.leading,l=(g="maxWait"in r)?Xu(nu(r.maxWait)||0,n):l,
d="trailing"in r?!!r.trailing:d),f.cancel=function(){_=0,c=p=a=h=T},f.flush=function(){return h===T?s:i(Ee())},f}function Le(t,n){function r(){var e=arguments,u=n?n.apply(this,e):e[0],o=r.cache;return o.has(u)?o.get(u):(e=t.apply(this,e),r.cache=o.set(u,e),e)}if(typeof t!="function"||n&&typeof n!="function")throw new Au("Expected a function");return r.cache=new(Le.Cache||Pt),r}function Me(t,n){if(typeof t!="function")throw new Au("Expected a function");return n=Xu(n===T?t.length-1:Xe(n),0),function(){
for(var e=arguments,u=-1,o=Xu(e.length-n,0),i=Array(o);++u<o;)i[u]=e[n+u];switch(n){case 0:return t.call(this,i);case 1:return t.call(this,e[0],i);case 2:return t.call(this,e[0],e[1],i)}for(o=Array(n+1),u=-1;++u<n;)o[u]=e[u];return o[n]=i,r(t,this,o)}}function Ce(t,n){return t===n||t!==t&&n!==n}function ze(t){return $e(t)&&Wu.call(t,"callee")&&(!qu.call(t,"callee")||"[object Arguments]"==Mu.call(t))}function Ue(t){return null!=t&&Pe(Wo(t))&&!Fe(t)}function $e(t){return Te(t)&&Ue(t)}function De(t){
return Te(t)?"[object Error]"==Mu.call(t)||typeof t.message=="string"&&typeof t.name=="string":false}function Fe(t){return t=Ze(t)?Mu.call(t):"","[object Function]"==t||"[object GeneratorFunction]"==t}function Ne(t){return typeof t=="number"&&t==Xe(t)}function Pe(t){return typeof t=="number"&&t>-1&&0==t%1&&9007199254740991>=t}function Ze(t){var n=typeof t;return!!t&&("object"==n||"function"==n)}function Te(t){return!!t&&typeof t=="object"}function qe(t){return typeof t=="number"||Te(t)&&"[object Number]"==Mu.call(t);
}function Ve(t){return!Te(t)||"[object Object]"!=Mu.call(t)||C(t)?false:(t=Ju(Object(t)),null===t?true:(t=Wu.call(t,"constructor")&&t.constructor,typeof t=="function"&&t instanceof t&&Ru.call(t)==Lu))}function Ke(t){return Ze(t)&&"[object RegExp]"==Mu.call(t)}function Ge(t){return typeof t=="string"||!yi(t)&&Te(t)&&"[object String]"==Mu.call(t)}function Je(t){return typeof t=="symbol"||Te(t)&&"[object Symbol]"==Mu.call(t)}function Ye(t){return Te(t)&&Pe(t.length)&&!!Mt[Mu.call(t)]}function He(t){if(!t)return[];
if(Ue(t))return Ge(t)?t.match(It):lr(t);if(Zu&&t[Zu])return z(t[Zu]());var n=qr(t);return("[object Map]"==n?U:"[object Set]"==n?D:cu)(t)}function Qe(t){return t?(t=nu(t),t===q||t===-q?1.7976931348623157e308*(0>t?-1:1):t===t?t:0):0===t?t:0}function Xe(t){t=Qe(t);var n=t%1;return t===t?n?t-n:t:0}function tu(t){return t?nn(Xe(t),0,4294967295):0}function nu(t){if(typeof t=="number")return t;if(Je(t))return V;if(Ze(t)&&(t=Fe(t.valueOf)?t.valueOf():t,t=Ze(t)?t+"":t),typeof t!="string")return 0===t?t:+t;
t=t.replace(ct,"");var n=dt.test(t);return n||bt.test(t)?Nt(t.slice(2),n?2:8):gt.test(t)?V:+t}function ru(t){return sr(t,fu(t))}function eu(t){return null==t?"":Yn(t)}function uu(t,n,r){return t=null==t?T:vn(t,n),t===T?r:t}function ou(t,n){return null!=t&&Vr(t,n,bn)}function iu(t){var n=ee(t);if(!n&&!Ue(t))return Qu(Object(t));var r,e=Yr(t),u=!!e,e=e||[],o=e.length;for(r in t)!yn(t,r)||u&&("length"==r||Xr(r,o))||n&&"constructor"==r||e.push(r);return e}function fu(t){for(var n=-1,r=ee(t),e=En(t),u=e.length,o=Yr(t),i=!!o,o=o||[],f=o.length;++n<u;){
var c=e[n];i&&("length"==c||Xr(c,f))||"constructor"==c&&(r||!Wu.call(t,c))||o.push(c)}return o}function cu(t){return t?k(t,iu(t)):[]}function au(t){return qi(eu(t).toLowerCase())}function lu(t){return(t=eu(t))&&t.replace(jt,W).replace(St,"")}function su(t,n,r){return t=eu(t),n=r?T:n,n===T&&(n=Bt.test(t)?Rt:st),t.match(n)||[]}function hu(t){return function(){return t}}function pu(t){return t}function _u(t){return kn(typeof t=="function"?t:rn(t,true))}function vu(t,n,r){var e=iu(n),o=_n(n,e);null!=r||Ze(n)&&(o.length||!e.length)||(r=n,
n=t,t=this,o=_n(n,iu(n)));var i=!(Ze(r)&&"chain"in r&&!r.chain),f=Fe(t);return u(o,function(r){var e=n[r];t[r]=e,f&&(t.prototype[r]=function(){var n=this.__chain__;if(i||n){var r=t(this.__wrapped__);return(r.__actions__=lr(this.__actions__)).push({func:e,args:arguments,thisArg:t}),r.__chain__=n,r}return e.apply(t,s([this.value()],arguments))})}),t}function gu(){}function du(t){return ne(t)?Un(fe(t)):$n(t)}function yu(){return[]}function bu(){return false}R=R?Gt.defaults({},R,Gt.pick(Kt,Lt)):Kt;var xu=R.Date,ju=R.Error,wu=R.Math,mu=R.RegExp,Au=R.TypeError,Ou=R.Array.prototype,ku=R.Object.prototype,Eu=R.String.prototype,Su=R["__core-js_shared__"],Iu=function(){
var t=/[^.]+$/.exec(Su&&Su.keys&&Su.keys.IE_PROTO||"");return t?"Symbol(src)_1."+t:""}(),Ru=R.Function.prototype.toString,Wu=ku.hasOwnProperty,Bu=0,Lu=Ru.call(Object),Mu=ku.toString,Cu=Kt._,zu=mu("^"+Ru.call(Wu).replace(it,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$"),Uu=Tt?R.Buffer:T,$u=R.Reflect,Du=R.Symbol,Fu=R.Uint8Array,Nu=$u?$u.f:T,Pu=Object.getOwnPropertySymbols,Zu=typeof(Zu=Du&&Du.iterator)=="symbol"?Zu:T,Tu=Object.create,qu=ku.propertyIsEnumerable,Vu=Ou.splice,Ku=wu.ceil,Gu=wu.floor,Ju=Object.getPrototypeOf,Yu=R.isFinite,Hu=Ou.join,Qu=Object.keys,Xu=wu.max,to=wu.min,no=R.parseInt,ro=wu.random,eo=Eu.replace,uo=Ou.reverse,oo=Eu.split,io=Zr(R,"DataView"),fo=Zr(R,"Map"),co=Zr(R,"Promise"),ao=Zr(R,"Set"),lo=Zr(R,"WeakMap"),so=Zr(Object,"create"),ho=lo&&new lo,po=!qu.call({
valueOf:1},"valueOf"),_o={},vo=ce(io),go=ce(fo),yo=ce(co),bo=ce(ao),xo=ce(lo),jo=Du?Du.prototype:T,wo=jo?jo.valueOf:T,mo=jo?jo.toString:T;Ot.templateSettings={escape:tt,evaluate:nt,interpolate:rt,variable:"",imports:{_:Ot}},Ot.prototype=kt.prototype,Ot.prototype.constructor=Ot,zt.prototype=un(kt.prototype),zt.prototype.constructor=zt,Ut.prototype=un(kt.prototype),Ut.prototype.constructor=Ut,$t.prototype.clear=function(){this.__data__=so?so(null):{}},$t.prototype["delete"]=function(t){return this.has(t)&&delete this.__data__[t];
},$t.prototype.get=function(t){var n=this.__data__;return so?(t=n[t],"__lodash_hash_undefined__"===t?T:t):Wu.call(n,t)?n[t]:T},$t.prototype.has=function(t){var n=this.__data__;return so?n[t]!==T:Wu.call(n,t)},$t.prototype.set=function(t,n){return this.__data__[t]=so&&n===T?"__lodash_hash_undefined__":n,this},Dt.prototype.clear=function(){this.__data__=[]},Dt.prototype["delete"]=function(t){var n=this.__data__;return t=Ht(n,t),0>t?false:(t==n.length-1?n.pop():Vu.call(n,t,1),true)},Dt.prototype.get=function(t){
var n=this.__data__;return t=Ht(n,t),0>t?T:n[t][1]},Dt.prototype.has=function(t){return-1<Ht(this.__data__,t)},Dt.prototype.set=function(t,n){var r=this.__data__,e=Ht(r,t);return 0>e?r.push([t,n]):r[e][1]=n,this},Pt.prototype.clear=function(){this.__data__={hash:new $t,map:new(fo||Dt),string:new $t}},Pt.prototype["delete"]=function(t){return Nr(this,t)["delete"](t)},Pt.prototype.get=function(t){return Nr(this,t).get(t)},Pt.prototype.has=function(t){return Nr(this,t).has(t)},Pt.prototype.set=function(t,n){
return Nr(this,t).set(t,n),this},Zt.prototype.add=Zt.prototype.push=function(t){return this.__data__.set(t,"__lodash_hash_undefined__"),this},Zt.prototype.has=function(t){return this.__data__.has(t)},qt.prototype.clear=function(){this.__data__=new Dt},qt.prototype["delete"]=function(t){return this.__data__["delete"](t)},qt.prototype.get=function(t){return this.__data__.get(t)},qt.prototype.has=function(t){return this.__data__.has(t)},qt.prototype.set=function(t,n){var r=this.__data__;return r instanceof Dt&&200==r.__data__.length&&(r=this.__data__=new Pt(r.__data__)),
r.set(t,n),this};var Ao=vr(hn),Oo=vr(pn,true),ko=gr(),Eo=gr(true);Nu&&!qu.call({valueOf:1},"valueOf")&&(En=function(t){return z(Nu(t))});var So=ho?function(t,n){return ho.set(t,n),t}:pu,Io=ao&&1/D(new ao([,-0]))[1]==q?function(t){return new ao(t)}:gu,Ro=ho?function(t){return ho.get(t)}:gu,Wo=Un("length");Pu||(Tr=yu);var Bo=Pu?function(t){for(var n=[];t;)s(n,Tr(t)),t=Ju(Object(t));return n}:Tr;(io&&"[object DataView]"!=qr(new io(new ArrayBuffer(1)))||fo&&"[object Map]"!=qr(new fo)||co&&"[object Promise]"!=qr(co.resolve())||ao&&"[object Set]"!=qr(new ao)||lo&&"[object WeakMap]"!=qr(new lo))&&(qr=function(t){
var n=Mu.call(t);if(t=(t="[object Object]"==n?t.constructor:T)?ce(t):T)switch(t){case vo:return"[object DataView]";case go:return"[object Map]";case yo:return"[object Promise]";case bo:return"[object Set]";case xo:return"[object WeakMap]"}return n});var Lo=Su?Fe:bu,Mo=function(){var t=0,n=0;return function(r,e){var u=Ee(),o=16-(u-n);if(n=u,o>0){if(150<=++t)return r}else t=0;return So(r,e)}}(),Co=Le(function(t){var n=[];return eu(t).replace(ot,function(t,r,e,u){n.push(e?u.replace(ht,"$1"):r||t)}),
n}),zo=Me(function(t,n){return $e(t)?fn(t,sn(n,1,$e,true)):[]}),Uo=Me(function(t,n){var r=ve(n);return $e(r)&&(r=T),$e(t)?fn(t,sn(n,1,$e,true),Fr(r)):[]}),$o=Me(function(t,n){var r=ve(n);return $e(r)&&(r=T),$e(t)?fn(t,sn(n,1,$e,true),T,r):[]}),Do=Me(function(t){var n=l(t,rr);return n.length&&n[0]===t[0]?xn(n):[]}),Fo=Me(function(t){var n=ve(t),r=l(t,rr);return n===ve(r)?n=T:r.pop(),r.length&&r[0]===t[0]?xn(r,Fr(n)):[]}),No=Me(function(t){var n=ve(t),r=l(t,rr);return n===ve(r)?n=T:r.pop(),r.length&&r[0]===t[0]?xn(r,T,n):[];
}),Po=Me(ge),Zo=Me(function(t,n){n=sn(n,1);var r=t?t.length:0,e=tn(t,n);return Fn(t,l(n,function(t){return Xr(t,r)?+t:t}).sort(fr)),e}),To=Me(function(t){return Hn(sn(t,1,$e,true))}),qo=Me(function(t){var n=ve(t);return $e(n)&&(n=T),Hn(sn(t,1,$e,true),Fr(n))}),Vo=Me(function(t){var n=ve(t);return $e(n)&&(n=T),Hn(sn(t,1,$e,true),T,n)}),Ko=Me(function(t,n){return $e(t)?fn(t,n):[]}),Go=Me(function(t){return tr(f(t,$e))}),Jo=Me(function(t){var n=ve(t);return $e(n)&&(n=T),tr(f(t,$e),Fr(n))}),Yo=Me(function(t){
var n=ve(t);return $e(n)&&(n=T),tr(f(t,$e),T,n)}),Ho=Me(ye),Qo=Me(function(t){var n=t.length,n=n>1?t[n-1]:T,n=typeof n=="function"?(t.pop(),n):T;return be(t,n)}),Xo=Me(function(t){function n(n){return tn(n,t)}t=sn(t,1);var r=t.length,e=r?t[0]:0,u=this.__wrapped__;return!(r>1||this.__actions__.length)&&u instanceof Ut&&Xr(e)?(u=u.slice(e,+e+(r?1:0)),u.__actions__.push({func:je,args:[n],thisArg:T}),new zt(u,this.__chain__).thru(function(t){return r&&!t.length&&t.push(T),t})):this.thru(n)}),ti=pr(function(t,n,r){
Wu.call(t,r)?++t[r]:t[r]=1}),ni=wr(he),ri=wr(pe),ei=pr(function(t,n,r){Wu.call(t,r)?t[r].push(n):t[r]=[n]}),ui=Me(function(t,n,e){var u=-1,o=typeof n=="function",i=ne(n),f=Ue(t)?Array(t.length):[];return Ao(t,function(t){var c=o?n:i&&null!=t?t[n]:T;f[++u]=c?r(c,t,e):wn(t,n,e)}),f}),oi=pr(function(t,n,r){t[r]=n}),ii=pr(function(t,n,r){t[r?0:1].push(n)},function(){return[[],[]]}),fi=Me(function(t,n){if(null==t)return[];var r=n.length;return r>1&&te(t,n[0],n[1])?n=[]:r>2&&te(n[0],n[1],n[2])&&(n=[n[0]]),
n=1==n.length&&yi(n[0])?n[0]:sn(n,1,Qr),Mn(t,n,[])}),ci=Me(function(t,n,r){var e=1;if(r.length)var u=$(r,Dr(ci)),e=32|e;return Cr(t,e,n,r,u)}),ai=Me(function(t,n,r){var e=3;if(r.length)var u=$(r,Dr(ai)),e=32|e;return Cr(n,e,t,r,u)}),li=Me(function(t,n){return on(t,1,n)}),si=Me(function(t,n,r){return on(t,nu(n)||0,r)});Le.Cache=Pt;var hi=Me(function(t,n){n=1==n.length&&yi(n[0])?l(n[0],O(Fr())):l(sn(n,1,Qr),O(Fr()));var e=n.length;return Me(function(u){for(var o=-1,i=to(u.length,e);++o<i;)u[o]=n[o].call(this,u[o]);
return r(t,this,u)})}),pi=Me(function(t,n){var r=$(n,Dr(pi));return Cr(t,32,T,n,r)}),_i=Me(function(t,n){var r=$(n,Dr(_i));return Cr(t,64,T,n,r)}),vi=Me(function(t,n){return Cr(t,256,T,T,T,sn(n,1))}),gi=Wr(dn),di=Wr(function(t,n){return t>=n}),yi=Array.isArray,bi=Uu?function(t){return t instanceof Uu}:bu,xi=Wr(Sn),ji=Wr(function(t,n){return n>=t}),wi=_r(function(t,n){if(po||ee(n)||Ue(n))sr(n,iu(n),t);else for(var r in n)Wu.call(n,r)&&Yt(t,r,n[r])}),mi=_r(function(t,n){if(po||ee(n)||Ue(n))sr(n,fu(n),t);else for(var r in n)Yt(t,r,n[r]);
}),Ai=_r(function(t,n,r,e){sr(n,fu(n),t,e)}),Oi=_r(function(t,n,r,e){sr(n,iu(n),t,e)}),ki=Me(function(t,n){return tn(t,sn(n,1))}),Ei=Me(function(t){return t.push(T,Vt),r(Ai,T,t)}),Si=Me(function(t){return t.push(T,oe),r(Li,T,t)}),Ii=Or(function(t,n,r){t[n]=r},hu(pu)),Ri=Or(function(t,n,r){Wu.call(t,n)?t[n].push(r):t[n]=[r]},Fr),Wi=Me(wn),Bi=_r(function(t,n,r){Bn(t,n,r)}),Li=_r(function(t,n,r,e){Bn(t,n,r,e)}),Mi=Me(function(t,n){return null==t?{}:(n=l(sn(n,1),fe),Cn(t,fn(gn(t,fu,Bo),n)))}),Ci=Me(function(t,n){
return null==t?{}:Cn(t,l(sn(n,1),fe))}),zi=Mr(iu),Ui=Mr(fu),$i=br(function(t,n,r){return n=n.toLowerCase(),t+(r?au(n):n)}),Di=br(function(t,n,r){return t+(r?"-":"")+n.toLowerCase()}),Fi=br(function(t,n,r){return t+(r?" ":"")+n.toLowerCase()}),Ni=yr("toLowerCase"),Pi=br(function(t,n,r){return t+(r?"_":"")+n.toLowerCase()}),Zi=br(function(t,n,r){return t+(r?" ":"")+qi(n)}),Ti=br(function(t,n,r){return t+(r?" ":"")+n.toUpperCase()}),qi=yr("toUpperCase"),Vi=Me(function(t,n){try{return r(t,T,n)}catch(e){
return De(e)?e:new ju(e)}}),Ki=Me(function(t,n){return u(sn(n,1),function(n){n=fe(n),t[n]=ci(t[n],t)}),t}),Gi=mr(),Ji=mr(true),Yi=Me(function(t,n){return function(r){return wn(r,t,n)}}),Hi=Me(function(t,n){return function(r){return wn(t,r,n)}}),Qi=Er(l),Xi=Er(i),tf=Er(_),nf=Rr(),rf=Rr(true),ef=kr(function(t,n){return t+n}),uf=Lr("ceil"),of=kr(function(t,n){return t/n}),ff=Lr("floor"),cf=kr(function(t,n){return t*n}),af=Lr("round"),lf=kr(function(t,n){return t-n});return Ot.after=function(t,n){if(typeof n!="function")throw new Au("Expected a function");
return t=Xe(t),function(){return 1>--t?n.apply(this,arguments):void 0}},Ot.ary=Se,Ot.assign=wi,Ot.assignIn=mi,Ot.assignInWith=Ai,Ot.assignWith=Oi,Ot.at=ki,Ot.before=Ie,Ot.bind=ci,Ot.bindAll=Ki,Ot.bindKey=ai,Ot.castArray=function(){if(!arguments.length)return[];var t=arguments[0];return yi(t)?t:[t]},Ot.chain=xe,Ot.chunk=function(t,n,r){if(n=(r?te(t,n,r):n===T)?1:Xu(Xe(n),0),r=t?t.length:0,!r||1>n)return[];for(var e=0,u=0,o=Array(Ku(r/n));r>e;)o[u++]=Tn(t,e,e+=n);return o},Ot.compact=function(t){for(var n=-1,r=t?t.length:0,e=0,u=[];++n<r;){
var o=t[n];o&&(u[e++]=o)}return u},Ot.concat=function(){for(var t=arguments.length,n=Array(t?t-1:0),r=arguments[0],e=t;e--;)n[e-1]=arguments[e];return t?s(yi(r)?lr(r):[r],sn(n,1)):[]},Ot.cond=function(t){var n=t?t.length:0,e=Fr();return t=n?l(t,function(t){if("function"!=typeof t[1])throw new Au("Expected a function");return[e(t[0]),t[1]]}):[],Me(function(e){for(var u=-1;++u<n;){var o=t[u];if(r(o[0],this,e))return r(o[1],this,e)}})},Ot.conforms=function(t){return en(rn(t,true))},Ot.constant=hu,Ot.countBy=ti,
Ot.create=function(t,n){var r=un(t);return n?Xt(r,n):r},Ot.curry=Re,Ot.curryRight=We,Ot.debounce=Be,Ot.defaults=Ei,Ot.defaultsDeep=Si,Ot.defer=li,Ot.delay=si,Ot.difference=zo,Ot.differenceBy=Uo,Ot.differenceWith=$o,Ot.drop=le,Ot.dropRight=se,Ot.dropRightWhile=function(t,n){return t&&t.length?Qn(t,Fr(n,3),true,true):[]},Ot.dropWhile=function(t,n){return t&&t.length?Qn(t,Fr(n,3),true):[]},Ot.fill=function(t,n,r,e){var u=t?t.length:0;if(!u)return[];for(r&&typeof r!="number"&&te(t,n,r)&&(r=0,e=u),u=t.length,
r=Xe(r),0>r&&(r=-r>u?0:u+r),e=e===T||e>u?u:Xe(e),0>e&&(e+=u),e=r>e?0:tu(e);e>r;)t[r++]=n;return t},Ot.filter=function(t,n){return(yi(t)?f:ln)(t,Fr(n,3))},Ot.flatMap=function(t,n){return sn(Oe(t,n),1)},Ot.flatMapDeep=function(t,n){return sn(Oe(t,n),q)},Ot.flatMapDepth=function(t,n,r){return r=r===T?1:Xe(r),sn(Oe(t,n),r)},Ot.flatten=function(t){return t&&t.length?sn(t,1):[]},Ot.flattenDeep=function(t){return t&&t.length?sn(t,q):[]},Ot.flattenDepth=function(t,n){return t&&t.length?(n=n===T?1:Xe(n),sn(t,n)):[];
},Ot.flip=function(t){return Cr(t,512)},Ot.flow=Gi,Ot.flowRight=Ji,Ot.fromPairs=function(t){for(var n=-1,r=t?t.length:0,e={};++n<r;){var u=t[n];e[u[0]]=u[1]}return e},Ot.functions=function(t){return null==t?[]:_n(t,iu(t))},Ot.functionsIn=function(t){return null==t?[]:_n(t,fu(t))},Ot.groupBy=ei,Ot.initial=function(t){return se(t,1)},Ot.intersection=Do,Ot.intersectionBy=Fo,Ot.intersectionWith=No,Ot.invert=Ii,Ot.invertBy=Ri,Ot.invokeMap=ui,Ot.iteratee=_u,Ot.keyBy=oi,Ot.keys=iu,Ot.keysIn=fu,Ot.map=Oe,
Ot.mapKeys=function(t,n){var r={};return n=Fr(n,3),hn(t,function(t,e,u){r[n(t,e,u)]=t}),r},Ot.mapValues=function(t,n){var r={};return n=Fr(n,3),hn(t,function(t,e,u){r[e]=n(t,e,u)}),r},Ot.matches=function(t){return Rn(rn(t,true))},Ot.matchesProperty=function(t,n){return Wn(t,rn(n,true))},Ot.memoize=Le,Ot.merge=Bi,Ot.mergeWith=Li,Ot.method=Yi,Ot.methodOf=Hi,Ot.mixin=vu,Ot.negate=function(t){if(typeof t!="function")throw new Au("Expected a function");return function(){return!t.apply(this,arguments)}},Ot.nthArg=function(t){
return t=Xe(t),Me(function(n){return Ln(n,t)})},Ot.omit=Mi,Ot.omitBy=function(t,n){return n=Fr(n),zn(t,function(t,r){return!n(t,r)})},Ot.once=function(t){return Ie(2,t)},Ot.orderBy=function(t,n,r,e){return null==t?[]:(yi(n)||(n=null==n?[]:[n]),r=e?T:r,yi(r)||(r=null==r?[]:[r]),Mn(t,n,r))},Ot.over=Qi,Ot.overArgs=hi,Ot.overEvery=Xi,Ot.overSome=tf,Ot.partial=pi,Ot.partialRight=_i,Ot.partition=ii,Ot.pick=Ci,Ot.pickBy=function(t,n){return null==t?{}:zn(t,Fr(n))},Ot.property=du,Ot.propertyOf=function(t){
return function(n){return null==t?T:vn(t,n)}},Ot.pull=Po,Ot.pullAll=ge,Ot.pullAllBy=function(t,n,r){return t&&t.length&&n&&n.length?Dn(t,n,Fr(r)):t},Ot.pullAllWith=function(t,n,r){return t&&t.length&&n&&n.length?Dn(t,n,T,r):t},Ot.pullAt=Zo,Ot.range=nf,Ot.rangeRight=rf,Ot.rearg=vi,Ot.reject=function(t,n){var r=yi(t)?f:ln;return n=Fr(n,3),r(t,function(t,r,e){return!n(t,r,e)})},Ot.remove=function(t,n){var r=[];if(!t||!t.length)return r;var e=-1,u=[],o=t.length;for(n=Fr(n,3);++e<o;){var i=t[e];n(i,e,t)&&(r.push(i),
u.push(e))}return Fn(t,u),r},Ot.rest=Me,Ot.reverse=de,Ot.sampleSize=ke,Ot.set=function(t,n,r){return null==t?t:Zn(t,n,r)},Ot.setWith=function(t,n,r,e){return e=typeof e=="function"?e:T,null==t?t:Zn(t,n,r,e)},Ot.shuffle=function(t){return ke(t,4294967295)},Ot.slice=function(t,n,r){var e=t?t.length:0;return e?(r&&typeof r!="number"&&te(t,n,r)?(n=0,r=e):(n=null==n?0:Xe(n),r=r===T?e:Xe(r)),Tn(t,n,r)):[]},Ot.sortBy=fi,Ot.sortedUniq=function(t){return t&&t.length?Gn(t):[]},Ot.sortedUniqBy=function(t,n){
return t&&t.length?Gn(t,Fr(n)):[]},Ot.split=function(t,n,r){return r&&typeof r!="number"&&te(t,n,r)&&(n=r=T),r=r===T?4294967295:r>>>0,r?(t=eu(t))&&(typeof n=="string"||null!=n&&!Ke(n))&&(n=Yn(n),""==n&&Wt.test(t))?ur(t.match(It),0,r):oo.call(t,n,r):[]},Ot.spread=function(t,n){if(typeof t!="function")throw new Au("Expected a function");return n=n===T?0:Xu(Xe(n),0),Me(function(e){var u=e[n];return e=ur(e,0,n),u&&s(e,u),r(t,this,e)})},Ot.tail=function(t){return le(t,1)},Ot.take=function(t,n,r){return t&&t.length?(n=r||n===T?1:Xe(n),
Tn(t,0,0>n?0:n)):[]},Ot.takeRight=function(t,n,r){var e=t?t.length:0;return e?(n=r||n===T?1:Xe(n),n=e-n,Tn(t,0>n?0:n,e)):[]},Ot.takeRightWhile=function(t,n){return t&&t.length?Qn(t,Fr(n,3),false,true):[]},Ot.takeWhile=function(t,n){return t&&t.length?Qn(t,Fr(n,3)):[]},Ot.tap=function(t,n){return n(t),t},Ot.throttle=function(t,n,r){var e=true,u=true;if(typeof t!="function")throw new Au("Expected a function");return Ze(r)&&(e="leading"in r?!!r.leading:e,u="trailing"in r?!!r.trailing:u),Be(t,n,{leading:e,maxWait:n,
trailing:u})},Ot.thru=je,Ot.toArray=He,Ot.toPairs=zi,Ot.toPairsIn=Ui,Ot.toPath=function(t){return yi(t)?l(t,fe):Je(t)?[t]:lr(Co(t))},Ot.toPlainObject=ru,Ot.transform=function(t,n,r){var e=yi(t)||Ye(t);if(n=Fr(n,4),null==r)if(e||Ze(t)){var o=t.constructor;r=e?yi(t)?new o:[]:Fe(o)?un(Ju(Object(t))):{}}else r={};return(e?u:hn)(t,function(t,e,u){return n(r,t,e,u)}),r},Ot.unary=function(t){return Se(t,1)},Ot.union=To,Ot.unionBy=qo,Ot.unionWith=Vo,Ot.uniq=function(t){return t&&t.length?Hn(t):[]},Ot.uniqBy=function(t,n){
return t&&t.length?Hn(t,Fr(n)):[]},Ot.uniqWith=function(t,n){return t&&t.length?Hn(t,T,n):[]},Ot.unset=function(t,n){var r;if(null==t)r=true;else{r=t;var e=n,e=ne(e,r)?[e]:er(e);r=ie(r,e),e=fe(ve(e)),r=!(null!=r&&yn(r,e))||delete r[e]}return r},Ot.unzip=ye,Ot.unzipWith=be,Ot.update=function(t,n,r){return null==t?t:Zn(t,n,(typeof r=="function"?r:pu)(vn(t,n)),void 0)},Ot.updateWith=function(t,n,r,e){return e=typeof e=="function"?e:T,null!=t&&(t=Zn(t,n,(typeof r=="function"?r:pu)(vn(t,n)),e)),t},Ot.values=cu,
Ot.valuesIn=function(t){return null==t?[]:k(t,fu(t))},Ot.without=Ko,Ot.words=su,Ot.wrap=function(t,n){return n=null==n?pu:n,pi(n,t)},Ot.xor=Go,Ot.xorBy=Jo,Ot.xorWith=Yo,Ot.zip=Ho,Ot.zipObject=function(t,n){return nr(t||[],n||[],Yt)},Ot.zipObjectDeep=function(t,n){return nr(t||[],n||[],Zn)},Ot.zipWith=Qo,Ot.entries=zi,Ot.entriesIn=Ui,Ot.extend=mi,Ot.extendWith=Ai,vu(Ot,Ot),Ot.add=ef,Ot.attempt=Vi,Ot.camelCase=$i,Ot.capitalize=au,Ot.ceil=uf,Ot.clamp=function(t,n,r){return r===T&&(r=n,n=T),r!==T&&(r=nu(r),
r=r===r?r:0),n!==T&&(n=nu(n),n=n===n?n:0),nn(nu(t),n,r)},Ot.clone=function(t){return rn(t,false,true)},Ot.cloneDeep=function(t){return rn(t,true,true)},Ot.cloneDeepWith=function(t,n){return rn(t,true,true,n)},Ot.cloneWith=function(t,n){return rn(t,false,true,n)},Ot.deburr=lu,Ot.divide=of,Ot.endsWith=function(t,n,r){t=eu(t),n=Yn(n);var e=t.length;return r=r===T?e:nn(Xe(r),0,e),r-=n.length,r>=0&&t.indexOf(n,r)==r},Ot.eq=Ce,Ot.escape=function(t){return(t=eu(t))&&X.test(t)?t.replace(H,B):t},Ot.escapeRegExp=function(t){
return(t=eu(t))&&ft.test(t)?t.replace(it,"\\$&"):t},Ot.every=function(t,n,r){var e=yi(t)?i:cn;return r&&te(t,n,r)&&(n=T),e(t,Fr(n,3))},Ot.find=ni,Ot.findIndex=he,Ot.findKey=function(t,n){return v(t,Fr(n,3),hn)},Ot.findLast=ri,Ot.findLastIndex=pe,Ot.findLastKey=function(t,n){return v(t,Fr(n,3),pn)},Ot.floor=ff,Ot.forEach=me,Ot.forEachRight=Ae,Ot.forIn=function(t,n){return null==t?t:ko(t,Fr(n,3),fu)},Ot.forInRight=function(t,n){return null==t?t:Eo(t,Fr(n,3),fu)},Ot.forOwn=function(t,n){return t&&hn(t,Fr(n,3));
},Ot.forOwnRight=function(t,n){return t&&pn(t,Fr(n,3))},Ot.get=uu,Ot.gt=gi,Ot.gte=di,Ot.has=function(t,n){return null!=t&&Vr(t,n,yn)},Ot.hasIn=ou,Ot.head=_e,Ot.identity=pu,Ot.includes=function(t,n,r,e){return t=Ue(t)?t:cu(t),r=r&&!e?Xe(r):0,e=t.length,0>r&&(r=Xu(e+r,0)),Ge(t)?e>=r&&-1<t.indexOf(n,r):!!e&&-1<d(t,n,r)},Ot.indexOf=function(t,n,r){var e=t?t.length:0;return e?(r=null==r?0:Xe(r),0>r&&(r=Xu(e+r,0)),d(t,n,r)):-1},Ot.inRange=function(t,n,r){return n=nu(n)||0,r===T?(r=n,n=0):r=nu(r)||0,t=nu(t),
t>=to(n,r)&&t<Xu(n,r)},Ot.invoke=Wi,Ot.isArguments=ze,Ot.isArray=yi,Ot.isArrayBuffer=function(t){return Te(t)&&"[object ArrayBuffer]"==Mu.call(t)},Ot.isArrayLike=Ue,Ot.isArrayLikeObject=$e,Ot.isBoolean=function(t){return true===t||false===t||Te(t)&&"[object Boolean]"==Mu.call(t)},Ot.isBuffer=bi,Ot.isDate=function(t){return Te(t)&&"[object Date]"==Mu.call(t)},Ot.isElement=function(t){return!!t&&1===t.nodeType&&Te(t)&&!Ve(t)},Ot.isEmpty=function(t){if(Ue(t)&&(yi(t)||Ge(t)||Fe(t.splice)||ze(t)||bi(t)))return!t.length;
if(Te(t)){var n=qr(t);if("[object Map]"==n||"[object Set]"==n)return!t.size}for(var r in t)if(Wu.call(t,r))return false;return!(po&&iu(t).length)},Ot.isEqual=function(t,n){return mn(t,n)},Ot.isEqualWith=function(t,n,r){var e=(r=typeof r=="function"?r:T)?r(t,n):T;return e===T?mn(t,n,r):!!e},Ot.isError=De,Ot.isFinite=function(t){return typeof t=="number"&&Yu(t)},Ot.isFunction=Fe,Ot.isInteger=Ne,Ot.isLength=Pe,Ot.isMap=function(t){return Te(t)&&"[object Map]"==qr(t)},Ot.isMatch=function(t,n){return t===n||An(t,n,Pr(n));
},Ot.isMatchWith=function(t,n,r){return r=typeof r=="function"?r:T,An(t,n,Pr(n),r)},Ot.isNaN=function(t){return qe(t)&&t!=+t},Ot.isNative=function(t){if(Lo(t))throw new ju("This method is not supported with `core-js`. Try https://github.com/es-shims.");return On(t)},Ot.isNil=function(t){return null==t},Ot.isNull=function(t){return null===t},Ot.isNumber=qe,Ot.isObject=Ze,Ot.isObjectLike=Te,Ot.isPlainObject=Ve,Ot.isRegExp=Ke,Ot.isSafeInteger=function(t){return Ne(t)&&t>=-9007199254740991&&9007199254740991>=t;
},Ot.isSet=function(t){return Te(t)&&"[object Set]"==qr(t)},Ot.isString=Ge,Ot.isSymbol=Je,Ot.isTypedArray=Ye,Ot.isUndefined=function(t){return t===T},Ot.isWeakMap=function(t){return Te(t)&&"[object WeakMap]"==qr(t)},Ot.isWeakSet=function(t){return Te(t)&&"[object WeakSet]"==Mu.call(t)},Ot.join=function(t,n){return t?Hu.call(t,n):""},Ot.kebabCase=Di,Ot.last=ve,Ot.lastIndexOf=function(t,n,r){var e=t?t.length:0;if(!e)return-1;var u=e;if(r!==T&&(u=Xe(r),u=(0>u?Xu(e+u,0):to(u,e-1))+1),n!==n)return M(t,u-1,true);
for(;u--;)if(t[u]===n)return u;return-1},Ot.lowerCase=Fi,Ot.lowerFirst=Ni,Ot.lt=xi,Ot.lte=ji,Ot.max=function(t){return t&&t.length?an(t,pu,dn):T},Ot.maxBy=function(t,n){return t&&t.length?an(t,Fr(n),dn):T},Ot.mean=function(t){return b(t,pu)},Ot.meanBy=function(t,n){return b(t,Fr(n))},Ot.min=function(t){return t&&t.length?an(t,pu,Sn):T},Ot.minBy=function(t,n){return t&&t.length?an(t,Fr(n),Sn):T},Ot.stubArray=yu,Ot.stubFalse=bu,Ot.stubObject=function(){return{}},Ot.stubString=function(){return""},Ot.stubTrue=function(){
return true},Ot.multiply=cf,Ot.nth=function(t,n){return t&&t.length?Ln(t,Xe(n)):T},Ot.noConflict=function(){return Kt._===this&&(Kt._=Cu),this},Ot.noop=gu,Ot.now=Ee,Ot.pad=function(t,n,r){t=eu(t);var e=(n=Xe(n))?N(t):0;return!n||e>=n?t:(n=(n-e)/2,Sr(Gu(n),r)+t+Sr(Ku(n),r))},Ot.padEnd=function(t,n,r){t=eu(t);var e=(n=Xe(n))?N(t):0;return n&&n>e?t+Sr(n-e,r):t},Ot.padStart=function(t,n,r){t=eu(t);var e=(n=Xe(n))?N(t):0;return n&&n>e?Sr(n-e,r)+t:t},Ot.parseInt=function(t,n,r){return r||null==n?n=0:n&&(n=+n),
t=eu(t).replace(ct,""),no(t,n||(vt.test(t)?16:10))},Ot.random=function(t,n,r){if(r&&typeof r!="boolean"&&te(t,n,r)&&(n=r=T),r===T&&(typeof n=="boolean"?(r=n,n=T):typeof t=="boolean"&&(r=t,t=T)),t===T&&n===T?(t=0,n=1):(t=nu(t)||0,n===T?(n=t,t=0):n=nu(n)||0),t>n){var e=t;t=n,n=e}return r||t%1||n%1?(r=ro(),to(t+r*(n-t+Ft("1e-"+((r+"").length-1))),n)):Nn(t,n)},Ot.reduce=function(t,n,r){var e=yi(t)?h:x,u=3>arguments.length;return e(t,Fr(n,4),r,u,Ao)},Ot.reduceRight=function(t,n,r){var e=yi(t)?p:x,u=3>arguments.length;
return e(t,Fr(n,4),r,u,Oo)},Ot.repeat=function(t,n,r){return n=(r?te(t,n,r):n===T)?1:Xe(n),Pn(eu(t),n)},Ot.replace=function(){var t=arguments,n=eu(t[0]);return 3>t.length?n:eo.call(n,t[1],t[2])},Ot.result=function(t,n,r){n=ne(n,t)?[n]:er(n);var e=-1,u=n.length;for(u||(t=T,u=1);++e<u;){var o=null==t?T:t[fe(n[e])];o===T&&(e=u,o=r),t=Fe(o)?o.call(t):o}return t},Ot.round=af,Ot.runInContext=Z,Ot.sample=function(t){t=Ue(t)?t:cu(t);var n=t.length;return n>0?t[Nn(0,n-1)]:T},Ot.size=function(t){if(null==t)return 0;
if(Ue(t)){var n=t.length;return n&&Ge(t)?N(t):n}return Te(t)&&(n=qr(t),"[object Map]"==n||"[object Set]"==n)?t.size:iu(t).length},Ot.snakeCase=Pi,Ot.some=function(t,n,r){var e=yi(t)?_:qn;return r&&te(t,n,r)&&(n=T),e(t,Fr(n,3))},Ot.sortedIndex=function(t,n){return Vn(t,n)},Ot.sortedIndexBy=function(t,n,r){return Kn(t,n,Fr(r))},Ot.sortedIndexOf=function(t,n){var r=t?t.length:0;if(r){var e=Vn(t,n);if(r>e&&Ce(t[e],n))return e}return-1},Ot.sortedLastIndex=function(t,n){return Vn(t,n,true)},Ot.sortedLastIndexBy=function(t,n,r){
return Kn(t,n,Fr(r),true)},Ot.sortedLastIndexOf=function(t,n){if(t&&t.length){var r=Vn(t,n,true)-1;if(Ce(t[r],n))return r}return-1},Ot.startCase=Zi,Ot.startsWith=function(t,n,r){return t=eu(t),r=nn(Xe(r),0,t.length),t.lastIndexOf(Yn(n),r)==r},Ot.subtract=lf,Ot.sum=function(t){return t&&t.length?w(t,pu):0},Ot.sumBy=function(t,n){return t&&t.length?w(t,Fr(n)):0},Ot.template=function(t,n,r){var e=Ot.templateSettings;r&&te(t,n,r)&&(n=T),t=eu(t),n=Ai({},n,e,Vt),r=Ai({},n.imports,e.imports,Vt);var u,o,i=iu(r),f=k(r,i),c=0;
r=n.interpolate||wt;var a="__p+='";r=mu((n.escape||wt).source+"|"+r.source+"|"+(r===rt?pt:wt).source+"|"+(n.evaluate||wt).source+"|$","g");var l="sourceURL"in n?"//# sourceURL="+n.sourceURL+"\n":"";if(t.replace(r,function(n,r,e,i,f,l){return e||(e=i),a+=t.slice(c,l).replace(mt,L),r&&(u=true,a+="'+__e("+r+")+'"),f&&(o=true,a+="';"+f+";\n__p+='"),e&&(a+="'+((__t=("+e+"))==null?'':__t)+'"),c=l+n.length,n}),a+="';",(n=n.variable)||(a="with(obj){"+a+"}"),a=(o?a.replace(K,""):a).replace(G,"$1").replace(J,"$1;"),
a="function("+(n||"obj")+"){"+(n?"":"obj||(obj={});")+"var __t,__p=''"+(u?",__e=_.escape":"")+(o?",__j=Array.prototype.join;function print(){__p+=__j.call(arguments,'')}":";")+a+"return __p}",n=Vi(function(){return Function(i,l+"return "+a).apply(T,f)}),n.source=a,De(n))throw n;return n},Ot.times=function(t,n){if(t=Xe(t),1>t||t>9007199254740991)return[];var r=4294967295,e=to(t,4294967295);for(n=Fr(n),t-=4294967295,e=m(e,n);++r<t;)n(r);return e},Ot.toFinite=Qe,Ot.toInteger=Xe,Ot.toLength=tu,Ot.toLower=function(t){
return eu(t).toLowerCase()},Ot.toNumber=nu,Ot.toSafeInteger=function(t){return nn(Xe(t),-9007199254740991,9007199254740991)},Ot.toString=eu,Ot.toUpper=function(t){return eu(t).toUpperCase()},Ot.trim=function(t,n,r){return(t=eu(t))&&(r||n===T)?t.replace(ct,""):t&&(n=Yn(n))?(t=t.match(It),n=n.match(It),ur(t,S(t,n),I(t,n)+1).join("")):t},Ot.trimEnd=function(t,n,r){return(t=eu(t))&&(r||n===T)?t.replace(lt,""):t&&(n=Yn(n))?(t=t.match(It),n=I(t,n.match(It))+1,ur(t,0,n).join("")):t},Ot.trimStart=function(t,n,r){
return(t=eu(t))&&(r||n===T)?t.replace(at,""):t&&(n=Yn(n))?(t=t.match(It),n=S(t,n.match(It)),ur(t,n).join("")):t},Ot.truncate=function(t,n){var r=30,e="...";if(Ze(n))var u="separator"in n?n.separator:u,r="length"in n?Xe(n.length):r,e="omission"in n?Yn(n.omission):e;t=eu(t);var o=t.length;if(Wt.test(t))var i=t.match(It),o=i.length;if(r>=o)return t;if(o=r-N(e),1>o)return e;if(r=i?ur(i,0,o).join(""):t.slice(0,o),u===T)return r+e;if(i&&(o+=r.length-o),Ke(u)){if(t.slice(o).search(u)){var f=r;for(u.global||(u=mu(u.source,eu(_t.exec(u))+"g")),
u.lastIndex=0;i=u.exec(f);)var c=i.index;r=r.slice(0,c===T?o:c)}}else t.indexOf(Yn(u),o)!=o&&(u=r.lastIndexOf(u),u>-1&&(r=r.slice(0,u)));return r+e},Ot.unescape=function(t){return(t=eu(t))&&Q.test(t)?t.replace(Y,P):t},Ot.uniqueId=function(t){var n=++Bu;return eu(t)+n},Ot.upperCase=Ti,Ot.upperFirst=qi,Ot.each=me,Ot.eachRight=Ae,Ot.first=_e,vu(Ot,function(){var t={};return hn(Ot,function(n,r){Wu.call(Ot.prototype,r)||(t[r]=n)}),t}(),{chain:false}),Ot.VERSION="4.13.1",u("bind bindKey curry curryRight partial partialRight".split(" "),function(t){
Ot[t].placeholder=Ot}),u(["drop","take"],function(t,n){Ut.prototype[t]=function(r){var e=this.__filtered__;if(e&&!n)return new Ut(this);r=r===T?1:Xu(Xe(r),0);var u=this.clone();return e?u.__takeCount__=to(r,u.__takeCount__):u.__views__.push({size:to(r,4294967295),type:t+(0>u.__dir__?"Right":"")}),u},Ut.prototype[t+"Right"]=function(n){return this.reverse()[t](n).reverse()}}),u(["filter","map","takeWhile"],function(t,n){var r=n+1,e=1==r||3==r;Ut.prototype[t]=function(t){var n=this.clone();return n.__iteratees__.push({
iteratee:Fr(t,3),type:r}),n.__filtered__=n.__filtered__||e,n}}),u(["head","last"],function(t,n){var r="take"+(n?"Right":"");Ut.prototype[t]=function(){return this[r](1).value()[0]}}),u(["initial","tail"],function(t,n){var r="drop"+(n?"":"Right");Ut.prototype[t]=function(){return this.__filtered__?new Ut(this):this[r](1)}}),Ut.prototype.compact=function(){return this.filter(pu)},Ut.prototype.find=function(t){return this.filter(t).head()},Ut.prototype.findLast=function(t){return this.reverse().find(t);
},Ut.prototype.invokeMap=Me(function(t,n){return typeof t=="function"?new Ut(this):this.map(function(r){return wn(r,t,n)})}),Ut.prototype.reject=function(t){return t=Fr(t,3),this.filter(function(n){return!t(n)})},Ut.prototype.slice=function(t,n){t=Xe(t);var r=this;return r.__filtered__&&(t>0||0>n)?new Ut(r):(0>t?r=r.takeRight(-t):t&&(r=r.drop(t)),n!==T&&(n=Xe(n),r=0>n?r.dropRight(-n):r.take(n-t)),r)},Ut.prototype.takeRightWhile=function(t){return this.reverse().takeWhile(t).reverse()},Ut.prototype.toArray=function(){
return this.take(4294967295)},hn(Ut.prototype,function(t,n){var r=/^(?:filter|find|map|reject)|While$/.test(n),e=/^(?:head|last)$/.test(n),u=Ot[e?"take"+("last"==n?"Right":""):n],o=e||/^find/.test(n);u&&(Ot.prototype[n]=function(){function n(t){return t=u.apply(Ot,s([t],f)),e&&h?t[0]:t}var i=this.__wrapped__,f=e?[1]:arguments,c=i instanceof Ut,a=f[0],l=c||yi(i);l&&r&&typeof a=="function"&&1!=a.length&&(c=l=false);var h=this.__chain__,p=!!this.__actions__.length,a=o&&!h,c=c&&!p;return!o&&l?(i=c?i:new Ut(this),
i=t.apply(i,f),i.__actions__.push({func:je,args:[n],thisArg:T}),new zt(i,h)):a&&c?t.apply(this,f):(i=this.thru(n),a?e?i.value()[0]:i.value():i)})}),u("pop push shift sort splice unshift".split(" "),function(t){var n=Ou[t],r=/^(?:push|sort|unshift)$/.test(t)?"tap":"thru",e=/^(?:pop|shift)$/.test(t);Ot.prototype[t]=function(){var t=arguments;if(e&&!this.__chain__){var u=this.value();return n.apply(yi(u)?u:[],t)}return this[r](function(r){return n.apply(yi(r)?r:[],t)})}}),hn(Ut.prototype,function(t,n){
var r=Ot[n];if(r){var e=r.name+"";(_o[e]||(_o[e]=[])).push({name:n,func:r})}}),_o[Ar(T,2).name]=[{name:"wrapper",func:T}],Ut.prototype.clone=function(){var t=new Ut(this.__wrapped__);return t.__actions__=lr(this.__actions__),t.__dir__=this.__dir__,t.__filtered__=this.__filtered__,t.__iteratees__=lr(this.__iteratees__),t.__takeCount__=this.__takeCount__,t.__views__=lr(this.__views__),t},Ut.prototype.reverse=function(){if(this.__filtered__){var t=new Ut(this);t.__dir__=-1,t.__filtered__=true}else t=this.clone(),
t.__dir__*=-1;return t},Ut.prototype.value=function(){var t,n=this.__wrapped__.value(),r=this.__dir__,e=yi(n),u=0>r,o=e?n.length:0;t=o;for(var i=this.__views__,f=0,c=-1,a=i.length;++c<a;){var l=i[c],s=l.size;switch(l.type){case"drop":f+=s;break;case"dropRight":t-=s;break;case"take":t=to(t,f+s);break;case"takeRight":f=Xu(f,t-s)}}if(t={start:f,end:t},i=t.start,f=t.end,t=f-i,u=u?f:i-1,i=this.__iteratees__,f=i.length,c=0,a=to(t,this.__takeCount__),!e||200>o||o==t&&a==t)return Xn(n,this.__actions__);e=[];
t:for(;t--&&a>c;){for(u+=r,o=-1,l=n[u];++o<f;){var h=i[o],s=h.type,h=(0,h.iteratee)(l);if(2==s)l=h;else if(!h){if(1==s)continue t;break t}}e[c++]=l}return e},Ot.prototype.at=Xo,Ot.prototype.chain=function(){return xe(this)},Ot.prototype.commit=function(){return new zt(this.value(),this.__chain__)},Ot.prototype.next=function(){this.__values__===T&&(this.__values__=He(this.value()));var t=this.__index__>=this.__values__.length,n=t?T:this.__values__[this.__index__++];return{done:t,value:n}},Ot.prototype.plant=function(t){
for(var n,r=this;r instanceof kt;){var e=ae(r);e.__index__=0,e.__values__=T,n?u.__wrapped__=e:n=e;var u=e,r=r.__wrapped__}return u.__wrapped__=t,n},Ot.prototype.reverse=function(){var t=this.__wrapped__;return t instanceof Ut?(this.__actions__.length&&(t=new Ut(this)),t=t.reverse(),t.__actions__.push({func:je,args:[de],thisArg:T}),new zt(t,this.__chain__)):this.thru(de)},Ot.prototype.toJSON=Ot.prototype.valueOf=Ot.prototype.value=function(){return Xn(this.__wrapped__,this.__actions__)},Zu&&(Ot.prototype[Zu]=we),
Ot}var T,q=1/0,V=NaN,K=/\b__p\+='';/g,G=/\b(__p\+=)''\+/g,J=/(__e\(.*?\)|\b__t\))\+'';/g,Y=/&(?:amp|lt|gt|quot|#39|#96);/g,H=/[&<>"'`]/g,Q=RegExp(Y.source),X=RegExp(H.source),tt=/<%-([\s\S]+?)%>/g,nt=/<%([\s\S]+?)%>/g,rt=/<%=([\s\S]+?)%>/g,et=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,ut=/^\w*$/,ot=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(\.|\[\])(?:\4|$))/g,it=/[\\^$.*+?()[\]{}|]/g,ft=RegExp(it.source),ct=/^\s+|\s+$/g,at=/^\s+/,lt=/\s+$/,st=/[a-zA-Z0-9]+/g,ht=/\\(\\)?/g,pt=/\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g,_t=/\w*$/,vt=/^0x/i,gt=/^[-+]0x[0-9a-f]+$/i,dt=/^0b[01]+$/i,yt=/^\[object .+?Constructor\]$/,bt=/^0o[0-7]+$/i,xt=/^(?:0|[1-9]\d*)$/,jt=/[\xc0-\xd6\xd8-\xde\xdf-\xf6\xf8-\xff]/g,wt=/($^)/,mt=/['\n\r\u2028\u2029\\]/g,At="[\\ufe0e\\ufe0f]?(?:[\\u0300-\\u036f\\ufe20-\\ufe23\\u20d0-\\u20f0]|\\ud83c[\\udffb-\\udfff])?(?:\\u200d(?:[^\\ud800-\\udfff]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff])[\\ufe0e\\ufe0f]?(?:[\\u0300-\\u036f\\ufe20-\\ufe23\\u20d0-\\u20f0]|\\ud83c[\\udffb-\\udfff])?)*",Ot="(?:[\\u2700-\\u27bf]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff])"+At,kt="(?:[^\\ud800-\\udfff][\\u0300-\\u036f\\ufe20-\\ufe23\\u20d0-\\u20f0]?|[\\u0300-\\u036f\\ufe20-\\ufe23\\u20d0-\\u20f0]|(?:\\ud83c[\\udde6-\\uddff]){2}|[\\ud800-\\udbff][\\udc00-\\udfff]|[\\ud800-\\udfff])",Et=RegExp("['\u2019]","g"),St=RegExp("[\\u0300-\\u036f\\ufe20-\\ufe23\\u20d0-\\u20f0]","g"),It=RegExp("\\ud83c[\\udffb-\\udfff](?=\\ud83c[\\udffb-\\udfff])|"+kt+At,"g"),Rt=RegExp(["[A-Z\\xc0-\\xd6\\xd8-\\xde]?[a-z\\xdf-\\xf6\\xf8-\\xff]+(?:['\u2019](?:d|ll|m|re|s|t|ve))?(?=[\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000]|[A-Z\\xc0-\\xd6\\xd8-\\xde]|$)|(?:[A-Z\\xc0-\\xd6\\xd8-\\xde]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])+(?:['\u2019](?:D|LL|M|RE|S|T|VE))?(?=[\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000]|[A-Z\\xc0-\\xd6\\xd8-\\xde](?:[a-z\\xdf-\\xf6\\xf8-\\xff]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])|$)|[A-Z\\xc0-\\xd6\\xd8-\\xde]?(?:[a-z\\xdf-\\xf6\\xf8-\\xff]|[^\\ud800-\\udfff\\xac\\xb1\\xd7\\xf7\\x00-\\x2f\\x3a-\\x40\\x5b-\\x60\\x7b-\\xbf\\u2000-\\u206f \\t\\x0b\\f\\xa0\\ufeff\\n\\r\\u2028\\u2029\\u1680\\u180e\\u2000\\u2001\\u2002\\u2003\\u2004\\u2005\\u2006\\u2007\\u2008\\u2009\\u200a\\u202f\\u205f\\u3000\\d+\\u2700-\\u27bfa-z\\xdf-\\xf6\\xf8-\\xffA-Z\\xc0-\\xd6\\xd8-\\xde])+(?:['\u2019](?:d|ll|m|re|s|t|ve))?|[A-Z\\xc0-\\xd6\\xd8-\\xde]+(?:['\u2019](?:D|LL|M|RE|S|T|VE))?|\\d+",Ot].join("|"),"g"),Wt=RegExp("[\\u200d\\ud800-\\udfff\\u0300-\\u036f\\ufe20-\\ufe23\\u20d0-\\u20f0\\ufe0e\\ufe0f]"),Bt=/[a-z][A-Z]|[A-Z]{2,}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]/,Lt="Array Buffer DataView Date Error Float32Array Float64Array Function Int8Array Int16Array Int32Array Map Math Object Promise Reflect RegExp Set String Symbol TypeError Uint8Array Uint8ClampedArray Uint16Array Uint32Array WeakMap _ isFinite parseInt setTimeout".split(" "),Mt={};
Mt["[object Float32Array]"]=Mt["[object Float64Array]"]=Mt["[object Int8Array]"]=Mt["[object Int16Array]"]=Mt["[object Int32Array]"]=Mt["[object Uint8Array]"]=Mt["[object Uint8ClampedArray]"]=Mt["[object Uint16Array]"]=Mt["[object Uint32Array]"]=true,Mt["[object Arguments]"]=Mt["[object Array]"]=Mt["[object ArrayBuffer]"]=Mt["[object Boolean]"]=Mt["[object DataView]"]=Mt["[object Date]"]=Mt["[object Error]"]=Mt["[object Function]"]=Mt["[object Map]"]=Mt["[object Number]"]=Mt["[object Object]"]=Mt["[object RegExp]"]=Mt["[object Set]"]=Mt["[object String]"]=Mt["[object WeakMap]"]=false;
var Ct={};Ct["[object Arguments]"]=Ct["[object Array]"]=Ct["[object ArrayBuffer]"]=Ct["[object DataView]"]=Ct["[object Boolean]"]=Ct["[object Date]"]=Ct["[object Float32Array]"]=Ct["[object Float64Array]"]=Ct["[object Int8Array]"]=Ct["[object Int16Array]"]=Ct["[object Int32Array]"]=Ct["[object Map]"]=Ct["[object Number]"]=Ct["[object Object]"]=Ct["[object RegExp]"]=Ct["[object Set]"]=Ct["[object String]"]=Ct["[object Symbol]"]=Ct["[object Uint8Array]"]=Ct["[object Uint8ClampedArray]"]=Ct["[object Uint16Array]"]=Ct["[object Uint32Array]"]=true,
Ct["[object Error]"]=Ct["[object Function]"]=Ct["[object WeakMap]"]=false;var zt={"\xc0":"A","\xc1":"A","\xc2":"A","\xc3":"A","\xc4":"A","\xc5":"A","\xe0":"a","\xe1":"a","\xe2":"a","\xe3":"a","\xe4":"a","\xe5":"a","\xc7":"C","\xe7":"c","\xd0":"D","\xf0":"d","\xc8":"E","\xc9":"E","\xca":"E","\xcb":"E","\xe8":"e","\xe9":"e","\xea":"e","\xeb":"e","\xcc":"I","\xcd":"I","\xce":"I","\xcf":"I","\xec":"i","\xed":"i","\xee":"i","\xef":"i","\xd1":"N","\xf1":"n","\xd2":"O","\xd3":"O","\xd4":"O","\xd5":"O","\xd6":"O",
"\xd8":"O","\xf2":"o","\xf3":"o","\xf4":"o","\xf5":"o","\xf6":"o","\xf8":"o","\xd9":"U","\xda":"U","\xdb":"U","\xdc":"U","\xf9":"u","\xfa":"u","\xfb":"u","\xfc":"u","\xdd":"Y","\xfd":"y","\xff":"y","\xc6":"Ae","\xe6":"ae","\xde":"Th","\xfe":"th","\xdf":"ss"},Ut={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"},$t={"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&#39;":"'","&#96;":"`"},Dt={"\\":"\\","'":"'","\n":"n","\r":"r","\u2028":"u2028","\u2029":"u2029"},Ft=parseFloat,Nt=parseInt,Pt=typeof exports=="object"&&exports,Zt=Pt&&typeof module=="object"&&module,Tt=Zt&&Zt.exports===Pt,qt=R(typeof self=="object"&&self),Vt=R(typeof this=="object"&&this),Kt=R(typeof global=="object"&&global)||qt||Vt||Function("return this")(),Gt=Z();
(qt||{})._=Gt,typeof define=="function"&&typeof define.amd=="object"&&define.amd? define(function(){return Gt}):Zt?((Zt.exports=Gt)._=Gt,Pt._=Gt):Kt._=Gt}).call(this);
var slice = Function.prototype.call.bind(Array.prototype.slice)
var flow_ = function (g, f) {
  return function () {
    var self = this;
    var args = slice(arguments)
    return Promise.resolve(g.apply(self, args)).then(function (v) {
      args[0] = v
      return f.apply(self, args)
    });
  }
}

window.flow = function () {
  var funcs = slice(arguments);
  return _.foldl(funcs, flow_);
}

// hpm.js
// Copyright Jonas Colmsjö 2015
//

;
(function () {
  var log = console.log.bind(console);
  var info = console.info.bind(console);
  var debug = console.debug.bind(console);
  var error = console.error.bind(console);

  debug('Initializing hpm - the package manager for html apps...');

  // imports
  // =======

  ODS = window['odsync'];

  // private vars
  // ===========

  // hpm class
  // =========

  // constructor
  var hpm = {};

  // NOTE: Should create a proper class, perhaps as a singleton???
  hpm.getConfig = function () {
    var db = new ydn.db.Storage('config', {
      stores: [{
        name: 'backend',
        autoIncrement: false
      }]
    });

    return db.get('backend', 'config').then(function (cfg) {
      if (!cfg || !cfg.url || !cfg.email ||  !cfg.accountId ||  !cfg.password)
        throw 'ERROR; url, email, accoundId and password must be configured, ' +
        'see hpm.help("config")';
      return cfg;
    });
  };


  hpm.getDb = function (workStore) {

    if (!workStore) workStore = "work";

    return hpm.getConfig()
      .then(function (cfg) {

        var db = new ydn.db.Storage(cfg.accountId, {
          stores: [
            {
              name: 'buckets',
              autoIncrement: false
            },
            {
              name: 'packages',
              autoIncrement: false
            },
            {
              name: workStore,
              autoIncrement: false
            }
          ]
        });

        return {
          cfg: cfg,
          db: db
        };
      });
  };

  // create a packege locally in the buckets store using html/css/js
  // from the work store. packageDef is a json with `name`, `description`
  // and `version`
  hpm.create = function (packageDef, html, css, js, workStore) {
    var db;

    if (!packageDef)
      throw "ERROR: packageDef must be specified!";


    if (!workStore) workStore = "work";

    var db;

    return hpm.getDb(workStore)
      .then(function (d) {

        db = d.db;

        var ps = [db.get(workStore, packageDef)];
        if (html) ps.push(db.get(workStore, html));
        if (css) ps.push(db.get(workStore, css));
        if (js) ps.push(db.get(workStore, js));

        return Promise.all(ps);

      })
      .then(function (data) {

        var d = {
          packageDef: data[0],
          html: data[1].v,
          css: data[2].v,
          js: data[3].v
        };

        if (!d.packageDef.name || !d.packageDef.description || !d.packageDef.version)
          throw 'ERROR: package definition file missing mandatory fields, ' +
          'see hpm.help("create") for more information.';

        return db.put("buckets", d, 'b_' + d.packageDef.name + '-' + d.packageDef.version);
      })

  };

  // url_path ::= [account_id]/[bucket name]$[filename.(html|css|js)]$[semver]
  // examples: a123456789/b_helloapp$hello.html$0.0.1
  //           a123456789/b_helloapp$hello.css$0.0.1
  //           a123456789/b_helloapp$hello.js$0.0.1
  hpm.fetch = function (accountId, bucket, filename, workStore) {

    if (!workStore) workStore = "work";

    return hpm.getDb()
      .then(function (res) {

        var od = new Odata(res.cfg);
        var db = res.db;

        // TODO: odapi expects the URL in options to end with a / while hpm does not
        od.fetch('/'+accountId, bucket+'$'+filename).then(function(res){
          db.put(workStore, {v: res.data}, filename);
        });

      });
  };

  hpm.register = function (package) {

    return hpm.getDb()
      .then(function (d) {

        return d.db.put("packages", {
            accountId: d.cfg.accountId,
            name: package
          },
          package);
      });
  };

  // Command line help, static functions on the App object
  // -----------------------------------------------------

  hpm.help = function (topic) {

    var footer = '\n\n-----\nSee hpm.help("config") for how to setup the database connection.';

    if (!topic) {

      var msg =
        '-- Htmlapp package manager help --'
        + '\n\n* hpm.help("register_account") - show setup help'
        + '\n* hpm.help("create") - help with creating packages'
        + '\n* hpm.help("work") - working with files'
        + '\n\n* hpm.create(package_def_file, html_file, css_file, js_file, [work_store]) - create new package or update existing package.'
//      +  '\n* hpm.sync() - uppdat registry med public packages, varna om name är upptaget'
//      +  '\n* hpm.register(name) - spara rad i b_packages: <account_id>, app id'
        + '\n* hpm.fetch(accountId, bucket, filename, [work_store]) - fetch file from the repository to the local database.'
//        + '\n* hpm.store(account_id, filename, [work_store]) - store file to the repository from the local database.'
// Fetch and then create        + '\n* hpm.install(name, version) - install app from the repository in the local database.'
//        + '\n* hpm.search(keywords) - lista packages som matchar, registry endast remote, ej lokalt?'
        ;

      info(msg);

      return;
    }

    if (topic === 'register_account') {
      var msg = 'A little configuration needs to be done before hpm can be used:' +
        '\n// Step one' +
        '\nvar config = {' +
        '\n\turl: "http://localhost:3000/", ' +
        '\n\temail: "joe@example.com"' +
        '\n};' +
        '\nvar db = new ydn.db.Storage("config", {stores: [{ name: "backend", autoIncrement: false }]});' +
        '\nOdata.createAccount(config).then(function (res) {' +
        '\n    config.accountId = res.data[1].accountId;' +
        '\n  }, function (res) {' +
        '\n    config.accountId = res.data[1].accountId;' +
        '\n  })' +
        '\n// Check that the accountId has been stored in config' +
        '\n// Step two' +
        '\nconfig.password = "check the mail for a password";' +
        '\n// This also works if you have a odataserver in development mode' +
        '\nOdata.resetPassword(config).then(function (res) {' +
        '\nconfig.password = res.data[0].password' +
        '\n}, console.log.bind("ERROR", console))' +
        '\n//Step 3' +
        '\ndb.put("backend", config, "config");';

      info(msg);
    } else if (topic === 'create') {
      var msg =
        'Your packages are saved in a database with the same name as your accountid and the ' +
        '\nobject store named buckets. The key for each packet is b_<package name>-<version>' +
        '\nwhere <version> should be in the format X.Y.Z, e.g. 1.0.0, using so called ' +
        '\nsemantic versions, see semver.org' +
        '\n\nThis is an example of a package definition file is created:' +
        '\n\ndb.put("work", { ' +
        '\n\t   name: "hello",' +
        '\n\t    description: "hello world example" ,' +
        '\n\t    version: "0.0.1" ,' +
        '\n\t    private: true , ' +
        '\n\t    permissions: null , ' +
        '\n\t    dependecies: "None (currently only for information, these needs to be fetched manually)"' +
        '\n\t  }, "mypackage.json");' +
        '\n\nThen create the package like this:' +
        '\n\nhpm.create("mypackage.json", "hello.html", "hello.css", "hello.js", [work_store])' +
        '\n\nCheck the results with:' +
        '\n\ndb.get("buckets","b_hello-0.0.1").then(console.log.bind(console));';

      info(msg);
    } else if (topic === 'work') {
      var msg =
        'Open a database connection that can be used for files we work on:' +
        '\n\nvar db; ' +
        '\nhpm.getConfig().then(function(cfg){' +
        '\n\tdb = new ydn.db.Storage(cfg.accountId, ' +
        '\n\t\t{stores: [{ name: "work", autoIncrement: false },' +
        '\n\t\t{ name: "buckets", autoIncrement: false }]}' +
        '\n\t);' +
        '\n});' +
        '\n\nUse this simple Hello World app to test that everything works:' +
        '\n\nvar html = "<htlm><body><h1>Hello World</h1></body></html>"' +
        '\nvar js = "init = function() { console.log(\'init function\');};"' +
        '\nvar css = "body {background: rgba(234, 159, 195, 0.8);}"' +
        '\ndb.put("work", {v: html}, "hello.html");' +
        '\ndb.put("work", {v: css}, "hello.css");' +
        '\ndb.put("work", {v: js}, "hello.js");' +
        '\n\nClear the object store "work"' +
        '\ndb.clear("work");';

      info(msg);

    } else if (topic === 'register') {
      var msg =
        'Register a package so it can be downloaded by anyone (not implemented yet):' +
        '\n\nhpm.register("hello");' +
        footer;

      info(msg);

    } else {
      info('Uknown help topic: ' + topic);
    }

  }

  // Export
  // ======

  window['hpm'] = hpm;

  debug('hpm is loaded.');

  // Introduction message
  // ====================

  // Htmlapp will show a welcome message
  //info('Welcome to hpm - the package manager for Html apps!');
  //info("Show the help with hpm.help()")

}());

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

    // Singleton
    if (typeof App.instance_ === 'object') {
      return App.instance_;
    }

    // initialize private and class variables
    App.instance_ = this;
  }

  App.prototype.init = function (options) {
    var self = this;

    self.varps_ = {};

    // events that we listens to in the main frame
    document.addEventListener('click', handler);

    if (!options) options = {};
    if (!options.pageOptions) {
      options.pageOptions = {
        title: "Apps developed with incredible speed!"
      };
    }
    self.createMainPage(options.pageOptions);

    // setup file storage using a stored configuration
    if (!options.dbName || !options.storeName) {
      if (!hpm)
        throw 'ERROR: hpm not loaded. App.init with options must be used!';

      return hpm.getConfig().then(function (cfg) {

        self.dbName = cfg.accountId;
        self.storeName = "work";

        self.db = new ydn.db.Storage(cfg.accountId, {
          stores: [{
            name: self.storeName,
            autoIncrement: false
          }, {
            name: "buckets",
            autoIncrement: false
          }]
        });

      });

    }

    // setup file storage with the options supplied
    else {
      // check mandatory atributes
      if (!options.dbName || !options.storeName)
        throw "ERROR: database name and store name must be specified!";

      self.dbName = options.dbName;
      self.storeName = options.storeName;

      // Use YDN-DB to access IndexedDB - not using inline key
      var schema = {
        stores: [{
          name: options.storeName,
          autoIncrement: false
        }]
      };

      self.db = new ydn.db.Storage(self.dbName, schema);

      return Promise.resolve(true);
    }
  };

  App.prototype.keys = function () {
    return this.db.keys(this.storeName);
  };

  App.prototype.get = function (filename) {
    return this.db.get(this.storeName, filename);
  };

  App.prototype.put = function (filename, data) {
    return this.db.put(this.storeName, data, filename);
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

  App.prototype.load = function (appName) {
    var self = this;

    return new Promise(function (fulfill, reject) {

      debug('load app:', appName);

      var createIFrame = function (input) {
        debug('createIFrame ' + input.packageDef.name);

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
          debug('updateIframe ' + input.packageDef.name + ' send=' + eventsToRegister);
        }

        // This is necesseray for Firefox, the real permissions are set at the end
        // Set the sandbox permissions
        if (input.permissions !== '') {
          iframe.sandbox = 'allow-same-origin allow-scripts';
        }

        iframe.id = input.packageDef.name;

        // this is executed when the iframe has been loaded
        var updateIframe = function (event) {
          debug('updateIframe ' + input.packageDef.name + ' (load event fired)');

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
          if (input.packageDef.permissions !== '') {
            event.target.sandbox = input.packageDef.permissions;
            debug('permissions set to: ' +
              document.getElementById(iframe.id).sandbox);
          }

          // Load CSS
          // ---------

          if (input.css && !input.noCSS) {
            debug('updateIframe with id ' + input.packageDef.name + '. Load CSS.');
            self.loadStyle(input.css, iframeDoc, false);
          }

          // Load script
          // ------------

          // Embedded scripts are not loaded, remove them the body
          var tmpScripts = iframeDoc.getElementsByTagName('script');
          while (tmpScripts.length > 0) {
            iframeDoc.body.removeChild(tmpScripts[0]);
          }

          if (input.js && !input.noJS) {
            debug('updateIframe with id ' + input.name + '. Load javascript.');
            self.loadScript(input.js, input.name + '_script', iframeDoc.head);
          }

          // run the init function if it exists
          if (iframe.contentWindow.init) {
            debug('Initializing frame.')
            iframe.contentWindow.init();
          }

          if (input.show) self.show(input.name);

          // NOTE: final step, return from async operation
          fulfill(null);

        };

        iframe.addEventListener("load", updateIframe, true);

        // Add iframe to varps element
        input.target.appendChild(iframe);

        return iframe;
        // end of createIFrame
      };

      try {
        self.db.get('buckets', 'b_' + appName).then(function(data){

          // check mandatory input
          if (!data || !data.packageDef || !data.packageDef.name) {
            reject('ERROR: app name must me specified!');
          }

          if (!data.packageDef.permissions) {
            data.packageDef.permissions = 'allow-scripts allow-forms';
          }

          data.target = document.getElementById('varps');
          data.element = createIFrame(data);
          self.varps_[data.name] = data;

        });

      } catch (e) {
        debug('load:' + appName + ':' + e);
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
      log('Error parsing JSON:' + e);
    }
  };

  // Command line help, static functions on the App object
  // -----------------------------------------------------

  App.help = function (topic) {

    if (!topic) {
      var msg = '' +
        '-- Overview of Htmlapp --'
        + '\n* Htmlapp.help("config") - customize the Htmlapp configuration'
        + '\n* Htmlapp.help("register_account") - create an account and configure for Htmlapp'
        + '\n* Htmlapp.help("hello") - show hello world example'
        + '\n* Htmlapp.help("load") - load a new webapp in the browser window'
        + '\n* Htmlapp.help("unload") - remove a webapp from the borwser window'
//        + '\n* Htmlapp.help("get") - get the contents of a file'
//        + '\n* Htmlapp.help("put") - save new content into a file'
        + '\n* Htmlapp.help("misc") - Miscellaneous';

      info(msg);
      return;
    }

    var footer = '\n\n-----\nKeep in mind that you need to perform the initial configuration, ' +
      'see Htmlapp.help("config")';

    if (topic === 'config') {
      var msg = 'A little configuration needs to be done before hpm can be used:' +
        '\nvar config = {' +
        '\n\turl: "http://odatadev.gizur.com/", ' +
        '\n\temail: "joe@example.com",' +
        '\n\taccountId: "a123456789",' +
        '\n\tpassword: "secret"' +
        '\n};' +
        '\nvar db = new ydn.db.Storage("config", {stores: [{ name: "backend", autoIncrement: false }]});' +
        '\ndb.put("backend", config, "config");' +
        '\n\nshow the configuration like this:' +
        '\ndb.get("backend","config").then(console.log.bind(console));';

      info(msg);
    } else if (topic === 'register_account') {
      return hpm.help("register_account")
    } else if (topic === 'hello') {
      hpm.help("work");
      hpm.help("create");
      this.help("load");
    } else if (topic === 'hello.old') {
      var msg = 'This is the traditional hello world example. Copy and past ' +
        'this text to create the app.' +
        '\n\nvar html = "<htlm><body><h1>Hello World</h1></body></html>";' +
        '\nvar js = "init = function() { console.log(\'init function\');};"' +
        '\nvar css = "body {background: rgba(234, 159, 195, 0.8);}"' +
        '\nenv.put("hello.html", {val: html});' +
        '\nenv.put("hello.js", {val: js});' +
        '\nenv.put("hello.css", {val: css});' +
        '\nvar appOptions = {' +
        '\n\tid: "hello",' +
        '\n\ttitle: "My fabulous app",' +
        '\n\tshow: true' +
        '\n};' +
        '\nenv.load(appOptions);' +
        footer;

      info(msg);
    } else if (topic === 'load') {
      var msg = 'Load a webapp from the database into the browser window.' +
        '\nThe version to use must currently be specified explicitely:' +
        '\n\nvar a = new Htmlapp();' +
        '\na.init()' +
        '\n.then(function(){return a.load("hello-0.0.1");})' +
        '\n.then(function(){return a.show("hello");})' +
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
    } else if (topic === 'misc') {
      var msg = 'The flow function makes it possible to combine functions.' +
        'The load exmaple can for instance be written like this:' +
        '\n\nvar a = new Htmlapp();' +
        '\nflow(a.init.bind(a), a.load.bind(a, "hello-0.0.1"), a.show.bind(a, "hello"))()' +
        '\n\nThis is another example where the log function is used, shorthand for console.log.bind(console)' +
        '\n\nflow(a.keys.bind(a), log)()'
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
