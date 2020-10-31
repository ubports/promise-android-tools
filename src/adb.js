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

const fs = require("fs-extra");
const path = require("path");
const events = require("events");
const common = require("./common.js");
const Tool = require("./tool.js");

class Event extends events {}

const DEFAULT_PORT = 5037;

/**
 * Android Debug Bridge (ADB) module
 */
class Adb extends Tool {
  constructor(options) {
    super({
      tool: "adb",
      extra: ["-P", options?.port || DEFAULT_PORT],
      ...options
    });
    this.port = options?.port || DEFAULT_PORT;
    this.adbEvent = new Event();
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
    if (stderr?.includes("no devices/emulators found")) {
      return "no device";
    } else {
      return super.handleError(error, stdout, stderr);
    }
  }

  /**
   * Kill all adb servers and start a new one to rule them all
   * @returns {Promise}
   */
  startServer() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.stopWaiting();
      _this
        .killServer()
        .then(() => {
          _this
            .exec("start-server")
            .then(() => {
              resolve();
            })
            .catch(reject);
        })
        .catch(reject);
    });
  }

  /**
   * Kill all running servers
   * @returns {Promise}
   */
  killServer() {
    this.stopWaiting();
    return this.exec("kill-server");
  }

  /**
   * kick connection from host side to force reconnect
   * @param {String} [modifier] - "device" or "offline"
   * @returns {Promise}
   */
  reconnect(modifier = "") {
    this.stopWaiting();
    return this.exec(...["reconnect", modifier].filter(i => i)).then(stdout => {
      if (stdout?.includes("no devices/emulators found")) {
        throw new Error("no device");
      } else {
        return this.waitForDevice();
      }
    });
  }

  /**
   * kick connection from device side to force reconnect
   * @returns {Promise}
   */
  reconnectDevice() {
    return this.reconnect("device");
  }

  /**
   * reset offline/unauthorized devices to force reconnect
   * @returns {Promise}
   */
  reconnectOffline() {
    return this.reconnect("offline");
  }

  /**
   * Get the devices serial number
   * @returns {Promise<String>} serial number
   */
  getSerialno() {
    var _this = this;
    var Exp = /^([0-9]|[a-z])+([0-9a-z]+)$/i;
    return new Promise(function(resolve, reject) {
      _this
        .exec("get-serialno")
        .then(stdout => {
          if (stdout && stdout.includes("unknown")) {
            _this
              .hasAccess()
              .then(access => {
                if (access) {
                  reject(new Error("device accessible. Unkown error"));
                } else {
                  reject(new Error("no accessible device"));
                }
              })
              .catch(error => {
                if (error.message.includes("not found")) {
                  reject(new Error("no device found"));
                } else if (error.message.includes("insufficient permissions")) {
                  reject(new Error("no permissions"));
                } else {
                  reject(error);
                }
              });
          } else if (stdout && stdout.match(Exp)) {
            resolve(stdout.replace("\n", ""));
          } else {
            reject(new Error("invalid device id"));
          }
        })
        .catch(reject);
    });
  }

  /**
   * run remote shell command
   * @param {Array} args - list of shell arguments
   * @returns {Promise<String>} stdout
   */
  shell(...args) {
    return this.exec("shell", `'${args.join(" ")}'`).then(stdout => {
      if (stdout) return stdout.replace("\n", "");
      else return;
    });
  }

  /**
   * copy local files/directories to device
   * @param {String} file - path to file to push
   * @param {String} dest - target path
   * @param {Integer} interval - poll interval
   * @returns {Promise}
   */
  push(file, dest, interval) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      // Make sure file exists first
      try {
        fs.statSync(file);
      } catch (e) {
        reject(new Error("Can't access file: " + e));
      }
      var fileSize = fs.statSync(file)["size"];
      var lastSize = 0;
      // FIXME use stream and parse stdout instead of polling with stat
      var progressInterval = setInterval(() => {
        _this
          .shell("stat", "-t", dest + "/" + path.basename(file))
          .then(stat => {
            _this.adbEvent.emit(
              "push:progress:size",
              eval(stat.split(" ")[1]) - lastSize
            );
            lastSize = eval(stat.split(" ")[1]);
          })
          .catch(e => {
            clearInterval(progressInterval);
          });
      }, interval || 1000);
      _this
        .exec("push", common.quotepath(file), dest, common.stdoutFilter("%]"))
        .then(stdout => {
          clearInterval(progressInterval);
          if (
            stdout &&
            (stdout.includes("no devices/emulators found") ||
              stdout.includes("couldn't read from device") ||
              stdout.includes("remote Bad file number"))
          ) {
            reject(new Error("connection lost"));
          } else if (
            stdout &&
            stdout.includes("remote No space left on device")
          ) {
            reject(new Error("Push failed: out of space"));
          } else if (stdout && stdout.includes("0 files pushed")) {
            reject(new Error("Push failed: stdout: " + stdout));
          } else {
            resolve();
          }
        })
        .catch(e => {
          clearInterval(progressInterval);
          _this
            .hasAccess()
            .then(access => {
              reject(access ? "Push failed: " + e : "connection lost");
            })
            .catch(() => {
              reject(new Error("Push failed: " + e));
            });
        });
    });
  }

  /**
   * Reboot to a state
   * @param {String} state - system, recovery, bootloader
   * @returns {Promise}
   */
  reboot(state) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      if (["system", "recovery", "bootloader"].indexOf(state) == -1) {
        reject(new Error("unknown state: " + state));
      } else {
        _this
          .exec("reboot", state)
          .then(stdout => {
            if (stdout && stdout.includes("failed"))
              reject(new Error("reboot failed"));
            else resolve();
          })
          .catch(e => reject(new Error("reboot failed: " + e)));
      }
    });
  }

  /**
   * sideload an ota package
   * @param {String} file - path to a file to sideload
   * @returns {Promise}
   */
  sideload(file) {
    return this.exec(
      "sideload",
      common.quotepath(file),
      common.stdoutFilter("%)")
    );
  }

  /**
   * Return the status of the device
   * @returns {Promise<String>} bootloader, recovery, device
   */
  getState() {
    return this.exec("get-state").then(stdout => stdout.trim());
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Reboot to a requested state, if not already in it
   * @param {String} state - system, recovery, bootloader
   * @returns {Promise}
   */
  ensureState(state) {
    return this.getState().then(currentState =>
      currentState === state ||
      (currentState === "device" && state === "system")
        ? Promise.resolve()
        : this.reboot(state).then(() => this.waitForDevice())
    );
  }

  /**
   * Push an array of files and report progress
   * @param {Array<{ src, dest }>} files file objects
   * @param {Function} progress progress function
   * @param {Integer} interval how often to call the progress function
   * @returns {Promise}
   */
  pushArray(files = [], progress = () => {}, interval) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      if (files.length <= 0) {
        progress(1);
        resolve();
      } else {
        var totalSize = 0;
        var pushedSize = 0;
        files.forEach(file => {
          try {
            totalSize += fs.statSync(file.src)["size"];
          } catch (e) {
            reject(new Error("Can't access file: " + e));
          }
        });
        function progressSize(s) {
          pushedSize += s;
          progress(pushedSize / totalSize);
        }
        function pushNext(i) {
          _this
            .push(files[i].src, files[i].dest, interval)
            .then(() => {
              if (i + 1 < files.length) {
                pushNext(i + 1);
              } else {
                _this.adbEvent.removeListener(
                  "push:progress:size",
                  progressSize
                );
                resolve();
              }
            })
            .catch(e =>
              reject(new Error("Failed to push file " + i + ": " + e))
            );
        }
        _this.adbEvent.on("push:progress:size", progressSize);
        pushNext(0); // Begin pushing
      }
    });
  }

  /**
   * get device codename from getprop or by reading the default.prop file
   * @returns {Promise<String>} codename
   */
  getDeviceName() {
    var _this = this;
    return _this
      .shell("getprop", "ro.product.device")
      .then(stdout => {
        if (!stdout || stdout.includes("getprop: not found")) {
          throw null;
        } else {
          return stdout.replace(/\W/g, "");
        }
      })
      .catch(e => {
        return _this
          .shell("cat", "default.prop")
          .catch(e => {
            throw new Error("getprop error: " + e);
          })
          .then(stdout => {
            if (stdout && stdout.includes("ro.product.device=")) {
              return stdout
                .split("\n")
                .filter(p => p.includes("ro.product.device="))[0]
                .replace("ro.product.device=", "")
                .trim();
            } else {
              throw new Error("unknown getprop error");
            }
          });
      });
  }

  /**
   * Find out what operating system the device is running (currently android and ubuntu touch)
   * @returns {Promise<String>} ubuntutouch, android
   */
  getOs() {
    return this.shell("cat", "/etc/system-image/channel.ini").then(stdout => {
      return stdout ? "ubuntutouch" : "android";
    });
  }

  /**
   * Find out if a device can be seen by adb
   * @returns {Promise<Boolean>} access?
   */
  hasAccess() {
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

  /**
   * Wait for a device
   * @param {Integer} interval how often to poll
   * @param {Integer} timeout when to time out
   */
  waitForDevice(interval, timeout) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      const accessInterval = setInterval(() => {
        _this
          .hasAccess()
          .then(access => {
            if (access) {
              clearInterval(accessInterval);
              clearTimeout(accessTimeout);
              resolve();
            }
          })
          .catch(error => {
            if (error) {
              clearInterval(accessInterval);
              clearTimeout(accessTimeout);
              reject(error);
            }
          });
      }, interval || 2000);
      const accessTimeout = setTimeout(() => {
        clearInterval(accessInterval);
        reject(new Error("no device: timeout"));
      }, timeout || 60000);
      _this.adbEvent.once("stop", () => {
        clearInterval(accessInterval);
        clearTimeout(accessTimeout);
        reject(new Error("stopped waiting"));
      });
    });
  }

  /**
   * Stop waiting for a device
   */
  stopWaiting() {
    this.adbEvent.emit("stop");
  }

  /**
   * Format partition
   * @param {String} partition partition to format
   * @returns {Promise}
   */
  format(partition) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .shell("cat", "/etc/recovery.fstab")
        .then(fstab => {
          if (!fstab || typeof fstab !== "string") {
            reject(new Error("unable to read recovery.fstab"));
          } else {
            const block = _this.findPartitionInFstab(partition, fstab);
            _this
              .shell("umount /" + partition)
              .then(() => {
                _this
                  .shell("make_ext4fs " + block)
                  .then(() => {
                    _this
                      .shell("mount /" + partition)
                      .then(error => {
                        if (error)
                          reject(new Error("failed to mount: " + error));
                        else resolve();
                      })
                      .catch(reject);
                  })
                  .catch(reject);
              })
              .catch(reject);
          }
        })
        .catch(error => {
          reject(new Error("failed to format " + partition + ": " + error));
        });
    });
  }

  /**
   * If cache can not be formated, rm it
   * @returns {Promise}
   */
  wipeCache() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      // TODO: move to Promise.prototype.finally() instead as soon as nodejs 8 dies in january 2020
      function rm() {
        _this
          .shell("rm", "-rf", "/cache/*")
          .then(resolve)
          .catch(e => reject(new Error("wiping cache failed: " + e)));
      }
      _this
        .format("cache")
        .then(rm)
        .catch(rm);
    });
  }

  /**
   * Find the partition associated with a mountpoint in an fstab
   * @param {String} partition partition to find
   * @param {String} fstab fstab
   * @returns {String} partition
   */
  findPartitionInFstab(partition, fstab) {
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

  /**
   * Find a partition and verify its type
   * @param {String} partition partition to verify
   * @param {String} type expected type
   * @returns {Promise<Boolean>} verified?
   */
  verifyPartitionType(partition, type) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .shell("mount")
        .then(stdout => {
          if (
            !(stdout.includes(" on /") && stdout.includes(" type ")) ||
            typeof stdout !== "string"
          ) {
            reject(new Error("unable to detect partitions"));
          } else if (!stdout.includes("/" + partition)) {
            reject(new Error("partition not found"));
          } else {
            resolve(stdout.includes(" on /" + partition + " type " + type));
          }
        })
        .catch(error =>
          reject(new Error("partition not found" + (error ? ": " + error : "")))
        );
    });
  }

  /**
   * size of a file or directory
   * @param {String} file file or directory
   * @returns {Promise<Float>} size
   */
  getFileSize(file) {
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

  /**
   * available size of a partition
   * @param {String} partition partition to check
   * @returns {Promise<Integer>} available size
   */
  getAvailablePartitionSize(partition) {
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

  /**
   * total size of a partition
   * @param {String} partition partition to check
   * @returns {Promise<Integer>} total size
   */
  getTotalPartitionSize(partition) {
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

  /**
   * Backup "srcfile" from the device to local tar "destfile"
   * @param {String} srcfile file to back up
   * @param {String} destfile target destination
   * @param {Function} progress progress function
   * @returns {Promise}
   */
  createBackupTar(srcfile, destfile, progress) {
    return Promise.all([
      this.ensureState("recovery")
        .then(() => this.shell("mkfifo /backup.pipe"))
        .then(() => this.getFileSize(srcfile)),
      fs.ensureFile(destfile)
    ])
      .then(([fileSize]) => {
        progress(0);
        // FIXME with gzip compression (the -z flag on tar), the progress estimate is way off. It's still beneficial to enable it, because it saves a lot of space.
        const progressInterval = setInterval(() => {
          const { size } = fs.statSync(destfile);
          progress((size / 1024 / fileSize) * 100);
        }, 1000);

        // FIXME replace shell pipe to dd with node stream
        return Promise.all([
          this.exec(
            "exec-out 'tar -cpz " +
              "--exclude=*/var/cache " +
              "--exclude=*/var/log " +
              "--exclude=*/.cache/upstart " +
              "--exclude=*/.cache/*.qmlc " +
              "--exclude=*/.cache/*/qmlcache " +
              "--exclude=*/.cache/*/qml_cache",
            srcfile,
            " 2>/backup.pipe' | dd of=" + destfile
          ),
          this.shell("cat /backup.pipe")
        ])
          .then(() => {
            clearInterval(progressInterval);
            progress(100);
          })
          .catch(e => {
            clearInterval(progressInterval);
            throw new Error(e);
          });
      })
      .then(() => this.shell("rm /backup.pipe"))
      .catch(e => {
        throw new Error(`Backup failed: ${e}`);
      });
  }

  /**
   * Restore tar "srcfile"
   * @param {String} srcfile file to restore
   * @returns {Promise}
   */
  restoreBackupTar(srcfile) {
    return this.ensureState("recovery")
      .then(() => this.shell("mkfifo /restore.pipe"))
      .then(() =>
        Promise.all([
          this.push(srcfile, "/restore.pipe"),
          this.shell("'cd /; cat /restore.pipe | tar -xvz'")
        ])
      )
      .then(() => this.shell("rm", "/restore.pipe"))
      .catch(e => {
        throw new Error(`Restore failed: ${e}`);
      });
  }

  /**
   * List backups
   * @param {String} backupBaseDir path to backup storage location
   * @returns {Promise<Array<Object>>} backup list
   */
  listUbuntuBackups(backupBaseDir) {
    return fs
      .readdir(backupBaseDir)
      .then(backups =>
        Promise.all(
          backups.map(backup =>
            fs
              .readFile(path.join(backupBaseDir, backup, "metadata.json"))
              .then(metadataBuffer => ({
                ...JSON.parse(metadataBuffer.toString()),
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
   * @param {String} backupBaseDir path to backup storage location
   * @param {String} [comment] description of the backup
   * @param {String} [dataPartition="/data"] data partition on the device
   * @param {Function} [progress] progress function
   * @returns {Promise<Object>} backup object
   */
  async createUbuntuTouchBackup(
    backupBaseDir,
    comment,
    dataPartition = "/data",
    progress = () => {}
  ) {
    const time = new Date();
    const dir = path.join(backupBaseDir, time.toISOString());
    return this.ensureState("recovery")
      .then(() => fs.ensureDir(dir))
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
          comment:
            comment || `Ubuntu Touch backup created on ${time.toISOString()}`,
          restorations: []
        };
        return fs
          .writeJSON(path.join(dir, "metadata.json"), metadata)
          .then(() => ({ ...metadata, dir }))
          .catch(e => {
            throw new Error(`Failed to restore: ${e}`);
          });
      });
  }

  /**
   * restore a full backup of ubuntu touch
   * @param {String} dir directory where backup is stored
   * @param {Function} [progress] progress function
   * @returns {Promise<Object>} backup object
   */
  async restoreUbuntuTouchBackup(dir, progress = () => {}) {
    progress(0); // FIXME report actual push progress
    let metadata = JSON.parse(
      await fs.readFile(path.join(dir, "metadata.json"))
    );
    return this.ensureState("recovery")
      .then(async () => {
        metadata.restorations = metadata.restorations || [];
        metadata.restorations.push({
          codename: await this.getDeviceName(),
          serialno: await this.getSerialno(),
          time: new Date().toISOString()
        });
      })
      .then(() => progress(10))
      .then(() => this.restoreBackupTar(path.join(dir, "system.tar.gz")))
      .then(() => progress(50))
      .then(() => this.restoreBackupTar(path.join(dir, "user.tar.gz")))
      .then(() => progress(90))
      .then(() => fs.writeJSON(path.join(dir, "metadata.json"), metadata))
      .then(() => this.reboot("system"))
      .then(() => progress(100))
      .then(() => ({ ...metadata, dir }))
      .catch(e => {
        throw new Error(`Failed to restore: ${e}`);
      });
  }
}

module.exports = Adb;
