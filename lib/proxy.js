"use strict";

const debug = require("debug")("socket.io-proxy:proxy");
const http = require("http");
const httpProxy = require("http-proxy");
const url = require("url");

const BindingRepository = require("./binding-repository");
const Manager = require("./manager");

const hasOwnProperty = Object.prototype.hasOwnProperty;

const SID_REGEX = /"sid":"([\w-]+)"/;

module.exports = class Proxy {
  constructor(opts) {
    if (!opts.redisClient) {
      throw new Error("'redisClient' is mandatory!");
    }
    if (!opts.hosts || !Array.isArray(opts.hosts)) {
      throw new Error("'hosts' array is mandatory!");
    }
    this.opts = Object.assign(
      {
        path: "/socket.io/",
        checkInterval: 2000,
        checkTimeout: 1000,
        keyPrefix: "socket.io#",
        keyExpiry: 60 // 1 minute
      },
      opts
    );

    debug("proxy created with options %O", this.opts);

    this.manager = new Manager(this.opts);
    this.bindingRepository = new BindingRepository(this.opts);

    this.proxyServer = httpProxy.createProxyServer({
      changeOrigin: true,
      ws: true
    });

    this.proxyServer.on("proxyRes", this.onProxyRes.bind(this));
    this.proxyServer.on("error", this.onError.bind(this));

    this.server = http.createServer(this.onRequest.bind(this));
    this.server.on("upgrade", this.onUpgrade.bind(this));
  }

  listen() {
    this.server.listen.apply(this.server, arguments);
  }

  close() {
    this.server.close.apply(this.server, arguments);
  }

  onRequest(req, res) {
    if (!req.url.startsWith(this.opts.path)) {
      debug("unknown path: %s", req.url);
      res.writeHead(400);
      res.end();
      return;
    }

    this.getHost(req, (err, host) => {
      if (err) {
        debug("error while proxying: %s", err);
        res.writeHead(400);
        res.end();
        return;
      }
      debug("proxying to %s", host);
      this.proxyServer.web(req, res, { target: "http://" + host });
    });
  }

  onUpgrade(req, socket, head) {
    if (!req.url.startsWith(this.opts.path)) {
      debug("unknown path (ws): %s", req.url);
      socket.write(
        "HTTP/1.1 400 Bad Request\r\n" +
          "Connection: close\r\n" +
          "Content-type: text/html\r\n" +
          "Content-Length: 0\r\n" +
          "\r\n"
      );
      socket.end();
      return;
    }

    this.getHost(req, (err, host) => {
      if (err) {
        debug("error while proxying (ws): %s", err);
        socket.write(
          "HTTP/1.1 400 Bad Request\r\n" +
            "Connection: close\r\n" +
            "Content-type: text/html\r\n" +
            "Content-Length: 0\r\n" +
            "\r\n"
        );
        socket.end();
        return;
      }
      debug("proxying (ws) to %s", host);
      this.proxyServer.ws(req, socket, { target: "ws://" + host });
    });
  }

  onProxyRes(proxyRes, req, res) {
    if (!req["PROXY_TRACK_ID"]) return;

    let body = "";
    proxyRes.on("data", chunk => {
      body += chunk;
    });
    proxyRes.on("end", () => {
      let sid = SID_REGEX.exec(body);
      if (!(sid && sid.length > 1)) {
        debug("sid not found in %s", body);
        return;
      }
      let target = req["PROXY_TARGET"];
      debug("binding sid %s with host %s", sid[1], target);
      this.bindingRepository.createBinding(sid[1], target);
    });
  }

  onError(err, req) {
    if (!req["PROXY_SID"]) return;

    debug("error, unbinding sid %s", req["PROXY_SID"]);
    this.bindingRepository.deleteBinding(req["PROXY_SID"]);
  }

  getHost(req, cb) {
    let query = url.parse(req.url, true).query;

    if (!hasOwnProperty.call(query, "sid")) {
      let host = this.manager.getRandomHost();
      if (!host) {
        return cb(new Error("no node available"));
      }
      debug("first request, proxying to %s", host);
      req["PROXY_TRACK_ID"] = true;
      req["PROXY_TARGET"] = host;
      return cb(null, host);
    }

    req["PROXY_SID"] = query.sid;
    this.bindingRepository.findBinding(query.sid, cb);
  }
};
