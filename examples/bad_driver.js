/**
* @namespace bad driver:
*/
exports.prototype = {

  initialize: function (_options, _logger) {

    this._options = (_options || {});

    this._logger = _logger;

    return this;
  },

  send: function (_message, _callback) {
    var self = this;
    this.get_phone_number(function(number) {
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

  stop: function () {
    return this;
  },

  destroy: function () {
    return this;
  },

  get_phone_number: function (callback) {
    callback("3458972345");
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
