import stream from 'stream';
import initDebug from 'debug';
const debug = initDebug('express-transform');

class ResProxy extends stream.Writable {
  constructor(res) {
    super();
    this.res = res;
    this.origWrite = res.write;
    this.origEnd = res.end;
  }

  write(...args) {
    // console.log('res.write');
    return this.origWrite.apply(this.res, args);
  }

  end(...args) {
    // console.log('res.end');
    return this.origEnd.apply(this.res, args);
  }
}

const patch = (res) => {
  const resProxy = new ResProxy(res);

  res.transforms = [ new stream.PassThrough() ];
  const first = () => {
    return res.transforms[0];
  };
  const last = () => {
    return res.transforms[res.transforms.length - 1];
  };

  res.transform = (s) => {
    last().pipe(s);
    res.transforms.push(s);
  };

  let streamConnected = false;
  const connectStream = () => {
    if (streamConnected) return;
    debug('connecting transform stream to response');
    streamConnected = true;
    last().pipe(resProxy);
  };
  // todo: only call res.write/res.end if res.transform
  // is called at least once
  res.write = (...args) => {
    connectStream();
    // console.log('passthrough res.write');
    return first().write(...args);
  };
  res.end = (...args) => {
    connectStream();
    // console.log('passthrough res.end');
    return first().end(...args);
  };
};


export default () => {
  return (req, res, next) => {
    patch(res);
    next();
  };
};
