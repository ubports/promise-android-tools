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

const DeviceTools = require("../../src/module.js").DeviceTools;
const { CancelablePromise } = require("cancelable-promise");

function expectReject(error, message) {
  expect(error).to.be.instanceOf(Error);
  expect(error).to.haveOwnProperty("message", message);
}

describe("DeviceTools module", function() {
  describe("constructor()", function() {
    it("should construct deviceTools", function() {
      const deviceTools = new DeviceTools();
      expect(deviceTools).to.exist;
    });
  });
  describe("wait()", function() {
    it("should resolve mode", function() {
      const deviceTools = new DeviceTools();
      sinon
        .stub(deviceTools.adb, "wait")
        .returns(CancelablePromise.resolve("device"));
      sinon
        .stub(deviceTools.fastboot, "wait")
        .returns(CancelablePromise.reject());
      sinon
        .stub(deviceTools.heimdall, "wait")
        .returns(CancelablePromise.reject());
      return deviceTools.wait().then(r => {
        expect(r).to.eql("device");
      });
    });
    it("should reject if all wait functions rejected", function(done) {
      const deviceTools = new DeviceTools();
      sinon.stub(deviceTools.adb, "wait").returns(CancelablePromise.reject());
      sinon
        .stub(deviceTools.fastboot, "wait")
        .returns(CancelablePromise.reject());
      sinon
        .stub(deviceTools.heimdall, "wait")
        .returns(CancelablePromise.reject());
      deviceTools.wait().catch(e => {
        expectReject(e, "no device");
        done();
      });
    });
    it("should be cancellable", function() {
      const deviceTools = new DeviceTools();
      sinon.stub(deviceTools.adb, "wait").returns(new CancelablePromise());
      sinon.stub(deviceTools.fastboot, "wait").returns(new CancelablePromise());
      sinon.stub(deviceTools.heimdall, "wait").returns(new CancelablePromise());
      const cp = deviceTools.wait();
      cp.cancel();
    });
  });
  describe("getDeviceName()", function() {
    it("should resolve device name", function() {
      const deviceTools = new DeviceTools();
      sinon
        .stub(deviceTools.adb, "getDeviceName")
        .returns(CancelablePromise.resolve("asdf"));
      sinon
        .stub(deviceTools.fastboot, "getDeviceName")
        .returns(CancelablePromise.reject());
      sinon
        .stub(deviceTools.heimdall, "hasAccess")
        .returns(CancelablePromise.resolve(false));
      return deviceTools.getDeviceName().then(r => {
        expect(r).to.eql("asdf");
      });
    });
    it("should reject on error", function(done) {
      const deviceTools = new DeviceTools();
      sinon
        .stub(deviceTools.adb, "getDeviceName")
        .returns(CancelablePromise.reject());
      sinon
        .stub(deviceTools.fastboot, "getDeviceName")
        .returns(CancelablePromise.reject());
      sinon
        .stub(deviceTools.heimdall, "hasAccess")
        .returns(CancelablePromise.resolve(false));
      deviceTools.getDeviceName().catch(e => {
        expectReject(e, "no device");
        done();
      });
    });
  });
});
