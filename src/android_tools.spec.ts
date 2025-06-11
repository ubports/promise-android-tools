/*
 * Copyright (C) 2020-2022 UBports Foundation <info@ubports.com>
 * Copyright (C) 2020-2022 Johannah Sprinz <hannah@ubports.com>
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

import tools, { getAndroidToolPath, Tool } from "./android_tools.js";

const TOOLS = ["adb", "fastboot", "mke2fs", "heimdall"];
const PLATFORMS: NodeJS.Platform[] = ["darwin", "linux", "win32"];
const ARCHITECTURES: NodeJS.Architecture[] = [
  "arm",
  "arm64",
  "ia32",
  "x64",
  "ppc"
];

test("default exports", async t => {
  t.is(tools.getAndroidToolPath("adb", true, { all: true }), "adb");
  t.truthy(tools.getAndroidToolBaseDir());
});

TOOLS.forEach(tool =>
  PLATFORMS.forEach(platform =>
    ARCHITECTURES.forEach(arch => {
      test(`getAndroidToolPath() should return ${tool} for ${arch} ${platform} if packaged`, async t => {
        t.regex(
          getAndroidToolPath(tool as Tool, true, {}, platform, arch),
          new RegExp(tool + platform === "win32" ? "\\.exe" : "")
        );
      });
    })
  )
);
test("getAndroidToolPath(), should throw if tool was not packaged and optimistic false", async t => {
  t.throws(() => getAndroidToolPath("adb", false, {}, "darwin", "ppc"), {
    message: "Failed to get tool: Error: No binary of adb for ppc darwin"
  });
});
test("getAndroidToolPath(), should return native if tool was not packaged but optimistic is true", async t => {
  t.is(getAndroidToolPath("adb", true, {}, "darwin", "ppc"), "adb");
});
test.serial(
  "getAndroidToolPath(), should return native if env var is set",
  async t => {
    td.replace(process.env, "USE_SYSTEM_ADB", true);
    t.is(getAndroidToolPath("adb", false, {}, "darwin", "ppc"), "adb");
    td.reset();
  }
);
