socket.io-proxy2
================

A socket.io proxy based on [http-proxy](https://github.com/nodejitsu/node-http-proxy) to handle multiple socket.io servers.

Installation
------------

```shell
$ npm install socket.io-proxy2
```

How to use
----------

```js
const Proxy = require('socket.io-proxy2');
const redis = require('redis');

const redisClient = redis.createClient(6379, 'localhost');

const proxy = new Proxy({
  redisClient: redisClient,
  hosts: [
    'localhost:3000',
    'localhost:3001',
    'localhost:3002'
  ]
});

const port = process.env['PORT'] || 4000;

proxy.listen(port, () => {
  console.log(`proxy listening on port ${port}`);
});
```

**Options:**

- **redisClient**: a Redis client (mandatory)
- **hosts**: an array of socket.io servers (mandatory)
- **path**: the name of the path to capture (optional, defaulting to */socket.io/*)
- **checkInterval**: the interval in ms between two healthchecks (optional, defaulting to *2000*)
- **checkTimeout**: the number of ms before an healthcheck failure (optional, defaulting to *1000*)
- **keyPrefix**: the prefix to use for the keys stored in Redis (optional, defaulting to *socket.io#*)
- **keyExpiry**: the TTL in seconds of the keys stored in Redis (optional, defaulting to *60*)

How it works
------------

The `polling` transport requires that every request is directed to the same backend for the duration of the session. There are several ways to meet this requirement:

- only use the `websocket` transport, but in that case you should rather consider using something like [robust-websocket](https://github.com/appuri/robust-websocket) for the client and [ws](https://github.com/websockets/ws) for the server, as one of the main features of Socket.IO is to provide a fallback when WebSocket connection is not possible.

- use sticky-session, either IP-based ([NGINX example](https://github.com/socketio/socket.io/tree/master/examples/cluster-nginx)) or cookie-based ([HAProxy example](https://github.com/socketio/socket.io/tree/master/examples/cluster-haproxy), [HTTPD example](https://github.com/socketio/socket.io/tree/master/examples/cluster-httpd))

- use Fedor Indutny's [sticky-session](https://github.com/indutny/sticky-session) package in a cluster environment

- or try this package:

On first request (the socket has no id yet), the request is proxied to a random available backend. The id is sent as part of the response, which the proxy reads to save the association in Redis (key: `<keyPrefix><socket id>` with an expiry of `<keyExpiry>` seconds).

For the next requests or the WebSocket upgrade, the association is retrieved from Redis and the request is proxied to the right backend.

Debug
-----

The package uses [debug](https://github.com/visionmedia/debug). In order to see all the debug output, you can run the proxy with the environment variable DEBUG including the desired scope:

```shell
$ DEBUG=socket.io-proxy* node index
```
