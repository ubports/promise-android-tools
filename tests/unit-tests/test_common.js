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

import * as common from "../../src/common.js";

describe("Common module", function() {
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
          g: 1337,
          h: {},
          i: { test: null },
          j: ["a", "b"],
          k: { foo: { bar: null }, baz: true, brz: {} }
        })
      ).to.deep.equal({
        a: "a",
        f: { test: "this" },
        g: 1337,
        j: ["a", "b"],
        k: { baz: true }
      });
    });
  });
});
