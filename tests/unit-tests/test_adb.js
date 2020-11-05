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
const fs = require("fs-extra");
const path = require("path");

const Adb = require("../../src/module.js").Adb;
const common = require("../../src/common.js");
const { getAndroidToolPath } = require("android-tools-bin");
const { adbErrors } = require("../test-data/known_errors.js");

function stubExec(error, stdout, stderr) {
  sinon.stub(child_process, "execFile").yields(error, stdout, stderr);
}

function expectArgs(...args) {
  expect(child_process.execFile).to.have.been.calledWith(
    getAndroidToolPath("adb"),
    ["-P", 5037, ...args]
  );
}

function expectReject(error, message) {
  expect(error).to.be.instanceOf(Error);
  expect(error).to.haveOwnProperty("message", message);
}

describe("Adb module", function() {
  describe("constructor()", function() {
    it("should construct adb", function() {
      const adb = new Adb();
      expect(adb).to.exist;
      expect(adb.tool).to.eql("adb");
      expect(adb.executable).to.include("adb");
      expect(adb.extra).to.eql(["-P", 5037]);
      expect(adb.execOptions).to.eql({});
    });
  });

  describe("basic functions", function() {
    describe("kill()", function() {
      it("should kill child processes", function() {
        stubExec();
        const adb = new Adb();
        return adb.kill();
      });
    });

    describe("handleError()", function() {
      adbErrors.forEach(e =>
        it(`should return ${e.expectedReturn}`, function() {
          const adb = new Adb();
          adb.executable = "/path/to/adb";
          expect(adb.handleError(e.error, e.stdout, e.stderr)).to.deep.eql(
            e.expectedReturn
          );
        })
      );
    });

    describe("startServer()", function() {
      it("should kill all servers and start a new one", function() {
        stubExec();
        const adb = new Adb();
        return adb.startServer().then(r => {
          expect(r).to.equal(undefined);
          expect(child_process.execFile).to.have.been.calledTwice;
          expectArgs("kill-server");
          expectArgs("start-server");
        });
      });
    });

    describe("killServer()", function() {
      it("should kill all servers", function() {
        stubExec();
        const adb = new Adb();
        return adb.killServer().then(r => {
          expect(r).to.equal(undefined);
          expectArgs("kill-server");
        });
      });
    });

    describe("reconnect()", function() {
      it("should reconnect", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "wait").resolves("device");
        return adb.reconnect().then(r => {
          expect(r).to.equal("device");
          expect(child_process.execFile).to.have.been.calledOnce;
          expect(child_process.execFile).to.not.have.been.calledTwice;
          expectArgs("reconnect");
        });
      });
      it("should reject on no device", function(done) {
        stubExec(null, "no devices/emulators found");
        const adb = new Adb();
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "wait").resolves("device");
        adb.reconnect().catch(error => {
          expect(error.message).to.eql("no device");
          done();
        });
      });
    });

    describe("reconnectDevice()", function() {
      it("should reconnect from device side", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "wait").resolves("device");
        return adb.reconnectDevice().then(r => {
          expect(r).to.equal("device");
          expect(child_process.execFile).to.have.been.calledOnce;
          expect(child_process.execFile).to.not.have.been.calledTwice;
          expectArgs("reconnect", "device");
        });
      });
    });

    describe("reconnectOffline()", function() {
      it("should reconnect offline devices", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "wait").resolves("device");
        return adb.reconnectOffline().then(r => {
          expect(r).to.equal("device");
          expect(child_process.execFile).to.have.been.calledOnce;
          expect(child_process.execFile).to.not.have.been.calledTwice;
          expectArgs("reconnect", "offline");
        });
      });
    });

    describe("getSerialno()", function() {
      it("should return serialnumber", function() {
        stubExec(false, "1234567890ABCDEF\n");
        const adb = new Adb();
        return adb.getSerialno().then(r => {
          expect(r).to.equal("1234567890ABCDEF");
          expect(child_process.execFile).to.have.been.calledOnce;
          expectArgs("get-serialno");
        });
      });
      it("should throw on invalid stdout", function() {
        stubExec(false, "This is an invalid string");
        const adb = new Adb();
        return expect(adb.getSerialno()).to.be.rejectedWith(
          "invalid serial number: This is an invalid string"
        );
      });
    });

    describe("shell()", function() {
      it("should run command on device", function() {
        stubExec(null, "This string is returned over stdout");
        const adb = new Adb();
        return adb.shell(["one", "two", "three"]).then(r => {
          expect(r).to.equal("This string is returned over stdout");
          expect(child_process.execFile).to.have.been.called;
        });
      });
    });

    describe("push()", function() {
      it("should resolve if called with empty files array", function() {
        sinon.stub(child_process, "spawn");
        const adb = new Adb();
        const progress = sinon.fake();
        return adb.push([], null, progress).then(() => {
          expect(child_process.spawn).to.not.have.been.called;
          expect(progress).to.have.been.calledWith(0);
          expect(progress).to.have.been.calledWith(1);
          expect(progress).to.not.have.been.calledThrice;
        });
      });
      it("should push files and resolve", function() {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(0, null), 10)),
          stdout: {
            on: sinon.fake((_, cb) => cb("a"))
          },
          stderr: {
            on: sinon.fake((_, cb) => {
              cb("some.cpp writex len=1337");
              cb("some.cpp writex len=NaN");
            })
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const progress = sinon.fake();
        return adb
          .push(["tests/test-data/test_file"], null, progress)
          .then(() => {
            expect(child_process.spawn).to.not.have.been.calledTwice;
            expect(progress).to.have.been.calledWith(0);
            expect(progress).to.have.been.calledWith(1);
          });
      });
      it("should reject on error", function(done) {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: sinon.fake((_, cb) => cb("a"))
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("b"))
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const progress = sinon.fake();
        adb.push(["tests/test-data/test_file"], null, progress).catch(e => {
          expect(child_process.spawn).to.not.have.been.calledTwice;
          expect(progress).to.have.been.calledWith(0);
          expect(progress).to.not.have.been.calledTwice;
          expectReject(
            e,
            '{"error":{"code":666,"signal":"SIGTERM"},"stdout":"a","stderr":"b"}'
          );
          done();
        });
      });
      it("should reject on inaccessible file", function(done) {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: sinon.fake((_, cb) =>
              cb("adb: error: cannot stat: 'file' No such file or directory")
            )
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("b"))
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const progress = sinon.fake();
        adb.push(["tests/test-data/test_file"], null, progress).catch(e => {
          expect(child_process.spawn).to.not.have.been.calledTwice;
          expect(progress).to.have.been.calledWith(0);
          expect(progress).to.not.have.been.calledTwice;
          expectReject(e, "file not found");
          done();
        });
      });
      it("should be cancelable", function() {
        const child = {
          on: sinon.fake(),
          once: sinon.fake(),
          stdout: {
            on: sinon.fake((_, cb) => cb("a"))
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("b"))
          },
          kill: sinon.fake()
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const cp = adb.push(["tests/test-data/test_file"]);
        cp.cancel();
      });
    });

    describe("reboot()", function() {
      ["system", "recovery", "bootloader"].forEach(state => {
        it("should reboot to " + state, function() {
          stubExec();
          const adb = new Adb();
          return adb.reboot(state).then(() => {
            expectArgs("reboot", state);
          });
        });
      });
      it("should reject on failure in stdout", function(done) {
        stubExec(null, "failed");
        const adb = new Adb();
        adb.reboot("bootloader").catch(() => {
          expectArgs("reboot", "bootloader");
          done();
        });
      });
      it("should reject on error", function(done) {
        stubExec(666, "everything exploded", "what!?");
        const adb = new Adb();
        adb.reboot("bootloader").catch(() => {
          expectArgs("reboot", "bootloader");
          done();
        });
      });
      it("should reject on invalid state", function() {
        stubExec();
        const adb = new Adb();
        return expect(adb.reboot("someinvalidstate")).to.have.been.rejectedWith(
          "unknown state: someinvalidstate"
        );
      });
    });
    describe("sideload()", function() {
      it("should sideload android ota package", function() {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(0, null), 10)),
          stdout: {
            on: sinon.fake((_, cb) => cb("something"))
          },
          stderr: {
            on: sinon.fake((_, cb) => {
              cb("some.cpp writex len=1337");
              cb("some.cpp writex len=NaN");
            })
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        return adb.sideload("tests/test-data/test_file").then(() => {
          expect(child_process.spawn).to.have.been.calledWith(adb.executable, [
            ...adb.extra,
            "sideload",
            "tests/test-data/test_file"
          ]);
        });
      });
      it("should be cancelable", function() {
        const child = {
          on: sinon.fake(),
          once: sinon.fake(),
          stdout: {
            on: sinon.fake((_, cb) => cb("a"))
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("b"))
          },
          kill: sinon.fake()
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const cp = adb.sideload("tests/test-data/test_file");
        cp.cancel();
      });
      it("should reject on inaccessible file", function(done) {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: sinon.fake((_, cb) =>
              cb("adb: error: cannot stat: 'file' No such file or directory")
            )
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("b"))
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const progress = sinon.fake();
        adb.sideload("tests/test-data/test_file", progress).catch(e => {
          expect(child_process.spawn).to.not.have.been.calledTwice;
          expect(progress).to.have.been.calledWith(0);
          expect(progress).to.not.have.been.calledTwice;
          expectReject(e, "file not found");
          done();
        });
      });
      it("should reject on error", function(done) {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(666, "SIGTERM"), 10)),
          stdout: {
            on: sinon.fake((_, cb) => cb("a"))
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("b"))
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const progress = sinon.fake();
        adb.sideload("tests/test-data/test_file", progress).catch(e => {
          expect(child_process.spawn).to.not.have.been.calledTwice;
          expect(progress).to.have.been.calledWith(0);
          expect(progress).to.not.have.been.calledTwice;
          expectReject(
            e,
            '{"error":{"code":666,"signal":"SIGTERM"},"stdout":"a","stderr":"b"}'
          );
          done();
        });
      });
    });
    describe("getState()", function() {
      it("should resolve state", function() {
        stubExec(null, "recovery");
        const adb = new Adb();
        return adb.getState().then(() => {
          expectArgs("get-state");
        });
      });
    });
  });

  describe("convenience functions", function() {
    describe("ensureState()", function() {
      it("should resolve if already in requested state", function() {
        stubExec(null, "recovery");
        const adb = new Adb();
        return adb.ensureState("recovery").then(() => {
          expectArgs("get-state");
        });
      });
      it("should properly handle device state", function() {
        stubExec(null, "device");
        const adb = new Adb();
        return adb.ensureState("system").then(() => {
          expectArgs("get-state");
        });
      });
      it("should reboot to correct state", function() {
        stubExec(null, "recovery");
        const adb = new Adb();
        sinon.stub(adb, "reboot").resolves();
        sinon.stub(adb, "wait").resolves("device");
        return adb.ensureState("system").then(() => {
          expectArgs("get-state");
        });
      });
    });

    describe("getDeviceName()", function() {
      it("should get device name from getprop", function() {
        stubExec(null, "thisisadevicecodename");
        const adb = new Adb();
        return adb.getDeviceName().then(r => {
          expect(r).to.equal("thisisadevicecodename");
          expectArgs("shell", "getprop ro.product.device");
        });
      });
      ["getprop: not found", null].forEach(response => {
        it("should cat default.prop on " + (response || "empty"), function() {
          sinon
            .stub(child_process, "execFile")
            .callsFake((executable, args, options, callback) => {
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
            });

          const adb = new Adb();
          return adb.getDeviceName().then(r => {
            expect(r).to.equal("thisisadevicecodename");
            expectArgs("shell", "getprop ro.product.device");
            expectArgs("shell", "cat default.prop");
          });
        });
      });
      it("should reject if prop not found", function() {
        stubExec();
        const adb = new Adb();
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal("unknown getprop error");
        });
      });
      it("should reject on error", function() {
        sinon
          .stub(child_process, "execFile")
          .callsFake((executable, args, options, callback) => {
            if (args.includes("getprop ro.product.device")) callback();
            else callback({ error: "something broke" });
          });

        const adb = new Adb();
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal(
            'getprop error: Error: {"error":{"error":"something broke"}}'
          );
          expectArgs("shell", "getprop ro.product.device");
          expectArgs("shell", "cat default.prop");
        });
      });
      it("should reject if default.prop didn't include ro.product.device", function() {
        sinon
          .stub(child_process, "execFile")
          .callsFake((executable, args, options, callback) => {
            if (args.includes("getprop ro.product.device")) {
              callback();
            } else {
              callback(null, "asdf=wasd\n1=234\nsomething=somethingelse");
            }
          });

        const adb = new Adb();
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal("unknown getprop error");
          expectArgs("shell", "getprop ro.product.device");
          expectArgs("shell", "cat default.prop");
        });
      });
    });

    describe("getOs()", function() {
      it('should resolve "ubuntutouch"', function() {
        stubExec(null, "Contents of the system-image file go here");
        const adb = new Adb();
        return adb.getOs().then(r => {
          expect(r).to.equal("ubuntutouch");
          expectArgs("shell", "cat /etc/system-image/channel.ini");
        });
      });
      it('should resolve "android"', function() {
        stubExec();
        const adb = new Adb();
        return adb.getOs().then(r => {
          expect(r).to.equal("android");
          expectArgs("shell", "cat /etc/system-image/channel.ini");
        });
      });
    });

    describe("hasAccess()", function() {
      it("should resolve true", function() {
        stubExec(null, ".");
        const adb = new Adb();
        return adb.hasAccess().then(r => {
          expect(r).to.equal(true);
          expectArgs("shell", "echo .");
        });
      });
      it("should resolve false", function() {
        stubExec(true, null, "error: no devices/emulators found");
        const adb = new Adb();
        return adb.hasAccess().then(r => {
          expect(r).to.equal(false);
          expectArgs("shell", "echo .");
        });
      });
      it("should reject", function() {
        stubExec(null, "This is an unexpected reply");
        const adb = new Adb();
        return expect(adb.hasAccess()).to.have.been.rejectedWith(
          "unexpected response: This is an unexpected reply"
        );
      });
    });

    describe("wait()", function() {
      it("should resolve when a device is detected", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "getState").resolves("device");
        return adb.wait().then(r => {
          expect(r).to.eql("device");
          expect(adb.getState).to.have.been.called;
          expectArgs("wait-for-any-any");
        });
      });
      it("should reject on invalid state", function(done) {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "getState").resolves("device");
        adb.wait("what the fuck").catch(r => {
          expectReject(r, "Invalid state: what the fuck");
          expect(child_process.execFile).to.not.have.been.called;
          done();
        });
      });
      it("should reject on invalid transport", function(done) {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "getState").resolves("device");
        adb.wait("any", "what the fuck").catch(r => {
          expectReject(r, "Invalid transport: what the fuck");
          expect(child_process.execFile).to.not.have.been.called;
          done();
        });
      });
    });

    describe("format()", function() {
      it("should format partition", function() {
        sinon
          .stub(child_process, "execFile")
          .callsFake((executable, args, options, callback) => {
            if (args.includes("cat /etc/recovery.fstab"))
              callback(
                null,
                "/dev/block/platform/mtk-msdc.0/by-name/cache /cache"
              );
            callback();
          });

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
      it("should be rejected if fstab can't be read", function() {
        stubExec();
        const adb = new Adb();
        return expect(adb.format("cache")).to.be.rejectedWith(
          "unable to read recovery.fstab"
        );
      });
      it("should be rejected if partition can't be read", function() {
        stubExec(null, "some invalid fstab");
        const adb = new Adb();
        return expect(adb.format("cache")).to.be.rejectedWith(
          "failed to format cache: Error: failed to parse fstab"
        );
      });
      it("should be rejected if mount failed", function() {
        stubExec(null, "some invalid fstab");
        const adb = new Adb();
        sinon.stub(adb, "findPartitionInFstab").returns("cache");
        sinon.stub(adb, "shell").resolves("some weird error");
        return expect(adb.format("cache")).to.be.rejectedWith(
          "failed to format cache: Error: failed to mount: some weird error"
        );
      });
    });

    describe("wipeCache()", function() {
      it("should resolve if cache was wiped", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "format").resolves();
        return adb.wipeCache().then(() => {
          expectArgs("shell", "rm -rf /cache/*");
        });
      });
    });

    describe("findPartitionInFstab()", function() {
      require("../test-data/testrecoveryfstabs.json").forEach(device => {
        device.partitions.forEach(partition => {
          it(
            "should find " + partition.mountpoint + " for " + device.device,
            function() {
              stubExec();
              const adb = new Adb();
              return expect(
                adb.findPartitionInFstab(partition.mountpoint, device.fstab)
              ).to.eql(partition.partition);
            }
          );
        });
      });
    });

    describe("verifyPartitionType()", function() {
      it("should verify parition type", function() {
        stubExec(null, "/dev/userdata on /data type ext4 (rw)");
        const adb = new Adb();
        return Promise.all([
          adb.verifyPartitionType("data", "ext4"),
          adb.verifyPartitionType("data", "ntfs")
        ]).then(r => {
          expect(r[0]).to.eql(true);
          expect(r[1]).to.eql(false);
        });
      });
      it("should reject if partition not found", function() {
        stubExec(null, "/dev/something on /something type ext4 (rw)");
        const adb = new Adb();
        return adb.verifyPartitionType("data", "ext4").catch(r => {
          expect(r.message).to.eql("partition not found");
        });
      });
    });
    describe("getFileSize()", function() {
      it("should resolve file size", function() {
        stubExec(null, "1337", null);
        const adb = new Adb();
        return adb.getFileSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expectArgs("shell", "du -shk /wtf");
        });
      });
      it("should reject on invalid response file size", function(done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getFileSize().catch(() => {
          expect(child_process.execFile).to.have.been.calledOnce;
          done();
        });
      });
    });
    describe("getAvailablePartitionSize()", function() {
      it("should resolve available partition size", function() {
        stubExec(null, "a\n/wtf 1337 a b");
        const adb = new Adb();
        return adb.getAvailablePartitionSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expectArgs("shell", "df -k -P /wtf");
        });
      });
      it("should reject on invalid response", function(done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getAvailablePartitionSize("/wtf").catch(() => {
          expect(child_process.execFile).to.have.been.calledOnce;
          done();
        });
      });
      it("should reject on error", function(done) {
        stubExec(69, "invalid response :)");
        const adb = new Adb();
        adb.getAvailablePartitionSize().catch(() => {
          expect(child_process.execFile).to.have.been.calledOnce;
          done();
        });
      });
    });
    describe("getTotalPartitionSize()", function() {
      it("should resolve available partition size", function() {
        stubExec(null, "a\n/wtf 1337 a b c d");
        const adb = new Adb();
        return adb.getTotalPartitionSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expectArgs("shell", "df -k -P /wtf");
        });
      });
      it("should reject on invalid response", function(done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getTotalPartitionSize("/wtf").catch(() => {
          expect(child_process.execFile).to.have.been.calledOnce;
          done();
        });
      });
      it("should reject on error", function(done) {
        stubExec(69, "invalid response :)");
        const adb = new Adb();
        adb.getTotalPartitionSize().catch(() => {
          expect(child_process.execFile).to.have.been.calledOnce;
          done();
        });
      });
    });
  });

  describe("backup and restore", function() {
    describe("execOut()", function() {
      it("should pipe to stream and resolve", function() {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(0, null), 10)),
          stdout: {
            pipe: sinon.spy()
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("something"))
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const stream = {
          close: sinon.spy()
        };
        return adb.execOut(stream, "echo hello world").then(r => {
          expect(r).to.eql(undefined);
          expect(stream.close).to.have.been.called;
          expect(child.stdout.pipe).to.have.been.calledWith(stream);
        });
      });
      it("should reject on error", function(done) {
        const child = {
          on: sinon.fake(),
          once: sinon.fake((_, cb) => setTimeout(() => cb(1, null), 10)),
          stdout: {
            pipe: sinon.spy()
          },
          stderr: {
            on: sinon.fake((_, cb) => cb("something"))
          }
        };
        sinon.stub(child_process, "spawn").returns(child);
        const adb = new Adb();
        const stream = {
          close: sinon.spy()
        };
        adb.execOut(stream, "echo hello world").catch(e => {
          expectReject(e, '{"error":{"code":1},"stderr":"something"}');
          expect(stream.close).to.have.been.called;
          expect(child.stdout.pipe).to.have.been.calledWith(stream);
          done();
        });
      });
    });
    describe("createBackupTar()", function() {
      it("should create backup tar image", function() {
        const adb = new Adb();
        sinon.stub(adb, "getFileSize").resolves(50);
        sinon.stub(fs, "statSync").returns(25);
        sinon.stub(fs, "createWriteStream").returns();
        sinon.stub(adb, "execOut").resolves();
        const progress = sinon.spy();
        return adb.createBackupTar("src", "dest", progress).then(r => {
          expect(r).to.eql(undefined);
        });
      });
    });
    describe("restoreBackupTar()", function() {
      it("should restore backup tar image", function() {
        const adb = new Adb();
        sinon.stub(adb, "ensureState").resolves("recovery");
        sinon.stub(adb, "shell").resolves();
        sinon.stub(adb, "push").resolves();
        const progress = sinon.spy();
        return adb.restoreBackupTar("src", progress).then(r => {
          expect(r).to.eql(undefined);
        });
      });
      it("should reject on error", function(done) {
        const adb = new Adb();
        sinon.stub(adb, "ensureState").rejects(new Error("oh no!"));
        adb.restoreBackupTar("src").catch(e => {
          expect;
          expectReject(e, "Restore failed: Error: oh no!");
          done();
        });
      });
    });
    describe("listUbuntuBackups()", function() {
      it("should list backups", function() {
        sinon.stub(fs, "readdir").resolves(["a", "b"]);
        sinon.stub(fs, "readJSON").resolves({ a: "b" });
        const adb = new Adb();
        adb.listUbuntuBackups("/tmp").then(r =>
          expect(r).to.deep.eql([
            { a: "b", dir: path.join("/tmp", "a") },
            { a: "b", dir: path.join("/tmp", "b") }
          ])
        );
      });
      it("should resolve empty list if necessary", function() {
        sinon.stub(fs, "readdir").resolves([]);
        const adb = new Adb();
        adb.listUbuntuBackups().then(r => expect(r).to.eql([]));
      });
    });
  });
  describe("createUbuntuTouchBackup()", function() {
    it("should create backup", function() {
      stubExec(1, "should not be called");
      sinon.stub(fs, "ensureDir").resolves();
      sinon.useFakeTimers({});
      const adb = new Adb();
      sinon.stub(adb, "createBackupTar").resolves();
      sinon.stub(adb, "ensureState").resolves("recovery");
      sinon.stub(adb, "shell").resolves();
      sinon.stub(adb, "getDeviceName").resolves("codename");
      sinon.stub(adb, "getSerialno").resolves("1337");
      sinon.stub(adb, "getFileSize").resolves("1337");
      sinon.stub(fs, "writeJSON").resolvesArg(1);
      return adb.createUbuntuTouchBackup("/tmp").then(r => {
        expect(r).to.eql({
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
    it("should reject if backup failed", function(done) {
      stubExec(1, "should not be called");
      sinon.stub(fs, "ensureDir").resolves();
      const adb = new Adb();
      sinon.stub(adb, "createBackupTar").resolves();
      sinon.stub(adb, "ensureState").resolves("recovery");
      sinon.stub(adb, "shell").resolves();
      sinon.stub(adb, "getDeviceName").resolves("codename");
      sinon.stub(adb, "getSerialno").resolves("1337");
      sinon.stub(adb, "getFileSize").resolves("1337");
      adb.createUbuntuTouchBackup("/tmp").catch(e => {
        expect(e.message).to.include(
          "Failed to restore: Error: ENOENT: no such file or directory, open"
        );
        done();
      });
    });
    it("should reject on invalid args", function(done) {
      stubExec(1, "should not be called");
      const adb = new Adb();
      adb.createUbuntuTouchBackup().catch(r => {
        done();
      });
    });
  });
  describe("restoreUbuntuTouchBackup()", function() {
    it("should restore full backup", function() {
      stubExec(1, "should not be called");
      sinon.useFakeTimers({});
      sinon.stub(fs, "readJSON").returns({
        codename: "codename",
        comment: "Ubuntu Touch backup created on 1970-01-01T00:00:00.000Z",
        dir: `/tmp/1970-01-01T00:00:00.000Z`,
        restorations: [],
        serialno: "1337",
        size: "13371337",
        time: new Date()
      });
      sinon.stub(fs, "writeJSON").resolvesArg(1);
      const adb = new Adb();
      sinon.stub(adb, "ensureState").resolves("recovery");
      sinon.stub(adb, "getDeviceName").resolves("codename");
      sinon.stub(adb, "getSerialno").resolves("1337");
      sinon.stub(adb, "restoreBackupTar").resolves();
      sinon.stub(adb, "reboot").resolves();
      return adb
        .restoreUbuntuTouchBackup("/tmp/1970-01-01T00:00:00.000Z")
        .then(r => {
          expect(r).to.eql({
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
    it("should reject on error", function(done) {
      stubExec(1, "something went wrong");
      sinon.stub(fs, "readJSON").resolves({ a: "b" });
      const adb = new Adb();
      sinon.stub(adb, "ensureState").resolvesArg(0);
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
