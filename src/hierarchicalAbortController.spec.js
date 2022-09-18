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

import { HierarchicalAbortController } from "./hierarchicalAbortController.js";

describe("HierarchicalAbortController", function () {
  it("should be constructed", done => {
    const abortListener = jest.fn();
    const controller = new HierarchicalAbortController();
    controller.signal.addEventListener("abort", abortListener);
    expect(controller.signal.aborted).toBe(false);
    controller.abort();

    expect(abortListener).toHaveBeenCalledTimes(1);
    expect(controller.signal.aborted).toBe(true);
    done();
  });
  it("aborting child should not abort parent", done => {
    const parentAbortListener = jest.fn();
    const parentController = new HierarchicalAbortController();
    parentController.signal.addEventListener("abort", parentAbortListener);
    const childAbortListener = jest.fn();
    const childController = new HierarchicalAbortController(
      parentController.signal
    );
    childController.signal.addEventListener("abort", childAbortListener);
    expect(parentController.signal.aborted).toBe(false);
    expect(childController.signal.aborted).toBe(false);

    childController.abort();

    expect(parentAbortListener).not.toHaveBeenCalled();
    expect(parentController.signal.aborted).toBe(false);
    expect(childAbortListener).toHaveBeenCalledTimes(1);
    expect(childController.signal.aborted).toBe(true);
    done();
  });
  it("aborting parent should abort child #mybodymychoice", done => {
    const parentAbortListener = jest.fn();
    const parentController = new HierarchicalAbortController();
    parentController.signal.addEventListener("abort", parentAbortListener);
    const childAbortListener = jest.fn();
    const childController = new HierarchicalAbortController(
      parentController.signal
    );
    childController.signal.addEventListener("abort", childAbortListener);
    expect(parentController.signal.aborted).toBe(false);
    expect(childController.signal.aborted).toBe(false);

    parentController.abort();

    expect(parentAbortListener).toHaveBeenCalledTimes(1);
    expect(parentController.signal.aborted).toBe(true);
    expect(childAbortListener).toHaveBeenCalledTimes(1);
    expect(childController.signal.aborted).toBe(true);
    done();
  });
  it("already aborted parent should abort child", done => {
    const parentController = new HierarchicalAbortController();
    parentController.abort();
    const childAbortListener = jest.fn();
    const childController = new HierarchicalAbortController(
      parentController.signal
    );
    childController.signal.addEventListener("abort", childAbortListener);

    expect(parentController.signal.aborted).toBe(true);
    expect(childAbortListener).not.toHaveBeenCalled();
    expect(childController.signal.aborted).toBe(true);
    done();
  });
});
