// @ts-check

/*
 * Copyright (C) 2017-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2017-2022 Johannah Sprinz <hannah@ubports.com>
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

import { Adb } from "./adb.js";
import { Fastboot } from "./fastboot.js";
import { Heimdall } from "./heimdall.js";

import EventEmitter from "events";
import { HierarchicalAbortController } from "./hierarchicalAbortController.js";

/**
 * A wrapper for Adb, Fastboot, and Heimall that returns convenient promises.
 * @property {HierarchicalAbortController} abortController abort controller
 */
export class DeviceTools extends EventEmitter {
  /**
   * @param {Object} param0
   * @param {ToolOptions} param0.adbOptions
   * @param {ToolOptions} param0.fastbootOptions
   * @param {ToolOptions} param0.heimdallOptions
   * @param {AbortSignal[]} param0.signals
   */
  constructor({
    adbOptions = {},
    fastbootOptions = {},
    heimdallOptions = {},
    signals = []
  }) {
    super();
    this.abortController = new HierarchicalAbortController(...signals);
    signals = [this.abortController.signal];
    this.adb = new Adb({ ...adbOptions, signals });
    this.fastboot = new Fastboot({ ...fastbootOptions, signals });
    this.heimdall = new Heimdall({ ...heimdallOptions, signals });

    ["adb", "fastboot", "heimdall"].forEach(tool => {
      this[tool].on("exec", r => this.emit("exec", r));
      this[tool].on("spawn:start", r => this.emit("spawn:start", r));
      this[tool].on("spawn:exit", r => this.emit("spawn:exit", r));
      this[tool].on("spawn:error", r => this.emit("spawn:error", r));
    });
  }

  /**
   * Terminate all child processes with extreme prejudice.
   */
  kill() {
    ["adb", "fastboot", "heimdall"].forEach(tool => {
      this[tool].kill();
    });
  }

  /**
   * Wait for a device
   * @returns {Promise<String>}
   */
  wait() {
    const _this = this;
    return new Promise(function (resolve, reject) {
      const waitPromises = [
        _this.adb.wait(),
        _this.fastboot.wait(),
        _this.heimdall.wait()
      ];
      Promise.race(waitPromises)
        .then(state => {
          waitPromises.forEach(p => "p.cancel()"); //FIXME;
          resolve(state);
        })
        .catch(() => {
          reject(new Error("no device"));
        });

      // onCancel(() => waitPromises.forEach(p => p.cancel()));
    });
  }

  /**
   * Resolve device name
   * @returns {Promise<String>}
   */
  getDeviceName() {
    // TODO support heimdall
    return this.adb
      .getDeviceName()
      .catch(() => this.fastboot.getDeviceName())
      .catch(() => {
        throw new Error("no device");
      });
  }
}

export { Adb } from "./adb.js";
export { Fastboot } from "./fastboot.js";
export { Heimdall } from "./heimdall.js";
export { Tool } from "./tool.js";
