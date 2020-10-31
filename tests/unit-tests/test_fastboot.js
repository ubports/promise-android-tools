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

const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const child_process = require("child_process");

const Fastboot = require("../../src/module.js").Fastboot;
const common = require("../../src/common.js");
const { getAndroidToolPath } = require("android-tools-bin");
const { fastbootErrors } = require("../test-data/known_errors.js");

function stubExec(error, stdout, stderr) {
  sinon.stub(child_process, "exec").yields(error, stdout, stderr);
}

function expectArgs(...args) {
  expect(child_process.exec).to.have.been.calledWith(
    [getAndroidToolPath("fastboot"), ...args].join(" ")
  );
}

function expectReject(error, message) {
  expect(error).to.be.instanceOf(Error);
  expect(error).to.haveOwnProperty("message", message);
}

describe("Fastboot module", function() {
  describe("constructor()", function() {
    it("should construct fastboot", function() {
      const fastboot = new Fastboot();
      expect(fastboot).to.exist;
      expect(fastboot.tool).to.eql("fastboot");
      expect(fastboot.executable).to.include("fastboot");
      expect(fastboot.extra).to.eql([]);
      expect(fastboot.execOptions).to.eql({});
    });
  });
  describe("basic functions", function() {
    describe("handleError()", function() {
      fastbootErrors.forEach(e =>
        it(`should return ${e.expectedReturn}`, function() {
          const fastboot = new Fastboot();
          fastboot.executable = "/path/to/fastboot";
          expect(fastboot.handleError(e.error, e.stdout, e.stderr)).to.deep.eql(
            e.expectedReturn
          );
        })
      );
    });
    describe("flash()", function() {
      it("should resolve if flashed successfully", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.flash("boot", "/path/to/image").then(r => {
          expectArgs("flash", "boot", common.quotepath("/path/to/image"));
          expect(child_process.exec).to.not.have.been.calledTwice;
        });
      });
      it("should reject if bootloader is locked", function(done) {
        stubExec(true, "", "FAILED (remote: 'Bootloader is locked.')");
        const fastboot = new Fastboot();
        fastboot.flash("boot", "/path/to/image").catch(error => {
          expectReject(error, "flashing failed: Error: bootloader is locked");
          expectArgs("flash", "boot", common.quotepath("/path/to/image"));
          done();
        });
      });
      it("should reject if flashing failed", function(done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.flash("boot", "/path/to/image").catch(error => {
          expectReject(
            error,
            'flashing failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
      });
    });
    describe("flashRaw()", function() {
      it("should resolve if flashed raw image successfully", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.flashRaw("boot", "/path/to/image").then(() => {
          expectArgs("flash:raw", "boot", common.quotepath("/path/to/image"));
        });
      });
      it("should resolve if force-flashed raw image successfully", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot
          .flashRaw("boot", "/path/to/image", "--force", "--disable-verity")
          .then(r => {
            expectArgs(
              "flash:raw",
              "boot",
              "--force",
              "--disable-verity",
              common.quotepath("/path/to/image")
            );
          });
      });
    });
    describe("boot()", function() {
      it("should resolve on boot", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.boot("/path/to/image").then(r => {
          expectArgs("boot", common.quotepath("/path/to/image"));
        });
      });
      it("should reject if booting failed", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(
          fastboot.boot("/path/to/image")
        ).to.have.been.rejectedWith(
          'booting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("update()", function() {
      it("should resolve if updating works", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.update("/path/to/image").then(r => {
          expectArgs("", "update", common.quotepath("/path/to/image"));
        });
      });
      it("should not wipe if not specified", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.update("/path/to/image").then(r => {
          expectArgs("", "update", common.quotepath("/path/to/image"));
        });
      });
      it("should wipe if specified", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.update("/path/to/image", true).then(r => {
          expectArgs("-w", "update", common.quotepath("/path/to/image"));
        });
      });
      it("should reject if updating fails", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(
          fastboot.update("/path/to/image")
        ).to.have.been.rejectedWith(
          'update failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("rebootBootloader()", function() {
      it("should resolve on reboot", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.rebootBootloader().then(r => {
          expectArgs("reboot-bootloader");
        });
      });
      it("should reject if rebooting fails", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.rebootBootloader()).to.have.been.rejectedWith(
          'rebooting to bootloader failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("reboot()", function() {
      it("should resolve on reboot", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.reboot().then(r => {
          expectArgs("reboot");
        });
      });
      it("should reject if rebooting fails", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.reboot()).to.have.been.rejectedWith(
          'rebooting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("continue()", function() {
      it("should resolve when boot continues", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.continue().then(r => {
          expectArgs("continue");
        });
      });
      it("should reject if continuing boot fails", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.continue()).to.have.been.rejectedWith(
          'continuing boot failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("format()", function() {
      it("should resolve after formatting", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.format("cache").then(r => {
          expectArgs("format", "cache");
        });
      });
      it("should reject if formatting failed", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.format("cache")).to.have.been.rejectedWith(
          'formatting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
      it("should reject if size was specified but not type", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(
          fastboot.format("cache", null, 69)
        ).to.have.been.rejectedWith(
          "formatting failed: size specification requires type to be specified as well"
        );
      });
      it("should resolve after formatting with type", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.format("cache", "ext4").then(r => {
          expectArgs("format:ext4", "cache");
        });
      });
      it("should resolve after formatting with type and size", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.format("cache", "ext4", 69).then(r => {
          expectArgs("format:ext4:69", "cache");
        });
      });
    });
    describe("erase()", function() {
      it("should resolve after erasing", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.erase("cache").then(r => {
          expectArgs("erase", "cache");
        });
      });
      it("should reject if erasing failed", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.erase("cache")).to.have.been.rejectedWith(
          'erasing failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("oemUnlock()", function() {
      it("should resolve after unlocking", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.oemUnlock().then(r => {
          expectArgs("oem", "unlock");
        });
      });
      it("should resolve if already unlocked", function() {
        stubExec(true, "FAILED (remote: Already Unlocked)");
        const fastboot = new Fastboot();
        return fastboot.oemUnlock().then(r => {
          expectArgs("oem", "unlock");
        });
      });
      it("should resolve if not necessary", function() {
        stubExec(
          true,
          "",
          "FAILED (remote: 'Not necessary')\nfastboot: error: Command failed"
        );
        const fastboot = new Fastboot();
        return fastboot.oemUnlock().then(r => {
          expectArgs("oem", "unlock");
        });
      });
      it("should reject if unlocking failed", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.oemUnlock()).to.have.been.rejectedWith(
          'oem unlock failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("oemLock()", function() {
      it("should resolve after locking", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.oemLock().then(r => {
          expectArgs("oem", "lock");
        });
      });
      it("should reject if locking failed", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.oemLock()).to.have.been.rejectedWith(
          'oem lock failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("setActive()", function() {
      it("should resolve after setting active slot", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.setActive("a").then(r => {
          expectArgs("--set-active=a");
        });
      });
      it("should reject if locking failed", function() {
        stubExec(
          {
            killed: false,
            code: 1,
            signal: null,
            cmd: "fastboot --set-active=a"
          },
          "",
          "error: Device does not support slots."
        );

        const fastboot = new Fastboot();
        return expect(fastboot.setActive("a")).to.have.been.rejectedWith(
          'failed to set active slot: Error: {"error":{"code":1,"cmd":"fastboot --set-active=a"},"stderr":"error: Device does not support slots."}'
        );
      });
      it("should reject if locking failed with non-zero exit code", function() {
        stubExec(null, "error: everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.setActive("a")).to.have.been.rejectedWith(
          "failed to set active slot: Error: error: everything exploded"
        );
      });
    });
  });
  describe("convenience functions", function() {
    describe("flashArray()", function() {
      it("should resolve if flashed successfully", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot
          .flashArray([
            { partition: "p1", file: "f1" },
            { partition: "p2", file: "f2", raw: true },
            { partition: "p3", file: "f3", raw: true, flags: ["--force"] },
            {
              partition: "p4",
              file: "f4",
              flags: ["--disable-verification", "--disable-verity"]
            }
          ])
          .then(r => {
            expectArgs("flash", "p1", common.quotepath("f1"));
            expectArgs("flash:raw", "p2", common.quotepath("f2"));
            expectArgs("flash:raw", "p3", "--force", common.quotepath("f3"));
            expectArgs(
              "flash",
              "p4",
              "--disable-verification",
              "--disable-verity",
              common.quotepath("f4")
            );
          });
      });
      it("should reject if flashing failed", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
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
        stubExec(null, "0123456789ABCDEF	fastboot");
        const fastboot = new Fastboot();
        return fastboot.hasAccess().then(r => {
          expect(r).to.eql(true);
          expectArgs("devices");
        });
      });
      it("should resolve false if no device is detected", function() {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.hasAccess().then(r => {
          expect(r).to.eql(false);
          expectArgs("devices");
        });
      });
      it("should reject on error", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.hasAccess()).to.be.rejectedWith(
          "everything exploded"
        );
      });
    });
    describe("waitForDevice()", function() {
      it("should resolve when a device is detected", function() {
        stubExec(null, "0123456789ABCDEF	fastboot");
        const fastboot = new Fastboot();
        return fastboot.waitForDevice(1).then(r => {
          expectArgs("devices");
        });
      });
      it("should reject on error", function() {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.waitForDevice(5, 10)).to.be.rejectedWith(
          "everything exploded"
        );
      });
      it("should reject on timeout", function() {
        stubExec();
        const fastboot = new Fastboot();
        return expect(fastboot.waitForDevice(5, 10)).to.be.rejectedWith(
          "no device: timeout"
        );
      });
    });
    describe("stopWaiting()", function() {
      it("should cause waitForDevice() to reject", function() {
        stubExec();
        const fastboot = new Fastboot();
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
