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

import child_process from "child_process";
import { getAndroidToolPath } from "android-tools-bin";
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
  constructor(options = {}) {
    super();
    this.tool = options?.tool;
    this.executable = getAndroidToolPath(options?.tool);
    this.extra = options?.extra || [];
    this.execOptions = options?.execOptions || {};
    this.processes = [];
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
        [..._this.extra, ...args],
        _this.execOptions,
        (error, stdout, stderr) => {
          _this.emit(
            "exec",
            removeFalsy({
              cmd: [_this.tool, ..._this.extra, ...args],
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
    this.processes.push(cp);
    cp.on("exit", (code, signal) => {
      this.processes.splice(this.processes.indexOf(cp), 1);
      this.emit(
        "spawn:exit",
        removeFalsy({
          cmd: [this.tool, ...this.extra, ...args].flat(),
          code,
          signal
        })
      );
    });
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
    return new CancelablePromise(function(resolve, reject, onCancel) {
      let timeout;
      let stop;
      function poll() {
        if (!stop) {
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
              if (error) {
                clearTimeout(timeout);
                reject(error);
              }
            });
        } else {
          clearTimeout(timeout);
        }
      }
      onCancel(() => {
        clearTimeout(timeout);
        stop = true;
      });
      poll();
    });
  }
}
