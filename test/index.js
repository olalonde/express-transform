/* eslint no-unused-vars:0 */
import test from 'blue-tape';
import http from 'http';
import express from 'express';
import fetch from 'node-fetch';
import transform from '../src';
import zlib from 'zlib';
import onHeaders from 'on-headers';
import fs from 'fs';
import path from 'path';
import initFsBlobStore from 'fs-blob-store';

const fsblobstore = initFsBlobStore(path.join(__dirname, 'data'));

const logoPath = path.join(__dirname, 'data/blockai-logo.png');
const logoContent = fs.readFileSync(logoPath);

let httpServer;

const setup = () => {
  const app = express();
  app.use(transform());
  app.use((req, res, next) => {
    if ('gzip' in req.query) {
      const gzip = zlib.createGzip();
      res.transform(gzip);
      onHeaders(res, function gzipOnHeaders() {
        this.setHeader('Content-Encoding', 'gzip');
        this.removeHeader('Content-Length');
      });
    }
    next();
  });

  app.use('/hello', (req, res) => {
    res.end('Hello World!');
  });

  app.use('/json', (req, res) => {
    res.json({ hello: 'world!' });
  });

  app.use('/readstream', (req, res) => {
    const readStream = fs.createReadStream(logoPath);
    res.status(200);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'max-age=31536000, public');
    readStream.pipe(res);
  });

  app.use('/fsblobstore', (req, res, next) => {
    const readStream = fsblobstore.createReadStream('blockai-logo.png');
    readStream.on('error', next);
    res.status(200);
    res.set('Content-Type', 'image/png');
    res.on('finish', () => {});
    readStream.pipe(res);
  });

  httpServer = http.createServer(app).listen(process.env.PORT);
  const httpPort = httpServer.address().port;
  const url = `http://localhost:${httpPort}`;
  return Promise.resolve({ url });
};

const tearDown = () => {
  httpServer.close();
  return Promise.resolve();
};

let url;
test('start server', (t) => {
  return setup().then((r) => {
    t.comment(r.url);
    url = r.url;
  });
});

test('/hello?gzip', (t) => {
  return fetch(`${url}/hello`)
    .then((res) => res.text())
    .then((body) => {
      t.equal(body, 'Hello World!');
    });
});

test('res.json?gzip', (t) => {
  return fetch(`${url}/json`)
    .then((res) => {
      return res.json();
    })
    .then((body) => {
      t.deepEqual(body, { hello: 'world!' });
    });
});

test('/hello', (t) => {
  return fetch(`${url}/hello`)
    .then((res) => res.text())
    .then((body) => {
      t.equal(body, 'Hello World!');
    });
});

test('res.json', (t) => {
  return fetch(`${url}/json`)
    .then((res) => {
      return res.json();
    })
    .then((body) => {
      t.deepEqual(body, { hello: 'world!' });
    });
});

test('readstream', (t) => {
  return fetch(`${url}/readstream`)
    .then((res) => {
      const body = res.body;
      return new Promise((resolve, reject) => {
        const buffers = [];
        body.on('data', (chunk) => buffers.push(chunk));
        body.on('end', () => resolve(Buffer.concat(buffers)));
        body.on('error', (err) => reject(err));
      });
    })
    .then((buf) => {
      t.deepEqual(buf, logoContent);
    });
});

test('fsblobstore', (t) => {
  return fetch(`${url}/fsblobstore`)
    .then((res) => {
      const body = res.body;
      return new Promise((resolve, reject) => {
        const buffers = [];
        body.on('data', (chunk) => buffers.push(chunk));
        body.on('end', () => resolve(Buffer.concat(buffers)));
        body.on('error', (err) => reject(err));
      });
    })
    .then((buf) => {
      t.deepEqual(buf, logoContent);
    });
});

test('stop server', () => {
  return tearDown();
});

