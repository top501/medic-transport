var chai = require('chai'),
    assert = chai.assert,
    adaptor = require('../../lib/adaptor.js'),
    request = require('request'),
    mock_http = require('../request-mocker.js'),
    MockWebapp = require('../mock-webapp.js'),
    adapter,

    AUTOJSON = false,
    TEST_URL_ROOT = 'http://localhost/nonsense',
    TODO = function(done) { done(new Error('Not Yet Implemented')); },
    MESSAGES_PATH = '/api/v1/records',
    MESSAGES_URL = TEST_URL_ROOT + MESSAGES_PATH,
    PENDING_PATH = '/api/v1/messages?state=pending',
    PENDING_URL = TEST_URL_ROOT + PENDING_PATH,
    STATE_PATH = '/api/v1/messages/state/',
    STATE_URL = TEST_URL_ROOT + STATE_PATH,
    register_noop_transmit_handler = function() {
      adapter.register_transmit_handler(function() {}); };


describe('medic-mobile', function() {
  afterEach(function() {
    if(adapter) adapter.stop();
  });

  describe('API detection', function() {
    describe('old API', function(done) {
      beforeEach(function() {
        mock_http.mock({
          'HEAD http://localhost/nonsense/api/v1/messages': function(url, options, callback) {
            callback(false, { statusCode:404 });
          }
        });
      });
      it('should detect the old API', function(done) {
        // given
        adapter = adaptor.create('medic-mobile',
            {pass:'secret', url:TEST_URL_ROOT, interval:100});

        // when
        adapter._detect_api_version(function(version) {
          assert.equal(version, 'old');
          done();
        });
      });
    });
    describe('new API', function(done) {
      beforeEach(function() {
        mock_http.mock({
          'HEAD http://localhost/nonsense/api/v1/messages': []
        });
      });
      it('should detect the new API', function(done) {
        // given
        adapter = adaptor.create('medic-mobile',
            {pass:'secret', url:TEST_URL_ROOT, interval:100});

        // when
        adapter._detect_api_version(function(version) {
          assert.equal(version, 'new');
          done();
        });
      });
    });
    it('should happen on startup', function(done) {
        // given
        this.timeout(0);
        adapter = adaptor.create('medic-mobile',
            {pass:'secret', url:TEST_URL_ROOT, interval:100});

        // then
        assert.notOk(adapter._api_version);

        // when
        adapter.start();

        // then
        setTimeout(function() {
          assert.ok(adapter._api_version);
          done();
        }, 200);
    });
  });
});

describe('medic-mobile with new API', function() {
  var mock_webapp;

  beforeEach(function() {
    adapter = adaptor.create('medic-mobile',
        {debug:false, pass:'secret', url:TEST_URL_ROOT, interval:100});
    mock_webapp = new MockWebapp({ url:TEST_URL_ROOT });
  });
  afterEach(function() {
    if(adapter) adapter.stop();
  });

  describe('mobile-originating', function() {
    describe('when not started', function() {
      it('should do nothing', function(done) {
        this.timeout(0);
        setTimeout(function() {
          assert.equal(mock_webapp.poll_count(), 0);
          done();
        }, 200);
      });
    });
    describe('when started', function() {
      it('should poll ' + PENDING_PATH, function(done) {
        // then
        this.timeout(0);
        setTimeout(function() {
          assert.ok(mock_webapp.poll_count() > 0);
          done();
        }, 200);
        register_noop_transmit_handler();

        // when
        adapter.start();
      });
      it('should poll once every interval', function(done) {
        // setup
        this.timeout(0);

        // then
        setTimeout(function() {
          assert.isAbove(mock_webapp.poll_count(), 3);
          assert.isBelow(mock_webapp.poll_count(), 7);
          done();
        }, 500);
        register_noop_transmit_handler();

        // when
        adapter.start();
      });
      it('should no longer poll when stopped', function(done) {
        // setup
        this.timeout(0);
        register_noop_transmit_handler();

        // then
        setTimeout(function() {
          var initial_poll_count = mock_webapp.poll_count();
          assert.ok(initial_poll_count > 0);
          adapter.stop();
          setTimeout(function() {
            assert.equal(mock_webapp.poll_count(), initial_poll_count);
            done();
          }, 300);
        }, 300);

        // when
        adapter.start();
      });
    });
    describe('when ' + PENDING_PATH + ' provides bad JSON', function() {
      it('should call the callback with a suitable error', function(done) {
        TODO(done);
      });
    });
    describe('when ' + PENDING_PATH + ' provides a message', function() {
      it('should be passed to the transmit handler', function(done) {
        // setup
        mock_webapp.push_pending_messages({ to:'+123', message:'hi' });

        adapter.register_transmit_handler(function(message, callback) {
          // then
          assert.equal(message.to, '+123');
          assert.equal(message.content, 'hi');
          // TODO we should really be supplying uuid and timestamp in our
          // original messages.  Perhaps it's safe not to test them?
          //assert.ok(message.uuid);
          //assert.ok(message.timestamp);
          done();
        });

        // when
        adapter.start();
      });
    });
    describe('when ' + PENDING_PATH + ' provides messages', function() {
      it('should transmit all of them', function(done) {
        // setup
        mock_webapp.push_pending_messages([
            { to:'+123', message:'hi' },
            { to:'+456', message:'ho' }]);

        // then
        var transmit_handler_calls = 0;
        adapter.register_transmit_handler(function(message, callback) {
          // then
          ++transmit_handler_calls;
          if(transmit_handler_calls === 1) {
            assert.equal(message.to, '+123');
            assert.equal(message.content, 'hi');
          } else if(transmit_handler_calls === 2) {
            assert.equal(message.to, '+456');
            assert.equal(message.content, 'ho');
            done();
          }
        });

        // when
        adapter.start();
      });
      it('should not stack overflow even with many messages', function(done) {
        // TODO this potential bug may be why async.eachSeries is used instead
        // of _.each?
        TODO(done);
      });
    });
    describe('when a message transmits successfully', function() {
      it('should update state with medic-webapp', function(done) {
        // setup
        this.timeout(0);
        mock_webapp.push_pending_messages({ uuid:'a-1', to:'+123', message:'hi' });
        adapter.register_transmit_handler(function(message, callback) {
          callback(null, { uuid:message.uuid, status:'success' });
        });

        // then
        setTimeout(function() {
          assert.deepEqual(mock_webapp.state_updates,
              { 'a-1':['sent'] });
          done();
        }, 200);

        // when
        adapter.start();
      });
    });
    describe('when a message transmit fails', function() {
      it('should update state with medic-webapp', function(done) {
        // setup
        this.timeout(0);
        mock_webapp.push_pending_messages({ uuid:'a-1', to:'+123', message:'hi' });
        adapter.register_transmit_handler(function(message, callback) {
          callback(null, { uuid:message.uuid, status:'failure' });
        });

        // then
        setTimeout(function() {
          assert.deepEqual(mock_webapp.state_updates,
              { 'a-1':['failed'] });
          done();
        }, 200);

        // when
        adapter.start();
      });
      it('should retry sending three times', function(done) {
        TODO(done);
      });
      it('should notify error handler if it still fails', function(done) {
        TODO(done);
      });
    });
  });
});
