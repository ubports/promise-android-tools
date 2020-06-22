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

const Heimdall = require("../../src/module.js").Heimdall;

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
Releasing device interface...`

describe("Heimdall module", function() {
  describe("constructor()", function() {
    it("should create default heimdall when called without arguments", function() {
      const heimdall = new Heimdall();
      expect(heimdall.exec).to.exist;
      expect(heimdall.log).to.equal(console.log);
    });
    it("should create default heimdall when called with unrelated object", function() {
      const heimdall = new Heimdall({});
      expect(heimdall.exec).to.exist;
      expect(heimdall.log).to.equal(console.log);
    });
    it("should create custom heimdall when called with valid options", function() {
      const execStub = sinon.stub();
      const logStub = sinon.stub();
      const heimdall = new Heimdall({ exec: execStub, log: logStub });
      expect(heimdall.exec).to.equal(execStub);
      expect(heimdall.exec).to.not.equal(logStub);
      expect(heimdall.log).to.equal(logStub);
      expect(heimdall.log).to.not.equal(execStub);
    });
  });
  describe("private functions", function() {
    describe("exec()", function() {
      it("should call the specified function", function() {
        const execSpy = sinon.spy();
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execSpy, log: logSpy });
        heimdall.exec("This is an argument");
        expect(execSpy).to.have.been.calledWith("This is an argument");
      });
    });
    describe("execCommand()", function() {
      it("should call an executable with specified argument", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(null, args.join(" "))
        );
        const logStub = sinon.stub();
        const heimdall = new Heimdall({ exec: execFake, log: logStub });
        return heimdall.execCommand(["some", "test arguments"]).then(r => {
          expect(execFake).to.have.been.calledWith(["some", "test arguments"]);
          expect(r).to.equal("some test arguments");
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(
            {
              cmd: "heimdall " + args.join(" ")
            },
            "everything is on fire"
          )
        );
        const logStub = sinon.stub();
        const heimdall = new Heimdall({ exec: execFake, log: logStub });
        return heimdall
          .execCommand(["this", "will", "not", "work"])
          .catch(e => {
            expect(execFake).to.have.been.calledWith([
              "this",
              "will",
              "not",
              "work"
            ]);
            expect(e.message).to.equal(
              '{"error":{"cmd":"heimdall this will not work"},"stdout":"everything is on fire"}'
            );
          });
      });
    });
  });
  describe("basic functions", function() {
    describe("hasAccess()", function() {
      it("should resolve true when a device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "0123456789ABCDEF	heimdall");
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return heimdall.hasAccess().then(r => {
          expect(r).to.eql(true);
          expect(execFake).to.have.been.calledWith(["detect"]);
        });
      });
      it("should resolve false if no device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            true,
            "ERROR: Failed to detect compatible download-mode device."
          );
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return heimdall.hasAccess().then(r => {
          expect(r).to.eql(false);
          expect(execFake).to.have.been.calledWith(["detect"]);
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return expect(heimdall.hasAccess()).to.be.rejectedWith(
          "everything exploded"
        );
      });
    });
    describe("printPit()", function() {
      it("should print pit from device", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, printPitFromDevice);
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return heimdall.printPit().then(r => {
          expect(r.length).to.eql(3);
          expect(execFake).to.have.been.calledWith(["print-pit"]);
        });
      });
      it("should print pit file");
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            true,
            null,
            "Initialising connection...\nDetecting device...\nERROR: Failed to detect compatible download-mode device."
          );
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return expect(heimdall.printPit()).to.be.rejectedWith("no device");
      });
    });
    describe("flashArray()", function() {
      it("should flash partitions", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(false, "OK");
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return heimdall.flashArray([
          {
            partition: "BOOT",
            file: "some.img"
          }
        ]);
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            true,
            null,
            "Initialising connection...\nDetecting device...\nERROR: Failed to detect compatible download-mode device."
          );
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return expect(
          heimdall.flashArray([
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
        const execFake = sinon.fake((args, callback) => {
          callback(null, printPitFromDevice);
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return heimdall.getPartitions().then(r => {
          expect(r.length).to.eql(3);
          expect(execFake).to.have.been.calledWith(["print-pit"]);
        });
      });
    });
    describe("flash()", function() {
      it("shold call flashArray()", function() {
        const heimdall = new Heimdall();
        heimdall.flashArray = sinon.spy();
        heimdall.flash("BOOT", "some.img");
        expect(heimdall.flashArray).to.have.been.calledWith([
          {
            partition: "BOOT",
            file: "some.img"
          }
        ]);
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
    describe("waitForDevice()", function() {
      it("should resolve when a device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "0123456789ABCDEF	heimdall");
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return heimdall.waitForDevice(1).then(r => {
          expect(execFake).to.have.been.calledWith(["detect"]);
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return expect(heimdall.waitForDevice(5, 10)).to.be.rejectedWith(
          "everything exploded"
        );
      });
      it("should reject on timeout", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            true,
            "ERROR: Failed to detect compatible download-mode device."
          );
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return expect(heimdall.waitForDevice(5, 10)).to.be.rejectedWith(
          "no device: timeout"
        );
      });
    });
    describe("stopWaiting()", function() {
      it("should cause waitForDevice() to reject", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            true,
            "ERROR: Failed to detect compatible download-mode device."
          );
        });
        const logSpy = sinon.spy();
        const heimdall = new Heimdall({ exec: execFake, log: logSpy });
        return new Promise(function(resolve, reject) {
          const wait = heimdall.waitForDevice(5);
          setTimeout(() => {
            heimdall.stopWaiting();
            resolve(expect(wait).to.be.rejectedWith("stopped waiting"));
          }, 10);
        });
      });
    });
  });
});
