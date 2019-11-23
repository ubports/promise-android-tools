"use strict";

/*
 * Copyright (C) 2019 UBports Foundation <info@ubports.com>
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

const exec = require("child_process").exec;
const events = require("events");
const common = require("./common.js");

class Event extends events {}

const DEFAULT_EXEC = (args, callback) => {
  exec(["heimdall"].concat(args).join(" "), undefined, callback);
};
const DEFAULT_LOG = console.log;

class Heimdall {
  constructor(options) {
    this.exec = DEFAULT_EXEC;
    this.log = DEFAULT_LOG;
    this.heimdallEvent = new Event();

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

  // Find out if a device in download mode can be seen by heimdall
  hasAccess() {
    return this.execCommand(["detect"])
      .then(() => {
        return true;
      })
      .catch(error => {
        if (
          error.message.includes(
            "ERROR: Failed to detect compatible download-mode device."
          )
        ) {
          return false;
        } else {
          throw error;
        }
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
      _this.heimdallEvent.once("stop", () => {
        clearInterval(accessInterval);
        clearTimeout(accessTimeout);
        reject(new Error("stopped waiting"));
      });
    });
  }

  // Stop waiting for a device
  stopWaiting() {
    this.heimdallEvent.emit("stop");
  }
}

module.exports = Heimdall;
