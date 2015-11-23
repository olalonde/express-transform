import test from 'blue-tape';
import http from 'http';
import express from 'express';
import fetch from 'node-fetch';
import transform from '../src';
import zlib from 'zlib';
import onHeaders from 'on-headers';

let httpServer;

const setup = () => {
  const app = express();
  app.use(transform());
  app.use((req, res, next) => {
    const gzip = zlib.createGzip();
    res.transform(gzip);
    onHeaders(res, function gzipOnHeaders() {
      this.setHeader('Content-Encoding', 'gzip');
      this.removeHeader('Content-Length');
    });
    next();
  });

  app.use('/hello', (req, res) => {
    res.end('Hello World!');
  });

  app.use('/json', (req, res) => {
    res.json({ hello: 'world!' });
  });

  httpServer = http.createServer(app).listen();
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

test('res.end', (t) => {
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

test('stop server', () => {
  return tearDown();
});

