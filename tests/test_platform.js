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

import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
const expect = chai.expect;
chai.use(sinonChai);

import util from "util";
import { spawn, execFile } from "child_process";
const execFilePromise = util.promisify(execFile);
const spawnPromise = (file, args) =>
  new Promise((resolve, reject) => {
    const cp = spawn(file, args);
    cp.on("exit", code => (code ? reject({ code }) : resolve()));
  });

describe("platform", function() {
  this.timeout(20000);
  ["fake_fileaccessor", "fake fileaccessor"].forEach(e => {
    describe(e, function() {
      [
        { f: execFilePromise, n: "execFile" },
        { f: spawnPromise, n: "spawn" }
      ].forEach(({ f, n }) => {
        it(`${n} should access path without spaces`, function() {
          return f("node", [
            `tests/test-data/${e}.js`,
            "tests/test-data/test_file"
          ]);
        });
        it(`${n} should access path with spaces`, function() {
          return f("node", [
            `tests/test-data/${e}.js`,
            "tests/test-data/test file"
          ]);
        });
        it(`${n} should throw on inaccessible path`, function(done) {
          f("node", [
            `tests/test-data/${e}.js`,
            "tests/test-data/thisdoesntexist"
          ]).catch(error => {
            expect(error).to.haveOwnProperty("code", 1);
            done();
          });
        });
      });
    });
  });
});
