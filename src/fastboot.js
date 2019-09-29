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
const exec = require('child_process').exec;
const common = require("./common.js");

const DEFAULT_EXEC = (args, callback) => { exec("fastboot", args, callback); };
const DEFAULT_LOG = console.log;

class Fastboot {
  constructor(options) {
    this.exec = DEFAULT_EXEC;
    this.log = DEFAULT_LOG;

    if (options) {
      if (options.exec) this.exec = options.exec;
      if (options.log) this.log = options.log;
    }
  }

  // Exec a command with port argument
  execCommand(args) {
    var _this = this;
    return new Promise(function(resolve, reject) {
      _this.exec((args), (error, stdout, stderr) => {
        if (error) reject(common.handleError(error, stdout, (stderr ? stderr.trim() : undefined)));
        else if (stdout) resolve(stdout.trim());
        else resolve();
      });
    });
  }
}

module.exports = Fastboot;

// Missing functions
// boot
// erase
// getvar
// reboot-bootloader
// continue
// flash
// oem
// update
// devices
// flashall
// reboot
