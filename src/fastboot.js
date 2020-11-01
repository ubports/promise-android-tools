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

const common = require("./common.js");
const Tool = require("./tool.js");

/**
 * fastboot android flashing and booting utility
 */
class Fastboot extends Tool {
  constructor(options) {
    super({
      tool: "fastboot",
      ...options
    });
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
      stderr?.includes("FAILED (remote: low power, need battery charging.)")
    ) {
      return "low battery";
    } else if (
      stderr?.includes("not supported in locked device") ||
      stderr?.includes("Bootloader is locked") ||
      stderr?.includes("not allowed in locked state") ||
      stderr?.includes("Device not unlocked cannot flash or erase")
    ) {
      return "bootloader is locked";
    } else if (
      stderr?.includes("Check 'Allow OEM Unlock' in Developer Options") ||
      stderr?.includes("Unlock operation is not allowed") ||
      stderr?.includes("oem unlock is not allowed")
    ) {
      return "enable unlocking";
    } else if (stderr?.includes("FAILED (remote failure)")) {
      return "failed to boot";
    } else if (
      stderr?.includes("I/O error") ||
      stderr?.includes("FAILED (command write failed (No such device))") ||
      stderr?.includes("FAILED (command write failed (Success))") ||
      stderr?.includes("FAILED (status read failed (No such device))") ||
      stderr?.includes("FAILED (data transfer failure (Broken pipe))") ||
      stderr?.includes("FAILED (data transfer failure (Protocol error))")
    ) {
      return "no device";
    } else {
      return super.handleError(error, stdout, stderr);
    }
  }

  /**
   * Write a file to a flash partition
   * @param {String} partition partition to flash
   * @param {String} file path to an image file
   * @param {Boolean} [raw=false] use flash:raw
   * @param  {...any} [flags] additional cli-flags like --force and --disable-verification
   * @returns {Promise}
   */
  flash(partition, file, raw = false, ...flags) {
    return this.exec(
      raw ? "flash:raw" : "flash",
      partition,
      ...flags,
      common.quotepath(file)
    ).catch(error => {
      throw new Error(`flashing failed: ${error}`);
    });
  }

  /**
   * Write a raw file to a flash partition
   * @param {String} partition partition to flash
   * @param {String} file path to an image file
   * @param  {...any} [flags] additional cli-flags like --force and --disable-verification
   * @returns {Promise}
   */
  flashRaw(partition, file, ...flags) {
    return this.flash(partition, file, true, ...flags);
  }

  /**
   * Download and boot kernel
   * @param {String} image image file to boot
   * @returns {Promise}
   */
  boot(image) {
    return this.exec("boot", common.quotepath(image))
      .then(stdout => {
        return;
      })
      .catch(error => {
        throw new Error("booting failed: " + error);
      });
  }

  /**
   * Reflash device from update.zip and set the flashed slot as active
   * @param {String} image image to flash
   * @param {String} wipe wipe option
   * @returns {Promise}
   */
  update(image, wipe) {
    return this.exec(wipe ? "-w" : "", "update", common.quotepath(image))
      .then(stdout => {
        return;
      })
      .catch(error => {
        throw new Error("update failed: " + error);
      });
  }

  /**
   * Reboot device into bootloader
   * @returns {Promise}
   */
  rebootBootloader() {
    return this.exec("reboot-bootloader")
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("rebooting to bootloader failed: " + error);
      });
  }

  /**
   * Reboot device
   * @returns {Promise}
   */
  reboot() {
    return this.exec("reboot")
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("rebooting failed: " + error);
      });
  }

  /**
   * Continue with autoboot
   * @returns {Promise}
   */
  continue() {
    return this.exec("continue")
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("continuing boot failed: " + error);
      });
  }

  /**
   * Format a flash partition. Can override the fs type and/or size the bootloader reports.
   * @param {String} partition to format
   * @param {String} type partition type
   * @param {String} size partition size
   * @returns {Promise}
   */
  format(partition, type, size) {
    if (!type && size) {
      return Promise.reject(
        new Error(
          "formatting failed: size specification requires type to be specified as well"
        )
      );
    }
    return this.exec(
      `format${type ? ":" + type : ""}${size ? ":" + size : ""}`,
      partition
    )
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("formatting failed: " + error);
      });
  }

  /**
   * Erase a flash partition
   * @param {String} partition partition to erase
   * @returns {Promise}
   */
  erase(partition) {
    return this.exec("erase", partition)
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("erasing failed: " + error);
      });
  }

  /**
   * Sets the active slot
   * @param {String} slot - slot to set as active
   */
  setActive(slot) {
    return this.exec(`--set-active=${slot}`)
      .then(stdout => {
        if (stdout && stdout.includes("error")) {
          throw new Error(stdout);
        } else {
          return;
        }
      })
      .catch(error => {
        throw new Error(`failed to set active slot: ${error}`);
      });
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Lift OEM lock
   * @returns {Promise}
   */
  oemUnlock() {
    return this.exec("oem", "unlock")
      .then(() => {
        return;
      })
      .catch(error => {
        if (
          error &&
          (error.message.includes("FAILED (remote: Already Unlocked)") ||
            error.message.includes("FAILED (remote: 'Not necessary')"))
        )
          return;
        else throw new Error("oem unlock failed: " + error);
      });
  }

  /**
   * Enforce OEM lock
   * @returns {Promise}
   */
  oemLock() {
    return this.exec("oem", "lock")
      .then(() => {
        return;
      })
      .catch(error => {
        throw new Error("oem lock failed: " + error);
      });
  }

  /**
   * Write files to flash partitions
   * @param {Array<Object>} images [ {partition, file, raw, flags}, ... ]
   * @returns {Promise}
   */
  flashArray(images) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      function flashNext(i) {
        _this
          .flash(
            images[i].partition,
            images[i].file,
            images[i].raw,
            ...(images[i].flags || [])
          )
          .then(() => {
            if (i + 1 < images.length) flashNext(i + 1);
            else resolve();
          })
          .catch(error => {
            reject(error);
          });
      }
      flashNext(0);
    });
  }

  /**
   * Find out if a device can be seen by fastboot
   * @returns {Promise}
   */
  hasAccess() {
    return this.exec("devices")
      .then(stdout => {
        return Boolean(stdout && stdout.includes("fastboot"));
      })
      .catch(error => {
        throw error;
      });
  }
}

module.exports = Fastboot;
