var chai = require('chai'),
    assert = chai.assert,
    request = require('request'),
    MockWebapp = require('./mock-webapp.js'),

    AUTOJSON = false,
    TEST_URL_ROOT = 'http://localhost/nonsense',
    MESSAGES_PATH = '/api/v1/records',
    MESSAGES_URL = TEST_URL_ROOT + MESSAGES_PATH,
    PENDING_PATH = '/api/v1/messages?state=pending',
    PENDING_URL = TEST_URL_ROOT + PENDING_PATH,
    API_TEST_PATH = '/api/v1/messages',
    API_TEST_URL = TEST_URL_ROOT + API_TEST_PATH;

describe('mock-webapp', function() {
  var mock_webapp;

  beforeEach(function() {
    mock_webapp = new MockWebapp({ url:TEST_URL_ROOT });
  });

  it('should respond OK to HEAD request to ' + API_TEST_PATH, function(done) {
     request.head(API_TEST_URL, function(err, resp) {
       assert.notOk(err);
       assert.equal(resp.statusCode, 200);
       done();
     });
  });

  it('should have a poll_count available', function() {
    assert.equal(typeof mock_webapp.poll_count(), 'number');
  });
  it('should count number of pollings done', function() {
    assert.equal(mock_webapp.poll_count(), 0);
    request.get(PENDING_URL);
    assert.equal(mock_webapp.poll_count(), 1);
    request.get(PENDING_URL);
    assert.equal(mock_webapp.poll_count(), 2);
    request.get(PENDING_URL);
    assert.equal(mock_webapp.poll_count(), 3);
  });
  it('should not share vars with other instances', function() {
    // given
    request.get(PENDING_URL);
    assert.equal(mock_webapp.poll_count(), 1);

    // when
    mock_webapp = new MockWebapp({ url:TEST_URL_ROOT });

    // then
    assert.equal(mock_webapp.poll_count(), 0);
  });
  it('should only count pollings to the correct URL', function() {
    assert.equal(mock_webapp.poll_count(), 0);
    request.get(TEST_URL_ROOT + '/something-wrong');
    assert.equal(mock_webapp.poll_count(), 0);
    request.get(TEST_URL_ROOT + '/api/v1/messages?status=not-pending');
    assert.equal(mock_webapp.poll_count(), 0);
    request.get(PENDING_URL);
    assert.equal(mock_webapp.poll_count(), 1);
  });
  it('should provide empty list if no messages are pending', function(done) {
    // when
    request.get(PENDING_URL, function(err, options, body) {
      if(!AUTOJSON) body = JSON.parse(body);
      // then
      assert.deepEqual(body, []);
      done();
    });
  });
  it('should provide a message from the pending message queue once', function(done) {
    // setup
    mock_webapp.push_pending_messages({ to:'+1234567890', message:'hello' });

    // when
    request.get(PENDING_URL, function(err, options, body) {
      if(!AUTOJSON) body = JSON.parse(body);

      // then
      assert.equal(body.length, 1);
      assert.equal(body[0].to, '+1234567890');
      assert.equal(body[0].message, 'hello');

      // when
      request.get(PENDING_URL, function(err, options, body) {
        if(!AUTOJSON) body = JSON.parse(body);

        // then
        assert.deepEqual(body, []);
        done();
      });
    });
  });
  it('should provide messages from the pending message queue', function(done) {
    // setup
    mock_webapp.push_pending_messages([
        { to:'+1234567890', message:'hello' },
        { to:'+1111111111', message:'aaaaa' }]);

    // when
    request.get(PENDING_URL, function(err, options, body) {
      if(!AUTOJSON) body = JSON.parse(body);

      // then
      assert.equal(body.length, 2);
      assert.equal(body[0].to, '+1234567890');
      assert.equal(body[0].message, 'hello');

      assert.equal(body[1].to, '+1111111111');
      assert.equal(body[1].message, 'aaaaa');

      // when
      request.get(PENDING_URL, function(err, options, body) {
        if(!AUTOJSON) body = JSON.parse(body);

        // then
        assert.deepEqual(body, []);
        done();
      });
    });
  });
  it('should maintain a store of state updates', function() {
    assert.deepEqual(mock_webapp.state_updates, {});
  });
  it('should log state updates', function(done) {
    var state_path = TEST_URL_ROOT + '/api/v1/messages/state/a-1';
    request.put(state_path,
        { state:'pending', details:{} },
        function() {
          assert.deepEqual(mock_webapp.state_updates,
              { 'a-1':['pending'] });
          request.put(state_path,
              { state:'failed', details:{} },
              function() {
                assert.deepEqual(mock_webapp.state_updates,
                    { 'a-1':['pending', 'failed'] });
                done();
              });
        });
  });
  it('should record saved messages', function(done) {
    assert.deepEqual(mock_webapp.received, []);

    // when
    request.post(MESSAGES_URL, { to:'+123', message:'abc' }, function() {
      // then
      assert.deepEqual(mock_webapp.received,
          [{ to:'+123', message:'abc' }]);

      // when
      request.post(MESSAGES_URL, { to:'+456', message:'def' }, function() {
        // then
        assert.deepEqual(mock_webapp.received, [{ to:'+123', message:'abc' },
            { to:'+456', message:'def' }]);
        done();
      });
    });
  });
  it('should fail deliveries if told to', function(done) {
    // given
    mock_webapp.fail_deliveries();

    // when
    request.post(MESSAGES_URL, { to:'+123', message:'abc' }, function(err, resp, body) {
      assert.notOk(err);
      assert.deepEqual(JSON.parse(body), { payload: { success: false } });
      done();
    });
  });
});
