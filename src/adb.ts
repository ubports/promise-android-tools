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

import {
  stat,
  readdir,
  mkdir,
  open,
  writeFile,
  readFile
} from "node:fs/promises";
import { WriteStream } from "fs";
import * as path from "node:path";
import {
  Tool,
  ToolOptions,
  ProgressCallback,
  ToolError,
  RawError
} from "./tool.js";

const SERIALNO = /^([0-9]|[a-z])+([0-9a-z]+)$/i;
const DEFAULT_PORT = 5037;
const DEFAULT_HOST = "localhost";
const DEFAULT_PROTOCOL = "tcp";

export interface AdbConfig {
  /**   -a                       listen on all network interfaces, not just localhost */
  allInterfaces: boolean;

  /**   -d                       use USB device (error if multiple devices connected) */
  useUsb: boolean;

  /**   -e                       use TCP/IP device (error if multiple TCP/IP devices available) */
  useTcpIp: boolean;

  /**   -s SERIAL                use device with given serial (overrides $ANDROID_SERIAL) */
  serialno?: string;

  /**   -t ID                    use device with given transport id */
  transportId?: string;

  /**   -H                       name of adb server host [default=localhost] */
  host: string | "localhost";

  /**   -P                       port of adb server [default=5037] */
  port: string | number | 5037;

  /** transport-level protocol */
  protocol: "tcp" | "udp";

  /**   -L SOCKET                listen on given socket for adb server [default=tcp:localhost:5037] */
  socket: string | "tcp:localhost:5037";

  /**   --exit-on-write-error    exit if stdout is closed */
  exitOnWriteError: boolean;
}

export type AdbOptions = AdbConfig | ToolOptions | {};

export type DeviceState = "device" | "recovery" | "bootloader";
export type ActualDeviceState = DeviceState | "offline";
export type RebootState =
  | DeviceState
  | "download"
  | "edl"
  | "sideload"
  | "sideload-auto-reboot";
export type WaitState =
  | "any"
  | DeviceState
  | "rescue"
  | "sideload"
  | "disconnect";

export interface Device {
  serialno: string;
  mode: string;
  transport_id: string | number;
  model?: string;
  device?: string;
  product?: string;
}

export class AdbError extends ToolError {
  get message(): string {
    if (
      this.stderr?.includes("error: device unauthorized") ||
      this.stderr?.includes("error: device still authorizing")
    ) {
      return "unauthorized";
    } else if (
      this.stderr?.includes("error: device offline") ||
      this.stderr?.includes("error: protocol fault") ||
      this.stderr?.includes("connection reset")
    ) {
      return "device offline";
    } else if (
      this.stderr?.includes("no devices/emulators found") ||
      this.stdout?.includes("no devices/emulators found") ||
      /device '.*' not found/.test(this.stderr || "") ||
      this.stdout?.includes("adb: error: failed to read copy response") ||
      this.stdout?.includes("couldn't read from device") ||
      this.stdout?.includes("remote Bad file number") ||
      this.stdout?.includes("remote Broken pipe") ||
      this.stderr?.includes("adb: sideload connection failed: closed") ||
      this.stderr?.includes(
        "adb: pre-KitKat sideload connection failed: closed"
      )
    ) {
      return "no device";
    } else if (this.stderr?.includes("more than one device/emulator")) {
      return "more than one device";
    } else {
      return super.message;
    }
  }
}

/** Android Debug Bridge (ADB) module */
export class Adb extends Tool {
  config!: AdbConfig;

  constructor(options: AdbOptions = {}) {
    super({
      tool: "adb",
      Error: AdbError,
      argsModel: {
        allInterfaces: ["-a", false, true],
        useUsb: ["-d", false, true],
        useTcpIp: ["-e", false, true],
        serialno: ["-s", null],
        transportId: ["-t", null],
        host: ["-H", DEFAULT_HOST],
        port: ["-P", DEFAULT_PORT],
        protocol: ["-L", DEFAULT_PROTOCOL, false, "socket"],
        exitOnWriteError: ["--exit-on-write-error", false, true]
      },
      config: {
        allInterfaces: false,
        useUsb: false,
        useTcpIp: false,
        serialno: null,
        transportId: null,
        host: DEFAULT_HOST,
        port: DEFAULT_PORT,
        protocol: DEFAULT_PROTOCOL,
        get socket() {
          return `${this.protocol}:${this.host}:${this.port}`;
        },
        exitOnWriteError: false
      },
      ...options
    });
  }

  /**
   * Kill all adb servers and start a new one to rule them all
   * @param options - new config options to apply
   * @param serialOrUsbId - applies the --one-device SERIAL|USB flag, server will only connect to one USB device, specified by a serial number or USB device address
   */
  public async startServer(
    options: AdbOptions = {},
    serialOrUsbId?: string | number
  ): Promise<void> {
    this.applyConfig(options);
    return this.killServer()
      .then(() =>
        this.exec(
          "start-server",
          ...(serialOrUsbId ? ["--one-device", serialOrUsbId] : [])
        )
      )
      .then(() => {});
  }

  /** Kill all running servers */
  public async killServer(): Promise<void> {
    return this.exec("kill-server").then(() => {});
  }

  /** Specifically connect to a device (tcp) */
  public async connect(address: string): Promise<ActualDeviceState> {
    return this.exec("connect", address).then(stdout => {
      if (
        stdout?.includes("no devices/emulators found") ||
        stdout?.includes("Name or service not known")
      ) {
        throw this.error(new Error("no device"), stdout);
      } else {
        return this.wait();
      }
    });
  }

  /** kick connection from host side to force reconnect */
  public async reconnect(
    modifier?: "device" | "offline"
  ): Promise<ActualDeviceState> {
    return this.exec("reconnect", modifier).then(stdout => {
      if (
        stdout?.includes("no devices/emulators found") ||
        stdout?.includes("No route to host")
      ) {
        throw this.error(new Error("no device"), stdout);
      } else {
        return this.wait();
      }
    });
  }

  /** kick connection from device side to force reconnect */
  public async reconnectDevice(): Promise<string> {
    return this.reconnect("device");
  }

  /** reset offline/unauthorized devices to force reconnect */
  public async reconnectOffline(): Promise<string> {
    return this.reconnect("offline");
  }

  /** list devices */
  public async devices(): Promise<Device[]> {
    return this.exec("devices", "-l")
      .then(r => r.replace("List of devices attached", "").trim())
      .then(r => r.split("\n").map(device => device.trim().split(/\s+/)))
      .then(devices =>
        devices
          .filter(([serialno]) => serialno)
          .map(([serialno, mode, ...props]) =>
            Object(
              props
                .map(p => p.split(":"))
                .reduce((acc, [p, v]) => ({ ...acc, [p]: v }), {
                  serialno,
                  mode
                })
            )
          )
      );
  }

  /** Get the devices serial number */
  public async getSerialno(): Promise<string> {
    return this.exec("get-serialno").then(stdout => {
      if (!stdout || stdout?.includes("unknown") || !SERIALNO.test(stdout)) {
        throw this.error(
          new Error(`invalid serial number: ${stdout?.trim()}`),
          stdout
        );
      } else {
        return stdout.trim();
      }
    });
  }

  /**
   * run remote shell command
   * @returns stdout
   */
  public async shell(...args: (string | number)[]): Promise<string> {
    return this.exec("shell", args.join(" ")).then(stdout => stdout?.trim());
  }

  /** determine child_process.spawn() result */
  private async onCpExit(
    code: number | null,
    signal: NodeJS.Signals | null,
    stdout: string,
    stderr: string
  ): Promise<void> {
    if (code || signal) {
      // truthy value (i.e. non-zero exit code) indicates error
      if (
        stdout.includes("adb: error: cannot stat") &&
        stdout.includes("No such file or directory")
      ) {
        throw this.error(new Error("file not found"));
      } else {
        throw this.error({ code, signal } as RawError, stdout, stderr);
      }
    }
  }

  /** extract chunk size from logging */
  private parseChunkSize(
    str: string,
    namespace: "writex" | "readx" = "writex"
  ): number {
    return str.includes(namespace)
      ? parseInt(str?.split("len=")[1]?.split(" ")[0]) || 0
      : 0;
  }

  /** calculate progress from current/total */
  private normalizeProgress(current: number, total: number): number {
    return Math.min(Math.round((current / total) * 100000) / 100000, 1);
  }

  private async spawnFileTransfer(
    command: string,
    files: string[] = [],
    args: string[] = [],
    progress: ProgressCallback = () => {}
  ): Promise<void> {
    progress(0);
    if (!files?.length) {
      // if there are no files, report 100% and resolve
      progress(1);
      return;
    } else {
      const _this = this;
      return new Promise((resolve, reject) => {
        const totalSize = Promise.all(
          files.map(file => stat(file).then(({ size }) => size))
        )
          .then(sizes => sizes.reduce((a, b) => a + b))
          .catch(() => {
            reject(new Error("file not found"));
            return 0;
          });
        let pushedSize = 0;
        let stdout = "";
        let stderr = "";
        const cp = _this
          ._withEnv({ ADB_TRACE: "rwx" })
          .spawn(command, ...files, ...args);
        cp.once("exit", (code, signal) =>
          resolve(_this.onCpExit(code, signal, stdout, stderr))
        );

        cp?.stdout?.on && cp.stdout.on("data", d => (stdout += d.toString()));
        cp?.stderr?.on &&
          cp.stderr.on("data", d => {
            d.toString()
              .split("\n")
              .forEach(async (str: string) => {
                if (!str.includes("cpp")) {
                  stderr += str;
                } else {
                  pushedSize += _this.parseChunkSize(str);
                  progress(
                    _this.normalizeProgress(
                      pushedSize,
                      (await totalSize) as number
                    )
                  );
                }
              });
          });
      });
    }
  }

  /**
   * copy local files/directories to device
   * @param files path to files
   * @param dest destination path on the device
   * @param progress progress function
   */
  public async push(
    files: string[] = [],
    dest: string,
    progress: ProgressCallback = () => {}
  ): Promise<void> {
    return this.spawnFileTransfer("push", files, [dest], progress);
  }

  /**
   * sideload an ota package
   * @param file - path to a file to sideload
   * @param progress progress function
   */
  public async sideload(
    file: string,
    progress: ProgressCallback = () => {}
  ): Promise<void> {
    return this.spawnFileTransfer("sideload", [file], [], progress);
  }

  /**
   * Reboot to a state
   * reboot the device; defaults to booting system image but
   * supports bootloader and recovery too. sideload reboots
   * into recovery and automatically starts sideload mode,
   * sideload-auto-reboot is the same but reboots after sideloading.
   */
  public async reboot(state?: RebootState): Promise<void> {
    return this.exec("reboot", state).then(stdout => {
      if (stdout?.includes("failed"))
        throw new Error(`reboot failed: ${stdout}`);
      else return;
    });
  }

  /** Return the status of the device */
  public async getState(): Promise<ActualDeviceState> {
    return this.exec("get-state").then(
      stdout => stdout.trim() as ActualDeviceState
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  /** Reboot to a requested state, if not already in it */
  public async ensureState(state: DeviceState): Promise<ActualDeviceState> {
    return this.getState().then(currentState =>
      currentState === state
        ? state
        : this.reboot(state).then(() => this.wait())
    );
  }

  /** read property from getprop or, failing that, the default.prop file */
  public async getprop(prop: string): Promise<string> {
    return this.shell("getprop", prop).then(stdout => {
      if (!stdout || stdout?.includes("not found")) {
        return this.shell("cat", "default.prop")
          .catch(e => {
            throw new Error("getprop error: " + e);
          })
          .then(stdout => {
            if (stdout && stdout.includes(`${prop}=`)) {
              return stdout.split(`${prop}=`)[1].split("\n")[0].trim();
            } else {
              throw new Error("unknown getprop error");
            }
          });
      } else {
        return stdout.trim();
      }
    });
  }

  /** get device codename from getprop or by reading the default.prop file */
  public async getDeviceName(): Promise<string> {
    return this.getprop("ro.product.device");
  }

  /** resolves true if recovery is system-image capable, false otherwise */
  public async getSystemImageCapability(): Promise<boolean> {
    return this.getprop("ro.ubuntu.recovery")
      .then(r => Boolean(r))
      .catch(e => {
        if (e.message === "unknown getprop error") {
          return false;
        } else {
          throw e;
        }
      });
  }

  /** Find out what operating system the device is running (currently android and ubuntu touch) */
  public async getOs(): Promise<"ubuntutouch" | "android"> {
    return this.shell("cat", "/etc/system-image/channel.ini").then(stdout => {
      return stdout ? "ubuntutouch" : "android";
    });
  }

  /** Find out if a device can be seen by adb */
  public async hasAccess(): Promise<boolean> {
    return this.shell("echo", ".")
      .then(stdout => {
        if (stdout == ".") return true;
        else throw new Error("unexpected response: " + stdout);
      })
      .catch(error => {
        if (error.message && error.message.includes("no device")) {
          return false;
        } else {
          throw error;
        }
      });
  }

  /** wait for a device, optionally limiting to specific states or transport types */
  public async wait(
    state: WaitState = "any",
    transport: "any" | "usb" | "local" = "any"
  ): Promise<ActualDeviceState> {
    return this.exec(`wait-for-${transport}-${state}`).then(() =>
      this.getState()
    );
  }

  /** Format partition */
  public async format(partition: string): Promise<void> {
    return this.shell("cat", "/etc/recovery.fstab")
      .then(fstab => {
        const block = this.findPartitionInFstab(partition, fstab);
        return this.shell("umount", `/${partition}`)
          .then(() => this.shell("make_ext4fs", block))
          .then(() => this.shell("mount", `/${partition}`))
          .then(error => {
            if (error) throw new Error("failed to mount: " + error);
            else return;
          });
      })
      .catch(error => {
        throw new Error("failed to format " + partition + ": " + error);
      });
  }

  /** Format cache if possible and rm -rf its contents */
  public async wipeCache(): Promise<void> {
    await this.format("cache").catch(() => {});
    await this.shell("rm", "-rf", "/cache/*");
    return;
  }

  /** Find the partition associated with a mountpoint in an fstab */
  private findPartitionInFstab(partition: string, fstab: string): string {
    try {
      return fstab
        .split("\n")
        .filter(block => block.startsWith("/dev"))
        .filter(
          block => block.split(" ").filter(c => c !== "")[1] === "/" + partition
        )[0]
        .split(" ")[0];
    } catch (error) {
      throw new Error("failed to parse fstab");
    }
  }

  /** Find a partition and verify its type */
  public async verifyPartitionType(
    partition: string,
    type: string
  ): Promise<boolean> {
    return this.shell("mount").then(stdout => {
      if (
        !(stdout.includes(" on /") && stdout.includes(" type ")) ||
        typeof stdout !== "string" ||
        !stdout.includes("/" + partition)
      ) {
        throw new Error("partition not found");
      } else {
        return stdout.includes(" on /" + partition + " type " + type);
      }
    });
  }

  /** size of a file or directory */
  public async getFileSize(file: string): Promise<number> {
    return this.shell("du -shk " + file)
      .then(size => {
        if (isNaN(parseFloat(size)))
          throw new Error(`Cannot parse size from ${size}`);
        else return parseFloat(size);
      })
      .catch(e => {
        throw new Error(`Unable to get size: ${e}`);
      });
  }

  /** available size of a partition */
  public async getAvailablePartitionSize(partition: string): Promise<number> {
    return this.shell("df -k -P " + partition)
      .then(stdout => stdout.split(/[ ,]+/))
      .then(arr => parseInt(arr[arr.length - 3]))
      .then(size => {
        if (isNaN(size)) throw new Error(`Cannot parse size from ${size}`);
        else return size;
      })
      .catch(e => {
        throw new Error(`Unable to get size: ${e}`);
      });
  }

  /** total size of a partition */
  public async getTotalPartitionSize(partition: string): Promise<number> {
    return this.shell("df -k -P " + partition)
      .then(stdout => stdout.split(/[ ,]+/))
      .then(arr => parseInt(arr[arr.length - 5]))
      .then(size => {
        if (isNaN(size)) throw new Error(`Cannot parse size from ${size}`);
        else return size;
      })
      .catch(e => {
        throw new Error(`Unable to get size: ${e}`);
      });
  }

  /** [EXPERIMENTAL] Run a command via adb exec-out and pipe the result to a stream, e.g., from fs.createWriteStream() */
  public async execOut(
    writableStream: WriteStream,
    ...args: (string | number | null | undefined)[]
  ): Promise<void> {
    const _this = this;
    return new Promise(function (resolve, reject) {
      let stderr = "";
      const cp = _this.spawn("exec-out", `'${args.join(" ")}'`);
      cp?.stdout && cp.stdout.pipe(writableStream);
      cp?.stderr && cp.stderr.on("data", d => (stderr += d.toString()));
      cp.once("exit", (code, signal) => {
        writableStream.close();
        if (code || signal)
          reject(_this.error({ code, signal } as RawError, undefined, stderr));
        else resolve();
      });
    });
  }

  /** [EXPERIMENTAL] Backup "srcfile" from the device to local tar "destfile" */
  public async createBackupTar(
    srcfile: string,
    destfile: string,
    progress: ProgressCallback
  ): Promise<void> {
    progress(0);
    const fileSize = this.getFileSize(srcfile);
    // FIXME with gzip compression (the -z flag on tar), the progress estimate is way off. It's still beneficial to enable it, because it saves a lot of space.
    let timeout: NodeJS.Timeout;
    const poll = async () => {
      try {
        const { size } = await stat(destfile);
        progress(this.normalizeProgress(size / 1024, await fileSize));
      } catch (e) {}
      timeout = setTimeout(poll, 500);
    };
    poll();
    return open(destfile, "w")
      .then(f =>
        this.execOut(
          f.createWriteStream(),
          "tar",
          "-cpz",
          "--exclude=*/var/cache ",
          "--exclude=*/var/log ",
          "--exclude=*/.cache/upstart ",
          "--exclude=*/.cache/*.qmlc ",
          "--exclude=*/.cache/*/qmlcache ",
          "--exclude=*/.cache/*/qml_cache",
          srcfile,
          "2>/dev/null"
        )
      )
      .finally(() => clearTimeout(timeout));
  }

  /** [EXPERIMENTAL] Restore tar "srcfile" */
  public async restoreBackupTar(
    srcfile: string,
    progress: ProgressCallback = () => {}
  ): Promise<void> {
    progress(0);
    return this.ensureState("recovery")
      .then(() => this.shell("mkfifo /restore.pipe"))
      .then(() =>
        Promise.all([
          this.push([srcfile], "/restore.pipe", progress),
          this.shell("cd /;", "cat /restore.pipe | tar -xvz")
        ])
      )
      .then(() => this.shell("rm", "/restore.pipe"))
      .then(() => {})
      .catch(e => {
        throw new Error(`Restore failed: ${e}`);
      });
  }

  /**
   * List backups
   * @param backupBaseDir path to backup storage location
   * @returns backup list
   */
  public async listUbuntuBackups(backupBaseDir: string): Promise<{}[]> {
    return readdir(backupBaseDir)
      .then(backups =>
        Promise.all(
          backups.map(backup =>
            readFile(path.join(backupBaseDir, backup, "metadata.json"))
              .then(r => JSON.parse(r.toString()))
              .then(metadata => ({
                ...metadata,
                dir: path.join(backupBaseDir, backup)
              }))
              .catch(() => null)
          )
        ).then(r => r.filter(r => r))
      )
      .catch(() => []);
  }

  /**
   * create a full backup of ubuntu touch
   * @param backupBaseDir path to backup storage location
   * @param comment description of the backup
   * @param dataPartition data partition on the device
   * @param progress progress function
   * @returns backup object
   */
  public async createUbuntuTouchBackup(
    backupBaseDir: string,
    comment: string = "",
    dataPartition: string = "/data",
    progress: ProgressCallback = () => {}
  ): Promise<{}> {
    progress(0);
    const time = new Date().toISOString();
    const dir = path.join(backupBaseDir, time);
    return this.ensureState("recovery")
      .then(() => mkdir(dir, { recursive: true }))
      .then(() =>
        Promise.all([
          this.shell("stat", "/data/user-data"),
          this.shell("stat", "/data/syste-mdata")
        ]).catch(() => this.shell("mount", dataPartition, "/data"))
      )
      .then(() =>
        this.createBackupTar(
          "/data/system-data",
          path.join(dir, "system.tar.gz"),
          p => progress(p * 0.5)
        )
      )
      .then(() =>
        this.createBackupTar(
          "/data/user-data",
          path.join(dir, "user.tar.gz"),
          p => progress(50 + p * 0.5)
        )
      )
      .then(async () => {
        const metadata = {
          codename: await this.getDeviceName(),
          serialno: await this.getSerialno(),
          size:
            (await this.getFileSize("/data/user-data")) +
            (await this.getFileSize("/data/system-data")),
          time,
          comment: comment || `Ubuntu Touch backup created on ${time}`,
          restorations: []
        };
        return writeFile(
          path.join(dir, "metadata.json"),
          JSON.stringify(metadata)
        ).then(() => ({ ...metadata, dir }));
      });
  }

  /**
   * restore a full backup of ubuntu touch
   * @param dir directory where backup is stored
   * @param progress progress function
   * @returns backup object
   */
  public async restoreUbuntuTouchBackup(
    dir: string,
    progress: ProgressCallback = () => {}
  ): Promise<{}> {
    progress(0); // FIXME report actual push progress
    return Promise.all([
      readFile(path.join(dir, "metadata.json")).then(r =>
        JSON.parse(r.toString())
      ),
      this.getDeviceName(),
      this.getSerialno(),
      new Date().toISOString(),
      this.ensureState("recovery")
    ])
      .then(([metadata, codename, serialno, time]) => {
        metadata.restorations = [
          ...(metadata.restorations || []),
          { codename, serialno, time }
        ];
        return Promise.resolve(progress(10))
          .then(() => this.restoreBackupTar(path.join(dir, "system.tar.gz")))
          .then(() => progress(50))
          .then(() => this.restoreBackupTar(path.join(dir, "user.tar.gz")))
          .then(() => progress(90))
          .then(() =>
            writeFile(path.join(dir, "metadata.json"), JSON.stringify(metadata))
          )
          .then(() => this.reboot())
          .then(() => progress(100))
          .then(() => ({ ...metadata, dir }));
      })
      .catch(e => {
        throw new Error(`Failed to restore: ${e}`);
      });
  }
}
