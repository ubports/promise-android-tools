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
            new Error(
              common.handleError(
                error,
                stdout,
                stderr ? stderr.trim() : undefined
              )
            )
          );
        else if (stdout) resolve(stdout.trim());
        else resolve();
      });
    });
  }

  flash(partition, file, force = false, raw = false) {
    return this.execCommand([
      raw ? "flash:raw" : "flash",
      partition,
      ...(force ? ["--force"] : []),
      common.quotepath(file)
    ])
      .then(stdout => {
        return;
      })
      .catch(error => {
        throw new Error("flashing failed: " + error);
      });
  }

  flashRaw(partition, file, force = false) {
    return this.flash(partition, file, force, true);
  }

  boot(image) {
    return this.execCommand(["boot", common.quotepath(image)])
      .then(stdout => {
        return;
      })
      .catch(error => {
        throw new Error("booting failed: " + error);
      });
  }

  update(image, wipe) {
    return this.execCommand([
      wipe ? "-w" : "",
      "update",
      common.quotepath(image)
    ])
      .then(stdout => {
        return;
      })
      .catch(error => {
        throw new Error("update failed: " + error);
      });
  }

  rebootBootloader() {
    return this.execCommand(["reboot-bootloader"])
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("rebooting to bootloader failed: " + error);
      });
  }

  reboot() {
    return this.execCommand(["reboot"])
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("rebooting failed: " + error);
      });
  }

  continue() {
    return this.execCommand(["continue"])
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("continuing boot failed: " + error);
      });
  }

  format(partition, type, size) {
    if (!type && size) {
      return Promise.reject(
        new Error(
          "formatting failed: size specification requires type to be specified as well"
        )
      );
    }
    return this.execCommand([
      `format${type ? ":" + type : ""}${size ? ":" + size : ""}`,
      partition
    ])
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("formatting failed: " + error);
      });
  }

  erase(partition) {
    return this.execCommand(["erase", partition])
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("erasing failed: " + error);
      });
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  oemUnlock() {
    return this.execCommand(["oem", "unlock"])
      .then(() => {
        return;
      })
      .catch(error => {
        if (
          error &&
          (error.message.includes("FAILED (remote: Already Unlocked)") ||
            error.message.includes("FAILED (remote: 'Not necessary')"))
        )
          return;
        else throw new Error("oem unlock failed: " + error);
      });
  }

  oemLock() {
    return this.execCommand(["oem", "lock"])
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("oem lock failed: " + error);
      });
  }

  // Flash image to a partition
  // [ {partition, file, force, raw} ]
  flashArray(images) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      function flashNext(i) {
        _this
          .flash(
            images[i].partition,
            images[i].file,
            images[i].force,
            images[i].raw
          )
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
    return this.execCommand(["devices"])
      .then(stdout => {
        return Boolean(stdout && stdout.includes("fastboot"));
      })
      .catch(error => {
        throw error;
      });
  }

  // Wait for a device
  waitForDevice(interval, timeout) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      const accessInterval = setInterval(() => {
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
      const accessTimeout = setTimeout(() => {
        clearInterval(accessInterval);
        reject(new Error("no device: timeout"));
      }, timeout || 60000);
      _this.fastbootEvent.once("stop", () => {
        clearInterval(accessInterval);
        clearTimeout(accessTimeout);
        reject(new Error("stopped waiting"));
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
