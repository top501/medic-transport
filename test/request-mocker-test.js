var chai = require('chai'),
    assert = chai.assert,
    request = require('request'),
    sinon = require('sinon'),
    mock_request = require('./request-mocker.js'),
    AUTOJSON = false;

describe('mocker', function() {
  'use strict';
  beforeEach(function() {
    this.timeout(500);
  });

  afterEach(function() {
    mock_request.restore();
  });

  it('should allow simple mocks with an object', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:true}]
    });

    // when
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.equal(err, null);
      if(AUTOJSON) {
        assert.deepEqual(body, {content:true});
      } else {
        assert.equal(body, '{"content":true}');
      }
      done();
    });
  });
  it('should repeat final response for multiple requests', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:1}, {content:2}, {content:'everything else'}]
    });

    // when
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.deepEqual(body.content, 1);
      } else {
        assert.equal(body, '{"content":1}');
      }
    });
    // and
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.deepEqual(body.content, 2);
      } else {
        assert.equal(body, '{"content":2}');
      }
    });
    // and
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.deepEqual(body.content, 'everything else');
      } else {
        assert.equal(body, '{"content":"everything else"}');
      }
    });
    // and
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.deepEqual(body.content, 'everything else');
      } else {
        assert.equal(body, '{"content":"everything else"}');
      }
      done();
    });
  });
  it('should return an error for unmocked paths', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:1}, {content:2}, {content:'everything else'}]
    });

    // when
    request.get('http://example.com/bad_path', function(err, resp, body) {
      // then
      assert.ok(err);
      done();
    });
  });
  it('should call functions listed as responses', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': function() { done(); }
    });

    // when
    request.get('http://example.com/path', function() {});
  });
  it('should defer callbacking to functions which request it', function(done) {
    // given
    this.timeout(0);
    mock_request.mock({
      'GET http://example.com/path': function(url, options, callback) {
        assert.ok(callback);
        callback(1, 2, 3);
      }
    });

    // when
    request.get('http://example.com/path', function(a, b, c) {
      assert.deepEqual([a, b, c], [1, 2, 3]);
    });

    setTimeout(done, 200);
  });
  it('should provide request details to function handlers', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': function(url, options) {
        assert.equal(url, 'http://example.com/path');
        assert.ok(options);
        done();
      }
    });

    // when
    request.get('http://example.com/path');
  });
  it('should provide support for POST requests wihtout a body', function(done) {
    // given
    mock_request.mock({
      'POST http://example.com/path': [{content:true}]
    });

    // when
    request.post('http://example.com/path', function(err, resp, body) {
      // then
      assert.equal(err, null);
      if(AUTOJSON) {
        assert.deepEqual(body, {content:true});
      } else {
        assert.equal(body, '{"content":true}');
      }
      done();
    });
  });
  it('should provide support for POST requests with a body', function(done) {
    // given
    mock_request.mock({
      'POST http://example.com/path': [{content:true}]
    });

    // when
    request.post('http://example.com/path', { here:'body' }, function(err, resp, body) {
      // then
      assert.equal(err, null);
      if(AUTOJSON) {
        assert.deepEqual(body, {content:true});
      } else {
        assert.equal(body, '{"content":true}');
      }
      done();
    });
  it('should provide support for PUT requests', function(done) {
    // given
    mock_request.mock({
      'PUT http://example.com/path': [{content:true}]
    });

    // when
    request.put('http://example.com/path', function(err, resp, body) {
      // then
      assert.equal(err, null);
      if(AUTOJSON) {
        assert.deepEqual(body, {content:true});
      } else {
        assert.equal(body, '{"content":true}');
      }
      done();
    });
  });
  });
  it('should provide support for HEAD requests', function(done) {
    // given
    mock_request.mock({
      'HEAD http://example.com/path': [{content:true}]
    });

    // when
    request.head('http://example.com/path', function(err, resp, body) {
      // then
      assert.equal(err, null);
      if(AUTOJSON) {
        assert.deepEqual(body, {content:true});
      } else {
        assert.equal(body, '{"content":true}');
      }
      done();
    });
  });
  it('should not be confused between config for GET and POST', function(done) {
    // given
    mock_request.mock({
      'POST http://example.com/path': [{content:true}]
    });

    // when
    request.get('http://example.com/path', function(err, resp, body) {
      // then
      assert.ok(err);
      done();
    });
  });
  it('should accept URLs passed in `options` object', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:true}]
    });

    // when
    request.get({url:'http://example.com/path'}, function(err, resp, body) {
      // then
      assert.equal(err, null);
      if(AUTOJSON) {
        assert.equal(body.content, true);
      } else {
        assert.equal(body, '{"content":true}');
      }
      done();
    });
  });
  it('should count requests', function() {
    // given
    mock_request.mock({
      'GET http://once': {},
      'GET http://twice': {},
      'GET http://thrice': {}
    });

    // when
    request.get('http://once');

    request.get('http://twice');
    request.get('http://twice');

    request.get('http://thrice');
    request.get('http://thrice');
    request.get('http://thrice');

    // then
    assert.equal(mock_request.handlers.GET['http://once'].count, 1);
    assert.equal(mock_request.handlers.GET['http://twice'].count, 2);
    assert.equal(mock_request.handlers.GET['http://thrice'].count, 3);
  });
  it('should support catch-all URLs', function() {
    // given
    mock_request.mock({
      'GET http://something/or-other/specific':'specific',
      'GET http://something/or-other/**':'catch-all' });

    // when
    request.get('http://something/or-other/specific', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.equal(body, 'specific');
      } else {
        assert.equal(body, '"specific"');
      }
    });

    // when
    request.get('http://something/or-other/', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.equal(body, 'catch-all');
      } else {
        assert.equal(body, '"catch-all"');
      }
    });

    // when
    request.get('http://something/or-other/random', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.equal(body, 'catch-all');
      } else {
        assert.equal(body, '"catch-all"');
      }
    });

    // when
    request.get('http://something/or-other', function(err, resp, body) {
      // then
      if(AUTOJSON) {
        assert.equal(body, 'catch-all');
      } else {
        assert.equal(body, '"catch-all"');
      }
    });

    // when
    request.get('http://something', function(err, resp, body) {
      // then
      assert.equal(err.toString(), 'Error: No mock found for GET at: http://something'); });
  });
/*  it('should support requests made via `request()`', function(done) {
    // given
    mock_request.mock({
      'GET http://example.com/path': [{content:true}]
    });

    // when
    request({url:'http://example.com/path'},
        function(err, resp, body) {
      assert.equal(err, null);
      assert.equal(body.content, true);
      done();
    });
    // and
    request({method:'POST', url:'http://example.com/path'},
        function(err, resp, body) {
      assert.ok(err);
      assert.notEqual(body.content, true);
      done();
    });
  });*/
});
