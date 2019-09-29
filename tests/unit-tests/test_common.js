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

const fs = require('fs');
const request = require('request');

const chai = require('chai');
var sinonChai = require("sinon-chai");
var expect = chai.expect;
chai.use(sinonChai);

const common = require('../../src/common.js');

const recognizedErrors = [
  {
    expectedReturn: "no device",
    error: {"killed": false, "code": 1, "signal": null, "cmd": "command"},
    stdout: undefined,
    stderr: "error: no devices/emulators found"
  }
]

describe('Common module', function() {
  describe("handleError()", function() {
    it("should hide password in command", function() {
      expect(common.handleError({cmd: "sudo command"})).to.equal("error: {\"cmd\":\"masked for security\"}\n");
    });
    recognizedErrors.forEach((re) => {
      it("should return \"" + re.expectedReturn + "\"", function() {
        expect(common.handleError(re.error, re.stdout, re.stderr)).to.equal(re.expectedReturn)
      });
    });
  });
});
