"use strict";

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

import child_process from "child_process";
import { getAndroidToolPath, getAndroidToolBaseDir } from "android-tools-bin";
import EventEmitter from "events";
import { removeFalsy } from "./common.js";
import { CancelablePromise } from "./cancelable-promise.js";

/**
 * generic tool class
 * @property {String} tool tool identifier
 * @property {String} executable tool executable path
 * @property {Array<String>} extra extra cli arguments
 * @property {Object} execOptions options for child_process.exec
 */
export class Tool extends EventEmitter {
  tool;
  config = {};
  flagsModel = {};

  get flags() {
    return [
      ...this.extra,
      ...Object.entries(this.flagsModel).map(
        ([key, [flag, defaultValue, noArgs, overrideKey]]) =>
          this.config[key] !== defaultValue
            ? noArgs
              ? [flag]
              : [flag, this.config[overrideKey || key]]
            : []
      )
    ].flat();
  }

  constructor(options = {}) {
    super();
    this.tool = options?.tool;
    this.executable = getAndroidToolPath(options?.tool);
    this.extra = options?.extra || [];
    this.execOptions = options?.execOptions || {};
    this.processes = [];
    if (
      options.setPath &&
      process.env.PATH &&
      !process.env.PATH.includes(getAndroidToolBaseDir())
    )
      process.env.PATH = `${getAndroidToolBaseDir()}:${process.env.PATH}`;
  }

  /**
   * return a clone of the current instance with a specified variation in the config options
   * @param {Object} options object to override config
   * @returns {Tool}
   */
  _withConfig(options) {
    const ret = Object.create(this, Tool);
    ret.config = { ...this.config };
    for (const key in options) {
      if (Object.hasOwnProperty.call(options, key)) {
        ret.config[key] = options[key];
      }
    }
    return ret;
  }

  /**
   * initialize helper functions to set every config option specified in the flags model.
   * ```
   * class MyTool extends Tool {
   *   config = { a: "b" }
   *   flagsModel = { a: ["-a", "b"] }
   *   constructor() { this.initializeFlags(); }
   * }
   * const tool = new MyTool({a: "a"});
   * tool.exec("arg", "--other-flag"); // tool will be called as "tool -a a arg --other-flag"
   * tool.__a("b")exec("arg", "--other-flag"); // tool will be called as "tool arg --other-flag", because defaults are omitted
   * tool.__a("c").exec("arg", "--other-flag"); // tool will be called as "tool -a c arg --other-flag"
   * tool.exec("arg", "--other-flag"); // tool will be called as "tool -a a arg --other-flag", because the original instance is not changed
   * ```
   * @private
   */
  initializeFlags() {
    for (const key in this.flagsModel) {
      if (Object.hasOwn(this.flagsModel, key)) {
        this[`__${key}`] = function (val) {
          return this._withConfig({ [key]: val });
        };
      }
    }
  }

  /**
   * apply config options to the tool instance
   * @param {Object} options config options
   */
  applyConfig(options) {
    for (const key in this.config) {
      if (
        Object.getOwnPropertyDescriptor(this.config, key)?.writable &&
        Object.hasOwn(options, key)
      ) {
        this.config[key] = options[key];
      }
    }
  }

  /**
   * Terminate all child processes with extreme prejudice.
   */
  kill() {
    this.processes.forEach(child => child.kill()); // HE EVEN KILLED THE YOUNGLINGS
  }

  /**
   * Execute a command. Used for short operations and operations that do not require real-time data access.
   * @param  {...any} args tool arguments
   * @private
   * @returns {CancelablePromise<String>} stdout
   */
  exec(...args) {
    const _this = this;
    return new CancelablePromise((resolve, reject, onCancel) => {
      const cp = child_process.execFile(
        _this.executable,
        [..._this.flags, ...args],
        _this.execOptions,
        (error, stdout, stderr) => {
          _this.emit(
            "exec",
            removeFalsy({
              cmd: [_this.tool, ..._this.flags, ...args],
              error: error
                ? {
                    message: error?.message
                      ?.replace(new RegExp(this.executable, "g"), this.tool)
                      .trim(),
                    code: error?.code,
                    signal: error?.signal,
                    killed: error?.killed
                  }
                : null,
              stdout: stdout?.trim(),
              stderr: stderr?.trim()
            })
          );
          if (error) {
            reject(new Error(_this.handleError(error, stdout, stderr)));
          } else {
            resolve(stdout?.trim() || stderr?.trim());
            this.processes.splice(this.processes.indexOf(cp), 1);
          }
        }
      );

      this.processes.push(cp);

      onCancel(() => {
        if (!cp.kill("SIGTERM")) {
          setTimeout(() => {
            cp.kill("SIGKILL");
          }, 25);
        }
      });
    });
  }

  /**
   * Spawn a child process. Used for long-running operations that require real-time data access.
   * @param  {...any} args tool arguments
   * @private
   * @returns {child_process.ChildProcess}
   */
  spawn(...args) {
    this.emit(
      "spawn:start",
      removeFalsy({ cmd: [this.tool, ...this.flags, ...args].flat() })
    );
    const cp = child_process.spawn(
      this.executable,
      [...this.flags, ...args].flat(),
      {
        env: {
          ...process.env,
          ADB_TRACE: "rwx"
        }
      }
    );
    this.processes.push(cp);
    cp.on("exit", (code, signal) => {
      this.processes.splice(this.processes.indexOf(cp), 1);
      this.emit(
        "spawn:exit",
        removeFalsy({
          cmd: [this.tool, ...this.flags, ...args].flat(),
          code,
          signal
        })
      );
    });
    cp.on("error", error =>
      this.emit(
        "spawn:error",
        removeFalsy({
          cmd: [this.tool, ...this.flags, ...args].flat(),
          error
        })
      )
    );
    return cp;
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
      stderr?.includes("Killed") ||
      stderr?.includes("killed by remote request")
    ) {
      return "killed";
    } else {
      return JSON.stringify(
        removeFalsy({
          error: removeFalsy(error),
          stdout: stdout?.trim(),
          stderr: stderr?.trim()
        })
      ).replace(new RegExp(this.executable, "g"), this.tool);
    }
  }

  /**
   * Find out if a device can be seen
   * @virtual
   * @returns {CancelablePromise<Boolean>} access?
   */
  hasAccess() {
    return CancelablePromise.reject(new Error("virtual"));
  }

  /**
   * Wait for a device
   * @returns {CancelablePromise}
   */
  wait() {
    var _this = this;
    return new CancelablePromise(function (resolve, reject, onCancel) {
      let timeout;
      function poll() {
        _this
          .hasAccess()
          .then(access => {
            if (access) {
              clearTimeout(timeout);
              resolve();
            } else {
              timeout = setTimeout(poll, 2000);
            }
          })
          .catch(error => {
            clearTimeout(timeout);
            reject(error);
          });
      }
      onCancel(() => {
        clearTimeout(timeout);
      });
      poll();
    });
  }
}
