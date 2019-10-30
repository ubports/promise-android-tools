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
const request = require("request");

const chai = require("chai");
var sinonChai = require("sinon-chai");
var expect = chai.expect;
chai.use(sinonChai);

const common = require("../../src/common.js");

const recognizedErrors = [
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "error: no devices/emulators found"
  },
  {
    expectedReturn: "device offline",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "error: error: device offline"
  },
  {
    expectedReturn: "incorrect password",
    error: { message: "this error includes incorrect password" },
    stdout: undefined,
    stderr: undefined
  },
  {
    expectedReturn: "low battery",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: low power, need battery charging.)"
  },
  {
    expectedReturn: "failed to boot",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote failure)"
  },
  {
    expectedReturn: "connection lost",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "this is an I/O error"
  },
  {
    expectedReturn: "connection lost",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (command write failed (No such device))"
  },
  {
    expectedReturn: "connection lost",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (command write failed (Success))"
  },
  {
    expectedReturn: "connection lost",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (status read failed (No such device))"
  },
  {
    expectedReturn: "connection lost",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (data transfer failure (Broken pipe))"
  },
  {
    expectedReturn: "connection lost",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (data transfer failure (Protocol error))"
  },
  {
    expectedReturn: "Killed",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "adb died: Killed"
  },
  {
    expectedReturn: "Killed",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "adb server killed by remote request"
  }
];

describe("Common module", function() {
  describe("handleError()", function() {
    recognizedErrors.forEach(re => {
      it('should return "' + re.expectedReturn + '"', function() {
        expect(common.handleError(re.error, re.stdout, re.stderr)).to.equal(
          re.expectedReturn
        );
      });
    });
    it("should hide password in command", function() {
      expect(common.handleError({ cmd: "sudo command" })).to.equal(
        'error: {"cmd":"masked for security"}\n'
      );
    });
  });
});
