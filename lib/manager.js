"use strict";

const debug = require("debug")("socket.io-proxy:manager");
const http = require("http");
const url = require("url");

const UP = Symbol("UP");
const DOWN = Symbol("DOWN");

module.exports = class Manager {
  constructor(opts) {
    this.checkInterval = opts.checkInterval;
    this.checkTimeout = opts.checkTimeout;
    this.nodes = opts.hosts.map(host => {
      let split = host.split(":");
      return {
        host: host,
        hostname: split[0],
        port: split[1],
        state: DOWN
      };
    });

    this.healthCheck();
    setInterval(this.healthCheck.bind(this), this.checkInterval);
  }

  healthCheck() {
    for (let i = 0, l = this.nodes.length; i < l; i++) {
      let node = this.nodes[i];

      let options = {
        hostname: node.hostname,
        port: node.port,
        method: "HEAD",
        timeout: this.checkTimeout
      };

      let req = http.request(options, () => {
        if (node.state === DOWN) {
          debug("%s is now UP", node.host);
          this.nodes[i].state = UP;
        }
      });

      req.on("error", err => {
        debug("error while checking health: %s", err);
        if (node.state === UP) {
          debug("%s is now DOWN", node.host);
          this.nodes[i].state = DOWN;
        }
      });

      req.end();
    }
  }

  getRandomHost() {
    let availableNodes = this.nodes.filter(u => u.state === UP);
    return availableNodes.length
      ? availableNodes[Math.floor(Math.random() * availableNodes.length)].host
      : null;
  }
};
