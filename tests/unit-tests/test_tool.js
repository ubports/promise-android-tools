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

const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const EventEmitter = require("events");
const child_process = require("child_process");

const { Tool } = require("../../src/module.js");

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

  describe("exec()", function() {
    validOptions.forEach(options => {
      it(`should resolve stdout if constructed with ${JSON.stringify(
        options
      )}`, function() {
        const execStub = sinon
          .stub(child_process, "exec")
          .yields(undefined, "ok");
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
          expect(execStub).to.have.been.calledWith(
            [tool.executable, ...tool.extra, ...args].join(" "),
            tool.execOptions
          );
        });
      });
    });
    it("should reject on error", function(done) {
      const execStub = sinon
        .stub(child_process, "exec")
        .yields("not good", "uh oh", "terrible things");
      const tool = new Tool({ tool: "fastboot" });
      const execListenerStub = sinon.stub();
      tool.on("exec", execListenerStub);
      tool.exec("asdf").catch(e => {
        expect(e).to.be.instanceOf(Error);
        expect(execListenerStub).to.have.been.calledWith({
          cmd: ["fastboot", "asdf"],
          error: "not good",
          stderr: "terrible things",
          stdout: "uh oh"
        });
        expect(e).to.have.ownProperty(
          "message",
          '{"error":"not good","stdout":"uh oh","stderr":"terrible things"}'
        );
        done();
      });
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
});
