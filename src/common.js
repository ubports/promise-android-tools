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

function handleError(error, stdout, stderr) {
  // hide commands that include sudo, so passwords don't get logged
  if (error.cmd && error.cmd.includes("sudo"))
    error.cmd = "masked for security";
  // console.log("error: " + JSON.stringify(error))
  // console.log("stdout: " + stdout)
  // console.log("stderr: " + stderr)
  if (stderr && stderr.includes("error: no devices/emulators found")) {
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
    return (
      (error ? "error: " + JSON.stringify(error) + "\n" : "") +
      (stdout ? "stdout: " + stdout + "\n" : "") +
      (stderr ? "stderr: " + stderr : "")
    );
  }
}

module.exports = {
  handleError: handleError
};
