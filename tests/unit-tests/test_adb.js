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

const Adb = require("../../src/module.js").Adb;
const common = require("../../src/common.js");
const { getAndroidToolPath } = require("android-tools-bin");
const { adbErrors } = require("../test-data/known_errors.js");

function stubExec(error, stdout, stderr) {
  sinon.stub(child_process, "exec").yields(error, stdout, stderr);
}

function expectArgs(...args) {
  expect(child_process.exec).to.have.been.calledWith(
    [getAndroidToolPath("adb"), "-P", 5037, ...args].join(" ")
  );
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
          expect(child_process.exec).to.have.been.calledTwice;
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
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.reconnect().then(r => {
          expect(r).to.equal(undefined);
          expect(child_process.exec).to.have.been.calledOnce;
          expect(child_process.exec).to.not.have.been.calledTwice;
          expectArgs("reconnect");
        });
      });
      it("should reject on no device", function(done) {
        stubExec(null, "no devices/emulators found");
        const adb = new Adb();
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "waitForDevice").resolves();
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
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.reconnectDevice().then(r => {
          expect(r).to.equal(undefined);
          expect(child_process.exec).to.have.been.calledOnce;
          expect(child_process.exec).to.not.have.been.calledTwice;
          expectArgs("reconnect", "device");
        });
      });
    });

    describe("reconnectOffline()", function() {
      it("should reconnect offline devices", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.reconnectOffline().then(r => {
          expect(r).to.equal(undefined);
          expect(child_process.exec).to.have.been.calledOnce;
          expect(child_process.exec).to.not.have.been.calledTwice;
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
          expect(child_process.exec).to.have.been.calledOnce;
          expectArgs("get-serialno");
        });
      });
      it("should return error on invalid return", function() {
        stubExec(false, "This is an invalid string");
        const adb = new Adb();
        return expect(adb.getSerialno()).to.be.rejectedWith(
          "invalid device id"
        );
      });
    });

    describe("shell()", function() {
      it("should run command on device", function() {
        stubExec(null, "This string is returned over stdout");
        const adb = new Adb();
        return adb.shell(["one", "two", "three"]).then(r => {
          expect(r).to.equal("This string is returned over stdout");
          expect(child_process.exec).to.have.been.called;
        });
      });
    });

    describe("push()", function() {
      it("should push file", function() {
        stubExec();
        const adb = new Adb();
        return adb.push("tests/test-data/test_file", "/tmp/target").then(() => {
          expectArgs(
            "push",
            common.quotepath("tests/test-data/test_file"),
            "/tmp/target",
            common.stdoutFilter("%]")
          );
        });
      });
      it("should reject if device is out of space", function() {
        stubExec(
          null,
          "adb: error: failed to copy '/local/path' to '/target/path': remote No space left on device\n" +
            "/local/path: 0 files pushed. 5.2 MB/s (99995728 bytes in 18.348s)\n",
          ""
        );
        const adb = new Adb();
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith("Push failed: out of space");
      });
      it("should reject if file is inaccessible", function() {
        stubExec();
        const adb = new Adb();
        return expect(
          adb.push("this/file/does/not/exist", "/tmp/target")
        ).to.have.been.rejectedWith("Can't access file");
      });
      it("should reject on bad file number", function() {
        stubExec(
          null,
          "adb: error: failed to copy '/a' to '/b': remote Bad file number",
          ""
        );
        const adb = new Adb();
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith("connection lost");
      });
      it("should reject on connection lost", function() {
        const execFakes = [
          sinon.fake((args, callback) => {
            if (args.includes("echo"))
              callback(true, null, "error: no devices/emulators found");
            else callback(true, "push-stdout", "push-stderr");
          }),
          sinon.fake((args, callback) => {
            callback(false, "no devices/emulators found");
          })
        ];
        return Promise.all(
          execFakes.map(execFake => {
            const adb = new Adb();
            return expect(
              adb.push("tests/test-data/test_file", "/tmp/target")
            ).to.have.been.rejectedWith("connection lost");
          })
        );
      });
      it("should reject with original error on connection lost and device detection rejected", function() {
        stubExec(true, "push-stdout", "push-stderr");
        const adb = new Adb();
        sinon.stub(adb, "hasAccess").rejects("oh no, what happened now");
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith(
          'Push failed: Error: {"error":true,"stdout":"push-stdout","stderr":"push-stderr"}'
        );
      });
      it("should reject with original error on connection lost and device detected", function() {
        stubExec(true, "push-stdout", "push-stderr");
        const adb = new Adb();
        sinon.stub(adb, "hasAccess").resolves(true);
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith(
          'Push failed: Error: {"error":true,"stdout":"push-stdout","stderr":"push-stderr"}'
        );
      });
      it("should reject on unknown error", function() {
        stubExec(false, "push-stdout: 0 files pushed", "push-stderr");
        const adb = new Adb();
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith(
          "Push failed: stdout: push-stdout: 0 files pushed"
        );
      });
      it("should survive if stat failed", function() {
        stubExec();
        const adb = new Adb();
        sinon.stub(adb, "shell").rejects("stat failed");
        return adb.push("tests/test-data/test_file", "/tmp/target", 1);
      });
    });

    describe("sync()", function() {
      it("should sync all if no argument supplied");
      ["all", "system", "vendor", "oem", "data"].forEach(p => {
        it("should sync " + p);
      });
      it("should reject on unsupported partition");
      it("should reject on error");
    });

    describe("pull()", function() {
      it("should pull files/dirs from device");
      it("should pull files/dirs from device and preserve mode and timestamp");
      it("should reject on incorrect number of arguments");
      it("should reject if target path inaccessible");
      it("should reject on error");
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
    describe("forward()", function() {
      it("should create forward connection");
      it("should not rebind forward connection");
      it("should reject on error");
    });
    describe("forwardList()", function() {
      it("should resolve all forward connections");
      it("should reject on error");
    });
    describe("forwardRemove()", function() {
      it("should remove forward connection");
      it("should reject on error");
    });
    describe("forwardRemoveAll()", function() {
      it("should remove all forward connections");
      it("should reject on error");
    });
    describe("forwardRemoveAll()", function() {
      it("should remove all forward connections");
      it("should reject on error");
    });
    describe("bugreport()", function() {
      it("should write bugreport to given path");
      it("should reject if no path specified");
      it("should reject if path inaccessible");
      it("should reject on error");
    });
    describe("logcat()", function() {
      it("should resolve log");
      it("should reject on error");
    });
    describe("remount()", function() {
      it("should remount /system, /vendor, and /oem partitions read-write");
      it("should reject on error");
    });
    describe("connect()", function() {
      it("should connect to device via TCP/IP on default port 5555");
      it("should connect to device via TCP/IP on custom port");
      it("should reject if no host specified");
      it("should reject on error");
    });
    describe("disconnect()", function() {
      it("should disconnect from all TCP/IP devices");
      it("should disconnect from given TCP/IP device on default port 5555");
      it("should disconnect from given TCP/IP device on custom port");
      it("should reject if no host specified");
      it("should reject on error");
    });
    describe("ppp()", function() {
      it("should run PPP over USB");
      it("should reject on error");
    });
    describe("devices()", function() {
      it("should resolve devices list");
      it("should resolve long devices list");
      it("should reject on error");
    });
    describe("root()", function() {
      it("should restart adbd with root permissions");
      it("should reject on error");
    });
    describe("unroot()", function() {
      it("should restart adbd without root permissions");
      it("should reject on error");
    });
    describe("install()", function() {
      it("should install apk");
      it("should install multiple apks");
      [
        ["-l", "forward lock application"],
        ["-r", "replace existing application"],
        ["-t", "allow test packages"],
        ["-s", "install application on sdcard"],
        ["-d", "allow version code downgrade (debuggable packages only)"],
        ["-g", "grant all runtime permissions"]
      ].forEach(option => {
        it("should " + option[1]);
      });
      it("should reject if no package specified");
      it("should reject if package inaccessible");
      it("should reject on error");
    });
    describe("uninstall()", function() {
      it("should remove app package from device");
      it("should remove app package from device but keep data and cache");
      it("should resolve if no such package was installed");
      it("should reject on error");
    });
    describe("emu()", function() {
      it("should reject if no emulator detected");
      it("should reject on error");
    });
    describe("jdwp()", function() {
      it("should list pids of processes hosting a JDWP transport");
      it("should reject on error");
    });
    describe("sideload()", function() {
      it("should sideload android ota package", function() {
        stubExec();
        const adb = new Adb();
        return adb.sideload("tests/test-data/test_file").then(() => {
          expectArgs(
            "sideload",
            common.quotepath("tests/test-data/test_file"),
            common.stdoutFilter("%)")
          );
        });
      });
      it("should reject if no package specified");
      it("should reject if package inaccessible");
      it("should reject on error");
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
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.ensureState("system").then(() => {
          expectArgs("get-state");
        });
      });
    });
    describe.skip("pushArray()", function() {
      it("should resolve on empty array", function() {
        stubExec();

        const adb = new Adb();
        const progressSpy = sinon.spy();
        return Promise.all([
          adb.pushArray([], progressSpy),
          adb.pushArray()
        ]).then(r => {
          expect(r[0]).to.equal(undefined);
          expect(r[1]).to.equal(undefined);
          expect(child_process.exec).to.not.have.been.called;
          expect(progressSpy).to.have.been.calledWith(1);
          expect(progressSpy).to.not.have.been.calledTwice;
        });
      });
      it("should push files", function() {
        stubExec(null, "1 1", null);
        const fakeArray = [
          { src: "tests/test-data/test_file", dest: "/tmp/target" },
          { src: "tests/test-data/test file", dest: "/tmp/target" }
        ];
        const adb = new Adb();
        sinon.stub(adb, "push").resolves();
        const progressSpy = sinon.spy();
        return adb.pushArray(fakeArray, progressSpy, 1).then(() => {
          expectArgs(
            "push",
            common.quotepath("tests/test-data/test_file"),
            "/tmp/target",
            common.stdoutFilter("%]")
          );
          expectArgs(
            "push",
            common.quotepath("tests/test-data/test file"),
            "/tmp/target",
            common.stdoutFilter("%]")
          );
          expectArgs("shell", "stat -t", "/tmp/target/test_file");
        });
      });
      it("should reject if files are inaccessible", function() {
        sinon.stub(child_process, "exec").callsFake((args, callback) => {
          if (args.includes("stat")) setTimeout(callback, 5);
          else callback(null, "1", null);
        });

        const fakeArray = [
          { src: "tests/test-data/test_file", dest: "/tmp/target" },
          { src: "this/file/does/not/exist", dest: "/tmp/target" },
          { src: "tests/test-data/test file", dest: "/tmp/target" }
        ];
        const adb = new Adb();
        const progressSpy = sinon.spy();
        return adb.pushArray(fakeArray, progressSpy, 1).catch(e => {
          expect(e).to.exist;
        });
      });
      it("should reject on error", function() {
        sinon.stub(child_process, "exec").callsFake((args, callback) => {
          if (args.includes("push"))
            setTimeout(
              () =>
                callback(
                  1,
                  "adb: error: failed to copy 'tests/test-data/test_file' to '/tmp/target': couldn't read from device\ntests/test-data/test_file: 0 files pushed. 7.2 MB/s (22213992 bytes in 2.957s)"
                ),
              5
            );
          else callback(null, "1 1", null);
        });

        const fakeArray = [
          { src: "tests/test-data/test_file", dest: "/tmp/target" },
          { src: "tests/test-data/test file", dest: "/tmp/target" }
        ];
        const adb = new Adb();
        const progressSpy = sinon.spy();
        return adb.pushArray(fakeArray, progressSpy, 1).catch(e => {
          expect(e.message).to.include(
            'Failed to push file 0: Error: Push failed: Error: {"error":1,"stdout":"adb: error: failed to copy \'tests/test-data/test_file\' to \'/tmp/target\': couldn\'t read from device\\ntests/test-data/test_file: 0 files pushed. 7.2 MB/s (22213992 bytes in 2.957s)"}'
          );
        });
      });
      it("should report progress"); // TODO: Check that the progress report actually makes sense
    });

    describe.skip("getDeviceName()", function() {
      it("should get device name from getprop", function() {
        stubExec(null, "thisisadevicecodename");
        const adb = new Adb();
        return adb.getDeviceName().then(r => {
          expect(r).to.equal("thisisadevicecodename");
          expectArgs("shell", "'getprop ro.product.device'");
        });
      });
      ["getprop: not found", null].forEach(response => {
        it("should cat default.prop on " + (response || "empty"), function() {
          sinon.stub(child_process, "exec").callsFake((args, callback) => {
            if (args.includes("getprop")) {
              callback(null, response);
            } else {
              callback(
                null,
                "asdf=wasd\n" +
                  "1=234\n" +
                  "ro.product.device=thisisadevicecodename\n" +
                  "something=somethingelse"
              );
            }
          });

          const adb = new Adb();
          return adb.getDeviceName().then(r => {
            expect(r).to.equal("thisisadevicecodename");
            expectArgs("shell", "'getprop ro.product.device'");
            expectArgs("shell", "'cat default.prop'");
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
        sinon.stub(child_process, "exec").callsFake((args, callback) => {
          if (args.includes("getprop")) callback();
          else callback({ error: "something broke" });
        });

        const adb = new Adb();
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal(
            'getprop error: Error: {"error":{"error":"something broke"}}'
          );
          expectArgs("shell", "'getprop ro.product.device'");
          expectArgs("shell", "'cat default.prop'");
        });
      });
      it("should reject if default.prop didn't include ro.product.device", function() {
        sinon.stub(child_process, "exec").callsFake((args, callback) => {
          if (args.includes("getprop")) {
            callback();
          } else {
            callback(null, "asdf=wasd\n1=234\nsomething=somethingelse");
          }
        });

        const adb = new Adb();
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal("unknown getprop error");
          expectArgs("shell", "'getprop ro.product.device'");
          expectArgs("shell", "'cat default.prop'");
        });
      });
    });

    describe("getOs()", function() {
      it('should resolve "ubuntutouch"', function() {
        stubExec(null, "Contents of the system-image file go here");
        const adb = new Adb();
        return adb.getOs().then(r => {
          expect(r).to.equal("ubuntutouch");
          expectArgs("shell", "'cat /etc/system-image/channel.ini'");
        });
      });
      it('should resolve "android"', function() {
        stubExec();
        const adb = new Adb();
        return adb.getOs().then(r => {
          expect(r).to.equal("android");
          expectArgs("shell", "'cat /etc/system-image/channel.ini'");
        });
      });
    });

    describe("hasAccess()", function() {
      it("should resolve true", function() {
        stubExec(null, ".");
        const adb = new Adb();
        return adb.hasAccess().then(r => {
          expect(r).to.equal(true);
          expectArgs("shell", "'echo .'");
        });
      });
      it("should resolve false", function() {
        stubExec(true, null, "error: no devices/emulators found");
        const adb = new Adb();
        return adb.hasAccess().then(r => {
          expect(r).to.equal(false);
          expectArgs("shell", "'echo .'");
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

    describe("waitForDevice()", function() {
      it("should resolve when a device is detected", function() {
        stubExec(null, ".");
        const adb = new Adb();
        return adb.waitForDevice(1).then(r => {
          expect(child_process.exec).to.have.been.called;
          expectArgs("shell", "'echo .'");
        });
      });
      it("should reject on error", function() {
        stubExec(true, null, "everything exploded");
        const adb = new Adb();
        return expect(adb.waitForDevice(5, 10)).to.be.rejectedWith(
          "everything exploded"
        );
      });
      it("should reject on timeout", function() {
        stubExec(true, null, "error: no devices/emulators found");
        const adb = new Adb();
        return expect(adb.waitForDevice(5, 10)).to.be.rejectedWith(
          "no device: timeout"
        );
      });
    });

    describe("stopWaiting()", function() {
      it("should cause waitForDevice() to reject", function() {
        stubExec(true, null, "error: no devices/emulators found");
        const adb = new Adb();
        return new Promise(function(resolve, reject) {
          const wait = adb.waitForDevice(5);
          setTimeout(() => {
            adb.stopWaiting();
            resolve(expect(wait).to.be.rejectedWith("stopped waiting"));
          }, 10);
        });
      });
    });

    describe.skip("format()", function() {
      it("should format partition", function() {
        sinon.stub(child_process, "exec").callsFake((args, callback) => {
          if (args.includes("/etc/recovery.fstab"))
            callback(
              null,
              "/dev/block/platform/mtk-msdc.0/by-name/cache /cache"
            );
          callback();
        });

        const adb = new Adb();
        return adb.format("cache").then(() => {
          expectArgs("shell", "'cat /etc/recovery.fstab'");
          expectArgs("shell", "'umount /cache'");
          expectArgs(
            "shell",
            "'make_ext4fs /dev/block/platform/mtk-msdc.0/by-name/cache'"
          );
          expectArgs("shell", "'mount /cache'");
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
    });

    describe("wipeCache()", function() {
      it("should resolve if cache was wiped", function() {
        stubExec();
        const adb = new Adb();
        return adb.wipeCache().then(() => {
          expectArgs("shell", "'rm -rf /cache/*'");
        });
      });
      it("should reject if rm failed");
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

    describe.skip("verifyPartitionType()", function() {
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
      it("should reject if partitions can't be read", function() {
        const execFake1 = sinon.fake((args, callback) => {
          callback(null, "some invalid return string", null);
        });
        const execFake2 = sinon.fake((args, callback) => {
          callback(null, 666, null);
        });

        const adb1 = new Adb();
        const adb2 = new Adb();
        return Promise.all([
          adb1.verifyPartitionType("data", "ext4"),
          adb2.verifyPartitionType("data", "ext4")
        ]).catch(r => {
          expect(r.message).to.eql("unable to detect partitions");
        });
      });
      it("should reject if partition not found", function() {
        stubExec(null, "/dev/something on /something type ext4 (rw)");
        const adb = new Adb();
        return adb.verifyPartitionType("data", "ext4").catch(r => {
          expect(r.message).to.eql("partition not found");
        });
      });
      it("should reject if adb shell rejected", function() {
        stubExec(true, null, "everything exploded");
        const adb = new Adb();
        return adb.verifyPartitionType("data", "ext4").catch(r => {
          expect(r.message).to.eql(
            'partition not found: Error: {"error":true,"stderr":"everything exploded"}'
          );
        });
      });
    });
    describe("getFileSize()", function() {
      it("should resolve file size", function() {
        stubExec(null, "1337", null);
        const adb = new Adb();
        return adb.getFileSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expectArgs("shell", "'du -shk /wtf'");
        });
      });
      it("should reject on invalid response file size", function(done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getFileSize().catch(() => {
          expect(child_process.exec).to.have.been.calledOnce;
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
          expectArgs("shell", "'df -k -P /wtf'");
        });
      });
      it("should reject on invalid response", function(done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getAvailablePartitionSize("/wtf").catch(() => {
          expect(child_process.exec).to.have.been.calledOnce;
          done();
        });
      });
      it("should reject on error", function(done) {
        stubExec(69, "invalid response :)");
        const adb = new Adb();
        adb.getAvailablePartitionSize().catch(() => {
          expect(child_process.exec).to.have.been.calledOnce;
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
          expectArgs("shell", "'df -k -P /wtf'");
        });
      });
      it("should reject on invalid response", function(done) {
        stubExec(null, "invalid response :)");
        const adb = new Adb();
        adb.getTotalPartitionSize("/wtf").catch(() => {
          expect(child_process.exec).to.have.been.calledOnce;
          done();
        });
      });
      it("should reject on error", function(done) {
        stubExec(69, "invalid response :)");
        const adb = new Adb();
        adb.getTotalPartitionSize().catch(() => {
          expect(child_process.exec).to.have.been.calledOnce;
          done();
        });
      });
    });
  });
});
