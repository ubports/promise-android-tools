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

const fs = require("fs");
const path = require("path");
const exec = require("child_process").exec;
const events = require("events");
const common = require("./common.js");

class Event extends events {}

const DEFAULT_EXEC = (args, callback) => {
  exec(
    ["adb"].concat(args).join(" "),
    { options: { maxBuffer: 1024 * 1024 * 2 } },
    callback
  );
};

const DEFAULT_LOG = console.log;
const DEFAULT_PORT = 5037;

class Adb {
  constructor(options) {
    this.exec = DEFAULT_EXEC;
    this.log = DEFAULT_LOG;
    this.port = DEFAULT_PORT;
    this.adbEvent = new Event();

    // Accept options
    if (options) {
      if (options.exec) {
        this.exec = options.exec;
      }
      if (options.log) {
        this.log = options.log;
      }
      if (options.port) {
        this.port = options.port;
      }
    }
  }

  // Exec a command with port argument
  execCommand(args) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.exec(["-P", _this.port].concat(args), (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              common.handleError(
                error,
                stdout,
                stderr ? stderr.trim() : undefined
              )
            )
          );
        } else if (stdout) {
          if (stdout.includes("no permissions")) {
            reject(new Error("no permissions"));
          } else {
            resolve(stdout.trim());
          }
        } else {
          resolve();
        }
      });
    });
  }

  // Kill all adb servers and start a new one to rule them all
  startServer() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.stopWaiting();
      _this
        .killServer()
        .then(() => {
          _this.log("starting adb server on port " + _this.port);
          _this
            .execCommand("start-server")
            .then(stdout => {
              resolve();
            })
            .catch(reject);
        })
        .catch(reject);
    });
  }

  // Kill all running servers
  killServer() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.stopWaiting();
      _this.log("killing all running adb servers");
      _this
        .execCommand("kill-server")
        .then(resolve)
        .catch(reject);
    });
  }

  // Get the devices serial number
  getSerialno() {
    var _this = this;
    var Exp = /^([0-9]|[a-z])+([0-9a-z]+)$/i;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand("get-serialno")
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

  shell(args) {
    return this.execCommand(["shell"].concat(args)).then(stdout => {
      if (stdout) return stdout.replace("\n", "");
      else return;
    });
  }

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
      var progressInterval = setInterval(() => {
        _this
          .shell([
            "stat",
            "-t",
            common.quotepath(dest + "/" + path.basename(file))
          ])
          .then(stat => {
            _this.adbEvent.emit(
              "push:progress:size",
              eval(stat.split(" ")[1]) - lastSize
            );
            lastSize = eval(stat.split(" ")[1]);
          })
          .catch(e => {
            clearInterval(progressInterval);
            _this.log("failed to stat: " + e);
          });
      }, interval || 1000);
      _this
        .execCommand([
          "push",
          common.quotepath(file),
          dest,
          common.stdoutFilter("%]")
        ])
        .then(stdout => {
          clearInterval(progressInterval);
          if (
            stdout &&
            (stdout.includes("no devices/emulators found") ||
              stdout.includes("couldn't read from device"))
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

  // Reboot to a state (system, recovery, bootloader)
  reboot(state) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      if (["system", "recovery", "bootloader"].indexOf(state) == -1) {
        reject(new Error("unknown state: " + state));
      } else {
        _this
          .execCommand(["reboot", state])
          .then(stdout => {
            if (stdout && stdout.includes("failed"))
              reject(new Error("reboot failed"));
            else resolve();
          })
          .catch(e => reject(new Error("reboot failed: " + e)));
      }
    });
  }

  // sideload an ota package
  sideload(file) {
    return this.execCommand([
      "sideload",
      common.quotepath(file),
      common.stdoutFilter("%)")
    ]);
  }

  // Return the status of the device (bootloader, recovery, device)
  getState() {
    return this.execCommand(["get-state"]).then(stdout => stdout.trim());
  }

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  // Reboot to a state (system, recovery, bootloader)
  ensureState(state) {
    return this.getState().then(currentState =>
      currentState === state ||
      (currentState === "device" && state === "system")
        ? Promise.resolve()
        : this.reboot(state)
    );
  }

  // Push an array of files and report progress
  // { src, dest }
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

  // Get device codename
  getDeviceName() {
    var _this = this;
    return _this
      .shell(["getprop", "ro.product.device"])
      .then(stdout => {
        if (!stdout || stdout.includes("getprop: not found")) {
          throw null;
        } else {
          return stdout.replace(/\W/g, "");
        }
      })
      .catch(e => {
        return _this
          .shell(["cat", "default.prop"])
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

  // Find out what operating system the device is running (currently android and ubuntu touch)
  getOs() {
    return this.shell(["cat", "/etc/system-image/channel.ini"]).then(stdout => {
      return stdout ? "ubuntutouch" : "android";
    });
  }

  // Find out if a device can be seen by adb
  hasAccess() {
    return this.shell(["echo", "."])
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

  // Wait for a device
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

  // Stop waiting for a device
  stopWaiting() {
    this.adbEvent.emit("stop");
  }

  // Format partition
  format(partition) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .shell(["cat", "/etc/recovery.fstab"])
        .then(fstab => {
          if (!fstab || typeof fstab !== "string") {
            reject(new Error("unable to read recovery.fstab"));
          } else {
            const block = _this.findPartitionInFstab(partition, fstab);
            _this.log("formatting " + block + " from recovery");
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

  // If cache can not be formated, rm it
  wipeCache() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      // TODO: move to Promise.prototype.finally() instead as soon as nodejs 8 dies in january 2020
      function rm() {
        _this
          .shell(["rm", "-rf", "/cache/*"])
          .then(resolve)
          .catch(e => reject(new Error("wiping cache failed: " + e)));
      }
      _this
        .format("cache")
        .then(rm)
        .catch(rm);
    });
  }

  // Find the partition associated with a mountpoint in an fstab
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

  // Find a partition and verify its type
  verifyPartitionType(partition, type) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .shell(["mount"])
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

  // Return the file size of a complete folder
  getFileSize(file) {
    // TODO verify that state detection is needed
    return this.getState()
      .then(state =>
        this.shell("du -shk " + file + (state == "device" ? " |tail -n1" : ""))
      )
      .then(stdout => parseFloat(stdout))
      .catch(e => {
        throw new Error(`Unable to get size: ${e}`);
      });
  }

  // Return the available size of a partition
  getAvailableSize(partition) {
    return this.ensureState("device")
      .then(() =>
        this.shell("df -hBK " + partition + " --output=avail|tail -n1")
      )
      .then(stdout => parseFloat(stdout))
      .catch(e => {
        throw new Error(`Unable to get size: ${e}`);
      });
  }

  // Return the total size of a partition
  getTotalSize(partition) {
    return this.ensureState("device")
      .then(() =>
        this.shell("df -hBK " + partition + " --output=size|tail -n1")
      )
      .then(stdout => parseFloat(stdout))
      .catch(e => {
        throw new Error(`Unable to get size: ${e}`);
      });
  }

  // Backup file "srcfile" from the device to "destfile" localy
  createRemoteUbuntuBackup(srcfile, destfile, progress) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      // Get file size
      _this
        .shell("mkfifo /backup.pipe")
        .then(() => _this.getFileSize(srcfile))
        .then(fileSize => {
          // Creating pipe
          var lastSize = 0;
          var progressInterval = setInterval(() => {
            const { size } = fs.statSync(destfile);
            progress((lastSize / fileSize) * 100);
            lastSize = size / 1024;
          }, 1000);

          // Start the backup
          _this.log("Starting Backup...");
          // FIXME replace shell pipe to dd with node stream
          Promise.all([
            _this.execCommand([
              "exec-out 'tar -cvp ",
              srcfile,
              " 2>/backup.pipe' | dd of=" + destfile
            ]),
            _this.shell("cat /backup.pipe")
          ])
            .then(() => {
              _this.log("Backup Ended");
              clearInterval(progressInterval);
              _this
                .shell("rm /backup.pipe")
                .then(() => {
                  _this.log("Pipe released.");
                  resolve();
                })
                .catch(e => {
                  reject(e + ", Unable to delete the pipe ");
                });
            })
            .catch(e => {
              clearInterval(progressInterval);
              reject(e + ", Unable to backuping the device ");
            });
        })
        .catch(e => {
          reject(e + ", Pipe creation failed ");
        });
    });
  }

  // Restore file "srcfile" from the computer to "destfile" on the phone
  applyRemoteUbuntuBackup(destfile, srcfile, adbpath, bckSize, progress) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      // Creating pipe
      _this
        .shell("mkfifo /restore.pipe")
        .then(stdout => {
          _this.log("Pipe created !");
          // Start the restoration
          _this.log("Starting Restore...");
          _this
            .execCommand([
              "push",
              srcfile,
              "/restore.pipe &",
              adbpath + "/adb -P",
              _this.port,
              " shell 'cd /; cat /restore.pipe | tar -xv'"
            ])
            .then((error, stdout, stderr) => {
              _this.log("Restore Ended");
              _this
                .shell("rm /restore.pipe")
                .then(() => {
                  _this.log("Pipe released.");
                  resolve(); // Everything's Fine !
                })
                .catch(e => {
                  reject(e);
                }); // Pipe Deletion
            })
            .catch(e => {
              reject(e);
            }); // Backup start
        })
        .catch(e => {
          reject(e);
        }); // Pipe Creation
    });
  }
}

module.exports = Adb;
