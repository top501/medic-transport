
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

  initialize: function (_options, _logger) {

    this._options = (_options || {});

    this._error_handler = false;
    this._send_url = this._options.send_url;
    this._send_code = this._options.send_code;
    this._send_token = this._options.send_token;
    this._receive_token = this._options.receive_token;
    this._logger = _logger;

    return this;
  },

  send: function (_message, _callback) {

    this._logger.debug('sending message', _message);

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
  },

  /**
  * @name set_state:
  *  Tells the driver to change its state.
  *  State is a boolean, and can either by up or down.
  *  Callback is a function(_err) that is called when state changes successfully
  *  or if unsuccessfully, with the error
  */
  set_state: function (state, callback) {
    this.state = state;
    callback(null);
  },

  /**
  * @name get_state:
  *  Tells the driver to retreive it's state, expects a callback of form
  *  function(state, _err)
  *  State is a boolean, and can either by up or down.
  */
  get_state: function (callback) {
    if (!this.state) {
      callback(true, null);
      return;
    }
    callback(this.state, null);
  }

};
