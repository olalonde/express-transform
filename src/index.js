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

spec.stream = {
  events: spec.readable.events.concat(spec.writable.events),
  methods: spec.readable.methods.concat(spec.writable.methods),
};

const patch = (res) => {
  debug('patching res');

  const _end = res.end.bind(res);
  const _write = res.write.bind(res);
  const _emit = res.emit.bind(res);

  let lastStream = res;

  const resProxy = new stream.Writable();
  resProxy.write = _write;
  resProxy.end = _end;

  // Redirect events:
  // 1) pass-xyz => res.emit(xyz)
  // 2) writable events => resProxy.emit(event)
  // 3) other events => res.emit(event)
  res.emit = (evName, ...args) => {
    const matches = evName.match(/^pass\-(.*)/);
    const isWritableEvent = spec.writable.events.indexOf(evName) !== -1;

    if (matches) {
      const name = matches[1];
      debug(`emitting ${name} to res`);
      return _emit(name, ...args);
    } else if (isWritableEvent) {
      debug(`emitting ${evName} to resProxy`);
      return resProxy.emit(evName, ...args);
    }

    return _emit(evName, ...args);
  };

  const pass = new stream.PassThrough();

  // Forward res stream methods to pass
  spec.stream.methods.forEach((methodName) => {
    res[methodName] = pass[methodName].bind(pass);
  });

  // Forward pass stream events to res
  spec.stream.events.forEach((evName) => {
    pass.on(evName, (...args) => res.emit('pass-' + evName, ...args));
  });

  res.transform = (s) => {
    lastStream.unpipe(resProxy);
    lastStream.pipe(s).pipe(resProxy);
    lastStream = s;
  };

  res.pipe(resProxy);
};


export default () => {
  return (req, res, next) => {
    patch(res);
    next();
  };
};
