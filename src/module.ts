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

import { ActualDeviceState, Adb, AdbOptions } from "./adb.js";
import { Fastboot, FastbootOptions } from "./fastboot.js";
import { Heimdall, HeimdallOptions } from "./heimdall.js";

import { Interface } from "./interface.js";

interface DeviceToolsOptions {
  adbOptions?: AdbOptions;
  fastbootOptions?: FastbootOptions;
  heimdallOptions?: HeimdallOptions;
  signals?: AbortSignal[];
}

/** A wrapper for Adb, Fastboot, and Heimall that returns convenient promises. */
export class DeviceTools extends Interface {
  adb: Adb;
  fastboot: Fastboot;
  heimdall: Heimdall;

  constructor({
    adbOptions = {},
    fastbootOptions = {},
    heimdallOptions = {},
    signals = []
  }: DeviceToolsOptions) {
    super(...signals);
    signals = [this.signal];
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

  /** returns clone with variation in env vars */
  _withEnv(env: NodeJS.ProcessEnv): this {
    const ret = Object.create(this);
    ret.adb = this.adb._withEnv(env);
    ret.fastboot = this.fastboot._withEnv(env);
    ret.heimdall = this.heimdall._withEnv(env);
    return ret;
  }

  /** Wait for a device */
  wait(): Promise<ActualDeviceState | "bootloader" | "download"> {
    const controller = new AbortController();
    const _this = this._withSignals(controller.signal);
    return Promise.race([
      _this.adb.wait(),
      _this.fastboot.wait(),
      _this.heimdall.wait()
    ]).finally(() => controller.abort());
  }

  /** Resolve device name */
  getDeviceName(): Promise<string> {
    // TODO support heimdall
    return this.adb
      .getDeviceName()
      .catch(() => this.fastboot.getDeviceName())
      .catch(() => {
        throw new Error("no device");
      });
  }
}

export { Adb, AdbOptions } from "./adb.js";
export { Fastboot, FastbootOptions } from "./fastboot.js";
export { Heimdall, HeimdallOptions } from "./heimdall.js";
export { Tool, ToolOptions } from "./tool.js";
export { HierarchicalAbortController } from "./hierarchicalAbortController.js";
