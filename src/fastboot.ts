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

import { ExecException } from "node:child_process";
import { ProgressCallback, Tool, ToolOptions } from "./tool.js";

export interface FastbootFlashImage {
  /** partition to flash */
  partition: string;

  /** path to an image file */
  file: string;

  /** use `fastboot flash:raw` instead of `fastboot flash` */
  raw?: boolean;

  /** additional cli-flags like --force and --disable-verification */
  flags?: string[];
}

export interface FastbootConfig {
  // -w                         Wipe userdata.
  wipe: boolean;

  //  -s <SERIAL|<tcp|udp:HOST[:PORT]>>   USB or network device
  device?: string | number;

  // -S SIZE[K|M|G]             Break into sparse files no larger than SIZE.
  maxSize?: string;

  // --force                    Force a flash operation that may be unsafe.
  force: boolean;

  // --slot SLOT                Use SLOT; 'all' for both slots, 'other' for non-current slot (default: current active slot).
  slot?: "all" | "current" | "other";

  // --set-active[=SLOT]        Sets the active slot before rebooting.
  setActive?: "all" | "current" | "other";

  // --skip-secondary           Don't flash secondary slots in flashall/update.
  skipSecondary: boolean;

  // --skip-reboot              Don't reboot device after flashing.
  skipReboot: boolean;

  // --disable-verity           Sets disable-verity when flashing vbmeta.
  disableVerity: boolean;

  // --disable-verification     Sets disable-verification when flashing vbmeta.
  disableVerification: boolean;

  // --fs-options=OPTION[,OPTION]   Enable filesystem features. OPTION supports casefold, projid, compress
  fsOptions?: string;

  // --unbuffered               Don't buffer input or output.
  unbuffered: boolean;
}

export type FastbootOptions = ToolOptions | FastbootConfig | {};

/** fastboot android flashing and booting utility */
export class Fastboot extends Tool {
  config!: FastbootConfig;

  constructor(options: FastbootOptions = {}) {
    super({
      tool: "fastboot",
      argsModel: {
        wipe: ["-w", false, true],
        device: ["-s", null],
        maxSize: ["-S", null],
        force: ["--force", false, true],
        slot: ["--slot", null],
        setActive: ["--set-active", null],
        skipSecondary: ["--skip-secondary", false, true],
        skipReboot: ["--skip-reboot", false, true],
        disableVerity: ["--disable-verity", false, true],
        disableVerification: ["--disable-verification", false, true],
        fsOptions: ["--fs-options", null],
        unbuffered: ["--unbuffered", false, true]
      },
      config: {
        wipe: false,
        device: null,
        maxSize: null,
        force: false,
        slot: null,
        setActive: null,
        skipSecondary: false,
        skipReboot: false,
        disableVerity: false,
        disableVerification: false,
        fsOptions: null,
        unbuffered: false
      },
      ...options
    });
  }

  /** Generate processable error messages from child_process.exec() callbacks */
  handleError(error?: ExecException | {}, stdout?: string, stderr?: string) {
    if (
      stderr?.includes("FAILED (remote: low power, need battery charging.)")
    ) {
      return "low battery";
    } else if (
      stderr?.includes("not supported in locked device") ||
      stderr?.includes("Bootloader is locked") ||
      stderr?.includes("not allowed in locked state") ||
      stderr?.includes("not allowed in Lock State") ||
      stderr?.includes("Device not unlocked cannot flash or erase") ||
      stderr?.includes("Partition flashing is not allowed") ||
      stderr?.includes("Command not allowed") ||
      stderr?.includes("not allowed when locked") ||
      stderr?.includes("device is locked. Cannot flash images") ||
      stderr?.match(/download for partition '[a-z]+' is not allowed/i)
    ) {
      return "bootloader locked";
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

  /** Write a file to a flash partition */
  flash(
    images: FastbootFlashImage[],
    progress: ProgressCallback = () => {}
  ): Promise<void> {
    progress(0);
    const _this = this;
    // build a promise chain to flash all images sequentially
    return images
      .reduce(
        (prev, { raw, partition, flags, file }, i) =>
          prev.then(
            () =>
              new Promise((resolve, reject) => {
                let stdout = "";
                let stderr = "";
                let offset = i / images.length;
                let scale = 1 / images.length;
                let sparseCurr = 1;
                let sparseTotal = 1;
                let sparseOffset = () => (sparseCurr - 1) / sparseTotal;
                let sparseScale = () => 1 / sparseTotal;
                const cp = _this.spawn(
                  raw ? "flash:raw" : "flash",
                  partition,
                  ...(flags || []),
                  file
                );
                cp.once("exit", (code, signal) => {
                  if (code || signal) {
                    reject(_this.handleError({ code, signal }, stdout, stderr));
                  } else {
                    resolve("bootloader");
                  }
                });
                cp?.stdout &&
                  cp.stdout.on("data", d => (stdout += d.toString()));
                cp?.stderr &&
                  cp.stderr.on("data", d => {
                    d.toString()
                      .trim()
                      .split("\n")
                      .forEach((str: string) => {
                        // FIXME improve and simplify logic
                        try {
                          if (!str.includes("OKAY")) {
                            if (str.includes(`Sending '${partition}'`)) {
                              progress(offset + 0.3 * scale);
                            } else if (
                              str.includes(`Sending sparse '${partition}'`)
                            ) {
                              [sparseCurr, sparseTotal] = str
                                .split(/' |\/| \(/)
                                .slice(1, 3)
                                .map(parseFloat);
                              progress(
                                offset +
                                  sparseOffset() * scale +
                                  sparseScale() * 0.33 * scale
                              );
                            } else if (str.includes(`Writing '${partition}'`)) {
                              progress(
                                offset +
                                  sparseOffset() * scale +
                                  sparseScale() * 0.85 * scale
                              );
                            } else if (
                              str.includes(`Finished '${partition}'`)
                            ) {
                              progress(offset + scale);
                            } else {
                              throw new Error(`failed to parse '${str}'`);
                            }
                          }
                        } catch (e) {
                          stderr += str;
                        }
                      });
                  });
              })
          ),
        _this.wait()
      )
      .then(() => {})
      .catch(e => {
        throw new Error(`Flashing failed: ${e}`);
      });
  }

  /** Download and boot kernel */
  boot(image: string): Promise<void> {
    return this.exec("boot", image)
      .then(() => {})
      .catch(error => {
        throw new Error("booting failed: " + error);
      });
  }

  /** Reflash device from update.zip and set the flashed slot as active */
  update(image: string, wipe: string | boolean = false): Promise<void> {
    return this._withConfig({ wipe })
      .exec("update", image)
      .then(() => {})
      .catch(error => {
        throw new Error("update failed: " + error);
      });
  }

  /** Reboot device into bootloader */
  rebootBootloader(): Promise<void> {
    return this.exec("reboot-bootloader")
      .then(() => {})
      .catch(error => {
        throw new Error("rebooting to bootloader failed: " + error);
      });
  }

  /**
   * Reboot device into userspace fastboot (fastbootd) mode
   * Note: this only works on devices that support dynamic partitions.
   */
  rebootFastboot(): Promise<void> {
    return this.exec("reboot-fastboot")
      .then(() => {})
      .catch(error => {
        throw new Error("rebooting to fastboot failed: " + error);
      });
  }

  /** Reboot device into recovery */
  rebootRecovery(): Promise<void> {
    return this.exec("reboot-recovery")
      .then(() => {})
      .catch(error => {
        throw new Error("rebooting to recovery failed: " + error);
      });
  }

  /** Reboot device */
  reboot(): Promise<void> {
    return this.exec("reboot")
      .then(() => {})
      .catch(error => {
        throw new Error("rebooting failed: " + error);
      });
  }

  /** Continue with autoboot */
  continue(): Promise<void> {
    return this.exec("continue")
      .then(() => {})
      .catch(error => {
        throw new Error("continuing boot failed: " + error);
      });
  }

  /** Format a flash partition. Can override the fs type and/or size the bootloader reports */
  async format(
    partition: string,
    type?: string,
    size?: string | number
  ): Promise<void> {
    if (!type && size) {
      throw new Error(
        "formatting failed: size specification requires type to be specified as well"
      );
    }
    return this.exec(
      `format${type ? ":" + type : ""}${size ? ":" + size : ""}`,
      partition
    )
      .then(() => {})
      .catch(error => {
        throw new Error("formatting failed: " + error);
      });
  }

  /** Erase a flash partition */
  erase(partition: string): Promise<void> {
    return this.exec("erase", partition)
      .then(() => {})
      .catch(error => {
        throw new Error("erasing failed: " + error);
      });
  }

  /** Sets the active slot */
  setActive(slot: string) {
    return this._withConfig({ setActive: slot })
      .exec()
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

  /** Create a logical partition with the given name and size, in the super partition */
  createLogicalPartition(
    partition: string,
    size: string | number
  ): Promise<void> {
    return this.exec("create-logical-partition", partition, size)
      .then(() => {})
      .catch(error => {
        throw new Error("creating logical partition failed: " + error);
      });
  }

  /** Resize a logical partition with the given name and final size, in the super partition */
  resizeLogicalPartition(
    partition: string,
    size: string | number
  ): Promise<void> {
    return this.exec("resize-logical-partition", partition, size)
      .then(() => {})
      .catch(error => {
        throw new Error("resizing logical partition failed: " + error);
      });
  }

  /** Delete a logical partition with the given name */
  deleteLogicalPartition(partition: string): Promise<void> {
    return this.exec("delete-logical-partition", partition)
      .then(() => {})
      .catch(error => {
        throw new Error("deleting logical partition failed: " + error);
      });
  }

  /** Wipe the super partition and reset the partition layout */
  wipeSuper(image: string): Promise<void> {
    return this.exec("wipe-super", image)
      .then(() => {})
      .catch(error => {
        throw new Error("wiping super failed: " + error);
      });
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Lift OEM lock
   * @param code optional unlock code (including 0x if necessary)
   */
  oemUnlock(code?: string | number): Promise<void> {
    return this.exec("oem", "unlock", code)
      .then(() => {})
      .catch(error => {
        if (
          error?.message.includes("Already Unlocked") ||
          error?.message.includes("Not necessary")
        )
          return;
        else throw new Error("oem unlock failed: " + error);
      });
  }

  /** Enforce OEM lock */
  oemLock(): Promise<void> {
    return this.exec("oem", "lock")
      .then(() => {})
      .catch(error => {
        throw new Error("oem lock failed: " + error);
      });
  }

  /** unlock partitions for flashing */
  flashingUnlock(): Promise<void> {
    return this.exec("flashing", "unlock").then(() => {});
  }

  /** lock partitions for flashing */
  flashingLock(): Promise<void> {
    return this.exec("flashing", "lock").then(() => {});
  }

  /** unlock 'critical' bootloader partitions */
  flashingUnlockCritical(): Promise<void> {
    return this.exec("flashing", "unlock_critical").then(() => {});
  }

  /** lock 'critical' bootloader partitions */
  flashingLockCritical(): Promise<void> {
    return this.exec("flashing", "lock_critical").then(() => {});
  }

  /** Find out if a device can be flashing-unlocked */
  getUnlockAbility(): Promise<boolean> {
    return this.exec("flashing", "get_unlock_ability")
      .then(stdout => stdout === "1")
      .catch(() => false);
  }

  /** Find out if a device can be seen by fastboot */
  hasAccess(): Promise<boolean> {
    return this.exec("devices")
      .then(stdout => {
        return Boolean(stdout?.includes("fastboot"));
      })
      .catch(error => {
        throw error;
      });
  }

  /** wait for a device */
  wait(): Promise<"bootloader"> {
    return super.wait().then(() => "bootloader");
  }

  /** get bootloader var */
  async getvar(variable: string): Promise<string> {
    const result = await this.exec("getvar", variable);
    const [name, value] = result
      .replace(/\r\n/g, "\n")
      .split("\n")[0]
      .split(": ");

    if (name !== variable) {
      throw new Error(`Unexpected getvar return: ${name}`);
    }

    return value;
  }

  /** get device codename from product bootloader var */
  getDeviceName(): Promise<string> {
    return this.getvar("product");
  }
}
