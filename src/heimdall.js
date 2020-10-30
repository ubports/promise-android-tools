"use strict";

/*
 * Copyright (C) 2019-2020 UBports Foundation <info@ubports.com>
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

const events = require("events");
const common = require("./common.js");
const Tool = require("./tool.js");

class Event extends events {}

/**
 * heimdall: flash firmware on samsung devices
 */
class Heimdall extends Tool {
  constructor(options) {
    super({
      tool: "heimdall",
      ...options
    });
    this.heimdallEvent = new Event();
  }

  /**
   * Find out if a device in download mode can be seen by heimdall
   * @returns {Promise<Boolean>}
   */
  detect() {
    return this.hasAccess();
  }

  /**
   * Generate processable error messages from child_process.exec() callbacks
   * @param {child_process.ExecException} error error returned by child_process.exec()
   * @param {String} stdout stdandard output
   * @param {String} stderr standard error
   * @private
   * @returns {String} error message
   */
  handleError(error, stdout, stderr) {
    if (
      stderr?.includes(
        "ERROR: Failed to detect compatible download-mode device."
      )
    ) {
      return "no device";
    } else {
      return super.handleError(error, stdout, stderr);
    }
  }

  /**
   * Find out if a device in download mode can be seen by heimdall
   * @returns {Promise<Boolean>}
   */
  hasAccess() {
    return this.exec("detect")
      .then(() => true)
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

  /**
   * Wait for a device
   * @param {Integer} interval how often to try
   * @param {Integer} timeout how long to try
   */
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

  /**
   * Stop waiting for a device
   */
  stopWaiting() {
    this.heimdallEvent.emit("stop");
  }

  /**
   * Prints the contents of a PIT file in a human readable format. If a filename is not provided then Heimdall retrieves the PIT file from the connected device.
   * @param {String} file pit file to print
   * @returns {Promise<String>}
   */
  printPit(file) {
    return this.exec(
      "print-pit",
      ...(file ? ["--file", common.quotepath(file)] : [])
    )
      .then(r =>
        r
          .split("\n\nEnding session...")[0]
          .split(/--- Entry #\d ---/)
          .slice(1)
          .map(r => r.trim())
      )
      .catch(error => {
        throw error;
      });
  }

  /**
   * get partitions from pit file
   * @returns {Promise<String>}
   */
  getPartitions() {
    return this.printPit().then(r =>
      r.map(r =>
        r
          .split("\n")
          .map(r => r.split(":").map(r => r.trim()))
          .reduce((result, item) => {
            result[item[0]] = item[1];
            return result;
          }, {})
      )
    );
  }

  /**
   * Flashes a firmware file to a partition (name or identifier)
   * @param {String} partition partition name
   * @param {String} file image file
   * @returns {Promise}
   */
  flash(partition, file) {
    return this.flashArray([{ partition, file }]);
  }

  /**
   * Flash firmware files to partitions (names or identifiers)
   * @param {Array<Object>} images [ {partition, file} ]
   * @returns {Promise}
   */
  flashArray(images) {
    return this.exec(
      "flash",
      ...images.map(i => `--${i.partition} ${common.quotepath(i.file)}`)
    )
      .then(() => null)
      .catch(error => {
        throw error;
      });
  }
}

module.exports = Heimdall;
