"use strict";

/*
 * Copyright (C) 2017-2019 UBports Foundation <info@ubports.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const fs = require("fs");
const path = require("path");
const exec = require('child_process').exec;
const common = require("./common.js");

const DEFAULT_EXEC = (args, callback) => { exec((["adb"].concat(args)).join(" "), undefined, callback); };
const DEFAULT_LOG = console.log;
const DEFAULT_PORT = 5037;

class Adb {
  constructor(options) {
    this.exec = DEFAULT_EXEC;
    this.log = DEFAULT_LOG;
    this.port = DEFAULT_PORT;

    // Accept options
    if (options) {
      if (options.exec) {
        this.exec = options.exec;
      }
      if (options.log) {
        this.log = options.log;
      }
      if (options.port) {
        this.port = options.port;
      }
    }
  }

  // Exec a command with port argument
  execPort(args) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.exec(["-P", _this.port].concat(args), (error, stdout, stderr) => {
        if (error) reject(error, stderr);
        else resolve(stdout);
      });
    });
  }

  // Kill all adb servers and start a new one to rule them all
  startServer() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.killServer().then(() => {
        _this.log("starting adb server on port " + _this.port);
        _this.execPort("start-server").then((stdout) => {
          resolve();
        }).catch(reject);
      }).catch((error, stderr) => {
        reject(error, stderr);
      });
    });
  }

  // Kill all running servers
  killServer() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.log("killing all running adb servers");
      _this.execPort("kill-server").then((stdout) => {
        resolve();
      }).catch((error, stderr) => {
        reject(error, stderr);
      });
    });
  }

  getSerialno() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.log("killing all running adb servers");
      _this.execPort("get-serialno").then((stdout) => {
        if (stdout.length == 17) resolve(stdout.replace("\n",""));
        else reject("invalid device id");
      }).catch((error, stderr) => {
        reject(error, stderr);
      });
    });
  }

  shell(args) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.execPort(["shell"].concat(args)).then((stdout) => {
        if (stdout) resolve(stdout.replace("\n",""));
        else resolve();
      }).catch((error, stderr) => {
        reject(error, stderr);
      });
    });
  }
}

module.exports = Adb;

// Missing functions:
// backup
// forward
// reboot-bootloader
// bugreport
// logcat
// remount
// status-window
// connect
// get-state
// ppp
// restore
// sync
// devices
// help
// pull
// root
// uninstall
// disconnect
// install
// push
// version
// emu
// jdwp
// reboot
// sideload
// wait-for-device
