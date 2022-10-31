/*
 * Copyright (C) 2019-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2019-2022 Johannah Sprinz <hannah@ubports.com>
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
import { genericErrors } from "./__test-helpers/known_errors.js";
import { tool as fake } from "./__test-helpers/fake.js";

const FAKE_EXECUTABLE = "./src/__test-helpers/fake_executable.js";

test(`constructor() should construct`, async t => {
  ["adb", "fastboot", "heimdall"].forEach(cmd => {
    const [[tool]] = fake({ tool: cmd, setPath: true })([]);
    t.is(tool.tool, cmd);
    t.regex(tool.executable, new RegExp(`.*${cmd}.*`));
    t.deepEqual(tool.extraArgs, []);
    t.deepEqual(tool.args, []);
  });
});

test("_withSignals() should listen", async t => {
  const controller = new AbortController();
  const [[tool]] = fake()([]);
  const toolWithSignals = tool._withSignals(controller.signal);
  t.false(tool.signal.aborted);
  t.false(controller.signal.aborted);
  t.false(toolWithSignals.signal.aborted);
  controller.abort();
  t.false(tool.signal.aborted);
  t.true(controller.signal.aborted);
  t.true(toolWithSignals.signal.aborted);
});
test("_withSignals() should bubble", async t => {
  const controller = new AbortController();
  const [[tool]] = fake()([]);
  const toolWithSignals = tool._withSignals(controller.signal);
  t.false(tool.signal.aborted);
  t.false(toolWithSignals.signal.aborted);
  tool.abort();
  t.true(tool.signal.aborted);
  t.true(toolWithSignals.signal.aborted);
});

test("_withTimeout() should timeout", async t => {
  t.plan(5);
  const [[tool]] = fake()([]);
  const toolWithSignals = tool._withTimeout(200);
  t.false(tool.signal.aborted);
  t.false(toolWithSignals.signal.aborted);
  return new Promise(resolve =>
    toolWithSignals.signal.addEventListener("abort", ev => {
      t.like(ev, { type: "abort", defaultPrevented: false, cancelable: false });
      t.false(tool.signal.aborted);
      t.true(toolWithSignals.signal.aborted);
      resolve();
    })
  );
});

test("_withConfig() should add config", async t => {
  const [[tool]] = fake({
    tool: "adb",
    argsModel: {
      wipe: ["-w", false, true]
    },
    config: { wipe: false }
  })([]);
  const toolWithConfig = tool._withConfig({ wipe: true });
  const toolFromHelper = tool.__wipe();
  t.deepEqual(tool.config, { wipe: false });
  t.deepEqual(tool.args, []);
  t.deepEqual(toolWithConfig.config, { wipe: true });
  t.deepEqual(toolWithConfig.args, ["-w"]);
  t.deepEqual(toolFromHelper.config, { wipe: true });
  t.deepEqual(toolFromHelper.args, ["-w"]);
  tool.applyConfig({ wipe: true });
  t.deepEqual(tool.config, { wipe: true });
  t.deepEqual(tool.args, ["-w"]);
});

test("_withEnv() should add env", async t => {
  const [[tool]] = fake()([]);
  const toolWithConfig = tool._withEnv({ ABC: "DEF" });
  t.falsy(tool.env.ABC);
  t.deepEqual(toolWithConfig.env.ABC, "DEF");
});

test(`abort() should abort`, async t => {
  t.plan(4);
  const [[tool]] = fake()([]);
  tool.signal.addEventListener("abort", () => t.pass());
  t.false(tool.signal.aborted);
  t.falsy(tool.abort());
  t.true(tool.signal.aborted);
});

test("exec() should resolve stderr if stdout empty", async t => {
  const [[tool]] = fake()([undefined, "ok", 0]);
  return tool.exec().then(stdout => t.is(stdout, "ok"));
});
test("exec() should reject on error", async t => {
  t.plan(2);
  const [[tool, error]] = fake()([undefined, "not ok", 255]);
  tool.on("exec", e =>
    t.like(e, {
      cmd: [FAKE_EXECUTABLE],
      ...error
    })
  );
  return t.throwsAsync(tool.exec(), {
    instanceOf: Error,
    message: JSON.stringify(error)
  });
});
test("exec() should allow aborting", async t => {
  const [[tool]] = fake()([]);
  const cp = t.throwsAsync(tool.exec(), {
    instanceOf: Error,
    message: "killed"
  });
  tool.abort();
  return await cp;
});

test("spawn() should allow aborting", async t => {
  t.plan(6);
  const [[tool]] = fake()([]);
  const args = ["these", "-are", "--all=valid", "./arguments"];
  tool.on("spawn:start", e =>
    t.deepEqual(e, {
      cmd: [tool.tool, ...tool.extraArgs, ...args]
    })
  );
  tool.on("spawn:exit", e =>
    t.deepEqual(e, {
      cmd: [tool.tool, ...tool.extraArgs, ...args],
      signal: "SIGTERM"
    })
  );
  tool.on("spawn:error", e =>
    t.like(e, {
      cmd: [tool.tool, ...tool.extraArgs, ...args],
      error: {
        code: "ABORT_ERR",
        message: "The operation was aborted"
      }
    })
  );
  const cp = new Promise((resolve, reject) =>
    tool
      .spawn(...args)
      .on("exit", (code, signal) => {
        t.falsy(code);
        t.is(signal, "SIGTERM");
        resolve(null);
      })
      .on("error", err => {
        t.like(err, {
          code: "ABORT_ERR",
          message: "The operation was aborted"
        });
      })
  );
  tool.abort();
  return cp;
});

test("handleError()", async t => {
  genericErrors("adb").forEach(({ error, stdout, stderr, expectedReturn }) => {
    const [[tool]] = fake({ tool: "adb" })([]);
    tool.executable = "/path/to/adb";
    t.is(
      tool.handleError(error, stdout, stderr),
      expectedReturn,
      `expected ${expectedReturn} for ${JSON.stringify({
        error,
        stdout,
        stderr
      })}`
    );
  });
});

test("wait() should resolve when a device is detected", async t => {
  const [[tool]] = fake()(["true", "", 0]);
  const hasAccess = td.replace(tool, "hasAccess");
  td.when(hasAccess()).thenResolve(true);
  t.falsy(await tool.wait(), "immediate access");

  td.when(hasAccess()).thenResolve(false, true);
  t.falsy(await tool.wait(), "delayed access");
});
test("wait() should handle error", async t => {
  const [[tool]] = fake()(["true", "", 0]);
  const hasAccess = td.replace(tool, "hasAccess");
  td.when(hasAccess()).thenReject(new Error("virtual"));
  return t.throwsAsync(tool.wait(), { message: "virtual" });
});
test("wait() should be abortable", async t => {
  const [[tool]] = fake()(["true", "", 0]);
  setTimeout(() => tool.abort(), 1500);
  return t.throwsAsync(tool.wait(), {
    instanceOf: DOMException,
    message: "This operation was aborted"
  });
});
