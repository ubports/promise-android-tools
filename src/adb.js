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

const DEFAULT_EXEC = (args, callback) => { exec("adb", args, callback); };
const DEFAULT_LOG = console.log;

class Adb {
  constructor(options) {
    this.exec = DEFAULT_EXEC;
    this.log = DEFAULT_LOG;

    if (options) {
      this.exec = options.exec;
      this.log = options.log;
    }
  }
}

module.exports = Adb;
