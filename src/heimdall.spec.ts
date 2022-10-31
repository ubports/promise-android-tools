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

import { heimdall as fake } from "./__test-helpers/fake.js";
import { ExecException } from "node:child_process";
import { heimdallErrors } from "./__test-helpers/known_errors.js";

const printPitFromDevice = `Heimdall v1.4.0

a lot of bullshit text goes here...


--- Entry #0 ---
Binary Type: 0 (AP)
Device Type: 2 (MMC)
Identifier: 1
Attributes: 5 (Read/Write)
Update Attributes: 1 (FOTA)
Partition Block Size/Offset: 8192
Partition Block Count: 38912
File Offset (Obsolete): 0
File Size (Obsolete): 0
Partition Name: APNHLOS
Flash Filename: NON-HLOS.bin
FOTA Filename:


--- Entry #1 ---
Binary Type: 0 (AP)
Device Type: 2 (MMC)
Identifier: 2
Attributes: 5 (Read/Write)
Update Attributes: 1 (FOTA)
Partition Block Size/Offset: 47104
Partition Block Count: 132928
File Offset (Obsolete): 0
File Size (Obsolete): 0
Partition Name: MODEM
Flash Filename: modem.bin
FOTA Filename:


--- Entry #2 ---
Binary Type: 0 (AP)
Device Type: 2 (MMC)
Identifier: 3
Attributes: 5 (Read/Write)
Update Attributes: 1 (FOTA)
Partition Block Size/Offset: 180032
Partition Block Count: 1024
File Offset (Obsolete): 0
File Size (Obsolete): 0
Partition Name: SBL1
Flash Filename: sbl1.mbn
FOTA Filename:

Ending session...
Rebooting device...
Releasing device interface...`;

test("constructor()", async t => {
  const [[heimdall]] = fake()([]);
  t.deepEqual(heimdall.args, []);
});

test("handleError()", async t => {
  const [[heimdall]] = fake({ tool: "heimdall" })([]);
  heimdall.executable = "/path/to/heimdall";
  heimdallErrors.forEach(({ error, stdout, stderr, expectedReturn }) => {
    t.is(
      heimdall.handleError(error as ExecException, stdout, stderr),
      expectedReturn,
      `expected ${expectedReturn} for ${JSON.stringify({
        error,
        stdout,
        stderr
      })}`
    );
  });
});

["hasAccess", "detect"].forEach(fn => {
  test(`${fn}()`, async t => {
    const [[heimdall_ok], [heimdall_nodevice], [heimdall_error, { stderr }]] =
      fake()(["", "", 0], ["no device", "", 1], ["", "problem", 1]);
    t.true(await heimdall_ok[fn]());
    t.false(await heimdall_nodevice[fn]());
    await t.throwsAsync(heimdall_error[fn](), {
      message: new RegExp(stderr as string)
    });
  });
});

test("wait()", async t => {
  const [[heimdall_ok], [heimdall_error, { stderr }]] = fake()(
    ["", "", 0],
    ["", "problem", 1]
  );
  t.is(await heimdall_ok.wait(), "download");
  await t.throwsAsync(heimdall_error.wait(), {
    message: new RegExp(stderr as string)
  });
});

test("printPit()", async t => {
  const [[heimdall_ok], [heimdall_error, { stderr }]] = fake()(
    [printPitFromDevice, "", 0],
    ["", "problem", 1]
  );
  t.is((await heimdall_ok.printPit()).length, 3);
  t.is(
    (await heimdall_ok.printPit("./src/__test-helpers/test_file")).length,
    3
  );
  await t.throwsAsync(heimdall_error.printPit(), {
    message: new RegExp(stderr as string)
  });
});

test("flash()", async t => {
  const [[heimdall_ok], [heimdall_error]] = fake()(
    ["OK", "", 0],
    [
      "",
      "Initialising connection...\nDetecting device...\nERROR: Failed to detect compatible download-mode device.",
      1
    ]
  );
  const images = [
    {
      partition: "BOOT",
      file: "some.img"
    },
    {
      partition: "RECOVERY",
      file: "other.img"
    }
  ];
  t.falsy(await heimdall_ok.flash(images));
  await t.throwsAsync(heimdall_error.flash(images), {
    message: "no device"
  });
});

test("getPartitions()", async t => {
  const [[heimdall_ok], [heimdall_error, { stderr }]] = fake()(
    [printPitFromDevice, "", 0],
    ["", "problem", 1]
  );
  t.is((await heimdall_ok.getPartitions()).length, 3);
  t.is((await heimdall_ok.getPartitions()).length, 3);
  await t.throwsAsync(heimdall_error.getPartitions(), {
    message: new RegExp(stderr as string)
  });
});
