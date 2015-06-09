var mock_http = require('./request-mocker.js'),
    _ = require('underscore'),

    API_TEST_PATH = '/api/v1/messages',
    PENDING_PATH = '/api/v1/messages?state=pending',
    MESSAGES_PATH = '/api/v1/records',
    STATE_PATH = '/api/v1/messages/state/';

module.exports = function(options) {
  'use strict';
  var self = {},
      behaviour = {},
      pending_message_queue = [],
      ID_MATCHER = new RegExp(/\/([^\/]*)$/),
      fail_deliveries;
  self.state_updates = {};
  self.received = [];

  self.API_TEST_URL = options.url + API_TEST_PATH;
  self.PENDING_URL = options.url + PENDING_PATH;
  self.STATE_URL = options.url + STATE_PATH;
  self.MESSAGES_URL = options.url + MESSAGES_PATH;

  self.poll_count = function() {
    return mock_http.handlers.GET[self.PENDING_URL].count;
  };
  self.push_pending_messages = function(messages) {
    pending_message_queue.push(messages);
  };
  self.fail_deliveries = function() {
    fail_deliveries = true;
  };

  behaviour['HEAD ' + self.API_TEST_URL] = [];
  behaviour['GET ' + self.PENDING_URL] = function() {
    var next = pending_message_queue.shift() || [];
    return _.isArray(next) ? next : [next];
  };
  behaviour['PUT ' + self.STATE_URL + '**'] = function(url, req) {
    var id = ID_MATCHER.exec(url)[1],
        state = req.state;
    self.state_updates[id] = self.state_updates[id] || [];
    self.state_updates[id].push(state);
  };
  behaviour['POST ' + self.MESSAGES_URL] = function(url, body) {
    if(fail_deliveries) {
      return { payload: { success:false } };
    } else {
      self.received.push(body);
      return { payload: { success:true } };
    }
  };
  mock_http.mock(behaviour);

  return self;
};
