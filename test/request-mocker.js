var request = require('request'),
    _ = require('underscore'),
    sinon = require('sinon'),
    DEBUG = false,
    AUTOJSON = false,
    SUPPORTED_VERBS = ['get', 'post', 'put', 'head'],
    WILDCARD_MATCH = new RegExp(/.*\*\*$/);

module.exports = (function() {
  'use strict';
  var self = {},
  handle_action = function(handler, url, options, callback) {
    if(DEBUG) console.log('handle_action() :: url=' + url);

    var hit_count = handler.count++,
        actions = handler.actions;

    if(_.isArray(handler.actions)) {
      if(hit_count < actions.length) {
        perform_action(actions[hit_count], url, options, callback);
      } else {
        perform_action(actions[actions.length-1], url, options, callback);
      }
    } else perform_action(actions, url, options, callback);
  },
  perform_action = function(action, url, options, callback) {
    var response_body;
    if(typeof action === 'function') {
      if(action.length === 3) {
        action(url, options, callback);
        return;
      }
      response_body = action(url, options);
    } else {
      response_body = action;
    }

    callback(null, {
            headers: { 'Content-type': 'application/json' },
            statusCode:200 },
        AUTOJSON ? response_body : JSON.stringify(response_body));
  },
  stubs_for = function(verbs) {
    _.each(verbs, function(verb) {
      var VERB = verb.toUpperCase();
      sinon.stub(request, verb, function(url, options, callback) {
        if(DEBUG) console.log('request() :: initial args = [' +
            typeof url + ', ' +
            typeof options + ', ' +
            typeof callback + ']');
        if(typeof url === 'object') {
          if(DEBUG) console.log('Received url as `options` object - remapping...');
          if(typeof callback !== 'undefined') {
            throw new Error('Too many args supplied.');
          }
          callback = options;
          options = url;
          url = options.url;
        }
        if(typeof callback === 'undefined') {
          // TODO check if including `options` in convenience methods is
          // actually supported
          callback = options;
          options = {};
        }
        callback = callback || function() {};

        if(DEBUG) console.log('request() :: remappd args = [' +
            typeof url + ', ' +
            typeof options + ', ' +
            typeof callback + ']');
        if(DEBUG) console.log(VERB + ':' +
            ' url=' + JSON.stringify(url) +
            ' options=' + JSON.stringify(options) +
            ' callback=' + JSON.stringify(callback));

        var handler = self.handlers[VERB][url];
        if(!handler) {
          // search for catch-all handler
          _.each(_.keys(self.handlers[VERB]), function(matcher) {
            if(WILDCARD_MATCH.test(matcher)) {
              var without_stars = matcher.slice(0, -2);
              if(without_stars === url.slice(0, without_stars.length)) {
                handler = self.handlers[VERB][matcher];
                return;
              }

              if(without_stars.slice(-1) !== '/') return;

              var without_stars_and_slash = without_stars.slice(0, -1);
              if(without_stars_and_slash === url) {
                handler = self.handlers[VERB][matcher];
                return;
              }
            }
          });
        }
        if(!handler) {
          callback(new Error('No mock found for ' + VERB + ' at: ' + url));
          return;
        }
        if(DEBUG) console.log('Found handler for ' + VERB + ' to ' + url + '!');
        return handle_action(handler, url, options, callback);
      });
    });
  };

  self.restore = function() {
    self.handlers = {};
    _.each(SUPPORTED_VERBS, function(verb) {
      if(request[verb].restore) request[verb].restore();
      self.handlers[verb.toUpperCase()] = {};
    });
  };
  self.mock = function(behaviour) {
    self.restore();
    _.mapObject(behaviour, function(resp, req) {
      if(DEBUG) console.log('Mapping: ' + req + ' -> ' + resp);
      var pieces = req.split(' ', 2),
          verb = pieces[0].toUpperCase(),
          url = pieces[1];
      if(!verb || !url) {
        throw new Error('Both VERB and URL to mock.  Supplied:' + req);
      }
      if(DEBUG) console.log('  verb: ' + verb + ', url: ' + url);
      self.handlers[verb][url] = { count:0, actions:resp };
    });
    stubs_for(SUPPORTED_VERBS);
    // TODO need to stub the global `request()` method
  };

  return self;
}());

