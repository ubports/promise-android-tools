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

const Adb = require("../../src/module.js").Adb;
const common = require("../../src/common.js");

describe("Adb module", function() {
  describe("constructor()", function() {
    it("should create default adb when called without arguments", function() {
      const adb = new Adb();
      expect(adb.exec).to.exist;
      expect(adb.log).to.equal(console.log);
      expect(adb.port).to.equal(5037);
    });
    it("should create default adb when called with unrelated object", function() {
      const adb = new Adb({});
      expect(adb.exec).to.exist;
      expect(adb.log).to.equal(console.log);
      expect(adb.port).to.equal(5037);
    });
    it("should create custom adb when called with valid options", function() {
      const execStub = sinon.stub();
      const logStub = sinon.stub();
      const adb = new Adb({ exec: execStub, log: logStub, port: 1234 });
      expect(adb.exec).to.equal(execStub);
      expect(adb.exec).to.not.equal(logStub);
      expect(adb.log).to.equal(logStub);
      expect(adb.log).to.not.equal(execStub);
      expect(adb.port).to.equal(1234);
    });
  });

  describe("private functions", function() {
    describe("exec()", function() {
      it("should call the specified function", function() {
        const execSpy = sinon.spy();
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execSpy, log: logSpy });
        adb.exec("This is an argument");
        expect(execSpy).to.have.been.calledWith("This is an argument");
      });
    });

    describe("execCommand()", function() {
      it("should call an with port argument", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(null, args.join(" "))
        );
        const logStub = sinon.stub();
        const adb = new Adb({ exec: execFake, log: logStub, port: 1234 });
        return adb.execCommand(["additional arg"]).then(r => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            1234,
            "additional arg"
          ]);
          expect(r).to.equal("-P 1234 additional arg");
        });
      });
      it("should reject on no permissions", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(null, "no permissions")
        );
        const logStub = sinon.stub();
        const adb = new Adb({ exec: execFake, log: logStub, port: 1234 });
        return adb.execCommand(["something illegal"]).catch(e => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            1234,
            "something illegal"
          ]);
          expect(e.message).to.equal("no permissions");
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) =>
          callback(
            {
              cmd: "adb " + args.join(" ")
            },
            "everything is on fire"
          )
        );
        const logStub = sinon.stub();
        const adb = new Adb({ exec: execFake, log: logStub, port: 1234 });
        return adb.execCommand(["this", "will", "not", "work"]).catch(e => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            1234,
            "this",
            "will",
            "not",
            "work"
          ]);
          expect(e.message).to.equal(
            '{"error":{"cmd":"adb -P 1234 this will not work"},"stdout":"everything is on fire"}'
          );
        });
      });
    });
  });

  describe("basic functions", function() {
    describe("startServer()", function() {
      it("should kill all servers and start a new one", function() {
        const execFake = sinon.fake((args, callback) => {
          callback();
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.startServer().then(r => {
          expect(r).to.equal(undefined);
          expect(execFake).to.have.been.calledTwice;
          expect(execFake).to.have.been.calledWith(["-P", 5037, "kill-server"]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "start-server"
          ]);
          expect(logSpy).to.have.been.calledTwice;
          expect(logSpy).to.have.been.calledWith(
            "killing all running adb servers"
          );
          expect(logSpy).to.have.been.calledWith(
            "starting adb server on port 5037"
          );
        });
      });
    });

    describe("killServer()", function() {
      it("should kill all servers", function() {
        const execFake = sinon.fake((args, callback) => {
          callback();
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.killServer().then(r => {
          expect(r).to.equal(undefined);
          expect(execFake).to.have.been.calledOnce;
          expect(execFake).to.not.have.been.calledTwice;
          expect(execFake).to.have.been.calledWith(["-P", 5037, "kill-server"]);
          expect(logSpy).to.not.have.been.calledTwice;
          expect(logSpy).to.have.been.calledWith(
            "killing all running adb servers"
          );
        });
      });
    });

    describe("reconnect()", function() {
      it("should reconnect", function() {
        const execFake = sinon.fake((args, callback) => {
          callback();
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.reconnect().then(r => {
          expect(r).to.equal(undefined);
          expect(execFake).to.have.been.calledOnce;
          expect(execFake).to.not.have.been.calledTwice;
          expect(execFake).to.have.been.calledWith(["-P", 5037, "reconnect"]);
        });
      });
      it("should reject on no device", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "no devices/emulators found");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
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
        const execFake = sinon.fake((args, callback) => {
          callback();
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.reconnectDevice().then(r => {
          expect(r).to.equal(undefined);
          expect(execFake).to.have.been.calledOnce;
          expect(execFake).to.not.have.been.calledTwice;
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "reconnect",
            "device"
          ]);
        });
      });
    });

    describe("reconnectOffline()", function() {
      it("should reconnect offline devices", function() {
        const execFake = sinon.fake((args, callback) => {
          callback();
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        sinon.stub(adb, "killServer").returns();
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.reconnectOffline().then(r => {
          expect(r).to.equal(undefined);
          expect(execFake).to.have.been.calledOnce;
          expect(execFake).to.not.have.been.calledTwice;
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "reconnect",
            "offline"
          ]);
        });
      });
    });

    describe("getSerialno()", function() {
      it("should return serialnumber", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(false, "1234567890ABCDEF\n");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getSerialno().then(r => {
          expect(r).to.equal("1234567890ABCDEF");
          expect(execFake).to.have.been.calledOnce;
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "get-serialno"
          ]);
        });
      });
      it("should return error on invalid return", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(false, "This is an invalid string");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(adb.getSerialno()).to.be.rejectedWith(
          "invalid device id"
        );
      });
    });

    describe("shell()", function() {
      it("should run command on device", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "This string is returned over stdout");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.shell(["one", "two", "three"]).then(r => {
          expect(r).to.equal("This string is returned over stdout");
          expect(execFake).to.have.been.called;
        });
      });
    });

    describe("push()", function() {
      it("should push file", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.push("tests/test-data/test_file", "/tmp/target").then(() => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "push",
            common.quotepath("tests/test-data/test_file"),
            "/tmp/target",
            common.stdoutFilter("%]")
          ]);
        });
      });
      it("should reject if device is out of space", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(
            null,
            "adb: error: failed to copy '/local/path' to '/target/path': remote No space left on device\n" +
              "/local/path: 0 files pushed. 5.2 MB/s (99995728 bytes in 18.348s)\n",
            ""
          );
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith("Push failed: out of space");
      });
      it("should reject if file is inaccessible", function() {
        const execFake = sinon.fake();
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(
          adb.push("this/file/does/not/exist", "/tmp/target")
        ).to.have.been.rejectedWith("Can't access file");
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
        const logSpy = sinon.spy();
        return Promise.all(
          execFakes.map(execFake => {
            const adb = new Adb({ exec: execFake, log: logSpy });
            return expect(
              adb.push("tests/test-data/test_file", "/tmp/target")
            ).to.have.been.rejectedWith("connection lost");
          })
        );
      });
      it("should reject with original error on connection lost and device detection rejected", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("echo"))
            callback(false, "hasaccess-stdout", "hasaccess-stderr");
          else callback(true, "push-stdout", "push-stderr");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith(
          'Push failed: Error: {"error":true,"stdout":"push-stdout","stderr":"push-stderr"}'
        );
      });
      it("should reject with original error on connection lost and device detected", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("echo")) callback(null, ".\r\n", "");
          else callback(true, "push-stdout", "push-stderr");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith(
          'Push failed: Error: {"error":true,"stdout":"push-stdout","stderr":"push-stderr"}'
        );
      });
      it("should reject on unknown error", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("echo"))
            callback(false, "hasaccess-stdout", "hasaccess-stderr");
          else callback(false, "push-stdout: 0 files pushed", "push-stderr");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(
          adb.push("tests/test-data/test_file", "/tmp/target")
        ).to.have.been.rejectedWith(
          "Push failed: stdout: push-stdout: 0 files pushed"
        );
      });
      it("should survive if stat failed", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("stat")) callback(true, "stdout", "stderr");
          else setTimeout(callback, 5);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb
          .push("tests/test-data/test_file", "/tmp/target", 1)
          .then(ret => {
            expect(logSpy).to.have.been.calledWith(
              'failed to stat: Error: {"error":true,"stdout":"stdout","stderr":"stderr"}'
            );
            expect(execFake).to.have.been.calledWith([
              "-P",
              5037,
              "shell",
              "stat",
              "-t",
              common.quotepath("/tmp/target/test_file")
            ]);
          });
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
          const execFake = sinon.fake((args, callback) => {
            callback(null, null, null);
          });
          const logSpy = sinon.spy();
          const adb = new Adb({ exec: execFake, log: logSpy });
          return adb.reboot(state).then(() => {
            expect(execFake).to.have.been.calledWith([
              "-P",
              5037,
              "reboot",
              state
            ]);
          });
        });
      });
      it("should reject on failure in stdout", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "failed", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.reboot("bootloader").catch(() => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "reboot",
            "bootloader"
          ]);
          done();
        });
      });
      it("should reject on error", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(666, "everything exploded", "what!?");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.reboot("bootloader").catch(() => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "reboot",
            "bootloader"
          ]);
          done();
        });
      });
      it("should reject on invalid state", function() {
        const execFake = sinon.spy();
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
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
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.sideload("tests/test-data/test_file").then(() => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "sideload",
            common.quotepath("tests/test-data/test_file"),
            common.stdoutFilter("%)")
          ]);
        });
      });
      it("should reject if no package specified");
      it("should reject if package inaccessible");
      it("should reject on error");
    });
    describe("getState()", function() {
      it("should resolve state", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "recovery", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getState().then(() => {
          expect(execFake).to.have.been.calledWith(["-P", 5037, "get-state"]);
        });
      });
    });
  });

  describe("convenience functions", function() {
    describe("ensureState()", function() {
      it("should resolve if already in requested state", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "recovery", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.ensureState("recovery").then(() => {
          expect(execFake).to.have.been.calledWith(["-P", 5037, "get-state"]);
        });
      });
      it("should properly handle device state", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "device", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.ensureState("system").then(() => {
          expect(execFake).to.have.been.calledWith(["-P", 5037, "get-state"]);
        });
      });
      it("should reboot to correct state", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "recovery", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        sinon.stub(adb, "reboot").resolves();
        sinon.stub(adb, "waitForDevice").resolves();
        return adb.ensureState("system").then(() => {
          expect(execFake).to.have.been.calledWith(["-P", 5037, "get-state"]);
        });
      });
    });
    describe("pushArray()", function() {
      it("should resolve on empty array", function() {
        const execFake = sinon.spy();
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        const progressSpy = sinon.spy();
        return Promise.all([
          adb.pushArray([], progressSpy),
          adb.pushArray()
        ]).then(r => {
          expect(r[0]).to.equal(undefined);
          expect(r[1]).to.equal(undefined);
          expect(execFake).to.not.have.been.called;
          expect(progressSpy).to.have.been.calledWith(1);
          expect(progressSpy).to.not.have.been.calledTwice;
        });
      });
      it("should push files", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("push")) setTimeout(callback, 5);
          else callback(null, "1 1", null);
        });
        const logSpy = sinon.spy();
        const fakeArray = [
          { src: "tests/test-data/test_file", dest: "/tmp/target" },
          { src: "tests/test-data/test file", dest: "/tmp/target" }
        ];
        const adb = new Adb({ exec: execFake, log: logSpy });
        const progressSpy = sinon.spy();
        return adb.pushArray(fakeArray, progressSpy, 1).then(() => {
          expect(progressSpy).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "push",
            common.quotepath("tests/test-data/test_file"),
            "/tmp/target",
            common.stdoutFilter("%]")
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "push",
            common.quotepath("tests/test-data/test file"),
            "/tmp/target",
            common.stdoutFilter("%]")
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "stat",
            "-t",
            common.quotepath("/tmp/target/test_file")
          ]);
        });
      });
      it("should reject if files are inaccessible", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("stat")) setTimeout(callback, 5);
          else callback(null, "1", null);
        });
        const logSpy = sinon.spy();
        const fakeArray = [
          { src: "tests/test-data/test_file", dest: "/tmp/target" },
          { src: "this/file/does/not/exist", dest: "/tmp/target" },
          { src: "tests/test-data/test file", dest: "/tmp/target" }
        ];
        const adb = new Adb({ exec: execFake, log: logSpy });
        const progressSpy = sinon.spy();
        return adb.pushArray(fakeArray, progressSpy, 1).catch(e => {
          expect(e).to.exist;
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
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
        const logSpy = sinon.spy();
        const fakeArray = [
          { src: "tests/test-data/test_file", dest: "/tmp/target" },
          { src: "tests/test-data/test file", dest: "/tmp/target" }
        ];
        const adb = new Adb({ exec: execFake, log: logSpy });
        const progressSpy = sinon.spy();
        return adb.pushArray(fakeArray, progressSpy, 1).catch(e => {
          expect(e.message).to.include(
            'Failed to push file 0: Error: Push failed: Error: {"error":1,"stdout":"adb: error: failed to copy \'tests/test-data/test_file\' to \'/tmp/target\': couldn\'t read from device\\ntests/test-data/test_file: 0 files pushed. 7.2 MB/s (22213992 bytes in 2.957s)"}'
          );
        });
      });
      it("should report progress"); // TODO: Check that the progress report actually makes sense
    });

    describe("getDeviceName()", function() {
      it("should get device name from getprop", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "thisisadevicecodename");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getDeviceName().then(r => {
          expect(r).to.equal("thisisadevicecodename");
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "getprop",
            "ro.product.device"
          ]);
        });
      });
      ["getprop: not found", null].forEach(response => {
        it("should cat default.prop on " + (response || "empty"), function() {
          const execFake = sinon.fake((args, callback) => {
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
          const logSpy = sinon.spy();
          const adb = new Adb({ exec: execFake, log: logSpy });
          return adb.getDeviceName().then(r => {
            expect(r).to.equal("thisisadevicecodename");
            expect(execFake).to.have.been.calledWith([
              "-P",
              5037,
              "shell",
              "getprop",
              "ro.product.device"
            ]);
            expect(execFake).to.have.been.calledWith([
              "-P",
              5037,
              "shell",
              "cat",
              "default.prop"
            ]);
          });
        });
      });
      it("should reject if prop not found", function() {
        const execFake = sinon.fake((args, callback) => callback());
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal("unknown getprop error");
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("getprop")) callback();
          else callback({ error: "something broke" });
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal(
            'getprop error: Error: {"error":{"error":"something broke"}}'
          );
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "getprop",
            "ro.product.device"
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "cat",
            "default.prop"
          ]);
        });
      });
      it("should reject if default.prop didn't include ro.product.device", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("getprop")) {
            callback();
          } else {
            callback(null, "asdf=wasd\n1=234\nsomething=somethingelse");
          }
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getDeviceName().catch(e => {
          expect(e.message).to.equal("unknown getprop error");
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "getprop",
            "ro.product.device"
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "cat",
            "default.prop"
          ]);
        });
      });
    });

    describe("getOs()", function() {
      it('should resolve "ubuntutouch"', function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "Contents of the system-image file go here");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getOs().then(r => {
          expect(r).to.equal("ubuntutouch");
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "cat",
            "/etc/system-image/channel.ini"
          ]);
        });
      });
      it('should resolve "android"', function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getOs().then(r => {
          expect(r).to.equal("android");
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "cat",
            "/etc/system-image/channel.ini"
          ]);
        });
      });
    });

    describe("hasAccess()", function() {
      it("should resolve true", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, ".");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.hasAccess().then(r => {
          expect(r).to.equal(true);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "echo",
            "."
          ]);
        });
      });
      it("should resolve false", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, null, "error: no devices/emulators found");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.hasAccess().then(r => {
          expect(r).to.equal(false);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "echo",
            "."
          ]);
        });
      });
      it("should reject", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "This is an unexpected reply");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(adb.hasAccess()).to.have.been.rejectedWith(
          "unexpected response: This is an unexpected reply"
        );
      });
    });

    describe("waitForDevice()", function() {
      it("should resolve when a device is detected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, ".");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.waitForDevice(1).then(r => {
          expect(execFake).to.have.been.called;
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "echo",
            "."
          ]);
        });
      });
      it("should reject on error", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, null, "everything exploded");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(adb.waitForDevice(5, 10)).to.be.rejectedWith(
          "everything exploded"
        );
      });
      it("should reject on timeout", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, null, "error: no devices/emulators found");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(adb.waitForDevice(5, 10)).to.be.rejectedWith(
          "no device: timeout"
        );
      });
    });

    describe("stopWaiting()", function() {
      it("should cause waitForDevice() to reject", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, null, "error: no devices/emulators found");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return new Promise(function(resolve, reject) {
          const wait = adb.waitForDevice(5);
          setTimeout(() => {
            adb.stopWaiting();
            resolve(expect(wait).to.be.rejectedWith("stopped waiting"));
          }, 10);
        });
      });
    });

    describe("format()", function() {
      it("should format partition", function() {
        const execFake = sinon.fake((args, callback) => {
          if (args.includes("/etc/recovery.fstab"))
            callback(
              null,
              "/dev/block/platform/mtk-msdc.0/by-name/cache /cache"
            );
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.format("cache").then(() => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "cat",
            "/etc/recovery.fstab"
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "umount /cache"
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "make_ext4fs /dev/block/platform/mtk-msdc.0/by-name/cache"
          ]);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "mount /cache"
          ]);
        });
      });
      it("should be rejected if fstab can't be read", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(adb.format("cache")).to.be.rejectedWith(
          "unable to read recovery.fstab"
        );
      });
      it("should be rejected if partition can't be read", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "some invalid fstab");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return expect(adb.format("cache")).to.be.rejectedWith(
          "failed to format cache: Error: failed to parse fstab"
        );
      });
    });

    describe("wipeCache()", function() {
      it("should resolve if cache was wiped", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, null, null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.wipeCache().then(() => {
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "rm",
            "-rf",
            "/cache/*"
          ]);
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
              const execSpy = sinon.spy();
              const logSpy = sinon.spy();
              const adb = new Adb({ exec: execSpy, log: logSpy });
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
        const execFake = sinon.fake((args, callback) => {
          callback(null, "/dev/userdata on /data type ext4 (rw)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
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
        const logSpy = sinon.spy();
        const adb1 = new Adb({ exec: execFake1, log: logSpy });
        const adb2 = new Adb({ exec: execFake2, log: logSpy });
        return Promise.all([
          adb1.verifyPartitionType("data", "ext4"),
          adb2.verifyPartitionType("data", "ext4")
        ]).catch(r => {
          expect(r.message).to.eql("unable to detect partitions");
        });
      });
      it("should reject if partition not found", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "/dev/something on /something type ext4 (rw)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.verifyPartitionType("data", "ext4").catch(r => {
          expect(r.message).to.eql("partition not found");
        });
      });
      it("should reject if adb shell rejected", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(true, null, "everything exploded");
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.verifyPartitionType("data", "ext4").catch(r => {
          expect(r.message).to.eql(
            'partition not found: Error: {"error":true,"stdout":null,"stderr":"everything exploded"}'
          );
        });
      });
    });
    describe("getFileSize()", function() {
      it("should resolve file size", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "1337", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getFileSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "du -shk /wtf"
          ]);
        });
      });
      it("should reject on invalid response file size", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "invalid response :)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.getFileSize().catch(() => {
          expect(execFake).to.have.been.calledOnce;
          done();
        });
      });
    });
    describe("getAvailablePartitionSize()", function() {
      it("should resolve available partition size", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "a\n/wtf 1337 a b", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getAvailablePartitionSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "df -k -P /wtf"
          ]);
        });
      });
      it("should reject on invalid response", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "invalid response :)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.getAvailablePartitionSize("/wtf").catch(() => {
          expect(execFake).to.have.been.calledOnce;
          done();
        });
      });
      it("should reject on error", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(69, "invalid response :)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.getAvailablePartitionSize().catch(() => {
          expect(execFake).to.have.been.calledOnce;
          done();
        });
      });
    });
    describe("getTotalPartitionSize()", function() {
      it("should resolve available partition size", function() {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "a\n/wtf 1337 a b c d", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        return adb.getTotalPartitionSize("/wtf").then(size => {
          expect(size).to.eql(1337);
          expect(execFake).to.have.been.calledWith([
            "-P",
            5037,
            "shell",
            "df -k -P /wtf"
          ]);
        });
      });
      it("should reject on invalid response", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(null, "invalid response :)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.getTotalPartitionSize("/wtf").catch(() => {
          expect(execFake).to.have.been.calledOnce;
          done();
        });
      });
      it("should reject on error", function(done) {
        const execFake = sinon.fake((args, callback) => {
          callback(69, "invalid response :)", null);
        });
        const logSpy = sinon.spy();
        const adb = new Adb({ exec: execFake, log: logSpy });
        adb.getTotalPartitionSize().catch(() => {
          expect(execFake).to.have.been.calledOnce;
          done();
        });
      });
    });
  });
});
