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

import child_process, { ChildProcess } from "child_process";
import EventEmitter from "events";
import { getAndroidToolPath, getAndroidToolBaseDir } from "android-tools-bin";
import * as common from "./common.js";
import assert from "assert";
import { HierarchicalAbortController } from "./hierarchicalAbortController.js";

/**
 * generic tool class
 * @property {String} tool tool identifier
 * @property {String} executable tool executable path
 * @property {Array<String>} extra extra cli arguments
 * @property {NodeJS.ProcessEnv} extraEnv extra environment variables
 * @property {Config} config tool configuration
 * @property {Array<String>} extraArgs extra cli arguments
 * @property {ArgsModel} argsModel object describing arguments
 * @property {HierarchicalAbortController} abortController abortSignal
 */
export class Tool extends EventEmitter {
  /** @type {Array<ChildProcess>} array of all running processes */
  processes = [];

  /** @type {Object.<string, string|undefined>} environment variables */
  get env() {
    return { ...process.env, ...this.extraEnv };
  }

  /** @type {Array<String>} cli arguments */
  get args() {
    return [
      ...this.extraArgs,
      ...Object.entries(this.argsModel).map(
        ([key, [flag, defaultValue, noArgs, overrideKey]]) =>
          this.config[key] !== defaultValue
            ? noArgs
              ? [flag]
              : [flag, this.config[overrideKey || key]]
            : []
      )
    ].flat();
  }

  /** @param {ToolOptions} param0 */
  constructor({
    tool,
    signals = [],
    extraArgs = [],
    extraEnv = {
      ADB_TRACE: "rwx"
    },
    setPath = false,
    config = {},
    argsModel = {},
    ...options
  }) {
    super();
    assert(tool, "tool option is required");
    this.tool = tool;
    this.executable = getAndroidToolPath(this.tool);
    this.abortController = new HierarchicalAbortController(...signals);
    this.extraArgs = extraArgs;
    this.extraEnv = extraEnv;
    if (setPath) this.env.PATH = `${getAndroidToolBaseDir()}:${this.env.PATH}`;
    this.config = config;
    this.argsModel = argsModel;
    this.applyConfig(options);
    this.initializeArgs();
  }

  /**
   * @param {...AbortSignal} signals
   */
  _withSignals(...signals) {
    const ret = Object.create(this);
    ret.abortController = new HierarchicalAbortController(
      this.abortController.signal,
      ...signals
    );
    ret.abortController.signal.addEventListener("abort", () =>
      console.log("aborted")
    );
    return ret;
  }

  _withTimeout(msecs = 1000) {
    return this._withSignals(AbortSignal.timeout(msecs));
  }

  /**
   * return a clone of the current instance with a specified variation in the config options
   * @param {Object} options object to override config
   * @returns {Tool}
   */
  _withConfig(options) {
    const ret = Object.create(this);
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
   *   argsModel = { a: ["-a", "b"] }
   *   constructor() { this.initializeArgs(); }
   * }
   * const tool = new MyTool({a: "a"});
   * tool.exec("arg", "--other-flag"); // tool will be called as "tool -a a arg --other-flag"
   * tool.__a("b")exec("arg", "--other-flag"); // tool will be called as "tool arg --other-flag", because defaults are omitted
   * tool.__a("c").exec("arg", "--other-flag"); // tool will be called as "tool -a c arg --other-flag"
   * tool.exec("arg", "--other-flag"); // tool will be called as "tool -a a arg --other-flag", because the original instance is not changed
   * ```
   * @internal
   */
  initializeArgs() {
    for (const key in this.argsModel) {
      if (Object.hasOwn(this.argsModel, key)) {
        this[`__${key}`] = function (val) {
          return this._withConfig({ [key]: val });
        };
      }
    }
  }

  /**
   * apply config options to the tool instance
   * @param {Config} options tool configuration config options
   */
  applyConfig(options) {
    if (!options) return;
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
   * @internal
   * @returns {Promise<String>} stdout
   */
  exec(...args) {
    const _this = this;
    return new Promise((resolve, reject) => {
      const cp = child_process.execFile(
        _this.executable,
        [..._this.args, ...args],
        {
          encoding: "utf8",
          signal: this.abortController.signal,
          env: this.env
        },
        (error, stdout, stderr) => {
          _this.emit(
            "exec",
            common.removeFalsy({
              cmd: [_this.tool, ..._this.args, ...args],
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

      // onCancel(() => {
      //   if (!cp.kill("SIGTERM")) {
      //     setTimeout(() => {
      //       cp.kill("SIGKILL");
      //     }, 25);
      //   }
      // });
    });
  }

  /**
   * Spawn a child process. Used for long-running operations that require real-time data access.
   * @param  {...any} args tool arguments
   * @internal
   * @returns {child_process.ChildProcess}
   */
  spawn(...args) {
    this.emit(
      "spawn:start",
      common.removeFalsy({ cmd: [this.tool, ...this.args, ...args].flat() })
    );
    const cp = child_process.spawn(
      this.executable,
      [...this.args, ...args].flat(),
      {
        env: this.env,
        signal: this.abortController.signal
      }
    );
    this.processes.push(cp);
    cp.on("exit", (code, signal) => {
      this.processes.splice(this.processes.indexOf(cp), 1);
      this.emit(
        "spawn:exit",
        common.removeFalsy({
          cmd: [this.tool, ...this.args, ...args].flat(),
          code,
          signal
        })
      );
    });
    cp.on("error", error =>
      this.emit(
        "spawn:error",
        common.removeFalsy({
          cmd: [this.tool, ...this.args, ...args].flat(),
          error
        })
      )
    );
    return cp;
  }

  /**
   * Generate processable error messages from child_process.exec() callbacks   * * @param {common.ExecException} error error returned by child_process.exec()
   * @param {String} stdout stdandard output
   * @param {String} stderr standard error
   * @internal
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
        common.removeFalsy({
          error: common.removeFalsy(error),
          stdout: stdout?.trim(),
          stderr: stderr?.trim()
        })
      ).replace(new RegExp(this.executable, "g"), this.tool);
    }
  }

  /**
   * Find out if a device can be seen
   * @virtual
   * @returns {Promise<Boolean>} access?
   */
  hasAccess() {
    return Promise.reject(new Error("virtual"));
  }

  /**
   * Wait for a device
   * @returns {Promise}
   */
  wait() {
    var _this = this;
    return new Promise(function (resolve, reject) {
      let timeout;
      function poll() {
        _this
          .hasAccess()
          .then(access => {
            if (access) {
              clearTimeout(timeout);
              resolve(null);
            } else {
              timeout = setTimeout(poll, 2000);
            }
          })
          .catch(error => {
            clearTimeout(timeout);
            reject(error);
          });
      }
      // onCancel(() => {
      //   clearTimeout(timeout);
      // });
      poll();
    });
  }
}
