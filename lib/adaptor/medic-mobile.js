
var async = require('async'),
    _ = require('underscore'),
    jsdump = require('jsDump'),
    moment = require('moment'),
    http_request = require('request');

/**
 * @namespace medic-mobile:
 */
exports.prototype = {

  initialize: function (_options, _logger) {

    this._options = (_options || {});
    this._url = this._options.url;

    this._error_handler = false;
    this._transmit_handler = false;

    this._previously_sent_uuids = {};
    this._http_callback_autoreplies = [];

    this._is_polling = false;
    this._is_started = false;

    this._pass =
      (this._options.pass || this._options.password);

    this._user =
      (this._options.user || this._options.username || 'admin');

    this._debug = this._options.debug;

    this._logger = _logger;

    this._poll_interval =
      parseInt((this._options.interval || 5000), 10);

    this._max_callback_depth =
      parseInt((this._options.max_callback_depth || 15), 10);

    return this;
  },

  deliver: function (_message, _callback) {

    var self = this;

    var request = {
      url: this._url + '/add',
      auth: { user: this._user, pass: this._pass },
      form: self._rewrite_message_for_delivery(_message)
    };

    http_request.post(request, function (_err, _resp, _body) {

      var response = {};

      if (_err) {
        return _callback.call(self, _err);
      }

      try {
        response = JSON.parse(_body);
      } catch (_e) {
        return _callback.call(self, _e);
      }

      var rc = response.callback;
      var rv = { total_sent: 1, status: 'success' };

      /* Callbacks:
          If no callbacks are provided, return immediately. */

      if (!rc) {
        return _callback.call(self, null, rv);
      }

      /* Otherwise:
          Perform callbacks before considering delivery successful. */

      return self._perform_http_callbacks(rc, 1, function (_e) {

        if (_e) {
          rv = { total_sent: 0, status: 'failure' }
        }

        _callback.call(self, _e, rv);
      });
    });

    return this;
  },

  register_transmit_handler: function (_handler) {

    this._transmit_handler = _handler;
    return this;
  },

  register_error_handler: function (_handler) {

    return this;
  },

  start: function () {

    this._is_polling = true;

    if (!this._is_started) {
      this._run_transmit_timer();
    }

    this._is_started = true;
    return this;
  },

  stop: function () {

    this._is_polling = false;
    return this;
  },

  destroy: function () {

    return this.stop();
  },

  /**
   * @name _invoke_transmit_handler:
   */
   _invoke_transmit_handler: function (_message, _callback) {

    var uuid = _message.uuid;

    if (!_.isFunction(this._transmit_handler)) {
      return _completion_callback.call(self, new Error(
        'No transmit handler is registered; please ' +
          'register one before invoking the `start` method'
      ));
    }

    /* Message already sent?
        If we received an HTTP 201 document update conflict during
        our last attempt to mark this outgoing message as `sent`,
        take care to not send a an additional duplicate message. */

    if (uuid && this._previously_sent_uuids[uuid]) {

      this._debug_print(
        'Skipping previously-sent message ' + JSON.stringify(_message)
      );

      return _callback.call(this, false, {
        status: 'success', previously_sent: true
      });
    }

    return this._transmit_handler.call(this, _message, _callback);
  },

  /**
   * @name _rewrite_message_for_delivery:
   */
  _rewrite_message_for_delivery: function (_message) {

    var timestamp = _message.timestamp;

    if (!timestamp) {
      timestamp = moment().unix();
    }

    var m = moment.unix(timestamp);

    return {
      message: _message.content,
        from: _message.from, sent_timestamp: m.format()
    };
  },

  /**
   * @name _rewrite_message_for_transmission:
   */
  _rewrite_message_for_transmission: function (_message) {

    return {
      uuid: _message.uuid,
        content: _message.message, to: _message.to,
          timestamp: moment(_message.sent_timestamp).unix()
    };
  },

  /**
   * @name _run_transmit_timer:
   *   Delay for this instance's specified poll interval, invoke
   *   `_handle_transmit_timer`, and then call this method again to
   *   repeat the process -- unless we've been signaled to stop.
   */
  _run_transmit_timer: function () {

    var self = this;

    setTimeout(function () {

      self._handle_transmit_timer(function (_err) {

        self._debug_print('register_transmit_handler: rescheduling');

        /* Continuation case:
            Are we still supposed to be polling? If so, use tail recursion
            to invoke ourself again, and re-enter the `setTimeout` delay.  */

        if (self._is_polling) {
          return self._run_transmit_timer();
        }

        /* Termination case:
            We've been asked to stop polling; let others know
            that we've indeed stopped, and don't repeat this procedure. */

        self._is_started = false;
      });

    }, self._poll_interval);

    return self;
  },

  /**
   * @name _handle_transmit_timer:
   *   Run one polling cycle, asking Kujua Lite for messages to transmit.
   *   If we find any, invoke `_handler` to allow the underlying driver
   *   to actually transmit the message data, run any SMSsync-style
   *   HTTP callbacks that are requested. Once there is no more work
   *   left to do (whether we found messages to transmit or not), invoke
   *   `_completion_callback`.
   */
  _handle_transmit_timer: function (_completion_callback) {

    var self = this;

    self._poll_for_transmit(function (_err, _poll_results) {

      var payload = (_poll_results || {}).payload;
      var messages = (payload || {}).messages;

      /* Do we have any messages?
          If not, then there's nothing to do -- just go back to sleep. */

      if ((messages || []).length <= 0) {
        return _completion_callback.call(self);
      }

      var total_sent = 0;
      var total_messages = messages.length;

      self._discard_http_callback_autoreplies();

      /* Hand messages over to driver for transmit:
          The driver will do its work in this callback, then will
          return control to us with some transmit result information. */

      async.each(messages,

        /* Iterator */
        function (_message, _callback) {

          var message;

          try {
            message = self._rewrite_message_for_transmission(_message);
          } catch (_e) {
            self._handle_transmit_format_error(_e);
            return _callback(); /* Next message */
          }

          /* Invoke handler:
              The handler accepts a single message only, but Kujua
              Lite currently sends a batch of messages and wants the
              HTTP callbacks to be run only after all messages are sent
              successfully. We loop through the messages asynchronously,
              and keep track of the transmit results along the way. Once
              we're done transmitting, we invoke the HTTP callbacks if and
              only if all of our transmission outcomes were successful. */

          self._invoke_transmit_handler(message, function (_e, _tx_result) {

            if (_e) {
              self._handle_transmit_error(_e, message);
              return _callback(_e);
            }

            self._debug_print(
              '_handle_transmit_timer: transmit handler ' +
                'returned; transmit result is ' + JSON.stringify(_tx_result)
            );

            if (message.uuid) {
              self._previously_sent_uuids[message.uuid] = true;
            }

            ++total_sent;
            return _callback(); /* Next message */
          });
        },

        /* Final */
        function (_e) {

         /* Hard error:
             If we couldn't even start processing the batch due to
             an error, skip this step and just inform our instansiator. */

         if (_e) {
           return _completion_callback.call(self, _e);
         }

         if (total_sent < total_messages) {

           /* FIXME:
                We need a better way to handle transmit failures for
                Kujua Lite. Currently, our choices are to either
                (a) retry the whole batch, potentially spamming the
                other people who have messages in the batch, or (b)
                treat all delivery failures as permenant failures. We're
                currently choosing the latter of those two approaches. */

           self._debug_print(
             'transmit_handler: Failed to send a total of ' +
               (total_messages - total_sent) + ' message(s)'
           );

           self._debug_print(
             'transmit_handler: Permanently discarding message(s)'
           );
         }

         /* Transmit successful:
             The underlying driver was able to send the message.
             Now, invoke the emulated SMSsync HTTP callbacks, which
             will allow Kujua Lite to perform its post-transmit work. */

         return self._perform_http_callbacks(
           _poll_results.callback, 1, _completion_callback
         );
        }
      );
    });

    return self;
  },

  /**
   * @name _handle_transmit_error:
   */
  _handle_transmit_error: function (_e, _message) {

    /* Message couldn't be transmitted:
        Our underlying driver was unable to send this message.
        Don't invoke any callbacks; we'll retry again next time. */

    var self = this;

    this._debug_print(
      'transmit_handler: Unable to transmit message'
    );

    this._debug_print(
      'transmit error was: ' + JSON.stringify(_e)
    );

    var request = {
      url: this._url + '/fail',
      auth: { user: this._user, pass: this._pass },
      form: this._rewrite_message_for_delivery(_message)
    };

    http_request.post(request, function (_err, _resp, _body) {
      if (_err) {
        self._logger.error("unable to report message transmit failure, _err" +
        _err);
      } else {
        self._debug_print("reported message transmit failure");
      }
    });
  },

  /**
   * @name _handle_transmit_format_error:
   */
  _handle_transmit_format_error: function (_e, _message) {

    /* Message couldn't be reformatted:
        It likely contains invalid or unexpected data; log it. */

    this._debug_print(
      'transmit_handler: Invalid or unrecognized message format'
    );

    this._debug_print(
      'format exception was: ' + JSON.stringify(_e)
    );

    this._debug_print(
      'original message was: ' + JSON.stringify(_message)
    );
  },

  /**
   * @name _perform_http_callbacks:
   */
  _perform_http_callbacks: function (_callback_object, _depth, _callback) {

    var self = this;

    if (_depth > self._max_callback_depth) {
      return _callback.call(self, new Error(
        'While processing callbacks: ' +
          'Reached maximum recursion depth of ' + self._max_callback_depth
      ));
    }

    self._debug_print(
      '_perform_http_callbacks: starting, callback object is ' +
        JSON.stringify(_callback_object)
    );

    var o = (_callback_object.options || {});

    var url = (
      (o.protocol || 'http') + '://' +
        (o.host || 'localhost') + ':' + (o.port || 5984) + (o.path || '/')
    );

    var request = {
      url: url,
      headers: (o.headers || {}),
      method: (o.method || 'GET'),
      body: JSON.stringify(_callback_object.data || {})
    };

    self._debug_http_request(request);

    http_request(request, function (_err, _resp, _body) {

      var body = {};

      if (_err) {
        return _callback.call(self, _err);
      }

      try {
        body = JSON.parse(_body);
      } catch (_e) {
        return _callback.call(self, _e);
      }

      self._debug_http_response(_err, request, _resp, _body);

      /* Base case */
      if (_.indexOf([ 200, 201 ], _resp.statusCode) < 0) {
        return _callback.call(self, new Error(
          'HTTP callback returned an error status of ' + _resp.statusCode
        ));
      }

      var payload = (body.payload || {});
      var next_callback_object = body.callback;

      /* Handle automatic replies */
      if (_.isArray(payload.messages)) {
        self._append_http_callback_autoreplies(payload.messages);
      }

      /* Base case */
      if (!next_callback_object) {

        self._forget_previously_sent_uuids(_callback_object, body);
        self._debug_print('_perform_http_callbacks: finished');

        return self._transmit_http_callback_autoreplies(_callback);
      }

      /* Recursive case */
      return self._perform_http_callbacks(
        next_callback_object, _depth + 1, _callback
      );
    });
  },

 /**
  * @name _forget_previously_sent_uuids:
  */
 _forget_previously_sent_uuids: function (_callback_object, _response_body) {

   var request = (_callback_object.data || {}).docs;

   var response = (
     _.isArray(_response_body) ?
       _response_body : [ _response_body ]
   )

   this._debug_print(
     '_forget_previously_sent_uuids: request was ' +
       JSON.stringify(request)
   );

   this._debug_print(
     '_forget_previously_sent_uuids: response was ' +
       JSON.stringify(response)
   );
 },

 /**
  * @name _append_callback_autoreplies:
  */
 _append_http_callback_autoreplies: function (_messages) {

   var self = this;

   self._debug_print(
     '_append_http_callback_autoreplies: queuing ' +
       'auto-reply message ' + JSON.stringify(_messages)
   );

   _.each(_messages, function (_message) {
     self._http_callback_autoreplies.push(_message);
   });
 },

 /**
  * @name _discard_callback_autoreplies:
  */
 _discard_http_callback_autoreplies: function () {

   this._http_callback_autoreplies = [];
 },

 /**
  * @name _transmit_http_callback_autoreplies:
  */
 _transmit_http_callback_autoreplies: function (_callback) {

   var self = this;

   self._debug_print(
     '_transmit_http_callback_autoreplies: preparing to send ' +
       self._http_callback_autoreplies.length + ' reply message(s)'
   );

   async.each(this._http_callback_autoreplies,

     function (_message, _completion_fn) {

       var message;

       try {
         message = self._rewrite_message_for_transmission(_message);
       } catch (e) {
         return _completion_fn(e);
       }

       self._debug_print(
         '_transmit_http_callback_autoreplies: sending ' +
           'auto-reply message ' + JSON.stringify(message)
       );

       /* Omit the transmit-completed callback:
           If we're currently in the process of receiving messages,
           further incoming messages won't be processed until we
           invoke `_completion_fn`. If we wait try to wait until the
           autoreply has been actually transmitted, we'll deadlock
           (N.B. we won't finish the receive process until the message
           is transmitted, and we won't process the queue of outgoing
           messages until we've finished processing the incoming ones). */

       self._invoke_transmit_handler(message, function () {
         self._debug_print(
           '_transmit_http_callback_autoreplies: reply sent'
         );
       });

       _completion_fn();
     },

     function (_err) {

       self._debug_print(
         '_transmit_http_callback_autoreplies: completed'
       );

       self._discard_http_callback_autoreplies();
       return _callback.call(self, _err);
     }
   );

   return self;
 },

 /**
  * @name _poll_for_transmit:
  *   Ask the attached Kujua Lite instance if there are any
  *   outgoing messages. If there are any, call `_callback`
  *   with an array for its second parameter. If there aren't any,
  *   call `_callback` with an empty array for its second parameter.
  *   If an error, occurs, call `_callback` with the first argument
  *   set to a non-null error object.
  */
  _poll_for_transmit: function (_callback) {

    var self = this;

    var request = {
      url: this._url + '/add',
      auth: { user: this._user, pass: this._pass }
    };

    self._debug_http_request(request);

    http_request(request, function (_err, _resp, _body) {

      var rv = {};

      self._debug_http_response(_err, request, _resp, _body);

      try {
        rv = JSON.parse(_body);
      } catch (_e) {
        return _callback.call(self, _e);
      }

      return _callback.call(self, _err, rv);
    });

  },

  /**
   * @name _debug_http_response:
   *   If the adaptor instance is currently in debug mode, print
   *   information about the results of an HTTP request.
   */
  _debug_http_request: function (_req) {

    var self = this;

    self._debug_print('_debug_http_request: starting');
    self._debug_print('  URL: ' + _req.url);
    self._debug_print('  Method: ' + _req.method);
    self._debug_print('  Body: ' + _req.body);
    self._debug_print('  Headers: ' + JSON.stringify(_req.headers || {}));
    self._debug_print('_debug_http_request: finished');

    return self;
  },

  /**
   * @name _debug_http_response:
   *   If the adaptor instance is currently in debug mode, print
   *   information about the results of an HTTP request.
   */
  _debug_http_response: function (_err, _req, _resp, _body) {

    var self = this;

    self._debug_print('_debug_http_response: starting');
    self._debug_print('  Result: ' + (_err ? 'Error' : 'Successful'));

    if (_err) {
      self._debug_print('  Error Message: ' + _err.message);
    }

    self._debug_print('  Original URL: ' + _req.url);
    self._debug_print('  Original Method: ' + _req.method);
    self._debug_print('  Status: ' + (_resp || {}).statusCode);
    self._debug_print('  Body: ' + _body);
    self._debug_print('_debug_http_response: finished');

    return self;
  },

  /**
   * @name _debug_print:
   */
  _debug_print: function (_string) {
    this._logger.debug(_string.trim());
  },

  get_configuration: function (callback) {
    return callback({
      "drivers": [{
        name: 'twilio',
        sid: 'ACc27ce8143c2f05d804a4828fc0f0f546',
        token: '986200d750694da9647988be4372bb51',
        phone: '+1 650-276-3342',
        log_level: 'debug',
        port: 9001,
        url: '/transport/twilio'
      }],
      "router":{
        "name": "simple",
        "log_level": "debug"
      }
    });
  }
};
