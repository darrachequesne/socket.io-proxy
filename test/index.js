"use strict";

const Proxy = require("..");
const Server = require("socket.io");
const Client = require("socket.io-client");
const redis = require("redis");

let server1, server2, proxy;
let PORT = 40000;

function onConnection(socket) {
  socket.on("hello", cb => cb("hello!"));
}

describe("socket.io-proxy", function() {
  this.timeout(10000);

  beforeEach(done => {
    server1 = new Server(++PORT);
    server2 = new Server(++PORT);

    server1.on("connection", onConnection);
    server2.on("connection", onConnection);

    proxy = new Proxy({
      redisClient: redis.createClient(6379, "localhost"),
      hosts: ["localhost:" + (PORT - 1), "localhost:" + PORT]
    });

    proxy.listen(++PORT);

    setTimeout(done, 1000);
  });

  afterEach(() => {
    server1.close();
    server2.close();
    proxy.close();
  });

  it("should work when using both polling and websocket", function(done) {
    let client = new Client("http://localhost:" + PORT);

    client.io.engine.on("upgrade", () => {
      client.emit("hello", () => {
        done();
      });
    });
  });

  it("should work when using only polling", function(done) {
    let client = new Client("http://localhost:" + PORT, {
      transports: ["polling"]
    });

    client.emit("hello", () => {
      done();
    });
  });

  it("should work when using only websocket", function(done) {
    let client = new Client("ws://localhost:" + PORT, {
      transports: ["websocket"]
    });

    client.emit("hello", () => {
      done();
    });
  });
});
