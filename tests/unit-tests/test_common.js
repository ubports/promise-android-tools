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
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);

const common = require("../../src/common.js");

describe("Common module", function() {
  describe("quotepath()", function() {
    it("should use correct quotes for the platform", function() {
      expect(common.quotepath("some/path with/ spaces")).to.equal(
        process.platform == "darwin"
          ? "'some/path with/ spaces'"
          : '"some/path with/ spaces"'
      );
    });
    [
      { platform: "darwin", q: "'" },
      { platform: "linux", q: '"' },
      { platform: "win32", q: '"' }
    ].forEach(p =>
      it(`should use ${p.q} on ${p.platform}`, function() {
        sinon.stub(process, "platform").value(p.platform);
        expect(common.quotepath("a")).to.eql(`${p.q}a${p.q}`);
      })
    );
  });
  describe("removeFalsy()", function() {
    it("should remove falsy values from an object", function() {
      expect(
        common.removeFalsy({
          a: "a",
          b: "",
          c: 0,
          d: null,
          e: undefined,
          f: { test: "this" },
          g: 1337
        })
      ).to.deep.equal({ a: "a", f: { test: "this" }, g: 1337 });
    });
  });
});
