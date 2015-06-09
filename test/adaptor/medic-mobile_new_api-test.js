var chai = require('chai'),
    assert = chai.assert,
    adaptor = require('../../lib/adaptor.js'),
    request = require('request'),
    mock_http = require('../request-mocker.js'),
    AUTOJSON = false,
    adapter, mock_webapp,
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


describe('API detection', function() {
  describe('old API', function(done) {
    beforeEach(function() {
      mock_http.mock({
        'HEAD http://localhost/nonsense/messages': function(url, options, callback) {
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
        'HEAD http://localhost/nonsense/messages': []
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

describe('medic-mobile with new API', function() {
});
