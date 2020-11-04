"use strict";

/*
 * Copyright (C) 2019 UBports Foundation <info@ubports.com>
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
const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const child_process = require("child_process");

const Heimdall = require("../../src/module.js").Heimdall;
const common = require("../../src/common.js");
const { getAndroidToolPath } = require("android-tools-bin");
const { heimdallErrors } = require("../test-data/known_errors.js");

function stubExec(error, stdout, stderr) {
  sinon.stub(child_process, "execFile").yields(error, stdout, stderr);
}

function expectArgs(...args) {
  expect(child_process.execFile).to.have.been.calledWith(
    getAndroidToolPath("heimdall"),
    args
  );
}

function expectReject(error, message) {
  expect(error).to.be.instanceOf(Error);
  expect(error).to.haveOwnProperty("message", message);
}

const printPitFromDevice = `Heimdall v1.4.0

a lot of bullshit text goes here...


--- Entry #0 ---
Binary Type: 0 (AP)
Device Type: 2 (MMC)
Identifier: 1
Attributes: 5 (Read/Write)
Update Attributes: 1 (FOTA)
Partition Block Size/Offset: 8192
Partition Block Count: 38912
File Offset (Obsolete): 0
File Size (Obsolete): 0
Partition Name: APNHLOS
Flash Filename: NON-HLOS.bin
FOTA Filename:


--- Entry #1 ---
Binary Type: 0 (AP)
Device Type: 2 (MMC)
Identifier: 2
Attributes: 5 (Read/Write)
Update Attributes: 1 (FOTA)
Partition Block Size/Offset: 47104
Partition Block Count: 132928
File Offset (Obsolete): 0
File Size (Obsolete): 0
Partition Name: MODEM
Flash Filename: modem.bin
FOTA Filename:


--- Entry #2 ---
Binary Type: 0 (AP)
Device Type: 2 (MMC)
Identifier: 3
Attributes: 5 (Read/Write)
Update Attributes: 1 (FOTA)
Partition Block Size/Offset: 180032
Partition Block Count: 1024
File Offset (Obsolete): 0
File Size (Obsolete): 0
Partition Name: SBL1
Flash Filename: sbl1.mbn
FOTA Filename:

Ending session...
Rebooting device...
Releasing device interface...`;

describe("Heimdall module", function() {
  describe("constructor()", function() {
    it("should construct heimdall", function() {
      const heimdall = new Heimdall();
      expect(heimdall).to.exist;
      expect(heimdall.tool).to.eql("heimdall");
      expect(heimdall.executable).to.include("heimdall");
      expect(heimdall.extra).to.eql([]);
      expect(heimdall.execOptions).to.eql({});
    });
  });
  describe("basic functions", function() {
    describe("handleError()", function() {
      heimdallErrors.forEach(e =>
        it(`should return ${e.expectedReturn}`, function() {
          const heimdall = new Heimdall();
          heimdall.executable = "/path/to/heimdall";
          expect(heimdall.handleError(e.error, e.stdout, e.stderr)).to.deep.eql(
            e.expectedReturn
          );
        })
      );
    });

    describe("hasAccess()", function() {
      it("should resolve true when a device is detected", function() {
        stubExec(null, "0123456789ABCDEF	heimdall");
        const heimdall = new Heimdall();
        return heimdall.hasAccess().then(r => {
          expect(r).to.eql(true);
          expectArgs("detect");
        });
      });
      it("should resolve false if no device is detected", function() {
        stubExec(
          true,
          "",
          "ERROR: Failed to detect compatible download-mode device."
        );
        const heimdall = new Heimdall();
        return heimdall.hasAccess().then(r => {
          expect(r).to.eql(false);
          expectArgs("detect");
        });
      });
      it("should reject on error", function() {
        stubExec(true, "everything exploded");
        const heimdall = new Heimdall();
        return expect(heimdall.hasAccess()).to.be.rejectedWith(
          "everything exploded"
        );
      });
    });
    describe("wait()", function() {
      it("should resolve mode as soon as device is detected", function() {
        stubExec(null, "0123456789ABCDEF	heimdall");
        const heimdall = new Heimdall();
        return heimdall.wait().then(r => {
          expect(r).to.eql("download");
          expectArgs("detect");
        });
      });
    });
    describe("printPit()", function() {
      it("should print pit from device", function() {
        stubExec(null, printPitFromDevice);
        const heimdall = new Heimdall();
        return heimdall.printPit().then(r => {
          expect(r.length).to.eql(3);
          expectArgs("print-pit");
        });
      });
      it("should print pit file", function() {
        stubExec(null, printPitFromDevice);
        const heimdall = new Heimdall();
        return heimdall.printPit("/test/test-data/test_file").then(r => {
          expect(r.length).to.eql(3);
          expectArgs(
            "print-pit",
            "--file",
            common.quotepath("/test/test-data/test_file")
          );
        });
      });
      it("should reject on error", function() {
        stubExec(
          true,
          null,
          "Initialising connection...\nDetecting device...\nERROR: Failed to detect compatible download-mode device."
        );
        const heimdall = new Heimdall();
        return expect(heimdall.printPit()).to.be.rejectedWith("no device");
      });
    });
    describe("flash()", function() {
      it("should flash partitions", function() {
        stubExec(null, "OK");
        const heimdall = new Heimdall();
        return heimdall
          .flash([
            {
              partition: "BOOT",
              file: "some.img"
            },
            {
              partition: "RECOVERY",
              file: "other.img"
            }
          ])
          .then(r => {
            expect(r).to.eql(null);
            expectArgs(
              "flash",
              `--BOOT ${common.quotepath("some.img")}`,
              `--RECOVERY ${common.quotepath("other.img")}`
            );
          });
      });
      it("should reject on error", function() {
        stubExec(
          true,
          null,
          "Initialising connection...\nDetecting device...\nERROR: Failed to detect compatible download-mode device."
        );

        const heimdall = new Heimdall();
        return expect(
          heimdall.flash([
            {
              partition: "BOOT",
              file: "some.img"
            }
          ])
        ).to.be.rejectedWith("no device");
      });
    });
  });
  describe("convenience functions", function() {
    describe("getPartitions()", function() {
      it("should get partitions from device pit", function() {
        stubExec(null, printPitFromDevice);
        const heimdall = new Heimdall();
        return heimdall.getPartitions().then(r => {
          expect(r.length).to.eql(3);
          expectArgs("print-pit");
        });
      });
    });
    describe("detect()", function() {
      it("shold call hasAccess()", function() {
        const heimdall = new Heimdall();
        heimdall.hasAccess = sinon.spy();
        heimdall.detect();
        expect(heimdall.hasAccess).to.have.been.called;
      });
    });
  });
});
