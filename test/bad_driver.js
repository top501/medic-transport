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

    this._logger = _logger;

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
    var self = this;
    var phone_number = this.get_phone_number(function(number) {
      if (_message.to == number) {
        console.log("Bad driver " + self._options.id + " got a status message and \
        is sending response: " + _message.content);
        _callback(null, {result: 'success'});

        self._sendStatusResponse(number, _message.content);
      } else {
        /*_callback(null, {result: 'success'});*/
        _callback(new Error(
          'Driver ' + self._options.id + ' is a bad driver and cannot send.'
        ));
      }
    });

    return this;
  },

  _sendStatusResponse: function(number, content) {
    var self = this;
    this._receive_handler({
      from: number,
      timestamp: Math.floor(Date.now() / 1000),
      content: content
    }, function (_e) {
      process.stderr.write(
        'Driver ' + self._options.id + ': receive handler invoked for status message ' + content + '; ' +
        'error status is ' + JSON.stringify(_e) + '\n'
      );
    });
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

    this._receive_handler = _handler;
    return this;
  },

  _fake_receive: function() {
    var self = this;
    this._receive_handler({
      from: 1111111111,
      timestamp:Math.floor(Date.now() / 1000),
      content: 'Fake message from driver' + self._options.id
    }, function (_e) {
      process.stderr.write(
        'bad driver ' + self._options.id + ': receive handler invoked; ' +
        'error status is ' + JSON.stringify(_e) + '\n'
      );
    });

    // this is bad driver, just receive every second
    setTimeout(this._fake_receive.bind(this), Math.floor(Math.random() * 30000));
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
    if (!this._error_handler) {
      process.stderr.write(
        'bad driver ' + this._options.id + ': angry that it has started with no error handler'
      );
    } else {
      this._error_handler(new Error(
        'Driver ' + this._options.id + ' is a bad driver and is angry about starting.'
      ));
    }
    this._fake_receive();
    return this;
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
    return this;
  },

  get_phone_number: function (callback) {
    callback("1111111111");
  },

  /**
  * @name set_state:
  *  Tells the driver to change its state.
  *  State is a boolean, and can either by up or down.
  *  Callback is a function (_err) that is called when state changes successfully
  *  or if unsuccessfully, with the error
  */
  set_state: function (state, callback) {
    this.state = state;
    callback(null);
  },

  /**
  * @name get_state:
  *  Tells the driver to retreive it's state, expects a callback of form
  *  function (state, _err)
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
