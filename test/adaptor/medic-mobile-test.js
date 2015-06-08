var chai = require('chai'),
    request = require('request'),
    sinon = require('sinon'),
    adaptor = require('../../lib/adaptor.js'),
    assert = chai.assert,
    mock_http = require('../request-mocker.js');
chai.config.includeStack = true;

describe('medic-mobile', function() {
  var TEST_MESSAGE = {content:'', from:'', timestamp:''},
      TEST_URL_ROOT = 'http://localhost/nonsense',
      TEST_CALLBACK_OBJ = {url:'http://localhost:5999/weird-callback',
          headers:{}, body:'{"docs":["asdf","123"]}'},
      mm = null;

  beforeEach(function() {
    mm = adaptor.create('medic-mobile',
        {debug:false, pass:'secret', url:TEST_URL_ROOT, interval:100});
  });

  afterEach(function() {
    if(mm) mm.stop();
    mock_http.restore();
  });

  var error_and_done = function(done, error_message) {
    return function() { return done(new Error(error_message)); };
  };

  var MESSAGES_TO_SEND_ONCE = [
    {
          payload:{messages:[
              {uuid:0, message:'a', to:'0', random_key:'should be ignored'},
              {uuid:1, message:'b', to:'1'},
              {uuid:2, message:'c', to:'2'}]},
          callback:{data:{docs:['asdf', '123']}, options:{protocol:'http', host:'localhost', port:5999, path:'/weird-callback'}}},
    {}
  ];

  describe('receiving', function() {
    it('should poll by GETting /add', function(done) {
      sinon.stub(request, 'get', function(options) {
        assert.equal(options.url, TEST_URL_ROOT + '/add');
        return done();
      });
      mm.start();
    });
    it('should call transmit handler once for each message when all sent ok',
        function(done) {
      this.timeout(0);

      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
        'GET http://localhost:5999/weird-callback': [
          function(url, options) {
            assert.deepEqual(options, TEST_CALLBACK_OBJ);
          },
          error_and_done(done, 'Should only make one callback.')
        ]
      });

      var transmit_handler_calls = [];
      mm.register_transmit_handler(function(message, callback) { // TODO not reuiqred
        var actual, i,
            ALPHABET = 'abc';
        transmit_handler_calls.push(message);
        if(transmit_handler_calls.length === 3) {
          for(i=0; i<3; ++i) {
            actual = transmit_handler_calls[i];
            assert.equal(actual.uuid, i);
            assert.equal(actual.content, ALPHABET.charAt(i));
            assert.equal(actual.to, ''+i);
            assert.ok(actual.timestamp);
            assert.notOk(actual.random_key);
          }
        }
        callback(null, { status:'success', total_sent:1 });
      });

      mm.start();

      setTimeout(function() {
        assert.equal(mock_http.handlers.GET['http://localhost:5999/weird-callback'].count, 1);
        done();
      }, 200);
    });
    it('should call transmit handler if some messages are successful and some failure', function(done) {
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
        'GET http://localhost:5999/weird-callback': [
          function(url, options) {
            assert.deepEqual(options, TEST_CALLBACK_OBJ);
            return done();
          },
          error_and_done(done, 'Should only make one callback.')
        ]
      });

      var transmit_handler_calls = 0;
      mm.register_transmit_handler(function(message, callback) {
        if(++transmit_handler_calls % 2 === 0) {
          callback(false, { status:'success', total_sent:1 });
        } else {
          callback(false, { status:'failure', total_sent:0 });
        }
      });
      mm.register_error_handler(function(error) {
        return done(error);
      });

      // when
      mm.start();
    });
    it('should not call transmit handler if all messages are failure', function(done) {
      this.timeout(0);
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
        'GET http://localhost:5999/weird-callback': error_and_done(done,
            'Should not make callback when all messages are failures.')
      });

      mm.register_transmit_handler(function(message, callback) {
        callback(false, { status:'failure', total_sent:0 });
      });
      mm.register_error_handler(function(error) {
        return done(error);
      });

      // when
      mm.start();

      // then
      setTimeout(done, 200);
    });
    it('should not call transmit handler when all messages give transmit errors', function(done) {
      // setup
      this.timeout(0);
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE
      });
      mm.register_transmit_handler(function(message, callback) {
        callback(new Error('Manufactured error for testing'));
      });

      // when
      mm.start();

      // then
      setTimeout(done, 200);
    });
    it('should call transmit handler when some messages give transmit errors but others succeed', function(done) {
      // setup
      this.timeout(0);
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
        'GET http://localhost:5999/weird-callback': 'OK'
      });
      var transmit_handler_call_count = 0;
      mm.register_transmit_handler(function(message, callback) {
        if(transmit_handler_call_count++ === 2) {
          callback(new Error('Manufactured error for testing'));
        } else {
          callback(false, { status:'success', total_sent:1 });
        }
      });

      // when
      mm.start();

      // then
      setTimeout(function() {
        assert.equal(mock_http.handlers.GET['http://localhost:5999/weird-callback'].count, 1);
        done();
      }, 200);
    });
    it('should not call transmit error handler when there are transmit errors', function(done) {
      // setup
      this.timeout(0);
      mock_http.mock({
        'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE
      });
      mm.register_transmit_handler(function(message, callback) {
        callback(new Error('Manufactured error for testing'));
      });
      var error_handler_call_count = 0;
      mm.register_error_handler(function(error) {
        assert.equal(error.toString(), 'Error: Manufactured error for testing');
        ++error_handler_call_count;
      });

      // when
      mm.start();

      // then
      setTimeout(function() {
        assert.equal(error_handler_call_count, 0);
        done();
      }, 200);
    });
    // TODO it's actually expected that messages which returned status
    // `failure` *should* be retried...but that's not what the current
    // implementation does.  So this test is there to ensure the
    // behaviour is not inadvertantly changed.
    it('should not retry messages which return status `failure`', function(done) {
      // setup
      this.timeout(0);
      mock_http.mock({
          'GET http://localhost/nonsense/add': MESSAGES_TO_SEND_ONCE,
          'GET http://localhost:5899/weird-callback': error_and_done(done,
              'Should not have callback with failed messages.')
      });
      var sendAttempts = 0;

      mm.register_transmit_handler(function(message, callback) {
        ++sendAttempts;
        callback(false, { status:'failure', total_sent:0 });
      });

      // when
      mm.start();

      // then
      setTimeout(function() {
        assert.equal(sendAttempts, 3);
        return done();
      }, 200);
    });
  });
  describe('.deliver()', function() {
    it('should call supplied callback if a good message is supplied', function(done) {
      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        // then
        return done();
      });
    });
    it('should POST to /add', function(done) {
      mock_http.mock({ 'POST http://localhost/nonsense/add': {} });

      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        if(error) return done(error);

        // then
        assert.deepEqual(response, { status:'success', total_sent:1 });

        var args = request.post.firstCall.args;
        assert.equal(args.length, 2);
        assert.equal(args[0].url, TEST_URL_ROOT + '/add');
        assert.equal(request.post.callCount, 1);
        assert.notOk(request.get.called);
        return done();
      });
    });
    it('should report success to the callback URL', function(done) {
      mock_http.mock({
        'POST http://localhost/nonsense/add': {
            payload: {
              messages:[{}]
            },
            callback: { data:
                { docs:['asdf', '123'] },
                options:{protocol:'http', host:'localhost', port:5999,
                    path:'/weird-callback'} } },
        'GET http://localhost:5999/weird-callback':
            function(request, options) {
              assert.equal(request,
                  'http://localhost:5999/weird-callback');
              // for some reason, the body should equal the data we passed
              // in the `callback` field of the `POST` to `/add`
              assert.equal(options.body, '{"docs":["asdf","123"]}');
              return done();
            }
      });

      mm.deliver(TEST_MESSAGE, function(error, response) {});
    });
    it('should report success to the callback URL once for each batch', function(done) {
      // setup
      this.timeout(0);
      mock_http.mock({
        'POST http://localhost/nonsense/add': {
            payload: {
              messages:[{}, {}, {}]
            },
            callback: { data:
                { docs:['asdf', '123'] },
                options:{protocol:'http', host:'localhost', port:5999,
                    path:'/weird-callback'} } },
        'GET http://localhost:5999/weird-callback':
            function(request, options) {
              assert.equal(request,
                  'http://localhost:5999/weird-callback');
              // for some reason, the body should equal the data we passed
              // in the `callback` field of the `POST` to `/add`
              assert.equal(options.body, '{"docs":["asdf","123"]}');
            }
      });

      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {});

      // then
      setTimeout(function() {
        assert.equal(mock_http.handlers.GET['http://localhost:5999/weird-callback'].count, 1);
        done();
      }, 200);
    });
    // TODO we probably do want to be retrying these, but the current
    // implementation does not.
    it('should not retry failed deliveries', function(done) {
      // setup
      var deliver_callback_count = 0;
      this.timeout(0);
      mock_http.mock({});

      // when
      mm.deliver(TEST_MESSAGE, function(error, response) {
        ++deliver_callback_count;
        assert.ok(error);
      });

      // then
      setTimeout(function() {
        assert.equal(deliver_callback_count, 1);
        done();
      }, 200);
    });
  });
});
