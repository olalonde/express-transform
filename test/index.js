import test from 'blue-tape';
import http from 'http';
import express from 'express';
import fetch from 'node-fetch';
import transform from '../src';
import zlib from 'zlib';

let httpServer;

const setup = () => {
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

  httpServer = http.createServer(app).listen();
  const httpPort = httpServer.address().port;
  const url = `http://localhost:${httpPort}`;
  return Promise.resolve({ url });
};

const tearDown = () => {
  httpServer.close();
};

test('bandwidth', (t) => {
  return setup()
    .then(({ url }) => {
      t.comment(url);
      return fetch(`${url}`)
      .then((res) => {
        return res.text();
      })
      .then((body) => {
        t.equal(body, 'Hello World!');
      });
    })
    .then(tearDown);
});

