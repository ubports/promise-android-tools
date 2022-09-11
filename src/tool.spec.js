"use strict";

/*
 * Copyright (C) 2019-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2019-2022 Johannah Sprinz <hannah@ubports.com>
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
jest.useFakeTimers();

import EventEmitter from "events";
import child_process from "child_process";

import { Tool } from "./module.js";
import { genericErrors } from "../tests/test-data/known_errors.js";

import cp from "cancelable-promise";
const { CancelablePromise } = cp;

const validOptions = [
  { tool: "adb" },
  { tool: "adb", extra: ["-a"] },
  { tool: "adb", extra: ["-a", "-s", "-d", "-f"] },
  { tool: "adb", execOptions: { a: "b" } }
];

describe("Tool module", function () {
  describe("constructor()", function () {
    ["adb", "fastboot", "heimdall"].forEach(t => {
      it(`should create generic ${t}`, function () {
        const tool = new Tool({ tool: t });
        expect(tool).toExist;
        expect(tool.tool).toEqual(t);
        expect(tool.executable).toMatch(t);
        expect(tool.extra).toEqual([]);
        expect(tool.execOptions).toEqual({});
      });
    });
    it("should throw if invoked without valid tool", function (done) {
      try {
        new Tool();
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toHaveProperty("message", "Invalid argument: undefined");
        done();
      }
    });
  });

  describe("kill()", function () {
    it("should kill childprocesses", function () {
      const tool = new Tool({ tool: "adb" });
      expect(tool.processes).toEqual([]);
      tool.processes = [{ kill: jest.fn() }, { kill: jest.fn() }];
      expect(tool.kill()).toEqual(undefined);
      expect(tool.processes[0].kill).toHaveBeenCalledTimes(1);
      expect(tool.processes[1].kill).toHaveBeenCalledTimes(1);
    });
    it("should do nothing if there's nothing to do", function () {
      const tool = new Tool({ tool: "adb" });
      expect(tool.processes).toEqual([]);
      expect(tool.kill()).toEqual(undefined);
    });
  });

  describe("exec()", function () {
    validOptions.forEach(options => {
      it(`should resolve stdout if constructed with ${JSON.stringify(
        options
      )}`, function () {
        child_process.execFile = jest
          .fn()
          .mockImplementation((_, args, opts, cb) => cb(undefined, "ok"));
        const tool = new Tool(options);
        const args = ["these", "-are", "--all=valid", "./arguments"];
        const execListenerStub = jest.fn();
        tool.on("exec", execListenerStub);
        return tool.exec(...args).then(r => {
          expect(r).toEqual("ok");
          expect(execListenerStub).toHaveBeenCalledWith({
            cmd: [tool.tool, ...tool.extra, ...args],
            stdout: "ok"
          });
          expect(child_process.execFile).toHaveBeenCalledTimes(1);
          expect(child_process.execFile).toHaveBeenCalledWith(
            tool.executable,
            [...tool.extra, ...args],
            tool.execOptions,
            expect.any(Function)
          );
        });
      });
    });
    it("should reject on error", function (done) {
      child_process.execFile = jest
        .fn()
        .mockImplementation((_, args, opts, cb) =>
          cb({ killed: true }, "uh oh", "terrible things")
        );
      const tool = new Tool({ tool: "fastboot" });
      const execListenerStub = jest.fn();
      tool.on("exec", execListenerStub);
      tool.exec("asdf").catch(e => {
        expect(e).toBeInstanceOf(Error);
        expect(execListenerStub).toHaveBeenCalledWith({
          cmd: ["fastboot", "asdf"],
          error: { killed: true },
          stderr: "terrible things",
          stdout: "uh oh"
        });
        expect(e).toHaveProperty(
          "message",
          '{"error":{"killed":true},"stdout":"uh oh","stderr":"terrible things"}'
        );
        done();
      });
    });
    it("should allow cancelling with SIGTERM", function (done) {
      const killFake = jest.fn().mockReturnValue(true);
      child_process.execFile = jest.fn().mockImplementation((...cpArgs) => ({
        kill(sig) {
          killFake(sig);
          cpArgs[3]();
          return true;
        }
      }));
      const tool = new Tool({ tool: "fastboot" });
      const job = tool.exec("asdf").finally(() => {
        expect(killFake).toHaveBeenCalledWith("SIGTERM");
        expect(killFake).not.toHaveBeenCalledWith("SIGKILL");
        expect(killFake).toHaveBeenCalledTimes(1);
        expect(tool.processes).toHaveLength(0);
        done();
      });
      expect(tool.processes).toHaveLength(1);
      job.cancel();
      jest.runAllTimers();
    });
    it("should allow cancelling and use SIGKILL if SIGTERM did not work", function (done) {
      const killFake = jest.fn().mockReturnValue(true);
      child_process.execFile = jest.fn().mockImplementation((...cpArgs) => ({
        kill(sig) {
          killFake(sig);
          if (sig === "SIGKILL") cpArgs[3]();
          else return false;
        }
      }));
      const tool = new Tool({ tool: "fastboot" });
      const job = tool.exec("asdf").finally(() => {
        expect(killFake).toHaveBeenCalledWith("SIGTERM");
        expect(killFake).toHaveBeenCalledWith("SIGKILL");
        expect(killFake).toHaveBeenCalledTimes(2);
        expect(tool.processes).toHaveLength(0);
        done();
      });
      expect(tool.processes).toHaveLength(1);
      job.cancel();
      jest.runAllTimers();
    });
    it("should allow killing", function (done) {
      child_process.execFile = jest.fn().mockImplementation((...cpArgs) => ({
        kill() {
          cpArgs[3]();
        }
      }));
      const tool = new Tool({ tool: "fastboot" });
      tool.exec("asdf").finally(() => {
        expect(tool.processes).toHaveLength(0);
        done();
      });
      expect(tool.processes).toHaveLength(1);
      tool.kill();
      jest.runAllTimers();
    });
  });

  describe("spawn()", function () {
    validOptions.forEach(options => {
      [
        { code: 0, signal: null },
        { code: 1, signal: "SIGTERM" }
      ].forEach(res => {
        it(`should spawn and handle ${JSON.stringify(
          res
        )} if constructed with ${JSON.stringify(options)}`, function (done) {
          const spawnEvent = new EventEmitter();
          spawnEvent.stdout = new EventEmitter();
          child_process.spawn = jest.fn().mockReturnValue(spawnEvent);
          const tool = new Tool(options);
          const spawnStartListenerStub = jest.fn();
          const spawnExitListenerStub = jest.fn();
          const spawnErrorListenerStub = jest.fn();
          tool.on("spawn:start", spawnStartListenerStub);
          tool.on("spawn:exit", spawnExitListenerStub);
          tool.on("spawn:error", spawnErrorListenerStub);
          const args = ["these", "-are", "--all=valid", "./arguments"];
          const cp = tool.spawn(args);
          const stdoutDataListener = jest.fn();
          cp.stdout.on("data", stdoutDataListener);
          const errorListener = jest.fn();
          cp.on("error", errorListener);
          cp.on("exit", (code, signal) => {
            expect(code).toEqual(res.code);
            expect(signal).toEqual(res.signal);
            expect(child_process.spawn).toHaveBeenCalledWith(
              tool.executable,
              [...tool.extra, ...args],
              { env: { ADB_TRACE: "rwx" } }
            );
            expect(spawnStartListenerStub).toHaveBeenCalledWith({
              cmd: [tool.tool, ...tool.extra, ...args]
            });
            expect(stdoutDataListener).toHaveBeenCalledTimes(2);
            if (!res.code && !res.sig) {
              expect(errorListener).not.toHaveBeenCalled;
              expect(spawnErrorListenerStub).not.toHaveBeenCalled;
            } else {
              expect(errorListener).toHaveBeenCalledWith(res);
              expect(errorListener).toHaveBeenCalledTimes(1);
              expect(spawnErrorListenerStub).toHaveBeenCalledTimes(1);
            }
            expect(spawnStartListenerStub).toHaveBeenCalledTimes(1);
            expect(spawnExitListenerStub).toHaveBeenCalledTimes(1);
            done();
          });
          spawnEvent.stdout.emit("data", "hello, world!");
          spawnEvent.stdout.emit("data", "more data");
          if (res.code || res.sig) {
            spawnEvent.emit("error", res);
          }
          spawnEvent.emit("exit", res.code, res.signal);
        });
      });
    });
  });

  describe("handleError()", function () {
    genericErrors("adb").forEach(e =>
      it(`should return ${e.expectedReturn}`, function () {
        const tool = new Tool({ tool: "adb" });
        tool.executable = "/path/to/adb";
        expect(tool.handleError(e.error, e.stdout, e.stderr)).toBe(
          e.expectedReturn
        );
      })
    );
  });

  describe("wait()", function () {
    it("should resolve when a device is detected", function () {
      const tool = new Tool({ tool: "adb" });
      tool.hasAccess = jest.fn().mockResolvedValue(true);
      return tool.wait().then(r => {
        expect(r).toEqual(undefined);
      });
    });
    it("should reject on error", function (done) {
      const tool = new Tool({ tool: "adb" });
      tool.wait().catch(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty("message", "virtual");
        done();
      });
    });
    it("should be cancelable", function () {
      const tool = new Tool({ tool: "adb" });
      tool.hasAccess = jest.fn().mockResolvedValue(false);
      const cp = tool.wait().catch(() => {});
      cp.cancel();
    });
  });
});
