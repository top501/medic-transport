/**
* @namespace simple.
* The simple router simple goes down the list of drivers,
* attempting to send the message each time until it's successful.
*/
exports.prototype = {



  /**
  * @name initialize:
  */
  initialize: function (_options) {

    this._options = (_options || {});
    return this;
  },

  set_drivers: function(_drivers) {
    this._drivers = _drivers;
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

    if (this._options.debug) {
      process.stderr.write(
        'abstract driver: sent ' + JSON.stringify(_message) + '\n'
      );
    }

    if (!this.drivers) {
      _callback.call(new Error("router error: no drivers set"), { status: 'failure' });
    }

    _sendWithDriver(0, _message, function(_err, _transmit_result) {
      _callback(_err, _transmit_result);
    });

    return this;
  },

  _sendWithDriver: function(_index, _message, _callback) {
    NoDriversLeftError.prototype = new Error();
    NoDriversLeftError.prototype.constructor = function(message) {
      this.name = 'MyError';
      this.message = message || 'Message could not send';
    };

    if (this._drivers.length < _index) {
      _callback.call(new NoDriversLeftError(), { status: 'failure' });
    }

    var driver = _drivers[_index];
    if (!driver.up) {
      console.log('router: driver down, trying next');
      _sendWithDriver(_index + 1, _message, _callback);
    }
    driver.send(_message, function (_err, _transmit_result) {
      if (_err) {
        console.log('send error: ' + jsdump.parse(_err));
        if (isinstance(_err, NoDriversLeftError)) {
          _callback(_err, _transmit_result);
        }
        _sendWithDriver(_index + 1, _message, _callback);
      } else {
        _callback(null, _transmit_result);
      }
    });
  }
};
