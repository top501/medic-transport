
/**
* @namespace abstract:
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
    this._drivers = drivers;
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

    _callback.call(
      this, null, { status: 'success', abstract: true }
    );

    return this;
  }
};
