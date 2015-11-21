WIP

# express-transform

[![Build Status](https://travis-ci.org/olalonde/express-transform.svg)](https://travis-ci.org/olalonde/express-transform)

## Install

```
npm install --save express-transform
```

## Usage

Adds a `req.transform` method that can be used to pipe the response
to transform streams before it is passed to the underlying socket.

See [./test/index.js](./test/index.js).

Example for compressing response:

```javascript
import express from 'express';
import onHeaders from 'on-headers';
import transform from 'express-transform';

const app = express();
app.use(transform);
app.use((req, res, next) => {
  const gzip = zlib.createGzip();
  res.transform(gzip);

  // Some express methods automatically
  // add Content-Length header which will
  // be incorrect since we are compressing.
  onHeaders(res, function gzipOnHeaders() {
    this.setHeader('Content-Encoding', 'gzip');
    this.removeHeader('Content-Length');
  });

  next();
});

app.use((req, res) => {
  res.send('Hello World!');
});
```
