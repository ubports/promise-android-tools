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

import test from "ava";
import * as td from "testdouble";

import { HierarchicalAbortController } from "./hierarchicalAbortController.js";

test("abort signal", async t => {
  t.plan(3);
  const controller = new HierarchicalAbortController();
  controller.signal.addEventListener("abort", ({ type }) =>
    t.is(type, "abort")
  );
  t.is(controller.signal.aborted, false);
  controller.abort();

  t.is(controller.signal.aborted, true);
});
test("aborting child should not abort parent", async t => {
  t.plan(5);
  const parentController = new HierarchicalAbortController();
  parentController.signal.addEventListener("abort", () =>
    t.fail("aborting child should not abort parent")
  );
  const childController = new HierarchicalAbortController(
    parentController.signal
  );
  childController.signal.addEventListener("abort", ({ type }) =>
    t.is(type, "abort")
  );
  t.is(parentController.signal.aborted, false);
  t.is(childController.signal.aborted, false);

  childController.abort();

  t.is(parentController.signal.aborted, false);
  t.is(childController.signal.aborted, true);
});
test("aborting parent should abort child", async t => {
  t.plan(6);
  const parentController = new HierarchicalAbortController();
  parentController.signal.addEventListener("abort", ({ type }) =>
    t.is(type, "abort")
  );
  const childController = new HierarchicalAbortController(
    parentController.signal
  );
  childController.signal.addEventListener("abort", ({ type }) =>
    t.is(type, "abort")
  );
  t.is(parentController.signal.aborted, false);
  t.is(childController.signal.aborted, false);

  parentController.abort();

  t.is(parentController.signal.aborted, true);
  t.is(childController.signal.aborted, true);
});
test("already aborted parent should abort child", async t => {
  t.plan(2);
  const parentController = new HierarchicalAbortController();
  parentController.abort();
  const childController = new HierarchicalAbortController(
    parentController.signal
  );
  childController.signal.addEventListener("abort", ({ type }) =>
    t.fail("parent had already been aborted, event should not be dispatched")
  );

  t.is(parentController.signal.aborted, true);
  t.is(childController.signal.aborted, true);
});
