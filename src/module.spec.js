// @ts-check
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

import { DeviceTools } from "./module.js";

function expectReject(error, message) {
  expect(error).toBeInstanceOf(Error);
  expect(error).toHaveProperty("message", message);
}

describe("DeviceTools module", function () {
  describe("constructor()", function () {
    it("should construct deviceTools", function () {
      const deviceTools = new DeviceTools({});
      expect(deviceTools).toExist;
    });
    it("should construct deviceTools with generic arg", function () {
      const deviceTools = new DeviceTools({ adbOptions: { port: 1337 } });
      expect(deviceTools).toExist;
    });
    it("should construct deviceTools with specific args", function () {
      const deviceTools = new DeviceTools({ port: 1337 }, { serial: true }, {});
      expect(deviceTools).toExist;
    });
    ["adb", "fastboot", "heimdall"].forEach(tool => {
      ["exec", "spawn:start", "spawn:exit", "spawn:error"].forEach(signal =>
        it(`should emit ${signal} for ${tool}`, () => {
          const deviceTools = new DeviceTools({});
          deviceTools.emit = jest.fn();
          deviceTools[tool].emit(signal, "asdf");
          expect(deviceTools.emit).toHaveBeenCalledTimes(1);
          expect(deviceTools.emit).toHaveBeenCalledWith(signal, "asdf");
        })
      );
    });
  });
  describe("kill()", function () {
    it("should kill child processes", function () {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.kill = jest.fn();
      deviceTools.fastboot.kill = jest.fn();
      deviceTools.heimdall.kill = jest.fn();
      expect(deviceTools.kill()).toEqual(undefined);
    });
  });
  describe.skip("wait()", function () {
    it("should resolve mode", function () {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.wait = jest
        .fn()
        .mockReturnValue(Promise.resolve("device"));
      deviceTools.fastboot.wait = jest.fn().mockReturnValue(Promise.reject());
      deviceTools.heimdall.wait = jest.fn().mockReturnValue(Promise.reject());
      return deviceTools.wait().then(r => {
        expect(r).toEqual("device");
      });
    });
    it("should reject if all wait functions rejected", function (done) {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.wait = jest.fn().mockReturnValue(Promise.reject());
      deviceTools.fastboot.wait = jest.fn().mockReturnValue(Promise.reject());
      deviceTools.heimdall.wait = jest.fn().mockReturnValue(Promise.reject());
      deviceTools.wait().catch(e => {
        expectReject(e, "no device");
        done();
      });
    });
    it.skip("should be cancellable", function () {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.wait = jest.fn().mockReturnValue(new Promise());
      deviceTools.fastboot.wait = jest.fn().mockReturnValue(new Promise());
      deviceTools.heimdall.wait = jest.fn().mockReturnValue(new Promise());
      const cp = deviceTools.wait();
      cp.cancel();
    });
  });
  describe("getDeviceName()", function () {
    it("should resolve device name from adb", function () {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.getDeviceName = jest
        .fn()
        .mockReturnValue(Promise.resolve("asdf"));
      return deviceTools.getDeviceName().then(r => {
        expect(r).toEqual("asdf");
      });
    });
    it("should resolve device name from fastboot", function () {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.getDeviceName = jest
        .fn()
        .mockReturnValue(Promise.reject());
      deviceTools.fastboot.getDeviceName = jest
        .fn()
        .mockReturnValue(Promise.resolve("asdf"));
      return deviceTools.getDeviceName().then(r => {
        expect(r).toEqual("asdf");
      });
    });
    it("should reject on error", function (done) {
      const deviceTools = new DeviceTools({});
      deviceTools.adb.getDeviceName = jest
        .fn()
        .mockReturnValue(Promise.reject());
      deviceTools.fastboot.getDeviceName = jest
        .fn()
        .mockReturnValue(Promise.reject());
      deviceTools.getDeviceName().catch(e => {
        expectReject(e, "no device");
        done();
      });
    });
  });
});
