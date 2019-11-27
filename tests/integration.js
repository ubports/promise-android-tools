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
              args[args.length - 2],
            callback
          );
        };
        const logSpy = sinon.spy();
        const _tool = new tools[tool]({ exec: execStub, log: logSpy});
        return expect(_tool.execCommand(["tests/test-data/test_file"])).to.not.have.been.rejected;
      });
    });
  });
});
