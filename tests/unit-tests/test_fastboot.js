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
const exec = require("child_process").exec;
const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const Fastboot = require("../../src/module.js").Fastboot;

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
        const execStub = (args, callback) => {
          exec(
            "node tests/test-data/fake_executable.js " + args.join(" "),
            callback
          );
        };
        const logStub = sinon.stub();
        const fastboot = new Fastboot({ exec: execStub, log: logStub });
        return fastboot
          .execCommand(["some", "test", "arguments"])
          .then((r, r2, r3) => {
            expect(r).to.equal("some test arguments");
          });
      });
      it("called executable should be able to access files", function() {
        const execStub = (args, callback) => {
          exec(
            "node tests/test-data/fake_fileaccesser.js " +
              args[args.length - 2],
            callback
          );
        };
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execStub, log: logSpy });
        return fastboot
          .execCommand(["tests/test-data/test_file", "/tmp/target"])
          .then(r => {
            expect(r).to.equal(undefined);
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
            "/path/to/image"
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
          fastboot.flash("boot", "/path/to/image")
        ).to.have.been.rejectedWith("error: true");
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
          expect(execFake).to.have.been.calledWith(["boot", "/path/to/image"]);
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
        ).to.have.been.rejectedWith("error: true");
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
            "/path/to/image"
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
            "/path/to/image"
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
        ).to.have.been.rejectedWith("error: true");
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
          "error: true"
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
          "error: true"
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
          "error: true"
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
          "error: true"
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
      it("should reject if unlocking failed", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, "everything exploded");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return expect(fastboot.oemUnlock()).to.have.been.rejectedWith(
          "error: true"
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
          "error: true"
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
            { partition: "p", file: "f" },
            { partition: "p", file: "f" }
          ])
          .then(r => {
            expect(execFake).to.have.been.called;
            expect(execFake).to.have.been.calledWith(["flash", "p", "f"]);
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
    describe("waitForDevice()", function() {
      it("should resolve immediately", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "0123456789ABCDEF	fastboot");
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return fastboot.waitForDevice(5).then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith(["devices"]);
        });
      });
    });
    describe("stopWaiting()", function() {
      it("should quietly stop waiting", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const fastboot = new Fastboot({ exec: execFake, log: logSpy });
        return new Promise(function(resolve, reject) {
          const wait = fastboot.waitForDevice(5);
          setTimeout(() => {
            fastboot.stopWaiting();
            expect(wait).to.be.rejectedWith("stopped waiting");
            resolve();
          }, 10);
        });
      });
    });
  });
});
