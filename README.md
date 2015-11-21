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

Example:

```javascript
import express from 'express';
import transform from 'express-transform';

const app = express();
app.use(transform);
app.use((req, res, next) => {
  const gzip = zlib.createGzip();
  res.transform(gzip);
  res.setHeader('Content-Encoding', 'gzip');
  next();
});

app.use((req, res) => {
  // TODO: doesnt work with res.send because it sets
  // (incorrect) content-length
  res.end('Hello World!');
});
```
