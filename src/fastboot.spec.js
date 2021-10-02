"use strict";

/*
 * Copyright (C) 2017-2021 UBports Foundation <info@ubports.com>
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

import { jest, expect } from "@jest/globals";

import child_process from "child_process";

import { Fastboot } from "./module.js";
import { getAndroidToolPath } from "android-tools-bin";
import { fastbootErrors } from "../tests/test-data/known_errors.js";

function stubExec(error, stdout, stderr) {
  child_process.execFile = jest.fn((file, args, opts, cb) =>
    cb(error, stdout, stderr)
  );
}

function expectArgs(...args) {
  expect(child_process.execFile).toHaveBeenCalledWith(
    getAndroidToolPath("fastboot"),
    args,
    expect.any(Object),
    expect.any(Function)
  );
}

function expectReject(error, message) {
  expect(error).toBeInstanceOf(Error);
  expect(error).toHaveProperty("message", message);
}

describe("Fastboot module", function () {
  describe("constructor()", function () {
    it("should construct fastboot", function () {
      const fastboot = new Fastboot();
      expect(fastboot).toExist;
      expect(fastboot.tool).toEqual("fastboot");
      expect(fastboot.executable).toMatch("fastboot");
      expect(fastboot.extra).toEqual([]);
      expect(fastboot.execOptions).toEqual({});
    });
  });
  describe("basic functions", function () {
    describe("handleError()", function () {
      fastbootErrors.forEach(e =>
        it(`should return ${e.expectedReturn}`, function () {
          const fastboot = new Fastboot();
          fastboot.executable = "/path/to/fastboot";
          expect(fastboot.handleError(e.error, e.stdout, e.stderr)).toBe(
            e.expectedReturn
          );
        })
      );
    });
    describe("flash()", function () {
      it("should resolve if flashed successfully", function () {
        let i = 0;
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(0, null), 5)),
          stdout: {
            on: jest.fn((_, cb) => cb("a"))
          },
          stderr: {
            on: jest.fn((_, cb) => {
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
        child_process.spawn = jest.fn().mockReturnValue(child);
        const fastboot = new Fastboot();
        fastboot.wait = jest.fn().mockResolvedValue();
        const progress = jest.fn();
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
            expect(r).toEqual(undefined);
            expect(child_process.spawn).toHaveBeenCalledWith(
              fastboot.executable,
              ["flash", "boot", "/path/to/boot.img"],
              { env: { ADB_TRACE: "rwx" } }
            );
            expect(child_process.spawn).toHaveBeenCalledWith(
              fastboot.executable,
              [
                "flash:raw",
                "recovery",
                "--force",
                "--disable-verity",
                "/path/to/recovery.img"
              ],
              { env: { ADB_TRACE: "rwx" } }
            );
            expect(progress).toHaveBeenCalledWith(0);
            expect(progress).toHaveBeenCalledWith(0.15);
            expect(progress).toHaveBeenCalledWith(0.45);
            expect(progress).toHaveBeenCalledWith(0.575);
            expect(progress).toHaveBeenCalledWith(0.725);
            expect(progress).toHaveBeenCalledWith(0.65);
            expect(progress).toHaveBeenCalledWith(0.95);
            expect(progress).toHaveBeenCalledWith(1);
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
            on: jest.fn(),
            once: jest.fn((_, cb) => setTimeout(() => cb(1, null), 5)),
            stdout: {
              on: jest.fn((_, cb) => cb(variation.stdout))
            },
            stderr: {
              on: jest.fn((_, cb) => cb(variation.stderr))
            }
          };
          child_process.spawn = jest.fn().mockReturnValue(child);
          const fastboot = new Fastboot();
          fastboot.wait = jest.fn().mockResolvedValue();
          fastboot
            .flash([{ partition: "boot", file: "/path/to/image" }])
            .catch(error => {
              expectReject(error, variation.expectedError);
              expect(child_process.spawn).toHaveBeenCalledWith(
                fastboot.executable,
                ["flash", "boot", "/path/to/image"],
                { env: { ADB_TRACE: "rwx" } }
              );
              done();
            });
        })
      );
      it("should reject if wait rejected", function (done) {
        child_process.spawn = jest.fn();
        const fastboot = new Fastboot();
        fastboot.wait = jest.fn().mockRejectedValue("wait error");
        fastboot.flash([]).catch(e => {
          expectReject(e, "Flashing failed: wait error");
          expect(child_process.spawn).not.toHaveBeenCalled;
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
      it("should reject if booting failed", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.boot("/path/to/image").catch(error => {
          expectReject(
            error,
            'booting failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if updating fails", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.update("/path/to/image").catch(error => {
          expectReject(
            error,
            'update failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if rebooting fails", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.rebootBootloader().catch(error => {
          expectReject(
            error,
            'rebooting to bootloader failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if rebooting fails", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.reboot().catch(error => {
          expectReject(
            error,
            'rebooting failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if continuing boot fails", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.continue().catch(error => {
          expectReject(
            error,
            'continuing boot failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if formatting failed", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.format("cache").catch(error => {
          expectReject(
            error,
            'formatting failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
      });
      it("should reject if size was specified but not type", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.format("cache", null, 69).catch(error => {
          expectReject(
            error,
            "formatting failed: size specification requires type to be specified as well"
          );
          done();
        });
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
      it("should reject if erasing failed", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.erase("cache").catch(error => {
          expectReject(
            error,
            'erasing failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if unlocking failed", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.oemUnlock().catch(error => {
          expectReject(
            error,
            'oem unlock failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
      it("should reject if locking failed", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.oemLock().catch(error => {
          expectReject(
            error,
            'oem lock failed: Error: {"error":true,"stdout":"everything exploded"}'
          );
          done();
        });
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
            expect(r).toEqual(null);
            expectArgs(...f.args);
          });
        });
        it(`should reject if ${f.args.join(" ")} failed`, function (done) {
          stubExec(true);
          const fastboot = new Fastboot();
          fastboot[f.f]().catch(r => {
            expect(r.message).toEqual('{"error":true}');
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
          expect(r).toEqual(true);
          expectArgs("flashing", "get_unlock_ability");
        });
      });
      it("should resolve false if not unlockable", function () {
        stubExec(null, "0");
        const fastboot = new Fastboot();
        return fastboot.getUnlockAbility().then(r => {
          expect(r).toEqual(false);
          expectArgs("flashing", "get_unlock_ability");
        });
      });
      it("should resolve false on error", function () {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        return fastboot.getUnlockAbility().then(r => {
          expect(r).toEqual(false);
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
      it("should reject if locking failed", function (done) {
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
        fastboot.setActive("a").catch(error => {
          expectReject(
            error,
            'failed to set active slot: Error: {"error":{"code":1,"cmd":"fastboot --set-active=a"},"stderr":"error: Device does not support slots."}'
          );
          done();
        });
      });
      it("should reject if locking failed with non-zero exit code", function (done) {
        stubExec(null, "error: everything exploded");
        const fastboot = new Fastboot();
        fastboot.setActive("a").catch(error => {
          expectReject(
            error,
            "failed to set active slot: Error: error: everything exploded"
          );
          done();
        });
      });
    });
  });
  describe("convenience functions", function () {
    describe("hasAccess()", function () {
      it("should resolve true when a device is detected", function () {
        stubExec(null, "0123456789ABCDEF	fastboot");
        const fastboot = new Fastboot();
        return fastboot.hasAccess().then(r => {
          expect(r).toEqual(true);
          expectArgs("devices");
        });
      });
      it("should resolve false if no device is detected", function () {
        stubExec();
        const fastboot = new Fastboot();
        return fastboot.hasAccess().then(r => {
          expect(r).toEqual(false);
          expectArgs("devices");
        });
      });
      it("should reject on error", function (done) {
        stubExec(true, "everything exploded");
        const fastboot = new Fastboot();
        fastboot.hasAccess().catch(error => {
          expectReject(error, '{"error":true,"stdout":"everything exploded"}');
          done();
        });
      });
    });
    describe("wait()", function () {
      it("should resolve mode as soon as device is detected", function () {
        stubExec(null, "0123456789ABCDEF	fastboot");
        const fastboot = new Fastboot();
        return fastboot.wait().then(r => {
          expect(r).toEqual("bootloader");
          expectArgs("devices");
        });
      });
    });
    describe("getvar()", function () {
      it("should resolve bootloader var", function () {
        stubExec(null, null, "product: FP2\nFinished. Total time: 0.000s");
        const fastboot = new Fastboot();
        fastboot.hasAccess = jest.fn().mockResolvedValue(true);
        return fastboot.getvar("product").then(r => {
          expect(r).toEqual("FP2");
          expectArgs("getvar", "product");
        });
      });
      it("should reject on no device", function (done) {
        stubExec(1);
        const fastboot = new Fastboot();
        fastboot.hasAccess = jest.fn().mockResolvedValue(false);
        fastboot.getvar("product").catch(e => {
          expectReject(e, "no device");
          done();
        });
      });
      it("should reject on unexpected return", function (done) {
        stubExec(null, null, "foo: bar\nFinished. Total time: 0.000s");
        const fastboot = new Fastboot();
        fastboot.hasAccess = jest.fn().mockResolvedValue(true);
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
        fastboot.getvar = jest.fn().mockResolvedValue("FP2");
        return fastboot.getDeviceName("product").then(r => {
          expect(r).toEqual("FP2");
        });
      });
    });
  });
});
