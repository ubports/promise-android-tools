"use strict";

/*
 * Copyright (C) 2017-2019 UBports Foundation <info@ubports.com>
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
            common.handleError(
              error,
              stdout,
              stderr ? stderr.trim() : undefined
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
      _this.log("getting serial number");
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
                  //If we arrive here the error is unknown. It will be usefull to have it on the screen
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
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .execCommand(["shell"].concat(args))
        .then(stdout => {
          if (stdout) resolve(stdout.replace("\n", ""));
          else resolve();
        })
        .catch(reject);
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
      var hundredEmitted;
      var fileSize = fs.statSync(file)["size"];
      var lastSize = 0;
      var progressInterval = setInterval(() => {
        _this
          .shell(["stat", "-t", dest + "/" + path.basename(file)])
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
      var guardedfile = process.platform == "darwin" ? file : '"' + file + '"'; // macos can't handle double quotes
      // stdout needs to be muted to not exceed buffer on very large transmissions
      _this
        .execCommand([
          "push",
          guardedfile,
          dest,
          process.platform == "win32" ? ' | findstr /v "%]"' : ' | grep -v "%]"'
        ])
        .then(stdout => {
          clearInterval(progressInterval);
          if (stdout && stdout.includes("remote No space left on device")) {
            reject(new Error("Push failed: out of space"));
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

  //////////////////////////////////////////////////////////////////////////////
  // Convenience functions
  //////////////////////////////////////////////////////////////////////////////

  // Push an array of files and report progress
  // { src, dest }
  pushArray(files, progress) {
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
            .push(files[i].src, files[i].dest)
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
    return new Promise(function(resolve, reject) {
      _this
        .shell(["getprop", "ro.product.device"])
        .then(stdout => {
          if (!stdout || stdout.includes("getprop: not found")) {
            _this
              .shell(["cat", "default.prop"])
              .then(stdout => {
                if (stdout) {
                  resolve(
                    stdout
                      .split("\n")
                      .filter(p => p.includes("ro.product.device="))[0]
                      .replace("ro.product.device=", "")
                      .trim()
                  );
                } else {
                  reject(new Error("failed to cat default.prop: no response"));
                }
              })
              .catch(e =>
                reject(new Error("failed to cat default.prop: " + e))
              );
          } else {
            resolve(stdout.replace(/\W/g, ""));
          }
        })
        .catch(e => reject(new Error("getprop error: " + e)));
    });
  }

  // Find out what operating system the device is running (currently android and ubuntu touch)
  getOs() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .shell(["cat", "/etc/system-image/channel.ini"])
        .then(stdout => {
          resolve(stdout ? "ubuntutouch" : "android");
        })
        .catch(reject);
    });
  }

  // Find out if a device can be seen by adb
  hasAccess() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .shell(["echo", "."])
        .then(stdout => {
          if (stdout == ".") resolve(true);
          else reject(new Error("unexpected response: " + stdout));
        })
        .catch(error => {
          if (error == "no device") resolve(false);
          else reject(error);
        });
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
          reject(
            new Error("failed to format " + partition + ": " + error.message)
          );
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
}

module.exports = Adb;
