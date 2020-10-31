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

const child_process = require("child_process");
const { getAndroidToolPath } = require("android-tools-bin");
const EventEmitter = require("events");
const { removeFalsy } = require("./common");
const { CancelablePromise } = require("cancelable-promise");

/**
 * generic tool class
 * @property {String} tool tool identifier
 * @property {String} executable tool executable path
 * @property {Array<String>} extra extra cli arguments
 * @property {Object} execOptions options for child_process.exec
 */
class Tool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tool = options?.tool;
    this.executable = getAndroidToolPath(options?.tool);
    this.extra = options?.extra || [];
    this.execOptions = options?.execOptions || {};
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
        [..._this.extra, ...args],
        _this.execOptions,
        (error, stdout, stderr) => {
          _this.emit(
            "exec",
            removeFalsy({
              cmd: [_this.tool, ..._this.extra, ...args],
              error,
              stdout,
              stderr
            })
          );
          if (error) {
            reject(new Error(_this.handleError(error, stdout, stderr)));
          } else {
            resolve(stdout?.trim());
          }
        }
      );

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
      removeFalsy({ cmd: [this.tool, ...this.extra, ...args].flat() })
    );
    const cp = child_process.spawn(
      this.executable,
      [...this.extra, ...args].flat(),
      {
        env: {
          ADB_TRACE: "rwx"
        }
      }
    );
    cp.on("exit", (code, signal) =>
      this.emit(
        "spawn:exit",
        removeFalsy({
          cmd: [this.tool, ...this.extra, ...args].flat(),
          code,
          signal
        })
      )
    );
    cp.on("error", error =>
      this.emit(
        "spawn:error",
        removeFalsy({
          cmd: [this.tool, ...this.extra, ...args].flat(),
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
}

module.exports = Tool;
