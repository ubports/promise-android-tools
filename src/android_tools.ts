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

import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

// HACK: Currently required for CommonJS compatibility.
//const __dirname = dirname(fileURLToPath(import.meta.url));

/** Get base directory path for debugging */
export function getAndroidToolBaseDir(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch
): string {
  return join(__dirname, "..", "dist", platform, normalizedArch(arch));
}

/** Group architectures together */
function normalizedArch(
  arch: NodeJS.Architecture = process.arch
): "x86" | NodeJS.Architecture {
  switch (arch) {
    case "ia32":
    case "x64":
      return "x86";
    case "arm":
    case "arm64":
      return "arm";
    default:
      return arch;
  }
}

export type Tool = "adb" | "fastboot" | "heimdall" | "mke2fs";
export type NativeSelector = {
  [tool in Tool]?: boolean;
} & {
  all?: boolean;
};

/** Returns path to an android tool. If the env var USE_SYSTEM_<tool> where <tool> is the capitalized name of the tool is set, the function will return the native tool for that tool accordingly. If the env var USE_NATIVE_SYSTEM_TOOLS is said, all tools will return the native tools. */
export function getAndroidToolPath(
  tool: Tool,
  optimistic = true,
  native: NativeSelector = {},
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch
): string {
  try {
    if (
      native.all ||
      process.env.USE_SYSTEM_TOOLS ||
      native[tool] ||
      process.env[`USE_SYSTEM_${tool.toUpperCase()}`]
    ) {
      return tool;
    }

    const assumedPath = join(
      getAndroidToolBaseDir(platform, arch),
      platform === "win32" ? `${tool}.exe` : tool
    );

    if (existsSync(assumedPath)) {
      return assumedPath;
    } else {
      throw new Error(`No binary of ${tool} for ${arch} ${platform}`);
    }
  } catch (error) {
    if (optimistic) return tool;
    else throw new Error(`Failed to get tool: ${error}`);
  }
}

export default {
  getAndroidToolPath: (
    tool: Tool,
    optimistic = true,
    native: NativeSelector = {}
  ) => getAndroidToolPath(tool, optimistic, native),
  getAndroidToolBaseDir: () => getAndroidToolBaseDir()
};
