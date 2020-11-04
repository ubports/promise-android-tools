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

/**
 * Remove falsy values
 * @param {Object} obj object to process
 */
function removeFalsy(obj) {
  if (typeof obj !== "object" || Array.isArray(obj)) return obj;
  for (var i in obj) {
    if (!obj[i]) {
      delete obj[i];
    } else {
      obj[i] = removeFalsy(obj[i]);
      if (!obj[i]) {
        delete obj[i];
      }
    }
  }
  return Object.keys(obj).length ? obj : null;
}

/**
 * Add platform-specific quotes to path string (macos can't handle double quotes)
 * @param {String} file path to guard in quotes
 * @returns {String} guarded path
 */
function quotepath(file) {
  return process.platform == "darwin" ? "'" + file + "'" : '"' + file + '"';
}

module.exports = {
  quotepath,
  removeFalsy
};
