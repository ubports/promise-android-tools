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
const exec = require("child_process").exec;
const events = require("events");
const common = require("./common.js");

class Event extends events {}

const DEFAULT_EXEC = (args, callback) => {
  exec(["fastboot"].concat(args).join(" "), undefined, callback);
};
const DEFAULT_LOG = console.log;

class Fastboot {
  constructor(options) {
    this.exec = DEFAULT_EXEC;
    this.log = DEFAULT_LOG;
    this.fastbootEvent = new Event();

    if (options) {
      if (options.exec) this.exec = options.exec;
      if (options.log) this.log = options.log;
    }
  }

  // Exec a command
  execCommand(args) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.exec(args, (error, stdout, stderr) => {
        if (error)
          reject(
            common.handleError(
              error,
              stdout,
              stderr ? stderr.trim() : undefined
            )
          );
        else if (stdout) resolve(stdout.trim());
        else resolve();
      });
    });
  }

  flash(partition, file) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["flash", partition, file])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("flashing failed: " + error);
        });
    });
  }

  boot(image) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["boot", image])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("booting failed: " + error);
        });
    });
  }

  update(image, wipe) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand([wipe ? "-w" : "", "update", image])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("update failed: " + error);
        });
    });
  }

  rebootBootloader() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["reboot-bootloader"])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("rebooting to bootloader failed: " + error);
        });
    });
  }

  reboot() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["reboot"])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("rebooting failed: " + error);
        });
    });
  }

  continue() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["continue"])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("continuing boot failed: " + error);
        });
    });
  }

  format(partition) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["format", partition])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("formatting failed: " + error);
        });
    });
  }

  erase(partition) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["erase", partition])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("erasing failed: " + error);
        });
    });
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  oemUnlock() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["oem", "unlock"])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          if (error && error.includes("FAILED (remote: Already Unlocked)"))
            resolve();
          else reject("oem unlock failed: " + error);
        });
    });
  }

  oemLock() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["oem", "lock"])
        .then(stdout => {
          resolve();
        })
        .catch(error => {
          reject("oem lock failed: " + error);
        });
    });
  }

  // Flash image to a partition
  // [ {partition, file} ]
  flashArray(images) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      function flashNext(i) {
        _this
          .flash(images[i].partition, images[i].file)
          .then(() => {
            if (i + 1 < images.length) flashNext(i + 1);
            else resolve();
          })
          .catch(error => {
            reject(error);
          });
      }
      flashNext(0);
    });
  }

  // Find out if a device can be seen by fastboot
  hasAccess() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["devices"])
        .then(stdout => {
          if (stdout && stdout.includes("fastboot")) resolve(true);
          else resolve(false);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  // Wait for a device
  waitForDevice(interval, timeout) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      let accessInterval = setInterval(() => {
        _this
          .hasAccess()
          .then(access => {
            if (access) {
              clearInterval(accessInterval);
              clearTimeout(accessTimeout);
              resolve();
            }
          })
          .catch(error => {
            if (error) {
              clearInterval(accessInterval);
              clearTimeout(accessTimeout);
              reject(error);
            }
          });
      }, interval || 2000);
      let accessTimeout = setTimeout(() => {
        clearInterval(accessInterval);
        reject("no device: timeout");
      }, timeout || 60000);
      _this.fastbootEvent.once("stop", () => {
        clearInterval(accessInterval);
        clearTimeout(accessTimeout);
        reject("stopped waiting");
      });
    });
  }

  // Stop waiting for a device
  stopWaiting() {
    this.fastbootEvent.emit("stop");
  }
}

module.exports = Fastboot;

// Missing functions
// getvar
// oem
// devices
// flashall
