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

import test from "ava";

import * as common from "./common.js";

test("removeFalsy()", async t => {
  t.deepEqual(
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
      k: { foo: { bar: null }, baz: true, brz: {} },
      l: " ",
      m: "\n",
      n: "\r\n",
      o: " \n\r\n",
      get p(): string {
        return "p";
      }
    }),
    {
      a: "a",
      f: { test: "this" },
      g: 1337,
      j: ["a", "b"],
      k: { baz: true },
      p: "p"
    }
  );
});
