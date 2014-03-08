
var moment = require('moment'),
    request = require('request'),
    express = require('express');

/**
 * @namespace concepto-movil:
 */
exports.prototype = {

  /**
   * @name _reset_express:
   *   Stop the express.js HTTP server and free its resources.
   */
  _reset_express: function () {

    if (this._express) {
      this._express.close();
      this._express = false;
    }
  },

  /**
   * @name initialize:
   *   Perform device-specific or API-specific initialization.
   */
  initialize: function (_options) {

    this._options = (_options || {});

    this._error_handler = false;
    this._send_url = this._options.send_url;
    this._send_code = this._options.send_code;
    this._send_token = this._options.send_token;
    this._receive_token = this._options.receive_token;

    return this;
  },

  /**
   * @name send:
   *   Send a new message. The `_message` argument must be an object,
   *   containing at least a `to` property (set to the phone number or
   *   MSISDN of the intended recipient), and a `content` property
   *   (containing the message body, encoded as utf-8 text).
   *
   *   After the message has been successfully transmitted, the
   *   `_callback(_err, _result)` function will be invoked with two
   *   arguments -- `_err` will be a node.js-style error object (or
   *   false-like if no error occurred). The `_result` argument will be
   *   an object containing, at a minimum, a single `result` property
   *   set to either `success`, `partial`, or `failure`. A result of
   *   `partial` indicates that the message was too large for a single
   *   message, had to be fragmented, and one or more of the fragments
   *   failed to send properly.
   *
   *   This function should return the driver instance in `this`.
   */
  send: function (_message, _callback) {

    if (this._options.debug) {
      process.stderr.write(
        'concepto-movil driver: sending ' +
          JSON.stringify(_message) + '\n'
      );
    }

    var options = {
      method: 'GET', url: this._send_url, qs: {
        Content: _message.content,
        DA: this._send_code, smscId: 'telcel_' + this._send_code,
        Token: this._send_token, SOA: _message.to.replace(/^\+/, '')
      }
    };

    /* Make HTTP GET request */
    request(options, function (_err, _resp, _body) {

      if (_err) {
        return _callback(_err);
      }

      if (_resp.statusCode != 200) {
        return _callback(
          new Error('Send returned unsuccessful HTTP status')
        );
      }

      var m = _body.match(/^\s*Error\s*:+(.*)/);

      if (m) {
        return _callback(
          new Error("API provider returned error: '" + m[1] + "'")
        );
      }

      var m = _body.match(/^\s*Success/);

      if (m) {
        process.stderr.write(
          'concepto-movil driver: message ' +
            JSON.stringify(_message) + ' successfully sent\n'
        );
        return _callback(null, { result: 'success' });
      }

      return _callback(new Error(
        "API provider returned unsupported result: '" + _body + "'"
      ));
    });

    return this;
  },

  /**
   * @name register_receive_handler:
   *   Ask the driver to invoke `_callback` whenever a message arrives.
   *   The `_handler(_message, _callback)` function will be invoked
   *   for each message received: the `_err` argument is a node.js-style
   *   error object (or false-like if the operation was successful); the
   *   `_message` argument is an object containing at least the `from`,
   *   `timestamp`, and `content` properties; the `_callback(_err)` argument
   *   is a function that must be called by our instansiator once the
   *   message has been safely written to persistent storage. If for some
   *   reason our instansiator cannot accept the message, the function
   *   should still be called, but the `_err` parameter set to a non-null
   *   error object.
   */
  register_receive_handler: function (_handler) {

    var self = this;

    self._reset_express();

    var fn = function (_req, _res) {

      var q = _req.query;
      var token = self._receive_token;

      if (typeof(q.token) != 'string' || q.token != token) {
        _res.send(400, "Invalid API token; access denied");
        return;
      }
      
      if (typeof(q.msisdn) != 'string' || q.msisdn.length <= 0) {
        _res.send(400, "Parameter 'msisdn' is missing (string, non-empty)");
        return;
      }

      if (typeof(q.content) != 'string' || q.content.length <= 0) {
        _res.send(400, "Parameter 'content' is missing (string, non-empty)");
        return;
      }

      var message = {
        timestamp: moment(),
        from: q.msisdn, content: q.content
      };

      _handler(message, function (_err) {

        if (_err) {
          /* FIXME: Don't drop messages on errors */
          return self._error_handler(_err);
        }

        process.stderr.write(
          'concepto-movil driver: delivery completed of `' +
            JSON.stringify(message) + '`\n'
        );
      });

      _res.send(200, 'Delivery successful');
    };

    var app = express();
    this._express = app;

    app.get('/incoming', fn);
    app.post('/incoming', fn);

    app.use(express.json());
    app.use(express.urlencoded());

    app.listen(8080);

    return self;
  },

  /**
   * @name register_error_handler:
   *   Ask the driver to invoke `_handler(_err)` whenever an error occurs
   *   that cannot be attributed to a requested `send` operation. The
   *   `_err` argument will contain a node.js-style error object, and
   *   should never be null.
   */
  register_error_handler: function (_handler) {

    this._error_handler = _handler;
    return this;
  },

  /**
   * @name start:
   *   Start any polling and/or watch operations that are required
   *   for this driver instance to function properly. To avoid data
   *   loss, this function *must* be called after you've registered
   *   callback functions via the `register_receive_handler` and
   *   `register_error_handler` methods.
   */
  start: function () {

    return this;
  },

  /**
   * @name stop:
   *   Stop any polling and/or watch operations that are currently
   *   running on behalf of this driver instance.
   */
  stop: function () {

    this._reset_express();
    return this;
  },

  /**
   * @name destroy:
   *   Release any and all resources held by this driver.
   */
  destroy: function () {

    this.stop();
    return this;
  }

};

