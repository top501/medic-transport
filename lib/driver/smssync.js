var express = require('express');
var bodyParser = require('body-parser');
var uuid = require('node-uuid');

exports.prototype = {

  /**
  * @name initialize:
  *   Perform device-specific or API-specific initialization.
  */
  initialize: function (_options) {
    var self = this;

    this._options = (_options || {});

    this.outgoingQueue = []; //messages that are queued up to send
    this.waitingQueue = []; //messages we are waiting for SMSSync to finish processing
    this.receiveHandler = null;
    this.errorHandler = null;
    this.getFnMap = {};
    this.postFnMap = {};

    // Every time a new SMS comes in, pass it onward!
    this.postFnMap[''] = function(_req, _res) {

      var message = {};
      message.from = _req.body.from;
      message.content = _req.body.message;
      message.timestamp = _req.body.sent_timestamp;
      var output = {
        "payload": {
          "success": true,
          "error": null
        }
      }
      if (self.receiveHandler != null) {
        self.receiveHandler(message, function(_err) {
          if (_err !== undefined) {
            output['payload']['success'] = false;
          }
          _res.json(output)
        });
      } else {
        _res.json(output)
      }
    }

    // SMSSync polls this GET call for messages to send out
    this.getFnMap['send'] = function(_req, _res) {
      var output = {
        "payload": {
          "task": "send",
          "secret": "secret",
          "messages": []
        }
      };
      self.outgoingQueue.forEach(function(message) {
        output['payload']['messages'].push({
          "to": message.to,
          "message": message.content,
          "uuid": message.id
        });
      });
      self.log("Sending response: " + JSON.stringify(output));
      _res.json(output);
    }

    // SMSSync POSTs as it accepts messages, we move them from Queued to Waiting
    this.postFnMap['sent'] = function(_req, _res) {
      var output = {
        "message_uuids": []
      };
      _req.body.queued_messages.forEach(function(queuedMessageId) {
        output['message_uuids'].push(queuedMessageId);
        //acknowledge it
        for (var i = 0; i < self.outgoingQueue.length; i++) {
          //find that message in our queue
          var outgoingMessage = self.outgoingQueue[i];
          if (outgoingMessage.id == queuedMessageId) {
            //and remove it
            self.outgoingQueue.splice(i, 1);
            self.waitingQueue.push(outgoingMessage)
            break;
          }
        }
      });
      self.log("Sending response: " + JSON.stringify(output));
      _res.json(output);
    }

    // SMSSync asks which messages are still waiting to have their status updated
    this.getFnMap['result'] = function(_req, _res) {
      var output = {"message_uuids": []}
      self.waitingQueue.forEach(function(message) {
        output['message_uuids'].push(message.id);
      });
      self.log("Sending response: " + JSON.stringify(output));
      _res.json(output);
    }

    // SMSSync tells us when messages are sent
    this.postFnMap['result'] = function(_req, _res) {
      _req.body.message_result = JSON.parse(_req.body.message_result);
      //we get back a list of message results
      _req.body.message_result.forEach(function(messageResult){
        //match those results with a message in the waiting queue
        for (var i = 0; i < self.waitingQueue.length; i++) {
          var message = self.waitingQueue[i];
          if (message.id == messageResult.uuid) {
            //we found it, now deal with its status
            if (messageResult.delivered_result_code == 0) {
              message.callback(false, {result: 'success'});
              self.waitingQueue.splice(i, 1);
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
                self.waitingQueue.splice(i, 1);
              }
              self.log("Message " + message.id + " delivery status: (" + message.delivered_result_code + ") " + message.delivered_result_message);
            }
            break;
          }
        }
      });
    }

    return this;
  },

  log: function(message) {
    if (this._options.debug) {
      console.log(message);
    }
  },

  start: function() {
    var self = this;
    // Route according to GET/POST and task=?
    var postFn = function (_req, _res) {
      var reqTask = _req.query.task;
      if (reqTask === undefined) {
        reqTask = "";
      }
      for (var task in self.postFnMap) {
        if (reqTask == task) {
          self.log("POST request to " + _req.url + ": " + JSON.stringify(_req.body));
          self.postFnMap[task](_req, _res);
          return;
        }
      }
      self.log("Could not find POST function for: " + reqTask)
    }
    var getFn = function (_req, _res) {
      var reqTask = _req.query.task;
      if (reqTask === undefined) {
        reqTask = "";
      }
      for (var task in self.getFnMap) {
        if (reqTask == task) {
          self.log("GET request to " + _req.url);
          self.getFnMap[task](_req, _res);
          return;
        }
      }
      self.log("Could not find GET function for: " + reqTask);
    }

    var app = express();
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());
    app.get('/', getFn);
    app.post('/', postFn);
    app.listen(3000);
    return this;
  },

  send: function (_message, _callback) {
    _message.id = uuid.v4();
    _message.callback = _callback;
    this.outgoingQueue.push(_message);
    return this;
  },

  register_receive_handler: function (_handler) {
    this.receiveHandler = _handler;
    return this;
  },

  register_error_handler: function (_handler) {
    this.errorHandler = _handler;
    return this;
  }

};
