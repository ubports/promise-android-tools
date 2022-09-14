"use strict";

/*
 * Copyright (C) 2017-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2017-2022 Johannah Sprinz <hannah@ubports.com>
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
import fs from "fs-extra";
import path from "path";

import testrecoveryfstabs from "../tests/test-data/testrecoveryfstabs.js";

import { Adb } from "./module.js";
import { getAndroidToolPath } from "android-tools-bin";
import { adbErrors } from "../tests/test-data/known_errors.js";

function stubExec(error, stdout, stderr) {
  child_process.execFile = jest.fn((file, args, opts, cb) =>
    cb(error, stdout, stderr)
  );
}

function expectArgs(...args) {
  expect(child_process.execFile).toHaveBeenCalledWith(
    getAndroidToolPath("adb"),
    args,
    expect.any(Object),
    expect.any(Function)
  );
}

function expectReject(error, message) {
  expect(error).toBeInstanceOf(Error);
  expect(error).toHaveProperty("message", message);
}

describe("Adb module", function () {
  describe("constructor()", function () {
    it("should construct adb", function () {
      const adb = new Adb();
      expect(adb).toExist;
      expect(adb.tool).toEqual("adb");
      expect(adb.executable).toMatch("adb");
      expect(adb.flags).toEqual([]);
      expect(adb.execOptions).toEqual({});
    });
    it("should construct adb with options", function () {
      const adb = new Adb({
        allInterfaces: true,
        useUsb: true,
        useTcpIp: true,
        serialno: 1337,
        transportId: 69,
        port: 5038,
        host: "somewhere",
        protocol: "udp",
        exitOnWrite: true
      });
      expect(adb).toExist;
      expect(adb.tool).toEqual("adb");
      expect(adb.executable).toMatch("adb");
      expect(adb.flags).toEqual([
        "-a",
        "-d",
        "-e",
        "-s",
        1337,
        "-t",
        69,
        "-H",
        "somewhere",
        "-P",
        5038,
        "-L",
        "udp:somewhere:5038"
      ]);
      expect(adb.execOptions).toEqual({});
    });
  });

  describe("flag helpers", function () {
    [
      ["allInterfaces", ["-a"]],
      ["useUsb", ["-d"]],
      ["useTcpIp", ["-e"]],
      ["serialno", ["-s", "a"]],
      ["transportId", ["-t", "a"]],
      ["port", ["-P", "a"]],
      ["host", ["-H", "a"]],
      ["protocol", ["-L", "tcp:localhost:5037"]],
      ["exitOnWriteError", ["--exit-on-write-error"]]
    ].forEach(([flag, args]) =>
      it(`should have __${flag}`, function () {
        const adb = new Adb();
        expect(adb.flags).toEqual([]);
        expect(adb[`__${flag}`]("a").flags).toEqual(args);
        expect(adb.flags).toEqual([]);
      })
    );
  });

  describe("basic functions", function () {
    describe("kill()", function () {
      it("should kill child processes", function () {
        stubExec();
        const adb = new Adb();
        return adb.kill();
      });
    });

    describe("handleError()", function () {
      adbErrors.forEach(e =>
        it(`should return ${e.expectedReturn}`, function () {
          const adb = new Adb();
          adb.executable = "/path/to/adb";
          expect(adb.handleError(e.error, e.stdout, e.stderr)).toStrictEqual(
            e.expectedReturn
          );
        })
      );
    });

    describe("startServer()", function () {
      it("should kill all servers and start a new one", function () {
        stubExec();
        const adb = new Adb();
        return adb.startServer().then(r => {
          expect(r).toEqual(undefined);
          expect(child_process.execFile).toHaveBeenCalledTimes(2);
          expectArgs("kill-server");
          expectArgs("start-server");
        });
      });
    });

    describe("killServer()", function () {
      it("should kill all servers", function () {
        stubExec();
        const adb = new Adb();
        return adb.killServer().then(r => {
          expect(r).toEqual(undefined);
          expectArgs("kill-server");
        });
      });
    });

    describe("reconnect()", function () {
      it("should reconnect", function () {
        stubExec();
        const adb = new Adb();
        adb.killServer = jest.fn();
        adb.wait = jest.fn().mockResolvedValue("device");
        return adb.reconnect().then(r => {
          expect(r).toEqual("device");
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          expectArgs("reconnect");
        });
      });
      it("should reject on no device", function (done) {
        stubExec(null, "no devices/emulators found");
        const adb = new Adb();
        adb.killServer = jest.fn();
        adb.wait = jest.fn().mockResolvedValue("device");
        adb.reconnect().catch(error => {
          expectReject(error, "no device");
          done();
        });
      });
    });

    describe("reconnectDevice()", function () {
      it("should reconnect from device side", function () {
        stubExec();
        const adb = new Adb();
        adb.killServer = jest.fn();
        adb.wait = jest.fn().mockResolvedValue("device");
        return adb.reconnectDevice().then(r => {
          expect(r).toEqual("device");
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          expectArgs("reconnect", "device");
        });
      });
    });

    describe("reconnectOffline()", function () {
      it("should reconnect offline devices", function () {
        stubExec();
        const adb = new Adb();
        adb.killServer = jest.fn();
        adb.wait = jest.fn().mockResolvedValue("device");
        return adb.reconnectOffline().then(r => {
          expect(r).toEqual("device");
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          expectArgs("reconnect", "offline");
        });
      });
    });

    describe("devices()", function () {
      [
        {
          stdout: "List of devices attached\n",
          ret: []
        },
        {
          stdout:
            "List of devices attached\n" +
            "emulator-5554          device product:sdk_gphone_x86_arm model:AOSP_on_IA_Emulator device:generic_x86_arm transport_id:5",
          ret: [
            {
              serialno: "emulator-5554",
              product: "sdk_gphone_x86_arm",
              model: "AOSP_on_IA_Emulator",
              device: "generic_x86_arm",
              transport_id: "5",
              mode: "device"
            }
          ]
        },
        {
          stdout:
            "List of devices attached\n" +
            "8945062f               device product:Device model:V777_SWM device:Device transport_id:4\n" +
            "emulator-5554          device product:sdk_gphone_x86_arm model:AOSP_on_IA_Emulator device:generic_x86_arm transport_id:5",
          ret: [
            {
              serialno: "8945062f",
              product: "Device",
              model: "V777_SWM",
              device: "Device",
              transport_id: "4",
              mode: "device"
            },
            {
              serialno: "emulator-5554",
              product: "sdk_gphone_x86_arm",
              model: "AOSP_on_IA_Emulator",
              device: "generic_x86_arm",
              transport_id: "5",
              mode: "device"
            }
          ]
        }
      ].map(({ stdout, ret }, i) =>
        it(`should return list of ${i} devices`, function () {
          stubExec(null, stdout);
          const adb = new Adb();
          return adb.devices().then(r => {
            expect(r).toEqual(ret);
            expect(child_process.execFile).toHaveBeenCalledTimes(1);
            expectArgs("devices", "-l");
          });
        })
      );
    });

    describe("getSerialno()", function () {
      it("should return serialnumber", function () {
        stubExec(false, "1234567890ABCDEF\n");
        const adb = new Adb();
        return adb.getSerialno().then(r => {
          expect(r).toEqual("1234567890ABCDEF");
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          expectArgs("get-serialno");
        });
      });
      it("should throw on invalid stdout", function (done) {
        stubExec(false, "This is an invalid string");
        const adb = new Adb();
        adb.getSerialno().catch(error => {
          expectReject(
            error,
            "invalid serial number: This is an invalid string"
          );
          done();
        });
      });
    });

    describe("shell()", function () {
      it("should run command on device", function () {
        stubExec(null, "This string is returned over stdout");
        const adb = new Adb();
        return adb.shell(["one", "two", "three"]).then(r => {
          expect(r).toEqual("This string is returned over stdout");
          expect(child_process.execFile).toHaveBeenCalled;
        });
      });
    });

    describe("push()", function () {
      it("should resolve if called with empty files array", function () {
        child_process.spawn = jest.fn();
        const adb = new Adb();
        const progress = jest.fn();
        return adb.push([], null, progress).then(() => {
          expect(child_process.spawn).not.toHaveBeenCalled;
          expect(progress).toHaveBeenCalledWith(0);
          expect(progress).toHaveBeenCalledWith(1);
          expect(progress).toHaveBeenCalledTimes(2);
        });
      });
      it("should push files and resolve", function () {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(0, null), 10)),
          stdout: {
            on: jest.fn((_, cb) => cb("a"))
          },
          stderr: {
            on: jest.fn((_, cb) => {
              cb("some.cpp writex len=1337");
              cb("some.cpp writex len=NaN");
            })
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const progress = jest.fn();
        return adb
          .push(["tests/test-data/test_file"], null, progress)
          .then(() => {
            expect(child_process.spawn).toHaveBeenCalledTimes(1);
            expect(progress).toHaveBeenCalledWith(0);
            expect(progress).toHaveBeenCalledWith(1);
          });
      });
      it("should reject on error", function (done) {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: jest.fn((_, cb) => cb("a"))
          },
          stderr: {
            on: jest.fn((_, cb) => cb("b"))
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const progress = jest.fn();
        adb.push(["tests/test-data/test_file"], null, progress).catch(e => {
          expect(child_process.spawn).toHaveBeenCalledTimes(1);
          expect(progress).toHaveBeenCalledWith(0);
          expect(progress).toHaveBeenCalledTimes(1);
          expectReject(
            e,
            '{"error":{"code":666,"signal":"SIGTERM"},"stdout":"a","stderr":"b"}'
          );
          done();
        });
      });
      it("should reject on inaccessible file", function (done) {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: jest.fn((_, cb) =>
              cb("adb: error: cannot stat: 'file' No such file or directory")
            )
          },
          stderr: {
            on: jest.fn((_, cb) => cb("b"))
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const progress = jest.fn();
        adb.push(["tests/test-data/test_file"], null, progress).catch(e => {
          expect(child_process.spawn).toHaveBeenCalledTimes(1);
          expect(progress).toHaveBeenCalledWith(0);
          expect(progress).toHaveBeenCalledTimes(1);
          expectReject(e, "file not found");
          done();
        });
      });
      it("should be cancelable", function () {
        const child = {
          on: jest.fn(),
          once: jest.fn(),
          stdout: {
            on: jest.fn((_, cb) => cb("a"))
          },
          stderr: {
            on: jest.fn((_, cb) => cb("b"))
          },
          kill: jest.fn()
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const cp = adb.push(["tests/test-data/test_file"]);
        cp.cancel();
      });
    });

    describe("reboot()", function () {
      ["system", "recovery", "bootloader", "download", "edl"].forEach(state => {
        it("should reboot to " + state, function () {
          stubExec();
          const adb = new Adb();
          return adb.reboot(state).then(() => {
            expectArgs("reboot", state);
          });
        });
      });
      it("should reject on failure in stdout", function (done) {
        stubExec(null, "failed");
        const adb = new Adb();
        adb.reboot("bootloader").catch(() => {
          expectArgs("reboot", "bootloader");
          done();
        });
      });
      it("should reject on error", function (done) {
        stubExec(666, "everything exploded", "what!?");
        const adb = new Adb();
        adb.reboot("bootloader").catch(() => {
          expectArgs("reboot", "bootloader");
          done();
        });
      });
      it("should reject on invalid state", function (done) {
        stubExec();
        const adb = new Adb();
        adb.reboot("someinvalidstate").catch(error => {
          expectReject(error, "unknown state: someinvalidstate");
          done();
        });
      });
    });
    describe("sideload()", function () {
      it("should sideload android ota package", function () {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(0, null), 10)),
          stdout: {
            on: jest.fn((_, cb) => cb("something"))
          },
          stderr: {
            on: jest.fn((_, cb) => {
              cb("some.cpp writex len=1337");
              cb("some.cpp writex len=NaN");
            })
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        return adb.sideload("tests/test-data/test_file").then(() => {
          expect(child_process.spawn).toHaveBeenCalledWith(
            adb.executable,
            ["sideload", "tests/test-data/test_file"],
            { env: expect.objectContaining({ ADB_TRACE: "rwx" }) }
          );
        });
      });
      it("should be cancelable", function () {
        const child = {
          on: jest.fn(),
          once: jest.fn(),
          stdout: {
            on: jest.fn((_, cb) => cb("a"))
          },
          stderr: {
            on: jest.fn((_, cb) => cb("b"))
          },
          kill: jest.fn()
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const cp = adb.sideload("tests/test-data/test_file");
        cp.cancel();
      });
      it("should reject on inaccessible file", function (done) {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: jest.fn((_, cb) =>
              cb("adb: error: cannot stat: 'file' No such file or directory")
            )
          },
          stderr: {
            on: jest.fn((_, cb) => cb("b"))
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const progress = jest.fn();
        adb.sideload("tests/test-data/test_file", progress).catch(e => {
          expect(child_process.spawn).toHaveBeenCalledTimes(1);
          expect(progress).toHaveBeenCalledWith(0);
          expect(progress).toHaveBeenCalledTimes(1);
          expectReject(e, "file not found");
          done();
        });
      });
      it("should reject on error", function (done) {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: jest.fn((_, cb) => cb("a"))
          },
          stderr: {
            on: jest.fn((_, cb) => cb("b"))
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const progress = jest.fn();
        adb.sideload("tests/test-data/test_file", progress).catch(e => {
          expect(child_process.spawn).toHaveBeenCalledTimes(1);
          expect(progress).toHaveBeenCalledWith(0);
          expect(progress).toHaveBeenCalledTimes(1);
          expectReject(
            e,
            '{"error":{"code":666,"signal":"SIGTERM"},"stdout":"a","stderr":"b"}'
          );
          done();
        });
      });
    });
    describe("getState()", function () {
      it("should resolve state", function () {
        stubExec(null, "recovery");
        const adb = new Adb();
        return adb.getState().then(() => {
          expectArgs("get-state");
        });
      });
    });
  });

  describe("convenience functions", function () {
    describe("ensureState()", function () {
      it("should resolve if already in requested state", function () {
        stubExec(null, "recovery");
        const adb = new Adb();
        return adb.ensureState("recovery").then(() => {
          expectArgs("get-state");
        });
      });
      it("should properly handle device state", function () {
        stubExec(null, "device");
        const adb = new Adb();
        return adb.ensureState("system").then(() => {
          expectArgs("get-state");
        });
      });
      it("should reboot to correct state", function () {
        stubExec(null, "recovery");
        const adb = new Adb();
        adb.reboot = jest.fn().mockResolvedValue();
        adb.wait = jest.fn().mockResolvedValue("device");
        return adb.ensureState("system").then(() => {
          expectArgs("get-state");
        });
      });
    });

    describe("getprop()", function () {
      it("should get device name from getprop", function () {
        stubExec(null, "thisisadevicecodename");
        const adb = new Adb();
        return adb.getprop("ro.product.device").then(r => {
          expect(r).toEqual("thisisadevicecodename");
          expectArgs("shell", "getprop ro.product.device");
        });
      });
      ["getprop: command not found", "getprop: not found", null].forEach(
        response => {
          it(
            "should cat default.prop on " + (response || "empty"),
            function () {
              child_process.execFile = jest.fn(
                (executable, args, options, callback) => {
                  if (args.includes("getprop ro.product.device")) {
                    callback(null, response);
                  } else {
                    callback(
                      null,
                      "asdf=wasd\r\n" +
                        "1=234\r\n" +
                        "ro.product.device=thisisadevicecodename\r\n" +
                        "something=somethingelse\r\n"
                    );
                  }
                }
              );

              const adb = new Adb();
              return adb.getprop("ro.product.device").then(r => {
                expect(r).toEqual("thisisadevicecodename");
                expectArgs("shell", "getprop ro.product.device");
                expectArgs("shell", "cat default.prop");
              });
            }
          );
        }
      );
      it("should reject if prop not found", function () {
        stubExec();
        const adb = new Adb();
        return adb.getprop("ro.product.device").catch(e => {
          expect(e.message).toEqual("unknown getprop error");
        });
      });
      it("should reject on error", function () {
        child_process.execFile = jest.fn(
          (executable, args, options, callback) => {
            if (args.includes("getprop ro.product.device")) callback();
            else callback({ error: "something broke" });
          }
        );

        const adb = new Adb();
        return adb.getprop("ro.product.device").catch(e => {
          expect(e.message).toEqual(
            'getprop error: Error: {"error":{"error":"something broke"}}'
          );
          expectArgs("shell", "getprop ro.product.device");
          expectArgs("shell", "cat default.prop");
        });
      });
      it("should reject if default.prop didn't include ro.product.device", function () {
        child_process.execFile = jest.fn(
          (executable, args, options, callback) => {
            if (args.includes("getprop ro.product.device")) {
              callback();
            } else {
              callback(null, "asdf=wasd\n1=234\nsomething=somethingelse");
            }
          }
        );

        const adb = new Adb();
        return adb.getprop("ro.product.device").catch(e => {
          expect(e.message).toEqual("unknown getprop error");
          expectArgs("shell", "getprop ro.product.device");
          expectArgs("shell", "cat default.prop");
        });
      });
    });

    describe("getDeviceName()", function () {
      it("should use getprop method", function () {
        const adb = new Adb();
        adb.getprop = jest.fn().mockResolvedValueOnce("bacon");
        return adb.getDeviceName().then(r => {
          expect(r).toEqual("bacon");
          expect(adb.getprop).toHaveBeenCalledTimes(1);
          expect(adb.getprop).toHaveBeenCalledWith("ro.product.device");
        });
      });
    });

    describe("getSystemImageCapability()", function () {
      it("should resolve true if capable", function () {
        const adb = new Adb();
        adb.getprop = jest.fn().mockResolvedValueOnce("true");
        return adb.getSystemImageCapability().then(r => {
          expect(r).toEqual(true);
          expect(adb.getprop).toHaveBeenCalledTimes(1);
          expect(adb.getprop).toHaveBeenCalledWith("ro.ubuntu.recovery");
        });
      });
      it("should resolve false if not capable", function () {
        const adb = new Adb();
        adb.getprop = jest.fn().mockResolvedValueOnce("");
        return adb.getSystemImageCapability().then(r => {
          expect(r).toEqual(false);
          expect(adb.getprop).toHaveBeenCalledTimes(1);
          expect(adb.getprop).toHaveBeenCalledWith("ro.ubuntu.recovery");
        });
      });
      it("should resolve false if prop not set", function () {
        const adb = new Adb();
        adb.getprop = jest
          .fn()
          .mockRejectedValueOnce(new Error("unknown getprop error"));
        return adb.getSystemImageCapability().then(r => {
          expect(r).toEqual(false);
          expect(adb.getprop).toHaveBeenCalledTimes(1);
          expect(adb.getprop).toHaveBeenCalledWith("ro.ubuntu.recovery");
        });
      });
      it("should reject on error", function (done) {
        const adb = new Adb();
        adb.getprop = jest.fn().mockRejectedValueOnce(new Error("no device"));
        adb.getSystemImageCapability().catch(e => {
          expect(e.message).toEqual("no device");
          expect(adb.getprop).toHaveBeenCalledTimes(1);
          expect(adb.getprop).toHaveBeenCalledWith("ro.ubuntu.recovery");
          done();
        });
      });
    });

    describe("getOs()", function () {
      it('should resolve "ubuntutouch"', function () {
        stubExec(null, "Contents of the system-image file go here");
        const adb = new Adb();
        return adb.getOs().then(r => {
          expect(r).toEqual("ubuntutouch");
          expectArgs("shell", "cat /etc/system-image/channel.ini");
        });
      });
      it('should resolve "android"', function () {
        stubExec();
        const adb = new Adb();
        return adb.getOs().then(r => {
          expect(r).toEqual("android");
          expectArgs("shell", "cat /etc/system-image/channel.ini");
        });
      });
    });

    describe("hasAccess()", function () {
      it("should resolve true", function () {
        stubExec(null, ".");
        const adb = new Adb();
        return adb.hasAccess().then(r => {
          expect(r).toEqual(true);
          expectArgs("shell", "echo .");
        });
      });
      it("should resolve false", function () {
        stubExec(true, null, "error: no devices/emulators found");
        const adb = new Adb();
        return adb.hasAccess().then(r => {
          expect(r).toEqual(false);
          expectArgs("shell", "echo .");
        });
      });
      it("should reject", function (done) {
        stubExec(null, "This is an unexpected reply");
        const adb = new Adb();
        adb.hasAccess().catch(error => {
          expectReject(
            error,
            "unexpected response: This is an unexpected reply"
          );
          done();
        });
      });
    });

    describe("wait()", function () {
      it("should resolve when a device is detected", function () {
        stubExec();
        const adb = new Adb();
        adb.getState = jest.fn().mockResolvedValue("device");
        return adb.wait().then(r => {
          expect(r).toEqual("device");
          expect(adb.getState).toHaveBeenCalled;
          expectArgs("wait-for-any-any");
        });
      });
      it("should reject on invalid state", function (done) {
        stubExec();
        const adb = new Adb();
        adb.getState = jest.fn().mockResolvedValue("device");
        adb.wait("what the fuck").catch(r => {
          expectReject(r, "Invalid state: what the fuck");
          expect(child_process.execFile).not.toHaveBeenCalled;
          done();
        });
      });
      it("should reject on invalid transport", function (done) {
        stubExec();
        const adb = new Adb();
        adb.getState = jest.fn().mockResolvedValue("device");
        adb.wait("any", "what the fuck").catch(r => {
          expectReject(r, "Invalid transport: what the fuck");
          expect(child_process.execFile).not.toHaveBeenCalled;
          done();
        });
      });
    });

    describe("format()", function () {
      it("should format partition", function () {
        child_process.execFile = jest.fn(
          (executable, args, options, callback) => {
            if (args.includes("cat /etc/recovery.fstab"))
              callback(
                null,
                "/dev/block/platform/mtk-msdc.0/by-name/cache /cache"
              );
            callback();
          }
        );

        const adb = new Adb();
        return adb.format("cache").then(() => {
          expectArgs("shell", "cat /etc/recovery.fstab");
          expectArgs("shell", "umount /cache");
          expectArgs(
            "shell",
            "make_ext4fs /dev/block/platform/mtk-msdc.0/by-name/cache"
          );
          expectArgs("shell", "mount /cache");
        });
      });
      it("should be rejected if fstab can't be read", function (done) {
        stubExec();
        const adb = new Adb();
        adb.format("cache").catch(error => {
          expectReject(
            error,
            "failed to format cache: Error: unable to read recovery.fstab"
          );
          done();
        });
      });
      it("should be rejected if partition can't be read", function (done) {
        stubExec(null, "some invalid fstab");
        const adb = new Adb();
        adb.format("cache").catch(error => {
          expectReject(
            error,
            "failed to format cache: Error: failed to parse fstab"
          );
          done();
        });
      });
      it("should be rejected if mount failed", function (done) {
        stubExec(null, "some invalid fstab");
        const adb = new Adb();
        adb.findPartitionInFstab = jest.fn().mockReturnValue("cache");
        adb.shell = jest.fn().mockResolvedValue("some weird error");
        adb.format("cache").catch(error => {
          expectReject(
            error,
            "failed to format cache: Error: failed to mount: some weird error"
          );
          done();
        });
      });
    });

    describe("wipeCache()", function () {
      it("should resolve if cache was wiped", function () {
        stubExec();
        const adb = new Adb();
        adb.format = jest.fn().mockResolvedValue();
        return adb.wipeCache().then(() => {
          expectArgs("shell", "rm -rf /cache/*");
        });
      });
    });

    describe("findPartitionInFstab()", function () {
      testrecoveryfstabs.forEach(device => {
        device.partitions.forEach(partition => {
          it(
            "should find " + partition.mountpoint + " for " + device.device,
            function () {
              stubExec();
              const adb = new Adb();
              return expect(
                adb.findPartitionInFstab(partition.mountpoint, device.fstab)
              ).toEqual(partition.partition);
            }
          );
        });
      });
    });

    describe("verifyPartitionType()", function () {
      it("should verify parition type", function () {
        stubExec(null, "/dev/userdata on /data type ext4 (rw)");
        const adb = new Adb();
        return Promise.all([
          adb.verifyPartitionType("data", "ext4"),
          adb.verifyPartitionType("data", "ntfs")
        ]).then(r => {
          expect(r[0]).toEqual(true);
          expect(r[1]).toEqual(false);
        });
      });
      it("should reject if partition not found", function () {
        stubExec(null, "/dev/something on /something type ext4 (rw)");
        const adb = new Adb();
        return adb.verifyPartitionType("data", "ext4").catch(r => {
          expect(r.message).toEqual("partition not found");
        });
      });
    });
    describe("getFileSize()", function () {
      it("should resolve file size", function () {
        stubExec(null, "1337", null);
        const adb = new Adb();
        return adb.getFileSize("/wtf").then(size => {
          expect(size).toEqual(1337);
          expectArgs("shell", "du -shk /wtf");
        });
      });
      it("should reject on invalid response file size", function (done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getFileSize().catch(() => {
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
    describe("getAvailablePartitionSize()", function () {
      it("should resolve available partition size", function () {
        stubExec(null, "a\n/wtf 1337 a b");
        const adb = new Adb();
        return adb.getAvailablePartitionSize("/wtf").then(size => {
          expect(size).toEqual(1337);
          expectArgs("shell", "df -k -P /wtf");
        });
      });
      it("should reject on invalid response", function (done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getAvailablePartitionSize("/wtf").catch(() => {
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          done();
        });
      });
      it("should reject on error", function (done) {
        stubExec(69, "invalid response :)");
        const adb = new Adb();
        adb.getAvailablePartitionSize().catch(() => {
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
    describe("getTotalPartitionSize()", function () {
      it("should resolve available partition size", function () {
        stubExec(null, "a\n/wtf 1337 a b c d");
        const adb = new Adb();
        return adb.getTotalPartitionSize("/wtf").then(size => {
          expect(size).toEqual(1337);
          expectArgs("shell", "df -k -P /wtf");
        });
      });
      it("should reject on invalid response", function (done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getTotalPartitionSize("/wtf").catch(() => {
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          done();
        });
      });
      it("should reject on error", function (done) {
        stubExec(69, "invalid response :)");
        const adb = new Adb();
        adb.getTotalPartitionSize().catch(() => {
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          done();
        });
      });
    });
  });

  describe("backup and restore", function () {
    describe("execOut()", function () {
      it("should pipe to stream and resolve", function () {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(0, null), 10)),
          stdout: {
            pipe: jest.fn()
          },
          stderr: {
            on: jest.fn((_, cb) => cb("something"))
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const stream = {
          close: jest.fn()
        };
        return adb.execOut(stream, "echo hello world").then(r => {
          expect(r).toEqual(undefined);
          expect(stream.close).toHaveBeenCalled;
          expect(child.stdout.pipe).toHaveBeenCalledWith(stream);
        });
      });
      it("should reject on error", function (done) {
        const child = {
          on: jest.fn(),
          once: jest.fn((_, cb) => setTimeout(() => cb(1, null), 10)),
          stdout: {
            pipe: jest.fn()
          },
          stderr: {
            on: jest.fn((_, cb) => cb("something"))
          }
        };
        child_process.spawn = jest.fn().mockReturnValue(child);
        const adb = new Adb();
        const stream = {
          close: jest.fn()
        };
        adb.execOut(stream, "echo hello world").catch(e => {
          expectReject(e, '{"error":{"code":1},"stderr":"something"}');
          expect(stream.close).toHaveBeenCalled;
          expect(child.stdout.pipe).toHaveBeenCalledWith(stream);
          done();
        });
      });
    });
    describe("createBackupTar()", function () {
      it("should create backup tar image", function () {
        const adb = new Adb();
        adb.getFileSize = jest.fn().mockResolvedValue(50);
        fs.statSync = jest.fn().mockReturnValue(25);
        fs.createWriteStream = jest.fn().mockReturnValue();
        adb.execOut = jest.fn().mockResolvedValue();
        const progress = jest.fn();
        return adb.createBackupTar("src", "dest", progress).then(r => {
          expect(r).toEqual(undefined);
        });
      });
    });
    describe("restoreBackupTar()", function () {
      it("should restore backup tar image", function () {
        const adb = new Adb();
        adb.ensureState = jest.fn().mockResolvedValue("recovery");
        adb.shell = jest.fn().mockResolvedValue();
        adb.push = jest.fn().mockResolvedValue();
        const progress = jest.fn();
        return adb.restoreBackupTar("src", progress).then(r => {
          expect(r).toEqual(undefined);
        });
      });
      it("should reject on error", function (done) {
        const adb = new Adb();
        adb.ensureState = jest.fn().mockRejectedValue(new Error("oh no!"));
        adb.restoreBackupTar("src").catch(e => {
          expect;
          expectReject(e, "Restore failed: Error: oh no!");
          done();
        });
      });
    });
    describe("listUbuntuBackups()", function () {
      it("should list backups", function () {
        fs.readdir = jest.fn().mockResolvedValue(["a", "b"]);
        fs.readJSON = jest.fn().mockResolvedValue({ a: "b" });
        const adb = new Adb();
        adb.listUbuntuBackups("/tmp").then(r =>
          expect(r).toStrictEqual([
            { a: "b", dir: path.join("/tmp", "a") },
            { a: "b", dir: path.join("/tmp", "b") }
          ])
        );
      });
      it("should resolve empty list if necessary", function () {
        fs.readdir = jest.fn().mockResolvedValue([]);
        const adb = new Adb();
        adb.listUbuntuBackups().then(r => expect(r).toEqual([]));
      });
    });
  });
  describe("createUbuntuTouchBackup()", function () {
    it("should create backup", function () {
      stubExec(1, "should not be called");
      fs.ensureDir = jest.fn().mockResolvedValue();
      jest.useFakeTimers();
      jest.setSystemTime();
      const adb = new Adb();
      adb.createBackupTar = jest.fn().mockResolvedValue();
      adb.ensureState = jest.fn().mockResolvedValue("recovery");
      adb.shell = jest.fn().mockResolvedValue();
      adb.getDeviceName = jest.fn().mockResolvedValue("codename");
      adb.getSerialno = jest.fn().mockResolvedValue("1337");
      adb.getFileSize = jest.fn().mockResolvedValue("1337");
      fs.writeJSON = jest.fn(async (_, r) => r);
      return adb.createUbuntuTouchBackup("/tmp").then(r => {
        expect(r).toEqual({
          codename: "codename",
          comment: "Ubuntu Touch backup created on 1970-01-01T00:00:00.000Z",
          dir: path.join("/tmp", "1970-01-01T00:00:00.000Z"),
          restorations: [],
          serialno: "1337",
          size: "13371337",
          time: new Date()
        });
      });
    });
    it("should reject if backup failed", function (done) {
      stubExec(1, "should not be called");
      fs.ensureDir = jest.fn().mockRejectedValue(new Error("ENOENT"));
      const adb = new Adb();
      adb.createBackupTar = jest.fn().mockResolvedValue();
      adb.ensureState = jest.fn().mockResolvedValue("recovery");
      adb.shell = jest.fn().mockResolvedValue();
      adb.getDeviceName = jest.fn().mockResolvedValue("codename");
      adb.getSerialno = jest.fn().mockResolvedValue("1337");
      adb.getFileSize = jest.fn().mockResolvedValue("1337");
      adb.createUbuntuTouchBackup("/tmp").catch(e => {
        expectReject(e, "ENOENT");
        done();
      });
    });
    it("should reject on invalid args", function (done) {
      stubExec(1, "should not be called");
      const adb = new Adb();
      adb.createUbuntuTouchBackup().catch(r => {
        done();
      });
    });
  });
  describe("restoreUbuntuTouchBackup()", function () {
    it("should restore full backup", function () {
      stubExec(1, "should not be called");
      jest.useFakeTimers();
      jest.setSystemTime();
      fs.readJSON = jest.fn().mockReturnValue({
        codename: "codename",
        comment: "Ubuntu Touch backup created on 1970-01-01T00:00:00.000Z",
        dir: `/tmp/1970-01-01T00:00:00.000Z`,
        restorations: [],
        serialno: "1337",
        size: "13371337",
        time: new Date()
      });
      fs.writeJSON = jest.fn(async (_, r) => r);
      const adb = new Adb();
      adb.ensureState = jest.fn().mockResolvedValue("recovery");
      adb.getDeviceName = jest.fn().mockResolvedValue("codename");
      adb.getSerialno = jest.fn().mockResolvedValue("1337");
      adb.restoreBackupTar = jest.fn().mockResolvedValue();
      adb.reboot = jest.fn().mockResolvedValue();
      return adb
        .restoreUbuntuTouchBackup("/tmp/1970-01-01T00:00:00.000Z")
        .then(r => {
          expect(r).toEqual({
            codename: "codename",
            comment: "Ubuntu Touch backup created on 1970-01-01T00:00:00.000Z",
            restorations: [
              {
                codename: "codename",
                serialno: "1337",
                time: "1970-01-01T00:00:00.000Z"
              }
            ],
            dir: `/tmp/1970-01-01T00:00:00.000Z`,
            serialno: "1337",
            size: "13371337",
            time: new Date()
          });
        });
    });
    it("should reject on error", function (done) {
      stubExec(1, "something went wrong");
      fs.readJSON = jest.fn().mockResolvedValue({ a: "b" });
      const adb = new Adb();
      adb.ensureState = jest.fn(async r => r);
      adb.restoreUbuntuTouchBackup("/tmp").catch(e => {
        expectReject(
          e,
          'Failed to restore: Error: {"error":1,"stdout":"something went wrong"}'
        );
        done();
      });
    });
  });
});
