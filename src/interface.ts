/*
 * Copyright (C) 2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2022 Johannah Sprinz <hannah@ubports.com>
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

import { EventEmitter } from "node:events";
import { use } from "typescript-mix";
import { HierarchicalAbortController } from "./hierarchicalAbortController.js";

/** HACK upstream definitions are incomplete */
export declare var AbortSignal: {
  prototype: AbortSignal;
  new (): AbortSignal;
  timeout(msecs: number): AbortSignal;
  abort(): AbortSignal;
};

export interface Interface extends EventEmitter, HierarchicalAbortController {
  on(
    eventName: "exec",
    listener: (e: {
      cmd: string[];
      error?: Error;
      stdout?: string;
      stderr?: string;
    }) => void
  ): this;
  on(eventName: "spawn:start", listener: (e: { cmd: string[] }) => void): this;
  on(
    eventName: "spawn:exit",
    listener: (e: { cmd: string[]; error?: Error }) => void
  ): this;
  on(
    eventName: "spawn:error",
    listener: (e: { cmd: string[]; error: Error }) => void
  ): this;
}
export class Interface extends HierarchicalAbortController {
  @use(EventEmitter, HierarchicalAbortController)
  this!: Interface;

  /** returns clone listening to additional AbortSignals */
  public _withSignals(...signals: AbortSignal[]): this {
    const ret = Object.create(this);
    Object.defineProperty(ret, "signal", {
      value: new HierarchicalAbortController(this.signal, ...signals).signal
    });
    return ret;
  }

  /** returns clone that will time out after the spelistening to an additional timeout abortSignal */
  public _withTimeout(msecs = 1000): this {
    return this._withSignals(AbortSignal.timeout(msecs));
  }

  /**
   * returns clone with variation in env vars
   * @virtual
   */
  protected _withEnv?(env: NodeJS.ProcessEnv): this;

  /**
   * Find out if a device can be seen
   * @virtual
   */
  protected async hasAccess(): Promise<boolean> {
    return false;
  }

  /**
   * Wait for a device
   * @virtual
   */
  protected async wait?(): Promise<string | any>;

  /**
   * Resolve device name
   * @virtual
   */
  protected async getDeviceName?(): Promise<string>;
}
