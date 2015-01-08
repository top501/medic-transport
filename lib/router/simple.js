/**
* @namespace simple.
* The simple router simple goes down the list of drivers,
* attempting to send the message each time until it's successful.
*/
exports.prototype = {

  /**
  * @name initialize:
  */
  initialize: function (_options, _logger) {
    this._options = (_options || {});
    this._logger = _logger;
    return this;
  },

  set_drivers: function(_drivers) {
    this._logger.debug("drivers set", {drivers: _.map(_drivers, function(driver){
      return driver._options.name;
    })});
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
  */
  send: function (_message, _callback) {

    this._logger.debug("sent", {message: _message});

    if (!this._drivers || this._drivers.length === 0) {
      _callback(new Error("simple router error: no drivers set"), { status: 'failure' });
      return;
    }

    this._sendWithDriver.call(this, 0, _message, function(_err, _transmit_result) {
      _callback(_err, _transmit_result);
    });

    return this;
  },

  _sendWithDriver: function(_index, _message, _callback) {
    var self = this;
    if (_index >= this._drivers.length) {
      _callback(new Error("No drivers left"), { status: 'failure' });
      return;
    }

    var driver = this._drivers[_index];
    driver.get_state(function(state, _err) {
      if (_err) {
        this._logger.error("driver unable to retreive state", _err);
        self._sendWithDriver.call(self, _index + 1, _message, _callback);
      } else {
        if (state) {
          driver.send(_message, function (_err, _transmit_result) {
            if (_err) {
              this._logger.error("driver unable to send message", _err);
              self._sendWithDriver.call(self, _index + 1, _message, _callback);
            } else {
              _callback(null, _transmit_result);
            }
          });
        } else {
          this._logger.debug("driver down, trying next");
          this._sendWithDriver.call(this, _index + 1, _message, _callback);
        }
      }
    });
  }
};
