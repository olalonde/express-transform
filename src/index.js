import stream from 'stream';
import initDebug from 'debug';
const debug = initDebug('express-transform');

const spec = {
  readable: {
    events: [
      'close',
      'data',
      'end',
      'error',
      'readable',
    ],
    methods: [
      'isPaused',
      'pause',
      'pipe',
      'read',
      'resume',
      'setEncoding',
      'unpipe',
      'unshift',
      'wrap',
    ],
  },
  writable: {
    events: [
      'drain',
      'error',
      'finish',
      'pipe',
      'unpipe',
    ],
    methods: [
      'cork',
      'end',
      'setDefaultEncoding',
      'uncork',
      'write',
    ],
  },
};

const patch = (res) => {
  debug('patching res');

  const _end = res.end.bind(res);
  const _write = res.write.bind(res);
  const _emit = res.emit.bind(res);

  const resProxy = new stream.Writable();
  resProxy.write = _write;
  resProxy.end = _end;

  /*
   * Events emitted by the PassThrough stream (i.e. "pass-*") will be
   * re-emitted by the ServerResponse. However, the "pass-finish" event
   * is not re-emitted, as this causes the ServerResponse to remove its
   * connection socket (see NodeJS _http_socket.js), which in turn prevents it from
   * sending the zero chunk (within ServerResponse.end). The ServerResponse
   * does however emit its own "finish" event later on.
   *
   * Writable events will be emitted by resProxy.
   *
   * All other events (e.g. custom), will be emitted by the ServerResponse,
   * as expected.
   */
  res.emit = (evName, ...args) => {
    const matches = evName.match(/^pass\-(.*)/);
    const isWritableEvent = spec.writable.events.indexOf(evName) !== -1;

    if (matches) {
      const name = matches[1];
      debug(`emitting ${name} to res`);

      if (name === 'finish') {
        return false;
      }
      return _emit(name, ...args);
    } else if (isWritableEvent) {
      debug(`emitting ${evName} to resProxy`);
      return resProxy.emit(evName, ...args);
    }

    return _emit(evName, ...args);
  };

  const pass = new stream.PassThrough();

  // Forward res stream methods to pass
  spec.writable.methods.forEach((methodName) => {
    res[methodName] = pass[methodName].bind(pass);
  });

  // Forward pass stream events to res
  spec.writable.events.forEach((evName) => {
    pass.on(evName, (...args) => res.emit('pass-' + evName, ...args));
  });

  let lastStream = pass;
  lastStream.pipe(resProxy);

  res.transform = (s) => {
    lastStream.unpipe(resProxy);
    lastStream.pipe(s).pipe(resProxy);
    lastStream = s;
  };
};


export default () => {
  return (req, res, next) => {
    patch(res);
    next();
  };
};
