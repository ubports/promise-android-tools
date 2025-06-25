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
import * as td from "testdouble";

import { fastbootErrors } from "./__test-helpers/known_errors.js";
import { fastboot as fake } from "./__test-helpers/fake.js";

test("constructor()", async t => {
  const [[plainFastboot]] = fake()([]);
  t.deepEqual(plainFastboot.args, []);

  const [[fastboot]] = fake({
    wipe: true,
    device: 1337,
    maxSize: "1G",
    force: true,
    slot: "all",
    skipSecondary: true,
    skipReboot: true,
    disableVerity: true,
    disableVerification: true,
    fsOptions: "casefold,projid,compress",
    unbuffered: true
  })([]);
  t.deepEqual(fastboot.args, [
    "-w",
    "-s",
    1337,
    "-S",
    "1G",
    "--force",
    "--slot",
    "all",
    "--skip-secondary",
    "--skip-reboot",
    "--disable-verity",
    "--disable-verification",
    "--fs-options",
    "casefold,projid,compress",
    "--unbuffered"
  ]);
});

test("flag helpers", async t => {
  const [[fastboot]] = fake()([]);
  [
    ["wipe", ["-w"]],
    ["device", ["-s", "a"]],
    ["maxSize", ["-S", "a"]],
    ["force", ["--force"]],
    ["slot", ["--slot", "a"]],
    ["skipSecondary", ["--skip-secondary"]],
    ["skipReboot", ["--skip-reboot"]],
    ["disableVerity", ["--disable-verity"]],
    ["disableVerification", ["--disable-verification"]],
    ["fsOptions", ["--fs-options", "a"]],
    ["unbuffered", ["--unbuffered"]]
  ].forEach(([flag, args]) => {
    t.deepEqual(fastboot.args, []);
    t.deepEqual(fastboot[`__${flag}`]("a").args, args);
    t.deepEqual(fastboot.args, []);
  });
});

test("FastbootError", async t => {
  fastbootErrors.forEach(({ error, stdout, stderr, expectedReturn }) => {
    const [[fastboot]] = fake({ tool: "fastboot" })([]);
    fastboot.executable = "/path/to/fastboot";
    t.is(
      new fastboot.Error(error, stdout, stderr).message,
      expectedReturn,
      `expected ${expectedReturn} for ${JSON.stringify({
        error,
        stdout,
        stderr
      })}`
    );
  });
});

test("flash() should resolve on success", async t => {
  const [[fastboot]] = fake()([
    "a",
    "Sending 'boot' (1500 KB)\n" +
      "Writing 'boot'\n" +
      "Finished 'boot'\n" +
      "Sending sparse 'userdata' 1/2 (62568 KB)\n" +
      "Writing 'userdata'\n" +
      "Sending sparse 'userdata' 2/2 (62568 KB)\n" +
      "Writing 'userdata'\n" +
      "Finished 'userdata'\n",
    0
  ]);
  td.replace(fastboot, "wait");
  td.when(fastboot.wait()).thenResolve("bootloader");
  const progress = td.func(p => {});
  t.falsy(
    await fastboot.flash(
      [
        { partition: "boot", file: "/path/to/boot.img" },
        {
          partition: "userdata",
          file: "/path/to/userdata.img",
          raw: true,
          flags: ["--force", "--disable-verity"]
        }
      ],
      progress
    )
  );
  td.verify(progress(0));
  td.verify(progress(0.15));
  td.verify(progress(0.425));
  td.verify(progress(0.5));
  td.verify(progress(0.5825));
  td.verify(progress(0.7125));
  td.verify(progress(0.8325));
  td.verify(progress(0.9625));
  td.verify(progress(1));
});
test("flash() should reject on error", async t => {
  const [[fastboot_locked], [fastboot_failed]] = fake()(
    ["", "FAILED (remote: 'Bootloader is locked.')", 1, 100],
    ["", "Sending sparse 'boot'\neverything exploded", 1, 100]
  );
  td.replace(fastboot_locked, "wait");
  td.when(fastboot_locked.wait()).thenResolve("bootloader");
  const args = [{ partition: "boot", file: "/path/to/boot.img" }];
  await Promise.all([
    t.throwsAsync(fastboot_locked.flash(args), {
      message: "bootloader locked"
    }),
    t.throwsAsync(fastboot_failed.flash(args), {
      message: `Command failed: fastboot devices\nSending sparse \'boot\'\neverything exploded`
    })
  ]);
});

test("boot()", async t => {
  const [[fastboot], [fastboot_error]] = fake()(
    ["", "", 0],
    ["", "everything exploded", 1]
  );
  await Promise.all([
    t.falsy(await fastboot.boot("/path/to/image")),
    t.throwsAsync(fastboot_error.boot("/path/to/image"), {
      message: `Command failed: fastboot boot /path/to/image\neverything exploded`
    })
  ]);
});

test("update()", async t => {
  const [[fastboot], [fastboot_error]] = fake()(
    ["", "", 0],
    ["", "everything exploded", 1]
  );
  await Promise.all([
    t.falsy(await fastboot.update("/path/to/image")),
    t.falsy(await fastboot.update("/path/to/image", true)),
    t.throwsAsync(fastboot_error.update("/path/to/image"), {
      message: `Command failed: fastboot update /path/to/image\neverything exploded`
    })
  ]);
});

[
  "rebootBootloader",
  "rebootFastboot",
  "rebootRecovery",
  "reboot",
  "continue"
].forEach(fn =>
  test(`${fn}()`, async t => {
    const [[fastboot], [fastboot_error]] = fake()(
      ["", "", 0],
      ["", "everything exploded", 1]
    );
    await Promise.all([
      t.falsy(await fastboot[fn]()),
      t.throwsAsync(fastboot_error[fn]())
    ]);
  })
);

test("format()", async t => {
  const [[fastboot], [fastboot_error]] = fake()(
    ["", "", 0],
    ["", "everything exploded", 1]
  );
  await Promise.all([
    t.falsy(await fastboot.format("boot", "ext4", 1337)),
    t.throwsAsync(fastboot_error.format("cache"), {
      message: `Command failed: fastboot format cache\neverything exploded`
    }),
    t.throwsAsync(fastboot.format("cache", undefined, 1337), {
      message: "size specification requires type to be specified as well"
    })
  ]);
});

test("erase()", async t => {
  const [[fastboot], [fastboot_error]] = fake()(["", "", 0], ["", "error", 1]);
  await Promise.all([
    t.falsy(await fastboot.erase("cache")),
    t.throwsAsync(fastboot_error.erase("cache"), {
      message: `Command failed: fastboot erase cache\nerror`
    })
  ]);
});

test("setActive()", async t => {
  const [[fastboot], [fastboot_error]] = fake()(["", "", 0], ["error", "", 0]);
  await Promise.all([
    t.falsy(await fastboot.setActive("a")),
    t.throwsAsync(fastboot_error.setActive("b"), {
      message: "failed to set active slot"
    })
  ]);
});

["createLogicalPartition", "resizeLogicalPartition"].forEach(fn => {
  test(`${fn}()`, async t => {
    const [[fastboot], [fastboot_error]] = fake()(
      ["", "", 0],
      ["", "everything exploded", 1]
    );
    await Promise.all([
      t.falsy(await fastboot[fn]("cache", 1337)),
      t.throwsAsync(fastboot_error[fn]("cache", 1337), {
        message: /Command failed/
      })
    ]);
  });
});

["deleteLogicalPartition", "wipeSuper"].forEach(fn => {
  test(`${fn}()`, async t => {
    const [[fastboot], [fastboot_error]] = fake()(
      ["", "", 0],
      ["", "everything exploded", 1]
    );
    await Promise.all([
      t.falsy(await fastboot[fn]("cache")),
      t.throwsAsync(fastboot_error[fn]("cache"), { message: /failed/ })
    ]);
  });
});

test("oemUnlock()", async t => {
  const [[fastboot], [fastboot_unlocked], [fastboot_error]] = fake()(
    ["", "", 0],
    ["", "Not necessary", 1],
    ["", "everything exploded", 1]
  );
  await Promise.all([
    t.falsy(await fastboot.oemUnlock()),
    t.falsy(await fastboot_unlocked.oemUnlock("a")),
    t.throwsAsync(fastboot_error.oemUnlock(), { message: /failed/ })
  ]);
});

[
  "oem",
  "oemLock",
  "flashingUnlock",
  "flashingLock",
  "flashingUnlockCritical",
  "flashingLockCritical"
].forEach(fn => {
  test(`${fn}()`, async t => {
    const [[fastboot], [fastboot_error]] = fake()(
      ["", "", 0],
      ["", "everything exploded", 1]
    );
    await Promise.all([
      t.falsy(await fastboot[fn]()),
      t.throwsAsync(fastboot_error[fn](), { message: /failed/ })
    ]);
  });
});

test("getUnlockAbility()", async t => {
  const [[fastboot_true], [fastboot_false], [fastboot_error]] = fake()(
    [" 1  ", "", 0],
    ["0", "", 0],
    ["error", "", 0]
  );
  await Promise.all([
    t.true(await fastboot_true.getUnlockAbility()),
    t.false(await fastboot_false.getUnlockAbility()),
    t.false(await fastboot_error.getUnlockAbility())
  ]);
});

test("hasAccess()", async t => {
  const [[fastboot_true], [fastboot_false], [fastboot_error]] = fake()(
    ["fastboot", "", 0],
    ["", "", 0],
    ["error", "", 0]
  );
  await Promise.all([
    t.true(await fastboot_true.hasAccess()),
    t.false(await fastboot_false.hasAccess()),
    t.false(await fastboot_error.hasAccess())
  ]);
});

test("wait()", async t => {
  const [[fastboot]] = fake()(["fastboot", "", 0]);
  t.is(await fastboot.wait(), "bootloader");
});

test("getvar()", async t => {
  const [[fastboot_true], [fastboot_false], [fastboot_error]] = fake()(
    ["", "product: FP2\nFinished. Total time: 0.000s", 0],
    ["", "", 0],
    ["error", "", 0]
  );
  await Promise.all([
    t.is(await fastboot_true.getvar("product"), "FP2"),
    t.throwsAsync(fastboot_false.getvar("product"), {
      message: 'Unexpected getvar return: ""'
    }),
    t.throwsAsync(fastboot_error.getvar("product"), {
      message: 'Unexpected getvar return: "error"'
    })
  ]);
});

test("getDeviceName()", async t => {
  const [
    [fastboot_true],
    [fastboot_tab_at_beginning],
    [fastboot_whitespaces_all_around],
    [fastboot_waiting],
    [fastboot_waiting_with_tab],
    [fastboot_waiting_with_whitespace],
    [fastboot_weird_output],
    [fastboot_error]
  ] = fake()(
    ["", "product: FP2\nFinished. Total time: 0.000s", 0],
    ["", "\tproduct: sdm845\nFinished. Total time: 0.001s", 0],
    ["", "     product: lahaina    \nFinished. Total time: 0.001s", 0],
    [
      "",
      "< waiting for any device >\nproduct: axolotl\nFinished. Total time: 0.001s",
      0
    ],
    [
      "",
      "< waiting for any device >\n\tproduct: otter \t \nFinished. Total time: 0.001s",
      0
    ],
    [
      "",
      "< waiting for any device >\n    product: FP5  \nFinished. Total time: 0.001s",
      0
    ],
    [
      "",
      "\t\n\n  \n< waiting for any device >\nThis\nis\npretty\nweird\output\n\n    product: qcm6490  \nFinished. Total time: 0.001s",
      0
    ],
    ["error", "", 0]
  );
  await Promise.all([
    t.is(await fastboot_true.getDeviceName(), "FP2"),
    t.is(await fastboot_tab_at_beginning.getDeviceName(), "sdm845"),
    t.is(await fastboot_whitespaces_all_around.getDeviceName(), "lahaina"),
    t.is(await fastboot_waiting.getDeviceName(), "axolotl"),
    t.is(await fastboot_waiting_with_tab.getDeviceName(), "otter"),
    t.is(await fastboot_waiting_with_whitespace.getDeviceName(), "FP5"),
    t.is(await fastboot_weird_output.getDeviceName(), "qcm6490"),
    t.throwsAsync(fastboot_error.getDeviceName(), {
      message: 'Unexpected getvar return: "error"'
    })
  ]);
});
