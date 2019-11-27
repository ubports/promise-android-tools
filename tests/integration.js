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
const commandExists = require('command-exists').sync;
const exec = require("child_process").exec;
const chai = require("chai");
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);
chai.use(chaiAsPromised);

const tools = require("../src/module.js");
const common = require("../src/common.js");

describe("Integration tests", function() {
  ["Adb","Fastboot","Heimdall"].forEach(tool => {
    describe(tool + " module", function() {
      it("should create tool", function() {
        const _tool = new tools[tool]();
      });
      it("should use tool from path by default", function() {
        const _tool = new tools[tool]();
        if (commandExists(tool.toLowerCase()))
          return expect(_tool.execCommand("--version")).to.not.have.been.rejected;
        else
          return expect(_tool.execCommand("--version")).to.have.been.rejected;
      });
      it("should call the specified executable", function() {
        const execStub = (args, callback) => {
          exec(
            "node tests/test-data/fake_executable.js " + args.join(" "),
            callback
          );
        };
        const logStub = sinon.stub();
        const _tool = new tools[tool]({ exec: execStub, log: logStub});
        return _tool.execCommand(["--help"]).then(r => {
          expect(r).to.include("--help")
        });
      });
      it("called executable should be able to access files", function() {
        const execStub = (args, callback) => {
          exec(
            "node tests/test-data/fake_fileaccesser.js " +
              args.join(" ").replace("-P 5037", ""),
            callback
          );
        };
        const logSpy = sinon.spy();
        const _tool = new tools[tool]({ exec: execStub, log: logSpy});
        return Promise.all([
          expect(_tool.execCommand(["this/file/does/not/exist"])).to.have.been.rejected,
          expect(_tool.execCommand(["tests/test-data/test_file"])).to.not.have.been.rejected,
          expect(_tool.execCommand([common.quotepath("tests/test-data/test file")])).to.not.have.been.rejected
        ]);
      });
    });
  });
  describe("Common module", function() {
    it("should be able to filter stdout", function(done) {
      let stringToEcho = process.platform != "win32" ? "\"this\nlooks\nnot\nok\"" : "this`nlooks`nnot`nok";
      exec(
        "echo " + stringToEcho + " " + common.stdoutFilter("not"),
        (error, stdout, stderr) => {
          expect(error).to.equal(null);
          expect(stdout).to.equal("this\nlooks\nok\n");
          expect(stderr).to.equal("");
          done();
        }
      );
    });
    it("should be able to quote file paths", function(done) {
      exec(
        (process.platform == "win32" ? "dir " : "ls ") + common.quotepath(__dirname + "/test-data/test file"),
        (error, stdout, stderr) => {
          expect(error).to.equal(null);
          expect(stdout).to.exist;
          expect(stderr).to.equal("");
          done();
        }
      );
    });
  })
});
