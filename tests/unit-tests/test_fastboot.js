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
const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const Fastboot = require("../../src/module.js").Fastboot;
const common = require("../../src/common.js");

describe("Fastboot module", function() {
  describe("constructor()", function() {
    it("should create default fastboot when called without arguments", function() {
      const fastboot = new Fastboot();
      expect(fastboot.exec).to.exist;
      expect(fastboot.log).to.equal(console.log);
    });
    it("should create default fastboot when called with unrelated object", function() {
      const fastboot = new Fastboot({});
      expect(fastboot.exec).to.exist;
      expect(fastboot.log).to.equal(console.log);
    });
    it("should create custom fastboot when called with valid options", function() {
      const execStub = sinon.stub();
      const logStub = sinon.stub();
      const fastboot = new Fastboot({ exec: execStub, log: logStub });
      expect(fastboot.exec).to.equal(execStub);
      expect(fastboot.exec).to.not.equal(logStub);
      expect(fastboot.log).to.equal(logStub);
      expect(fastboot.log).to.not.equal(execStub);
    });
  });
  describe("private functions", function() {
    describe("exec()", function() {
      it("should call the specified function", function() {
        const execSpy = sinon.spy();
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execSpy, log: logSpy });
        fastboot.exec("This is an argument");
        expect(execSpy).to.have.been.calledWith("This is an argument");
      });
    });
    describe("execCommand()", function() {
      it("should call an executable with specified argument", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(null, args.join(" "))
        );
        const logStub = sinon.stub();
        const fastboot = new Fastboot({ exec: execFake, log: logStub });
        return fastboot.execCommand(["some", "test arguments"]).then(r => {
          expect(execFake).to.have.been.calledWith(["some", "test arguments"]);
          expect(r).to.equal("some test arguments");
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(
            {
              cmd: "fastboot " + args.join(" ")
            },
            "everything is on fire"
          )
        );
        const logStub = sinon.stub();
        const fastboot = new Fastboot({ exec: execFake, log: logStub });
        return fastboot
          .execCommand(["this", "will", "not", "work"])
          .catch(e => {
            expect(execFake).to.have.been.calledWith([
              "this",
              "will",
              "not",
              "work"
            ]);
            expect(e.message).to.equal(
              '{"error":{"cmd":"fastboot this will not work"},"stdout":"everything is on fire"}'
            );
          });
      });
    });
  });
  describe("basic functions", function() {
    describe("flash()", function() {
      it("should resolve if flashed successfully", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.flash("boot", "/path/to/image").then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "flash",
            "boot",
            common.quotepath("/path/to/image")
          ]);
        });
      });
      it("should reject if bootloader is locked", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "", "FAILED (remote: 'Bootloader is locked.')");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(
          fastboot.flash("boot", "/path/to/image")
        ).to.have.been.rejectedWith(
          "flashing failed: Error: bootloader is locked"
        );
      });
      it("should reject if flashing failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(
          fastboot.flash("boot", "/path/to/image")
        ).to.have.been.rejectedWith(
          'flashing failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("boot()", function() {
      it("should resolve on boot", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.boot("/path/to/image").then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "boot",
            common.quotepath("/path/to/image")
          ]);
        });
      });
      it("should reject if booting failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(
          fastboot.boot("/path/to/image")
        ).to.have.been.rejectedWith(
          'booting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("update()", function() {
      it("should resolve if updating works", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.update("/path/to/image").then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "",
            "update",
            common.quotepath("/path/to/image")
          ]);
        });
      });
      it("should not wipe if not specified", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.update("/path/to/image").then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "",
            "update",
            common.quotepath("/path/to/image")
          ]);
        });
      });
      it("should wipe if specified", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.update("/path/to/image", true).then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "-w",
            "update",
            common.quotepath("/path/to/image")
          ]);
        });
      });
      it("should reject if updating fails", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(
          fastboot.update("/path/to/image")
        ).to.have.been.rejectedWith(
          'update failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("rebootBootloader()", function() {
      it("should resolve on reboot", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.rebootBootloader().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["reboot-bootloader"]);
        });
      });
      it("should reject if rebooting fails", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.rebootBootloader()).to.have.been.rejectedWith(
          'rebooting to bootloader failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("reboot()", function() {
      it("should resolve on reboot", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.reboot().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["reboot"]);
        });
      });
      it("should reject if rebooting fails", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.reboot()).to.have.been.rejectedWith(
          'rebooting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("continue()", function() {
      it("should resolve when boot continues", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.continue().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["continue"]);
        });
      });
      it("should reject if continuing boot fails", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.continue()).to.have.been.rejectedWith(
          'continuing boot failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("format()", function() {
      it("should resolve after formatting", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.format("cache").then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["format", "cache"]);
        });
      });
      it("should reject if formatting failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.format("cache")).to.have.been.rejectedWith(
          'formatting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("erase()", function() {
      it("should resolve after erasing", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.erase("cache").then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["erase", "cache"]);
        });
      });
      it("should reject if erasing failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.erase("cache")).to.have.been.rejectedWith(
          'erasing failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("oemUnlock()", function() {
      it("should resolve after unlocking", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.oemUnlock().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["oem", "unlock"]);
        });
      });
      it("should resolve if already unlocked", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "FAILED (remote: Already Unlocked)");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.oemUnlock().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["oem", "unlock"]);
        });
      });
      it("should resolve if not necessary", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            true,
            "",
            "FAILED (remote: 'Not necessary')\nfastboot: error: Command failed"
          );
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.oemUnlock().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["oem", "unlock"]);
        });
      });
      it("should reject if unlocking failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.oemUnlock()).to.have.been.rejectedWith(
          'oem unlock failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("oemLock()", function() {
      it("should resolve after locking", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.oemLock().then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["oem", "lock"]);
        });
      });
      it("should reject if locking failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.oemLock()).to.have.been.rejectedWith(
          'oem lock failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
  });
  describe("convenience functions", function() {
    describe("flashArray()", function() {
      it("should resolve if flashed successfully", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot
          .flashArray([
            { partition: "p1", file: "f1" },
            { partition: "p2", file: "f2" }
          ])
          .then(r => {
            expect(execFake).to.have.been.calledTwice;
            expect(execFake).to.not.have.been.calledThrice;
            expect(execFake).to.have.been.calledWith([
              "flash",
              "p1",
              common.quotepath("f1")
            ]);
            expect(execFake).to.have.been.calledWith([
              "flash",
              "p2",
              common.quotepath("f2")
            ]);
          });
      });
      it("should reject if flashing failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(
          fastboot.flashArray([
            { partition: "p", file: "f" },
            { partition: "p", file: "f" }
          ])
        ).to.have.been.rejectedWith("flashing failed");
      });
      it("should report progress");
    });
    describe("hasAccess()", function() {
      it("should resolve true when a device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "0123456789ABCDEF	fastboot");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.hasAccess().then(r => {
          expect(r).to.eql(true);
          expect(execFake).to.have.been.calledWith(["devices"]);
        });
      });
      it("should resolve false if no device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback();
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.hasAccess().then(r => {
          expect(r).to.eql(false);
          expect(execFake).to.have.been.calledWith(["devices"]);
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.hasAccess()).to.be.rejectedWith(
          "everything exploded"
        );
      });
    });
    describe("waitForDevice()", function() {
      it("should resolve when a device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "0123456789ABCDEF	fastboot");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.waitForDevice(1).then(r => {
          expect(execFake).to.have.been.calledWith(["devices"]);
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.waitForDevice(5, 10)).to.be.rejectedWith(
          "everything exploded"
        );
      });
      it("should reject on timeout", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.waitForDevice(5, 10)).to.be.rejectedWith(
          "no device: timeout"
        );
      });
    });
    describe("stopWaiting()", function() {
      it("should cause waitForDevice() to reject", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return new Promise(function(resolve, reject) {
          const wait = fastboot.waitForDevice(5);
          setTimeout(() => {
            fastboot.stopWaiting();
            resolve(expect(wait).to.be.rejectedWith("stopped waiting"));
          }, 10);
        });
      });
    });
  });
});
