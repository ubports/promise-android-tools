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
            reject("no permissions");
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
      _this.adbEvent.emit("stop");
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
                  reject("device accessible. Unkown error");
                } else {
                  reject("no accessible device");
                }
              })
              .catch(error => {
                if (error.includes("not found")) {
                  reject("no device found");
                } else if (error.includes("insufficient permissions")) {
                  reject("no permissions");
                } else {
                  //If we arrive here the error is unknown. It will be usefull to have it on the screen
                  reject(error);
                }
              });
          } else if (stdout && stdout.match(Exp)) {
            resolve(stdout.replace("\n", ""));
          } else {
            reject("invalid device id");
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
        reject("Can't access file: " + e);
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
          process.platform == "win32" ? "> nul" : "> /dev/null"
        ])
        .then(stdout => {
          clearInterval(progressInterval);
          resolve();
        })
        .catch(e => {
          clearInterval(progressInterval);
          reject("Push failed: " + e);
        });
    });
  }

  // Reboot to a state (system, recovery, bootloader)
  reboot(state) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      if (["system", "recovery", "bootloader"].indexOf(state) == -1) {
        reject("unknown state: " + state);
      } else {
        _this
          .execCommand(["reboot", state])
          .then(stdout => {
            if (stdout && stdout.includes("failed")) reject("reboot failed");
            else resolve();
          })
          .catch(e => reject("reboot failed: " + e));
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
            reject("Can't access file: " + e);
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
            .catch(e => reject("Failed to push file " + i + ": " + e));
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
                  reject("failed to cat default.prop: no response");
                }
              })
              .catch(e => reject("failed to cat default.prop: " + e));
          } else {
            resolve(stdout.replace(/\W/g, ""));
          }
        })
        .catch(e => reject("getprop error: " + e));
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
          else reject("unexpected response: " + stdout);
        })
        .catch(error => {
          if (error == "no device") resolve(false);
          else reject(error);
        });
    });
  }

  // Wait for a device
  waitForDevice(timeout) {
    if (!timeout) timeout = 2000;
    var _this = this;
    return new Promise(function(resolve, reject) {
      let timer = setInterval(() => {
        _this
          .hasAccess()
          .then(access => {
            if (access) {
              clearInterval(timer);
              resolve();
            }
          })
          .catch(error => {
            if (error) {
              clearInterval(timer);
              reject(error);
            }
          });
      }, timeout);
      _this.adbEvent.once("stop", () => {
        clearInterval(timer);
        reject("stopped waiting");
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
        .then(fstab_ => {
          if (!fstab_) {
            reject("unable to read recovery.fstab");
          } else {
            var fstab = fstab_.split("\n");
            var block;
            fstab.forEach(fs => {
              if (!fs.includes(partition) || block) return;
              block = fs.split(" ")[0];
              if (!block.startsWith("/dev")) block = false;
            });
            if (!block) {
              reject("unable to read partition " + partition);
            } else {
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
                            reject(
                              "failed to format " + partition + " " + error
                            );
                          else resolve();
                        })
                        .catch(reject);
                    })
                    .catch(reject);
                })
                .catch(reject);
            }
          }
        })
        .catch(error => {
          reject("failed to format " + partition + ": " + error);
        });
    });
  }

  // If cache can not be formated, rm it
  wipeCache() {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this
        .format("cache")
        .then(resolve)
        .catch(() => {
          _this
            .shell(["rm", "-rf", "/cache/*"])
            .then(resolve)
            .catch(e => reject("wiping cache failed: " + e));
        });
    });
  }
}

module.exports = Adb;
