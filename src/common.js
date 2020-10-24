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
 * convert child_process callback data to escalabable string
 * @param {Object} error child_process error
 * @param {String} stdout stdout buffer string
 * @param {String} stderr stderr buffer string
 * @returns {String} error description
 */
function handleError(error, stdout, stderr) {
  // hide commands that include sudo, so passwords don't get logged
  if (error.cmd && error.cmd.includes("sudo"))
    error.cmd = "masked for security";
  // console.log("error: " + JSON.stringify(error))
  // console.log("stdout: " + stdout)
  // console.log("stderr: " + stderr)
  if (
    stderr &&
    (stderr.includes("error: no devices/emulators found") ||
      stderr.includes(
        "ERROR: Failed to detect compatible download-mode device."
      ))
  ) {
    return "no device";
  } else if (stderr && stderr.includes("error: device offline")) {
    return "device offline";
  } else if (
    error &&
    error.message &&
    error.message.includes("incorrect password")
  ) {
    return "incorrect password";
  } else if (
    stderr &&
    stderr.includes("FAILED (remote: low power, need battery charging.)")
  ) {
    return "low battery";
  } else if (
    stderr &&
    (stderr.includes("FAILED (remote: not supported in locked device)") ||
      stderr.includes("FAILED (remote: 'Bootloader is locked.')") ||
      stderr.includes("FAILED (remote: 'not allowed in locked state')") ||
      stderr.includes(
        "FAILED (remote: 'Device not unlocked cannot flash or erase')"
      ))
  ) {
    return "bootloader is locked";
  } else if (stderr && stderr.includes("FAILED (remote failure)")) {
    return "failed to boot";
  } else if (
    stderr &&
    (stderr.includes("I/O error") ||
      stderr.includes("FAILED (command write failed (No such device))") ||
      stderr.includes("FAILED (command write failed (Success))") ||
      stderr.includes("FAILED (status read failed (No such device))") ||
      stderr.includes("FAILED (data transfer failure (Broken pipe))") ||
      stderr.includes("FAILED (data transfer failure (Protocol error))"))
  ) {
    return "connection lost";
  } else if (
    stderr &&
    (stderr.includes("Killed") ||
      stderr.includes("adb server killed by remote request"))
  ) {
    return "Killed";
  } else {
    return JSON.stringify({
      error: error,
      stdout: stdout,
      stderr: stderr
    });
  }
}

/**
 * Add platform-specific quotes to path string (macos can't handle double quotes)
 * @param {String} file path to guard in quotes
 * @returns {String} guarded path
 */
function quotepath(file) {
  return process.platform == "darwin" ? "'" + file + "'" : '"' + file + '"';
}

/**
 * hack to filter a string from stdout to not exceed buffer
 * @param {String} query string to filter out
 * @returns {String} pipe to findstr on windows or grep on posix
 */
function stdoutFilter(query) {
  return process.platform == "win32"
    ? ' | findstr /v "' + query + '"'
    : ' | ( grep -v "' + query + '" || true )'; // grep will fail if there are no matches
}

module.exports = {
  handleError: handleError,
  quotepath: quotepath,
  stdoutFilter: stdoutFilter
};
