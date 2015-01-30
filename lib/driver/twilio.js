var express = require('express');
    twilio = require('twilio');
    bodyParser = require('body-parser');
/**
* @namespace twilio:
*/
exports.prototype = {

  initialize: function (_options, _logger) {
    this._options = (_options || {});

    if (this._options.port === undefined) {
      this._options.port = 3000;
    }

    this._logger = _logger;
    this._twilio = twilio(_options.sid, _options.token);
    this._phone = _options.phone;
    this._url = _options.url || '/';
    return this;
  },

  send: function (_message, _callback) {
    this._logger.debug("sending", {mesage: _message});

    var self = this;
    this._twilio.sendMessage({
      body: _message.content,
      to: _message.to,
      from: this._phone
    }, function(_err, _message) {
      if (_err) {
        self._logger.error(_err.message, _err);
        _callback(_err, { status: 'failure' });
      } else {
        _callback(null, { status: 'success' });
      }
    });

    return this;
  },

  register_receive_handler: function (_handler) {
    this.receiveHandler = _handler;
    return this;
  },

  register_error_handler: function (_handler) {
    this.errorHandler = _handler;
    return this;
  },

  start: function () {
    var self = this;

    var app = express();

    var logger = function (req, res, next) {
      self._logger.debug("incoming request", {url: req.url});
      next(); // Passing the request to the next handler in the stack.
    };
    app.use(logger);

    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    app.post(this._url, this._receiveMessage.bind(this));

    var server = app.listen(self._options.port , function (err) {
      var addr = server.address();
      self._logger.info('Server listening on %s:%s', addr.address, addr.port);
    });

    return this;
  },

  _receiveMessage: function(_req, _res) {
    var self = this;

    this._logger.debug('got message', _req.body);
    var message = {
      from: _req.body.From,
      content: _req.body.Body,
      timestamp: Math.round(Date.now() / 1000)
    };

    if (this.receiveHandler !== null) {
      this.receiveHandler(message, function (_err) {
        if (_err) {
          self._logger.error("receive handler threw", {error: _err});
          _res.sendStatus(400);
          return;
        }
        self._logger.debug("incoming message", {
          message: message
        });
        _res.set('Content-Type', 'text/xml');
        _res.send('<?xml version="1.0" encoding="UTF-8" ?><Response></Response>');
      });
    } else {
      this.errorHandler(new Error(
        'Receive handler not set'
      ));
      _res.sendStatus(400);
    }
  },

  /**
  * @name stop:
  *   Stop any polling and/or watch operations that are currently
  *   running on behalf of this driver instance.
  */
  stop: function () {
    return this;
  },

  destroy: function () {
    return this.stop();
  },

  get_phone_number: function (callback) {
    callback(this._phone);
  },

  set_state: function (state, callback) {
    this.state = state;
    callback(null);
  },

  get_state: function (callback) {
    if (!this.state) {
      callback(true, null);
      return;
    }
    callback(this.state, null);
  }
};
