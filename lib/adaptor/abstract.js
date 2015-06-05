
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

  /**
   * @name deliver:
   *   Deliver the message `_message` to this adaptor's attached
   *   application. Invokes `_callback(_err, _rx_result)` once the message
   *   has been successfully delivered and committed to persistent storage.
   *
   *   The `_message` argument should be an object, containing at least
   *   three properties: `content` should contain the body of the message,
   *   `from` should contain the phone number (MSISDN) from which the
   *   message originated, and `timestamp` should contain the ISO-formatted
   *   UTC timestamp of when the message was first received by the
   *   originating system.
   */
  deliver: function (_message, _callback) {

    if (this._options.debug) {
      process.stderr.write(
        'abstract adaptor: delivered ' + JSON.stringify(_message) + '\n'
      );
    }

    _callback.call(
      this, null, { status: 'success', abstract: true }
    );

    return this;
  },

  
  /**
   * @name register_transmit_handler:
   *   Ask this adaptor to invoke `_handler` when the attached
   *   application wants to send a message. This function is responsible
   *   for polling and/or registering event listerners, so that `_handler`
   *   runs every time a message is sent (outbound) from the application.
   *
   *   The `_handler(_message, _callback)` function will be invoked
   *   repeatedly as messages start arriving. The callback's `this` object
   *   will be set to the current adaptor instance. The `_message` argument
   *   will be a single object containing (at a minimum) a `uuid`, `content`,
   *   `to`, and `timestamp` property. The `_callback(_err, _tx_result)`
   *   parameter is a callback that should be invoked by `_handler` once it
   *   has successfully transmitted the messages provided to it. The `_err`
   *   argument is an error object (or false-like for success); the
   *   `_tx_result` parameter is an object containing information about
   *   transmission success or failure (both a summary, and at the
   *   individual message level).
   *
   *   The `_tx_result` object, at a minimum, should contain a `status`
   *   property (a string, either `success`, `partial`, or `failure`), and
   *   a `total_sent` property (an integer depicting the number of messages
   *   from the original `_messages` argument that were sent successfully).
   *
   *   `_err` should only be passed if there was a serious problem, e.g. the
   *   server could not be contacted.  If there is a format problem in the
   *   message itself, then error should be falsy, and `_tx_result` should
   *   be used to indicated failure.
   */
  register_transmit_handler: function (_handler) {

    return this;
  },

  /**
   * @name register_error_handler:
   *   Ask the driver to invoke `_handler(_err)` whenever an error occurs
   *   that cannot be attributed to a specific `deliver` operation. The
   *   `_err` argument will contain a node.js-style error object, and
   *   should never be null.
   */
  register_error_handler: function (_handler) {

    return this;
  },

  /**
   * @name start:
   *   Start any polling and/or watch operations that are required
   *   for this adaptor instance to function properly. To avoid data
   *   loss, this function *must* be called after you've registered
   *   callback functions via the `register_transmit_handler` and
   *   `register_error_handler` methods.
   */
  start: function () {

    return this;
  },

  /**
   * @name stop:
   *   Stop any polling and/or watch operations that are currently
   *   running on behalf of this adaptor instance.
   */
  stop: function () {

    return this;
  },

  /**
   * @name destroy:
   *   Release any and all resources held by this adaptor.
   */
  destroy: function () {

    return this.stop();
  }

};

