var express = require('express');
    twilio = require('twilio');
    bodyParser = require('body-parser');
/**
* @namespace abstract:
*/
exports.prototype = {

  /**
  * @name initialize:
  *   Perform device-specific or API-specific initialization.
  */
  initialize: function (_options, _logger) {
    this._options = (_options || {});

    if (this._options.port === undefined) {
      this._options.port = 3000;
    }

    this._logger = _logger;
    this._twilio = twilio(_options.sid, _options.token);
    this._phone = _options.phone;
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
  *   false-like if no error occurred). THe `_result` argument will be
  *   an object containing, at a minimum, a single `result` property
  *   set to either `success`, `partial`, or `failure`. A result of
  *   `partial` indicates that the message was too large for a single
  *   message, had to be fragmented, and one or more of the fragments
  *   failed to send properly.
  *
  *   This function should return the driver instance in `this`.
  */
  send: function (_message, _callback) {
    this._logger.debug("sending", {mesage: _message});

    var self = this;
    this._twilio.sendMessage({
      body: _message.content,
      to: _message.to,
      from: this._phone
    }, function(err, message) {
      if (err) {
        self._logger.error(err.message, {mesage: _message});
        _callback(err, { status: 'failure' });
      } else {
        _callback(null, { status: 'success' });
      }
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
    this.receiveHandler = _handler;
    return this;
  },

  /**
  * @name register_error_handler:
  *   Ask the driver to invoke `_handler(_err)` whenever an error occurs
  *   that cannot be attributed to a requested `send` operation. The
  *   `_err` argument will contain a node.js-style error object, and
  *   should never be null.
  */
  register_error_handler: function (_handler) {
    this.errorHandler = _handler;
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
    var self = this;

    var app = express();

    var logger = function (req, res, next) {
      self._logger.debug("incoming request", {url: req.url});
      next(); // Passing the request to the next handler in the stack.
    };
    app.use(logger);

    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    app.post('/', this._receiveMessage.bind(this));

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

  /**
  * @name destroy:
  *   Release any and all resources held by this driver.
  */
  destroy: function () {

    return this.stop();
  },

  /**
  * @name get_phone_number:
  *   Release any and all resources held by this driver.
  */
  get_phone_number: function (callback) {
    callback(this._phone);
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
