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
  });
  describe("convenience functions", function() {
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
