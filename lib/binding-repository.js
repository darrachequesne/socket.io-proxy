"use strict";

const debug = require("debug")("socket.io-proxy:binding-repository");

module.exports = class BindingRepository {
  constructor(opts) {
    this.redisClient = opts.redisClient;
    this.keyPrefix = opts.keyPrefix;
    this.keyExpiry = opts.keyExpiry;
  }

  createBinding(sid, host) {
    debug("creating binding between sid %s and host %s", sid, host);
    this.redisClient.set(
      `${this.keyPrefix}${sid}`,
      host,
      "EX",
      this.keyExpiry,
      err => {
        if (err) {
          debug("error while creating binding: %s", err);
        }
      }
    );
  }

  findBinding(sid, cb) {
    debug("finding binding for sid %s", sid);
    this.redisClient.get(`${this.keyPrefix}${sid}`, (err, host) => {
      if (err) {
        return cb(err);
      }
      if (!host) {
        return cb(new Error("unknown binding"));
      }
      cb(null, host);
      this.delayBindingExpiry(sid);
    });
  }

  deleteBinding(sid) {
    debug("deleting binding for sid %s", sid);
    this.redisClient.del(`${this.keyPrefix}${sid}`, err => {
      if (err) {
        debug("error while deleting binding: %s", err);
      }
    });
  }

  delayBindingExpiry(sid) {
    debug("delaying binding for sid %s", sid);
    this.redisClient.expire(`${this.keyPrefix}${sid}`, this.keyExpiry, err => {
      if (err) {
        debug("error while delaying binding expiry: %s", err);
      }
    });
  }
};
