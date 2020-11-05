"use strict";

/*
 * Copyright (C) 2017-2020 UBports Foundation <info@ubports.com>
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

const Adb = require("./adb.js");
const Fastboot = require("./fastboot.js");
const Heimdall = require("./heimdall.js");
const Tool = require("./tool.js");

const EventEmitter = require("events");
const { CancelablePromise } = require("cancelable-promise");

/**
 * A wrapper for Adb, Fastboot, and Heimall that returns convenient promises.
 */
class DeviceTools extends EventEmitter {
  constructor() {
    super();
    this.adb = new Adb();
    this.fastboot = new Fastboot();
    this.heimdall = new Heimdall();

    ["adb", "fastboot", "heimdall"].forEach(tool => {
      this[tool].on("exec", r => this.emit("exec", r));
      this[tool].on("spawn:start", r => this.emit("spawn:start", r));
      this[tool].on("spawn:exit", r => this.emit("spawn:exit", r));
      this[tool].on("spawn:error", r => this.emit("spawn:error", r));
    });
  }

  /**
   * Wait for a device
   * @returns {CancelablePromise<String>}
   */
  wait() {
    const _this = this;
    return new CancelablePromise(function(resolve, reject, onCancel) {
      const waitPromises = [
        _this.adb.wait(),
        _this.fastboot.wait(),
        _this.heimdall.wait()
      ];
      CancelablePromise.race(waitPromises)
        .then(state => {
          waitPromises.forEach(p => p.cancel());
          resolve(state);
        })
        .catch(() => {
          reject(new Error("no device"));
        });

      onCancel(() => waitPromises.forEach(p => p.cancel()));
    });
  }

  /**
   * Wait for a device
   * @returns {Promise<String>}
   */
  getDeviceName() {
    return Promise.any([
      this.adb.getDeviceName(),
      this.fastboot.getDeviceName(),
      this.heimdall.hasAccess().then(() => {
        throw new Error(`Can't get name from heimdall`);
      })
    ]).catch(() => {
      throw new Error("no device");
    });
  }
}

module.exports = { Adb, Fastboot, Heimdall, Tool, DeviceTools };
