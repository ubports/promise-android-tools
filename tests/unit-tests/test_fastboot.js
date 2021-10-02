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

import chai from "chai";
import sinon from "sinon";
import chaiAsPromised from "chai-as-promised";
import sinonChai from "sinon-chai";
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

import child_process from "child_process";

import { Fastboot } from "../../src/module.js";
import { getAndroidToolPath } from "android-tools-bin";
import { fastbootErrors } from "../test-data/known_errors.js";

function stubExec(error, stdout, stderr) {
  sinon.stub(child_process, "execFile").yields(error, stdout, stderr);
}

function expectArgs(...args) {
  expect(child_process.execFile).to.have.been.calledWith(
    getAndroidToolPath("fastboot"),
    args
  );
}

function expectReject(error, message) {
  expect(error).to.be.instanceOf(Error);
  expect(error).to.haveOwnProperty("message", message);
}

describe("Fastboot module", function () {
  describe("constructor()", function () {
    it("should construct fastboot", function () {
      const fastboot = new Fastboot();
      expect(fastboot).to.exist;
      expect(fastboot.tool).to.eql("fastboot");
      expect(fastboot.executable).to.include("fastboot");
      expect(fastboot.extra).to.eql([]);
      expect(fastboot.execOptions).to.eql({});
    });
  });
  describe("basic functions", function () {
    describe("handleError()", function () {
      fastbootErrors.forEach(e =>
        it(`should return ${e.expectedReturn}`, function () {
          const fastboot = new Fastboot();
          fastboot.executable = "/path/to/fastboot";
          expect(fastboot.handleError(e.error, e.stdout, e.stderr)).to.deep.eql(
            e.expectedReturn
          );
        })
      );
    });
    describe("flash()", function () {
      it("should resolve if flashed successfully", function () {
        let i = 0;
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(0, null), 5)),
          stdout: {
            on: sinon.fake((_, cb) => cb("a"))
          },
          stderr: {
            on: sinon.fake((_, cb) => {
              if (i++ === 0) {
                cb("Sending 'boot'");
                setTimeout(() => cb("Writing 'boot'"), 1);
                setTimeout(() => cb("Finished 'boot'"), 2);
              } else {
                cb("Sending sparse 'userdata' 1/2 (62568 KB)");
                setTimeout(() => cb("Writing 'userdata'"), 1);
                setTimeout(
                  () => cb("Sending sparse 'userdata' 2/2 (62568 KB)"),
                  2
                );
                setTimeout(() => cb("Writing 'userdata'"), 3);
                setTimeout(() => cb("Finished 'userdata'"), 4);
              }
            })
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const fastboot = new Fastboot();
        sinon.stub(fastboot, "wait").resolves();
        const progress = sinon.spy();
        return fastboot
          .flash(
            [
              { partition: "boot", file: "/path/to/boot.img" },
              {
                partition: "recovery",
                file: "/path/to/recovery.img",
                raw: true,
                flags: ["--force", "--disable-verity"]
              }
            ],
            progress
          )
          .then(r => {
            expect(r).to.eql(undefined);
            expect(child_process.spawn).to.have.been.calledWith(
              fastboot.executable,
              ["flash", "boot", "/path/to/boot.img"]
            );
            expect(child_process.spawn).to.have.been.calledWith(
              fastboot.executable,
              [
                "flash:raw",
                "recovery",
                "--force",
                "--disable-verity",
                "/path/to/recovery.img"
              ]
            );
            expect(progress).to.have.been.calledWith(0);
            expect(progress).to.have.been.calledWith(0.15);
            expect(progress).to.have.been.calledWith(0.45);
            expect(progress).to.have.been.calledWith(0.575);
            expect(progress).to.have.been.calledWith(0.725);
            expect(progress).to.have.been.calledWith(0.65);
            expect(progress).to.have.been.calledWith(0.95);
            expect(progress).to.have.been.calledWith(1);
          });
      });
      [
        {
          description: "should reject if bootloader is locked",
          exit: 1,
          stdout: "",
          stderr: "FAILED (remote: 'Bootloader is locked.')",
          expectedError: "Flashing failed: bootloader locked"
        },
        {
          description: "should reject if flashing failed",
          exit: 1,
          stdout: "",
          stderr: "Sending sparse\neverything exploded",
          expectedError:
            'Flashing failed: {"error":{"code":1},"stderr":"everything exploded"}'
        }
      ].forEach(variation =>
        it(variation.description, function (done) {
          const child = {
            on: sinon.fake(),
            once: sinon.fake((_, cb) => setTimeout(() => cb(1, null), 5)),
            stdout: {
              on: sinon.fake((_, cb) => cb(variation.stdout))
            },
            stderr: {
              on: sinon.fake((_, cb) => cb(variation.stderr))
            }
          };
          sinon.stub(child_process, "spawn").returns(child);
          const fastboot = new Fastboot();
          sinon.stub(fastboot, "wait").resolves();
          fastboot
            .flash([{ partition: "boot", file: "/path/to/image" }])
            .catch(error => {
              expectReject(error, variation.expectedError);
              expect(child_process.spawn).to.have.been.calledWith(
                fastboot.executable,
                ["flash", "boot", "/path/to/image"]
              );
              done();
            });
        })
      );
      it("should reject if wait rejected", function (done) {
        sinon.stub(child_process, "spawn");
        const fastboot = new Fastboot();
        sinon.stub(fastboot, "wait").rejects("wait error");
        fastboot.flash([]).catch(e => {
          expectReject(e, "Flashing failed: wait error");
          expect(child_process.spawn).to.not.have.been.called;
          done();
        });
      });
    });
    describe("boot()", function () {
      it("should resolve on boot", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.boot("/path/to/image").then(r => {
          expectArgs("boot", "/path/to/image");
        });
      });
      it("should reject if booting failed", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(
          fastboot.boot("/path/to/image")
        ).to.have.been.rejectedWith(
          'booting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("update()", function () {
      it("should resolve if updating works", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.update("/path/to an/image").then(r => {
          expectArgs("", "update", "/path/to an/image");
        });
      });
      it("should not wipe if not specified", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.update("/path/to/image").then(r => {
          expectArgs("", "update", "/path/to/image");
        });
      });
      it("should wipe if specified", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.update("/path/to/image", true).then(r => {
          expectArgs("-w", "update", "/path/to/image");
        });
      });
      it("should reject if updating fails", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(
          fastboot.update("/path/to/image")
        ).to.have.been.rejectedWith(
          'update failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("rebootBootloader()", function () {
      it("should resolve on reboot", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.rebootBootloader().then(r => {
          expectArgs("reboot-bootloader");
        });
      });
      it("should reject if rebooting fails", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.rebootBootloader()).to.have.been.rejectedWith(
          'rebooting to bootloader failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("reboot()", function () {
      it("should resolve on reboot", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.reboot().then(r => {
          expectArgs("reboot");
        });
      });
      it("should reject if rebooting fails", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.reboot()).to.have.been.rejectedWith(
          'rebooting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("continue()", function () {
      it("should resolve when boot continues", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.continue().then(r => {
          expectArgs("continue");
        });
      });
      it("should reject if continuing boot fails", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.continue()).to.have.been.rejectedWith(
          'continuing boot failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("format()", function () {
      it("should resolve after formatting", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.format("cache").then(r => {
          expectArgs("format", "cache");
        });
      });
      it("should reject if formatting failed", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.format("cache")).to.have.been.rejectedWith(
          'formatting failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
      it("should reject if size was specified but not type", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(
          fastboot.format("cache", null, 69)
        ).to.have.been.rejectedWith(
          "formatting failed: size specification requires type to be specified as well"
        );
      });
      it("should resolve after formatting with type", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.format("cache", "ext4").then(r => {
          expectArgs("format:ext4", "cache");
        });
      });
      it("should resolve after formatting with type and size", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.format("cache", "ext4", 69).then(r => {
          expectArgs("format:ext4:69", "cache");
        });
      });
    });
    describe("erase()", function () {
      it("should resolve after erasing", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.erase("cache").then(r => {
          expectArgs("erase", "cache");
        });
      });
      it("should reject if erasing failed", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.erase("cache")).to.have.been.rejectedWith(
          'erasing failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("oemUnlock()", function () {
      it("should resolve after unlocking", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.oemUnlock().then(r => {
          expectArgs("oem", "unlock");
        });
      });
      it("should use code if specified", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.oemUnlock("0x0123456789ABCDEF").then(r => {
          expectArgs("oem", "unlock", "0x0123456789ABCDEF");
        });
      });
      it("should resolve if already unlocked", function () {
        stubExec(true, "FAILED (remote: Already Unlocked)");
        const fastboot = new Fastboot();
        return fastboot.oemUnlock().then(r => {
          expectArgs("oem", "unlock");
        });
      });
      it("should resolve if not necessary", function () {
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
      it("should reject if unlocking failed", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.oemUnlock()).to.have.been.rejectedWith(
          'oem unlock failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    describe("oemLock()", function () {
      it("should resolve after locking", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.oemLock().then(r => {
          expectArgs("oem", "lock");
        });
      });
      it("should reject if locking failed", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.oemLock()).to.have.been.rejectedWith(
          'oem lock failed: Error: {"error":true,"stdout":"everything exploded"}'
        );
      });
    });
    [
      { f: "flashingLock", args: ["flashing", "lock"] },
      { f: "flashingUnlock", args: ["flashing", "unlock"] },
      { f: "flashingLockCritical", args: ["flashing", "lock_critical"] },
      { f: "flashingUnlockCritical", args: ["flashing", "unlock_critical"] }
    ].forEach(f => {
      describe(`${f.f}()`, function () {
        it(`should resolve after ${f.args.join(" ")}`, function () {
          stubExec();
          const fastboot = new Fastboot();
          return fastboot[f.f]().then(r => {
            expect(r).to.eql(null);
            expectArgs(...f.args);
          });
        });
        it(`should reject if ${f.args.join(" ")} failed`, function (done) {
          stubExec(true);
          const fastboot = new Fastboot();
          fastboot[f.f]().catch(r => {
            expect(r.message).to.eql('{"error":true}');
            expectArgs(...f.args);
            done();
          });
        });
      });
    });
    describe("getUnlockAbility()", function () {
      it("should resolve true if unlockable", function () {
        stubExec(null, "1");
        const fastboot = new Fastboot();
        return fastboot.getUnlockAbility().then(r => {
          expect(r).to.eql(true);
          expectArgs("flashing", "get_unlock_ability");
        });
      });
      it("should resolve false if not unlockable", function () {
        stubExec(null, "0");
        const fastboot = new Fastboot();
        return fastboot.getUnlockAbility().then(r => {
          expect(r).to.eql(false);
          expectArgs("flashing", "get_unlock_ability");
        });
      });
      it("should resolve false on error", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return fastboot.getUnlockAbility().then(r => {
          expect(r).to.eql(false);
          expectArgs("flashing", "get_unlock_ability");
        });
      });
    });
    describe("setActive()", function () {
      it("should resolve after setting active slot", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.setActive("a").then(r => {
          expectArgs("--set-active=a");
        });
      });
      it("should reject if locking failed", function () {
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
      it("should reject if locking failed with non-zero exit code", function () {
        stubExec(null, "error: everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.setActive("a")).to.have.been.rejectedWith(
          "failed to set active slot: Error: error: everything exploded"
        );
      });
    });
  });
  describe("convenience functions", function () {
    describe("hasAccess()", function () {
      it("should resolve true when a device is detected", function () {
        stubExec(null, "0123456789ABCDEF	fastboot");
        const fastboot = new Fastboot();
        return fastboot.hasAccess().then(r => {
          expect(r).to.eql(true);
          expectArgs("devices");
        });
      });
      it("should resolve false if no device is detected", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.hasAccess().then(r => {
          expect(r).to.eql(false);
          expectArgs("devices");
        });
      });
      it("should reject on error", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return expect(fastboot.hasAccess()).to.be.rejectedWith(
          "everything exploded"
        );
      });
    });
    describe("wait()", function () {
      it("should resolve mode as soon as device is detected", function () {
        stubExec(null, "0123456789ABCDEF	fastboot");
        const fastboot = new Fastboot();
        return fastboot.wait().then(r => {
          expect(r).to.eql("bootloader");
          expectArgs("devices");
        });
      });
    });
    describe("getvar()", function () {
      it("should resolve bootloader var", function () {
        stubExec(null, null, "product: FP2\nFinished. Total time: 0.000s");
        const fastboot = new Fastboot();
        sinon.stub(fastboot, "hasAccess").resolves(true);
        return fastboot.getvar("product").then(r => {
          expect(r).to.eql("FP2");
          expectArgs("getvar", "product");
        });
      });
      it("should reject on no device", function (done) {
        stubExec(1);
        const fastboot = new Fastboot();
        sinon.stub(fastboot, "hasAccess").resolves(false);
        fastboot.getvar("product").catch(e => {
          expectReject(e, "no device");
          done();
        });
      });
      it("should reject on unexpected return", function (done) {
        stubExec(null, null, "foo: bar\nFinished. Total time: 0.000s");
        const fastboot = new Fastboot();
        sinon.stub(fastboot, "hasAccess").resolves(true);
        fastboot.getvar("product").catch(e => {
          expectReject(e, "Unexpected getvar return: foo");
          expectArgs("getvar", "product");
          done();
        });
      });
    });
    describe("getDeviceName()", function () {
      it("should resolve bootloader var", function () {
        const fastboot = new Fastboot();
        sinon.stub(fastboot, "getvar").resolves("FP2");
        return fastboot.getDeviceName("product").then(r => {
          expect(r).to.eql("FP2");
        });
      });
    });
  });
});
