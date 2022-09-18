// @ts-check

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

import * as common from "./common.js";
import { Tool } from "./tool.js";

/**
 * heimdall: flash firmware on samsung devices
 */
export class Heimdall extends Tool {
  constructor(options) {
    super({ tool: "heimdall", ...options });
  }

  /**
   * Generate processable error messages from child_process.exec() callbacks
   * @param {common.ExecException} error error returned by child_process.exec()
   * @param {String} stdout stdandard output
   * @param {String} stderr standard error
   * @returns {String} error message
   */
  handleError(error, stdout, stderr) {
    if (
      stderr?.includes(
        "ERROR: Failed to detect compatible download-mode device."
      )
    ) {
      return "no device";
    } else {
      return super.handleError(error, stdout, stderr);
    }
  }

  /**
   * Find out if a device in download mode can be seen by heimdall
   * @returns {Promise<Boolean>}
   */
  detect() {
    return this.hasAccess();
  }

  /**
   * Find out if a device in download mode can be seen by heimdall
   * @returns {Promise<Boolean>}
   */
  hasAccess() {
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

  /**
   * Wait for a device
   * @returns {Promise<String>}
   */
  wait() {
    return super.wait().then(() => "download");
  }

  /**
   * Prints the contents of a PIT file in a human readable format. If a filename is not provided then Heimdall retrieves the PIT file from the connected device.
   * @param {String} [file] pit file to print
   * @returns {Promise<string[]>}
   */
  printPit(file) {
    return this.exec("print-pit", ...(file ? ["--file", file] : []))
      .then(r =>
        r
          .split("\n\nEnding session...")[0]
          .split(/--- Entry #\d ---/)
          .slice(1)
          .map(r => r.trim())
      )
      .catch(error => {
        throw error;
      });
  }

  /**
   * get partitions from pit file
   * @returns {Promise<{}[]>}
   */
  getPartitions() {
    return this.printPit().then(r =>
      r.map(r =>
        r
          .split("\n")
          .map(r => r.split(":").map(r => r.trim()))
          .reduce((result, item) => {
            result[item[0]] = item[1];
            return result;
          }, {})
      )
    );
  }

  /**
   * @typedef HeimdallFlashImage
   * @property {String} partition partition to flash
   * @property {String} file path to an image file
   */

  /**
   * Flash firmware files to partitions (names or identifiers)
   * @param {Array<HeimdallFlashImage>} images Images to flash
   * @returns {Promise}
   */
  flash(images) {
    // TODO report progress similar to fastboot.flash()
    return this.exec(
      "flash",
      ...images.map(i => [`--${i.partition}`, i.file]).flat()
    ).then(() => null);
  }
}
