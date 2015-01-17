
var gammu = require('node-gammu-json');

exports.prototype = {

  initialize: function (_options, _logger) {

    this._options = (_options || {});
    this._gammu = gammu.create(this._options);
    this._logger = _logger;

    return this;
  },

  send: function (_message, _callback) {

    this._logger.debug('queueing ', _message);

    try {
      this._gammu.send(_message.to, _message.content, function (_err, _rv) {

        this._logger.debug('sent ', {
          message: _message,
          status: _rv
        });
        return _callback(_err);
      });

    } catch (e) {

      return _callback(new Error(
        'Invalid argument(s) supplied to the `send` method'
      ));
    }

    return this;
  },

  register_receive_handler: function (_handler) {

    var self = this;

    self._gammu.on('receive', function (_message, _callback) {

      this._logger.debug('received', _message);

      _handler(_message, function (_e) {

        this._logger.debug('receive handler invoked', {error: _e});

        _callback(_e);
      });

    });

    this._logger.debug('registered receive handler');

    return self;
  },

  register_error_handler: function (_handler) {

    this._gammu.on('error', function (_err) {
      _handler(_err);
    });

    return this;
  },

  start: function () {

    this._gammu.start();
    return this;
  },

  stop: function () {

    this._gammu.stop();
    return this;
  },

  destroy: function () {

    this._gammu.destroy();
    return this;
  },

  set_state: function (state, callback) {
    this.state = state;
    callback(null);
  },

  get_state: function (callback) {
    if (!this.state) {
      callback(true, null);
      return;
    }
    callback(this.state, null);
  }
};
