"use strict";

/*
 * Copyright (C) 2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2022 Johannah Sprinz <hannah@ubports.com>
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

import cp from "cancelable-promise";

describe("CancelablePromise", function () {
  it("should export tool when packaged", function () {
    cp.CancelablePromise = null;
    return import("./cancelable-promise.js").then(cp =>
      expect(cp).toBeTruthy()
    );
  });
  it("should export tool when native", function () {
    return import("./cancelable-promise.js").then(cp =>
      expect(cp).toBeTruthy()
    );
  });
});
