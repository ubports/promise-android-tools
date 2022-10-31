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

import { exec, spawn, ChildProcess, ExecException } from "./exec.js";
import {
  getAndroidToolPath,
  getAndroidToolBaseDir,
  Tool as BundledTool
} from "android-tools-bin";
import * as common from "./common.js";
import { Interface } from "./interface.js";
import {normalize} from "node:path"

export type ProgressCallback = (percentage: number) => void;

/** executable in PATH or path to an executable */
export type ToolString = "adb" | "fastboot" | "heimdall" | string;

export interface ToolOptions {
  tool: ToolString;

  /** extra cli args */
  extraArgs?: string[];

  /** extra environment variables */
  extraEnv?: NodeJS.ProcessEnv;

  /** set PATH environment variable */
  setPath?: boolean;

  /** tool configuration */
  config?: ToolConfig;

  /** object describing arguments */
  argsModel?: ArgsModel;

  /** signals to listen to */
  signals?: AbortSignal[];

  /** additional properties */
  [propName: string]: any;
}

/** tool configuration */
export interface ToolConfig {
  [propName: string]: any;
}

export type Arg = [string, any?, any?, string?];

/** object describing arguments */
export interface ArgsModel {
  [propName: string]: Arg;
}

/**
 * generic tool class
 */
export abstract class Tool extends Interface {
  /** bundled tool, executable in PATH, or path to an executable */
  tool: ToolString;

  /** path to a bundled executable if it has been resolved in bundle */
  executable: ToolString | string;

  /** extra cli args */
  extraArgs: string[];

  /** extra environment variables */
  extraEnv: NodeJS.ProcessEnv;

  /** tool configuration */
  abstract config: ToolConfig;

  /** object describing arguments */
  protected argsModel!: ArgsModel;

  /** environment variables */
  get env(): NodeJS.ProcessEnv {
    return { ...process.env, ...this.extraEnv };
  }

  /** cli arguments */
  get args(): string[] {
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

  constructor({
    tool,
    signals = [],
    extraArgs = [],
    extraEnv = {},
    setPath = false,
    config = {},
    argsModel = {},
    ...options
  }: ToolOptions) {
    super();
    this.tool = tool;
    this.executable = getAndroidToolPath(this.tool as BundledTool);
    this.listen(...signals);
    this.extraArgs = extraArgs;
    this.extraEnv = extraEnv;
    if (setPath) this.env.PATH = `${getAndroidToolBaseDir()}:${this.env.PATH}`;
    this.#initializeArgs(config, argsModel);
    this.applyConfig(options);
  }

  /** return a clone with a specified variation in the config options */
  _withConfig(config: typeof this.config): this {
    const ret = Object.create(this);
    ret.config = { ...this.config };
    for (const key in config) {
      if (Object.hasOwnProperty.call(config, key)) {
        ret.config[key] = config[key];
      }
    }
    return ret;
  }

  /** returns clone with variation in env vars */
  public _withEnv(env: NodeJS.ProcessEnv): this {
    const ret = Object.create(this);
    ret.extraEnv = { ...this.extraEnv };
    for (const key in env) {
      if (Object.hasOwnProperty.call(env, key)) {
        ret.extraEnv[key] = env[key];
      }
    }
    return ret;
  }

  /**
   * initialize helper functions to set every config option specified in the args model.
   * ```
   * class MyTool extends Tool {
   *   constructor() {
   *     super({
   *       config: { a: "b" },
   *       argsModel: { a: ["-a", "b"] }
   *     });
   *   }
   * }
   * const tool = new MyTool({a: "a"});
   * tool.exec("arg", "--other-flag"); // tool will be called as "tool -a a arg --other-flag"
   * tool.__a("b")exec("arg", "--other-flag"); // tool will be called as "tool arg --other-flag", because defaults are omitted
   * tool.__a("c").exec("arg", "--other-flag"); // tool will be called as "tool -a c arg --other-flag"
   * tool.exec("arg", "--other-flag"); // tool will be called as "tool -a a arg --other-flag", because the original instance is not changed
   * ```
   */
  #initializeArgs(config, argsModel): void {
    this.config = config;
    this.argsModel = argsModel;
    for (const key in this.argsModel) {
      if (Object.hasOwn(this.argsModel, key)) {
        const [_arg, defaultValue, isFlag] = this.argsModel[key];
        this[`__${key}` as `__${keyof typeof this.argsModel}`] = function (
          val: any
        ) {
          return this._withConfig({ [key]: isFlag ? !defaultValue : val });
        };
      }
    }
  }

  /** helper functions */
  [key: `__${keyof typeof this.argsModel}`]: (val?: any) => this;
  // FIXME https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
  // [Helper<ArgsModel>]!: (val: any) => this
  // type Helper<Type> = `__${string & keyof Type}`;

  /** apply config options to the tool instance */
  applyConfig(config: typeof this.config): void {
    for (const key in this.config) {
      if (
        Object.getOwnPropertyDescriptor(this.config, key)?.writable &&
        Object.hasOwn(config, key)
      ) {
        this.config[key] = config[key];
      }
    }
  }

  /** filter nullish and empty-string arguments */
  constructArgs(args: any[]): string[] {
    return [...this.args, ...args]
      .filter(arg => ![null, undefined, ""].includes(arg))
      .flat() as string[];
  }

  /**
   * Execute a command. Used for quick operations that do not require real-time data access.
   * @returns stdout
   */
  async exec(...args: (string | number | null | undefined)[]): Promise<string> {
    this.signal.throwIfAborted();
    const allArgs: string[] = this.constructArgs(args);
    const cmd = [this.tool, ...allArgs];
    return exec(this.executable, allArgs, {
      encoding: "utf8",
      signal: this.signal,
      env: this.env
    })
      .catch(({ message, code, signal, killed, stdout, stderr }) => {
        const error = { message, code, signal, killed };
        this.emit("exec", common.removeFalsy({ cmd, error, stdout, stderr }));
        throw new Error(this.handleError(error, stdout, stderr));
      })
      .then(({ stdout, stderr }) => {
        this.emit("exec", common.removeFalsy({ cmd, stdout, stderr }));
        return stdout?.trim() || stderr?.trim();
      });
  }

  /** Spawn a child process. Used for long-running operations that require real-time data access. */
  spawn(...args: (string | number | null | undefined)[]): ChildProcess {
    this.signal.throwIfAborted();
    const allArgs: string[] = this.constructArgs(args);
    const cmd = [this.tool, ...allArgs];
    this.emit("spawn:start", common.removeFalsy({ cmd }));
    const cp = spawn(this.executable, allArgs, {
      env: this.env,
      signal: this.signal
    });
    cp.on("exit", (code, signal) =>
      this.emit("spawn:exit", common.removeFalsy({ cmd, code, signal }))
    );
    cp.on("error", error =>
      this.emit("spawn:error", common.removeFalsy({ cmd, error }))
    );
    return cp;
  }

  /**
   * Parse and simplify errors
   * @returns error message
   */
  handleError(
    /** error returned by exec() hi */
    error?: ExecException | { [propName: string]: any },
    /** standard output */
    stdout?: string,
    /** standard error */
    stderr?: string
  ): string {
    if (
      stderr?.includes("Killed") ||
      stderr?.includes("killed by remote request") ||
      error?.code == "ABORT_ERR"
    ) {
      return "killed";
    } else {
      return JSON.stringify(
        common.removeFalsy({ error, stdout, stderr })
      ).replace(new RegExp(normalize(this.executable), "g"), this.tool);
    }
  }

  /** Wait for a device */
  public async wait(): Promise<string | any> {
    return new Promise(resolve => setTimeout(resolve, 2000))
      .then(() => this.hasAccess())
      .then(access => {
        if (!access) {
          this.signal.throwIfAborted();
          return this.wait();
        }
      });
  }
}
