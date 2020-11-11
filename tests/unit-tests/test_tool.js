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

import chai from "chai";
import sinon from "sinon";
import chaiAsPromised from "chai-as-promised";
import sinonChai from "sinon-chai";
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

import EventEmitter from "events";
import child_process from "child_process";

import { Tool } from "../../src/module.js";
import { genericErrors } from "../test-data/known_errors.js";

const validOptions = [
  { tool: "adb" },
  { tool: "adb", extra: ["-a"] },
  { tool: "adb", extra: ["-a", "-s", "-d", "-f"] },
  { tool: "adb", execOptions: { a: "b" } }
];

describe("Tool module", function() {
  describe("constructor()", function() {
    ["adb", "fastboot", "heimdall"].forEach(t => {
      it(`should create generic ${t}`, function() {
        const tool = new Tool({ tool: t });
        expect(tool).to.exist;
        expect(tool.tool).to.eql(t);
        expect(tool.executable).to.include(t);
        expect(tool.extra).to.eql([]);
        expect(tool.execOptions).to.eql({});
      });
    });
    it("should throw if invoked without valid tool", function(done) {
      try {
        new Tool();
      } catch (e) {
        expect(e).to.be.instanceOf(Error);
        expect(e).to.have.ownProperty("message", "Invalid argument: undefined");
        done();
      }
    });
  });

  describe("kill()", function() {
    it("should kill childprocesses", function() {
      const tool = new Tool({ tool: "adb" });
      expect(tool.processes).to.eql([]);
      tool.processes = [{ kill: sinon.spy() }, { kill: sinon.spy() }];
      expect(tool.kill()).to.eql(undefined);
      expect(tool.processes[0].kill).to.have.been.calledOnce;
      expect(tool.processes[1].kill).to.have.been.calledOnce;
    });
    it("should do nothing if there's nothing to do", function() {
      const tool = new Tool({ tool: "adb" });
      expect(tool.processes).to.eql([]);
      expect(tool.kill()).to.eql(undefined);
    });
  });

  describe("exec()", function() {
    validOptions.forEach(options => {
      it(`should resolve stdout if constructed with ${JSON.stringify(
        options
      )}`, function() {
        sinon.stub(child_process, "execFile").yields(undefined, "ok");
        const tool = new Tool(options);
        const args = ["these", "-are", "--all=valid", "./arguments"];
        const execListenerStub = sinon.stub();
        tool.on("exec", execListenerStub);
        return tool.exec(...args).then(r => {
          expect(r).to.eql("ok");
          expect(execListenerStub).to.have.been.calledWith({
            cmd: [tool.tool, ...tool.extra, ...args],
            stdout: "ok"
          });
          expect(child_process.execFile).to.have.been.calledWith(
            tool.executable,
            [...tool.extra, ...args],
            tool.execOptions
          );
        });
      });
    });
    it("should reject on error", function(done) {
      sinon
        .stub(child_process, "execFile")
        .yields({ killed: true }, "uh oh", "terrible things");
      const tool = new Tool({ tool: "fastboot" });
      const execListenerStub = sinon.stub();
      tool.on("exec", execListenerStub);
      tool.exec("asdf").catch(e => {
        expect(e).to.be.instanceOf(Error);
        expect(execListenerStub).to.have.been.calledWith({
          cmd: ["fastboot", "asdf"],
          error: { killed: true },
          stderr: "terrible things",
          stdout: "uh oh"
        });
        expect(e).to.have.ownProperty(
          "message",
          '{"error":{"killed":true},"stdout":"uh oh","stderr":"terrible things"}'
        );
        done();
      });
    });
    it("should allow cancelling", function(done) {
      const killFake = sinon.stub().returns(true);
      sinon.stub(child_process, "execFile").callsFake((...cpArgs) => ({
        kill(sig) {
          killFake(sig);
          if (sig === "SIGKILL") cpArgs[3]();
        }
      }));
      const tool = new Tool({ tool: "fastboot" });
      const job = tool.exec("asdf").finally(() => {
        expect(killFake).to.have.been.calledWith("SIGTERM");
        expect(killFake).to.have.been.calledWith("SIGKILL");
        expect(killFake).to.not.have.been.calledThrice;
        expect(tool.processes).to.have.lengthOf(0);
        done();
      });
      expect(tool.processes).to.have.lengthOf(1);
      setTimeout(() => job.cancel(), 1);
    });
    it("should allow killing", function(done) {
      sinon.stub(child_process, "execFile").callsFake((...cpArgs) => ({
        kill() {
          cpArgs[3]();
        }
      }));
      const tool = new Tool({ tool: "fastboot" });
      tool.exec("asdf").finally(() => {
        expect(tool.processes).to.have.lengthOf(0);
        done();
      });
      expect(tool.processes).to.have.lengthOf(1);
      setTimeout(() => tool.kill(), 1);
    });
  });

  describe("spawn()", function() {
    validOptions.forEach(options => {
      [
        { code: 0, signal: null },
        { code: 1, signal: "SIGTERM" }
      ].forEach(res => {
        it(`should spawn and handle ${JSON.stringify(
          res
        )} if constructed with ${JSON.stringify(options)}`, function(done) {
          const spawnEvent = new EventEmitter();
          spawnEvent.stdout = new EventEmitter();
          const spawnStub = sinon
            .stub(child_process, "spawn")
            .returns(spawnEvent);
          const tool = new Tool(options);
          const spawnStartListenerStub = sinon.stub();
          const spawnExitListenerStub = sinon.stub();
          const spawnErrorListenerStub = sinon.stub();
          tool.on("spawn:start", spawnStartListenerStub);
          tool.on("spawn:exit", spawnExitListenerStub);
          tool.on("spawn:error", spawnErrorListenerStub);
          const args = ["these", "-are", "--all=valid", "./arguments"];
          const cp = tool.spawn(args);
          const stdoutDataListener = sinon.stub();
          cp.stdout.on("data", stdoutDataListener);
          const errorListener = sinon.stub();
          cp.on("error", errorListener);
          cp.on("exit", (code, signal) => {
            expect(code).to.eql(res.code);
            expect(signal).to.eql(res.signal);
            expect(spawnStub).to.have.been.calledWith(tool.executable, [
              ...tool.extra,
              ...args
            ]);
            expect(spawnStartListenerStub).to.have.been.calledWith({
              cmd: [tool.tool, ...tool.extra, ...args]
            });
            expect(stdoutDataListener).to.have.been.calledTwice;
            if (!res.code && !res.sig) {
              expect(errorListener).to.not.have.been.called;
              expect(spawnErrorListenerStub).to.not.have.been.called;
            } else {
              expect(errorListener).to.have.been.calledWith(res);
              expect(errorListener).to.not.have.been.calledTwice;
              expect(spawnErrorListenerStub).to.have.been.called;
              expect(spawnErrorListenerStub).to.not.have.been.calledTwice;
            }
            expect(spawnStartListenerStub).to.not.have.been.calledTwice;
            expect(spawnExitListenerStub).to.not.have.been.calledTwice;
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

  describe("handleError()", function() {
    genericErrors("adb").forEach(e =>
      it(`should return ${e.expectedReturn}`, function() {
        const tool = new Tool({ tool: "adb" });
        tool.executable = "/path/to/adb";
        expect(tool.handleError(e.error, e.stdout, e.stderr)).to.deep.eql(
          e.expectedReturn
        );
      })
    );
  });

  describe("wait()", function() {
    it("should resolve when a device is detected", function() {
      const tool = new Tool({ tool: "adb" });
      sinon.stub(tool, "hasAccess").resolves(true);
      return tool.wait().then(r => {
        expect(r).to.eql(undefined);
      });
    });
    it("should reject on error", function() {
      const tool = new Tool({ tool: "adb" });
      return expect(tool.wait()).to.be.rejectedWith("virtual");
    });
    it("should be cancelable", function() {
      const tool = new Tool({ tool: "adb" });
      sinon.stub(tool, "hasAccess").resolves(false);
      const cp = tool.wait().catch(() => {});
      cp.cancel();
    });
  });
});
