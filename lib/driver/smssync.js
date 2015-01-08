var express = require('express');
    bodyParser = require('body-parser');
    uuid = require('node-uuid');
    jsdump = require('jsDump');

/**
* @namespace smssync:
*/
exports.prototype = {

  //messages that are queued up to send
  outgoingMessages: {},

  //messages we are waiting for SMSSync to finish processing
  waitingMessages: {},

  receiveHandler: null,
  errorHandler: null,

  getFnMap: {},
  postFnMap: {},

  /**
  * @name initialize:
  *   Secret (to be set up in SMSSync) defaults to 'secret',
  *   can be passed in as argument to change.
  *   (Optional) Set *debug* to see logs
  */
  initialize: function (_options, _logger) {
    var self = this;

    this._options = (_options || {});
    if (this._options.secret === undefined) {
      this._options.secret = 'secret';
    }
    if (this._options.port === undefined) {
      this._options.port = 3000;
    }

    this._logger = _logger;

    this.postFnMap[''] = this._incoming_message.bind(this);
    this.getFnMap.send = this._outgoing_messages.bind(this);
    this.postFnMap.sent = this._set_processing.bind(this);
    this.getFnMap.result = this._list_processing.bind(this);
    this.postFnMap.result = this._finish_processing.bind(this);

    return this;
  },

  // Every time a new SMS comes in, pass it onward!
  _incoming_message: function(_req, _res) {
    var self = this;
    var message = {};
    message.from = _req.body.from;
    message.content = _req.body.message;
    message.timestamp = _req.body.sent_timestamp;
    var output = {
      payload: {
        success: true,
        error: null
      }
    };
    if (this.receiveHandler !== null) {
      this.receiveHandler(message, function(_err) {
        if (_err) {
          self._logger.error("receive handler threw", {error: _err});
          output.payload.success = false;
        }
        self._logger.debug("incoming message delivered to adapter from SMSSync", {message: output});
        _res.json(output);
      });
    } else {
      this.errorHandler(new Error(
        'Receive handler not set'
      ));
      output.payload.success = false;
      _res.json(output);
    }
  },

  // SMSSync polls this GET call for messages to send out
  _outgoing_messages: function(_req, _res) {
    var output = {
      "payload": {
        "task": "send",
        "secret": this._options.secret,
        "messages": []
      }
    };
    for (var messageId in this.outgoingMessages) {
      var message = this.outgoingMessages[messageId];
      output.payload.messages.push({
        "to": message.to,
        "message": message.content,
        "uuid": message.id
      });
    }
    this._logger.debug("messages delivered to SMSSync for sending", output);
    _res.json(output);
  },

  // SMSSync POSTs as it accepts messages, we move them from Queued to Waiting
  _set_processing: function(_req, _res) {
    var self = this;
    var output = {
      "message_uuids": []
    };
    _req.body.queued_messages.forEach(function(messageId) {
      output.message_uuids.push(messageId);
      var outgoingMessage = self.outgoingMessages[messageId];
      self.waitingMessages[messageId] = outgoingMessage;
      delete self.outgoingMessages[messageId];
    });
    this._logger.debug("SMSSync accepted messages", output);
    _res.json(output);
  },

  // SMSSync asks which messages are still waiting to have their status updated
  _list_processing: function(_req, _res) {
    var output = { "message_uuids": [] };
    for (var messageId in this.waitingMessages) {
      output.message_uuids.push(messageId);
    }
    this._logger.debug("Sending response: " + JSON.stringify(output));
    _res.json(output);
  },

  // SMSSync tells us when messages are sent
  _finish_processing: function(_req, _res) {
    var self = this;
    _req.body.message_result = JSON.parse(_req.body.message_result);
    //we get back a list of message results
    _req.body.message_result.forEach(function(messageResult){
      //match those results with a message in the waiting queue
      for (var messageId in self.waitingMessages) {
        var message = self.waitingMessages[messageId];
        if (message.id == messageResult.uuid) {
          //we found it, now deal with its status
          if (messageResult.delivered_result_code === 0) {
            message.callback(false, {result: 'success'});
            delete self.waitingMessages[messageId];
          } else {
            //fill in the info
            message.sent_result_code = messageResult.sent_result_code;
            message.sent_result_message = messageResult.sent_result_message;
            message.delivered_result_code = messageResult.delivered_result_code;
            message.delivered_result_message = messageResult.delivered_result_message;
            //if delivery failed, remove it from waiting and send out the error
            if (messageResult.delivered_result_code < 0) {
              message.callback(new Error(
                'Message could not be delivered'
              ), {result: 'failure'});
              delete self.waitingMessages[messageId];
            }
            self._logger.debug("SMSSync reported successful send", message);
          }
          break;
        }
      }
    });
  },

  _postFn: function (_req, _res) {
    var reqTask = _req.query.task;
    if (reqTask === undefined) {
      reqTask = "";
    }
    for (var task in this.postFnMap) {
      if (reqTask == task) {
        this.postFnMap[task](_req, _res);
        return;
      }
    }
    this._logger.info("POST request to unrecognized task", {task: reqTask});
    _res.sendStatus("404");
  },

  _getFn: function (_req, _res) {
    var reqTask = _req.query.task;
    if (reqTask === undefined) {
      reqTask = "";
    }
    for (var task in this.getFnMap) {
      if (reqTask == task) {
        this.getFnMap[task](_req, _res);
        return;
      }
    }
    this._logger.info("GET request to unrecognized task", {task: reqTask});
    _res.sendStatus("404");
  },

  start: function() {
    var self = this;

    var app = express();

    /* Enable this if you want every request logged
    var logger = function(req, res, next) {
      console.log("GOT REQUEST " + req.url);
      next(); // Passing the request to the next handler in the stack.
    };
    app.use(logger); */

    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    app.get('/', this._getFn.bind(this));
    app.post('/', this._postFn.bind(this));

    var server = app.listen(self._options.port, function(err) {
      var addr = server.address();
      self._logger.info('Server listening on %s:%s', addr.address, addr.port);
    });

    return this;
  },

  send: function (_message, _callback) {
    _message.id = uuid.v4();
    _message.callback = _callback;
    this.outgoingMessages[_message.id] = _message;
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

  get_phone_number: function(callback) {
    callback("1111111111");
  }
};
