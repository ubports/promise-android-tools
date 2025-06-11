#!/usr/bin/env node

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

import { cp, chmod, rm } from "fs/promises";
import * as path from "path";
import { download } from "progressive-downloader";
import { promisify } from "util";
import * as zip from "7zip-min";

const unpack = promisify(zip.unpack);

const downloadPath = path.resolve("./download");
const distPath = path.resolve("./dist");

const PLATFORMS = ["darwin", "linux", "win32"];
const POSIX = ["darwin", "linux"];

const archives = [
  // download heimdall
  ...PLATFORMS.map(platform => ({
    url: `https://people.ubuntu.com/~neothethird/heimdall-${platform}.zip`,
    path: path.join(downloadPath, `heimdall-${platform}.zip`)
  })),
  // download adb and fastboot
  ...PLATFORMS.map(p => ({
    url: `https://dl.google.com/android/repository/platform-tools-latest-${
      p === "win32" ? "windows" : p
    }.zip`,
    path: path.join(downloadPath, `adb-fastboot-${p}.zip`)
  })),
  // download libusb1.0 for Windows
  {
    url: "https://github.com/libusb/libusb/releases/download/v1.0.24/libusb-1.0.24.7z",
    path: path.join(downloadPath, "libusb-windows.7z")
  }
];

const downloadTools = () =>
  download(
    archives,
    (p, s) => console.log("x86 progress", p * 100, "% at", s, "Mb/s"),
    (c, t) => console.log("x86 file", c, "of", t)
  )
    // unpack everything
    .then(() =>
      Promise.all(
        archives.map(a =>
          //@ts-ignore
          unpack(a.path, a.path.replace(/\.zip|\.7z/g, ""))
        )
      )
    )
    // move adb and fastboot to dist
    .then(() =>
      Promise.all(
        PLATFORMS.map(platform =>
          cp(
            path.join(downloadPath, `adb-fastboot-${platform}/platform-tools`),
            path.join(distPath, platform, "x86"),
            { recursive: true }
          )
        )
      )
    )
    // move heimdall to dist
    .then(() =>
      Promise.all(
        PLATFORMS.map(platform =>
          cp(
            path.join(downloadPath, `heimdall-${platform}`),
            path.join(distPath, platform, "x86"),
            { recursive: true }
          )
        )
      )
    )
    // Copy libusb-1.0.dll for Heimdall on Windows
    .then(() =>
      cp(
        path.join(
          downloadPath,
          "libusb-windows",
          "MinGW32",
          "dll",
          "libusb-1.0.dll"
        ),
        path.join(distPath, "win32", "x86", "libusb-1.0.dll")
      )
    )
    // chmod +x for x86 POSIX
    .then(() =>
      Promise.all(
        POSIX.map(platform =>
          Promise.all(
            ["fastboot", "adb", "mke2fs", "heimdall"].map(executable =>
              chmod(path.join(distPath, platform, "x86", executable), 0o755)
            )
          )
        )
      )
    )
    // download for arm
    .then(() =>
      download(
        [
          {
            url: "https://github.com/blobbsen/adb-fastboot-executables-for-ARM/raw/master/adb",
            path: path.join(distPath, "linux", "arm", "adb")
          },
          {
            url: "https://github.com/blobbsen/adb-fastboot-executables-for-ARM/raw/master/fastboot",
            path: path.join(distPath, "linux", "arm", "fastboot")
          },
          {
            url: "http://people.ubuntu.com/~neothethird/heimdall-arm",
            path: path.join(distPath, "linux", "arm", "heimdall")
          }
        ],
        (p, s) => console.log("arm progress", p * 100, "% at", s, "Mb/s"),
        (c, t) => console.log("arm file", c, "of", t)
      )
    )
    // chmod +x for arm
    .then(() =>
      Promise.all(
        ["fastboot", "adb", "heimdall"].map(executable =>
          chmod(path.join(distPath, "linux", "arm", executable), 0o755)
        )
      )
    )
    .then(() => console.log("download complete"));

Promise.all([rm(downloadPath, { recursive: true })])
  .catch(() => {})
  .then(downloadTools);
