/*
 * Copyright (C) 2019-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2019-2022 Johannah Sprinz <hannah@ubports.com>
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

import { Tool, ToolError, ToolOptions } from "./tool.js";

export type HeimdallOptions = ToolOptions | {};
export interface HeimdallConfig {}

export class HeimdallError extends ToolError {
  get message(): string {
    if (this.stderr?.includes("Failed to detect")) {
      return "no device";
    } else {
      return super.message;
    }
  }
}

/** heimdall: flash firmware on samsung devices */
export class Heimdall extends Tool {
  config!: HeimdallConfig;

  constructor(options: HeimdallOptions = {}) {
    super({ tool: "heimdall", Error: HeimdallError, ...options });
  }

  /** Find out if a device in download mode can be seen by heimdall */
  detect(): Promise<boolean> {
    return this.hasAccess();
  }

  /** Find out if a device in download mode can be seen by heimdall */
  hasAccess(): Promise<boolean> {
    return this.exec("detect")
      .then(() => true)
      .catch(error => {
        if (error.message.includes("no device")) {
          return false;
        } else {
          throw error;
        }
      });
  }

  /** Wait for a device */
  wait(): Promise<"download"> {
    return super.wait().then(() => "download");
  }

  /** Prints the contents of a PIT file in a human readable format. If a filename is not provided then Heimdall retrieves the PIT file from the connected device. */
  printPit(file?: string): Promise<string[]> {
    return this.exec("print-pit", ...(file ? ["--file", file] : [])).then(r =>
      r
        .split("\n\nEnding session...")[0]
        .split(/--- Entry #\d ---/)
        .slice(1)
        .map(r => r.trim())
    );
  }

  /** get partitions from pit file */
  getPartitions(): Promise<{}[]> {
    return this.printPit().then(r =>
      r.map(r =>
        r
          .split("\n")
          .map(r => r.split(":").map(r => r.trim()))
          .reduce((result, item) => {
            result[item[0]] = item[1];
            return result;
          }, {} as { [k: string]: string })
      )
    );
  }

  /** Flash firmware files to partitions (names or identifiers) */
  flash(images: { partition: string; file: string }[]): Promise<void> {
    // TODO report progress similar to fastboot.flash()
    return this.exec(
      "flash",
      ...images.map(i => [`--${i.partition}`, i.file]).flat()
    ).then(() => {});
  }
}
