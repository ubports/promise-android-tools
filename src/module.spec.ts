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

import { DeviceTools } from "./module.js";
import { deviceTools as fake } from "./__test-helpers/fake.js";

test("constructor()", async t => {
  const deviceTools_basic = new DeviceTools({});
  t.truthy(deviceTools_basic);
  const deviceTools_complex = new DeviceTools({
    adbOptions: { port: 1337 },
    fastbootOptions: { serial: true },
    heimdallOptions: {}
  });
  t.is(deviceTools_complex.adb.config.port, 1337);
});

test("wait() should resolve", async t => {
  const [[deviceTools]] = fake()(["device", "", 0]);
  t.is(await deviceTools.wait(), "device");
});
test("wait() should escalate and reject errors", async t => {
  const [[deviceTools]] = fake()(["", "", 1]);
  await t.throwsAsync(deviceTools.wait(), {
    message:
      '{"error":{"message":"Command failed: ./src/__test-helpers/fake_executable.js wait-for-any-any","code":1}}'
  });
});

test("getDeviceName() should resolve", async t => {
  const [[deviceTools], [deviceTools_error]] = fake()(
    ["bacon", "", 0],
    ["", "", 1]
  );
  t.is(await deviceTools.getDeviceName(), "bacon");
  await t.throwsAsync(deviceTools_error.getDeviceName(), {
    message: "no device"
  });
});
