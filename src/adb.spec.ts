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

import testrecoveryfstabs from "./__test-helpers/testrecoveryfstabs.js";

import { AdbError, RebootState } from "./adb.js";
import { adbErrors } from "./__test-helpers/known_errors.js";
import { WriteStream } from "fs";
import sandbox from "./__test-helpers/sandbox.js";
import { readFile, cp } from "node:fs/promises";
import { adb as fake } from "./__test-helpers/fake.js";

test.after(async t => sandbox.remove().catch(() => {}));

test("constructor()", async t => {
  const [[plainAdb]] = fake()([]);
  t.deepEqual(plainAdb.args, []);

  const [[adb]] = fake({
    allInterfaces: true,
    useUsb: true,
    useTcpIp: true,
    serialno: 1337,
    transportId: 69,
    port: 5038,
    host: "somewhere",
    protocol: "udp",
    exitOnWrite: true
  })([]);
  t.deepEqual(adb.args, [
    "-a",
    "-d",
    "-e",
    "-s",
    1337,
    "-t",
    69,
    "-H",
    "somewhere",
    "-P",
    5038,
    "-L",
    "udp:somewhere:5038"
  ]);
});

test("flag helpers", async t => {
  const [[adb]] = fake()([]);
  [
    ["allInterfaces", ["-a"]],
    ["useUsb", ["-d"]],
    ["useTcpIp", ["-e"]],
    ["serialno", ["-s", "a"]],
    ["transportId", ["-t", "a"]],
    ["port", ["-P", "a"]],
    ["host", ["-H", "a"]],
    ["protocol", ["-L", "tcp:localhost:5037"]],
    ["exitOnWriteError", ["--exit-on-write-error"]]
  ].forEach(([flag, args]) => {
    t.deepEqual(adb.args, []);
    t.deepEqual(adb[`__${flag}`]("a").args, args);
    t.deepEqual(adb.args, []);
  });
});

test("startServer()", async t => {
  const [[adb]] = fake()(["starting server", "", 0]);
  t.falsy(await adb.startServer());
  t.falsy(await adb.startServer({}, 1));
});

test("killServer()", async t => {
  const [[adb]] = fake()(["killed server", "", 0]);
  t.falsy(await adb.killServer());
});

test("AdbError", async t => {
  adbErrors.forEach(({ error, stdout, stderr, expectedReturn }) => {
    const [[adb]] = fake({ tool: "adb" })([]);
    adb.executable = "/path/to/adb";
    t.is(
      new adb.Error(error, stdout, stderr).message,
      expectedReturn,
      `expected ${expectedReturn} for ${JSON.stringify({
        error,
        stdout,
        stderr
      })}`
    );
  });
});

test("connect() should connect", async t => {
  const [[adb]] = fake()(["device", "", 0]);
  t.is(await adb.connect("abc"), "device");
});
["no devices/emulators found", "Name or service not known"].forEach(
  async stdout => {
    test(`connect() should reject on '${stdout}'`, async t => {
      const [[adb]] = fake()([stdout, "", 0]);
      return t.throwsAsync(adb.connect("abc"), {
        message: "no device"
      });
    });
  }
);

["reconnect", "reconnectDevice", "reconnectOffline"].forEach(fn => {
  test(`${fn}() should reconnect`, async t => {
    const [[adb]] = fake()(["device", "", 0]);
    t.is(await adb[fn](), "device");
  });
  ["no devices/emulators found", "No route to host"].forEach(async stdout => {
    test(`${fn}() should reject on '${stdout}'`, async t => {
      const [[adb]] = fake()([stdout, "", 0]);
      return t.throwsAsync(adb[fn](), {
        message: "no device"
      });
    });
  });
});

[
  {
    stdout: "List of devices attached\n",
    ret: []
  },
  {
    stdout:
      "List of devices attached\n" +
      "emulator-5554          device product:sdk_gphone_x86_arm model:AOSP_on_IA_Emulator device:generic_x86_arm transport_id:5",
    ret: [
      {
        serialno: "emulator-5554",
        product: "sdk_gphone_x86_arm",
        model: "AOSP_on_IA_Emulator",
        device: "generic_x86_arm",
        transport_id: "5",
        mode: "device"
      }
    ]
  },
  {
    stdout:
      "List of devices attached\n" +
      "8945062f               device product:Device model:V777_SWM device:Device transport_id:4\n" +
      "emulator-5554          device product:sdk_gphone_x86_arm model:AOSP_on_IA_Emulator device:generic_x86_arm transport_id:5",
    ret: [
      {
        serialno: "8945062f",
        product: "Device",
        model: "V777_SWM",
        device: "Device",
        transport_id: "4",
        mode: "device"
      },
      {
        serialno: "emulator-5554",
        product: "sdk_gphone_x86_arm",
        model: "AOSP_on_IA_Emulator",
        device: "generic_x86_arm",
        transport_id: "5",
        mode: "device"
      }
    ]
  }
].map(({ stdout, ret }, i) =>
  test(`devices() should return list of ${i} devices`, async t => {
    const [[adb]] = fake()([stdout, "", 0]);
    t.deepEqual(await adb.devices(), ret);
  })
);

test("getSerialno() should resolve serialno", async t => {
  const [[adb]] = fake()(["1234567890ABCDEF\n", "", 0]);
  t.deepEqual(await adb.getSerialno(), "1234567890ABCDEF");
});
test("getSerialno() should reject when invalid", async t => {
  const [[adb]] = fake()(["this is an invalid string\n", "", 0]);
  await t.throwsAsync(adb.getSerialno(), {
    message: "invalid serial number: this is an invalid string"
  });
});
test("getSerialno() should reject when unknown", async t => {
  const [[adb]] = fake()(["unknown\n", "", 0]);
  await t.throwsAsync(adb.getSerialno(), {
    message: "invalid serial number: unknown"
  });
});

test("shell() should resolve serialno", async t => {
  const [[adb]] = fake()(["hi\n", "", 0]);
  t.deepEqual(await adb.shell(), "hi");
});

test("push() should resolve if called with empty files array", async t => {
  const [[adb]] = fake()([]);
  const progress = td.func(p => {});
  t.falsy(await adb.push([], "dest", progress));
  td.verify(progress(0));
  td.verify(progress(1));
});
test("push() should push files and resolve", async t => {
  if (process.platform === "win32") return t.pass(); // FIXME
  const [[adb]] = fake()([
    "a",
    "some.cpp writex len=42\n" +
      "some.cpp writex len=1\n" +
      "some.cpp hello\n" +
      "some.cpp readx len=NaN\n" +
      "some.cpp writex len=NaN\n" +
      "some.cpp writex len=69\n",
    0
  ]);
  const progress = td.func(p => {});
  t.falsy(
    await adb.push(
      ["src/__test-helpers/test_file", "src/__test-helpers/test file"],
      "dest",
      progress
    )
  );
  td.verify(progress(0));
  td.verify(progress(0.45161));
  td.verify(progress(0.46237));
  td.verify(progress(1));
});
test("push() should reject if files not found by fs.stat()", async t => {
  const [[adb]] = fake()([]);
  await t.throwsAsync(adb.push(["src/__test-helpers/does not exist"], "dest"), {
    message: /ENOENT/
  });
});
test("push() should reject if files not found by adb", async t => {
  const [[adb]] = fake()([
    "adb: error: cannot stat\nNo such file or directory\n",
    "",
    255
  ]);
  const progress = td.func(p => {});
  await t.throwsAsync(
    adb.push(
      ["src/__test-helpers/test_file", "src/__test-helpers/test file"],
      "dest",
      progress
    ),
    {
      message: "file not found"
    }
  );
  td.verify(progress(0));
});
test("push() should reject on error", async t => {
  const [[adb]] = fake()([]);
  const progress = td.func(p => {});
  const cp = t.throwsAsync(
    adb.push(
      ["src/__test-helpers/test_file", "src/__test-helpers/test file"],
      "dest",
      progress
    ),
    {
      message: '{"error":{"signal":"SIGTERM"}}'
    }
  );
  adb.abort();
  await cp;
  td.verify(progress(0));
});

test("reboot() should resolve", async t => {
  const [[adb]] = fake()(["ok", "", 0]);
  return Promise.all(
    (
      ["system", "recovery", "bootloader", "download", "edl", "sideload", "sideload-auto-reboot"] as RebootState[]
    ).map(async state => t.falsy(await adb.reboot(state), state))
  );
});
test("reboot() should reject on error", async t => {
  const [[adb]] = fake()(["failed", "", 0]);
  return t.throwsAsync(adb.reboot(), {
    message: "reboot failed"
  });
});

test("sideload() should sideload and resolve", async t => {
  const [[adb]] = fake()([
    "a",
    "some.cpp writex len=42\n" +
      "some.cpp writex len=1\n" +
      "some.cpp writex len=NaN\n" +
      "some.cpp writex len=69\n",
    0
  ]);
  const progress = td.func(p => {});
  t.falsy(await adb.sideload("src/__test-helpers/test_file", progress));
  t.falsy(await adb.sideload("src/__test-helpers/test_file"));
  td.verify(progress(0));
});

test("ensureState()", async t => {
  const [[adb]] = fake()(["recovery", "", 0]);
  td.replace(adb, "reboot");
  td.when(adb.reboot("recovery")).thenDo(() =>
    t.fail("should not have been called")
  );
  t.is(await adb.ensureState("recovery"), "recovery");
  td.when(adb.reboot("bootloader")).thenResolve();
  t.is(await adb.ensureState("bootloader"), "recovery");
});

test("getprop() should use getprop", async t => {
  const [[adb]] = fake()(["thisisadevicecodename", "", 0]);
  t.is(await adb.getprop("ro.product.device"), "thisisadevicecodename");
});
test("getprop() should cat default.prop", async t => {
  const [[adb]] = fake()(["", "", 0]);
  td.replace(adb, "shell");
  td.when(adb.shell("getprop"), {
    ignoreExtraArgs: true,
    times: 1
  }).thenResolve("");
  td.when(adb.shell("cat"), { ignoreExtraArgs: true }).thenResolve(
    "ro.product.device=thisisadevicecodename"
  );
  t.is(await adb.getDeviceName(), "thisisadevicecodename");
});
test("getprop() handle error", async t => {
  const [[adb]] = fake()(["", "", 0]);
  td.replace(adb, "shell");
  td.when(adb.shell(), { ignoreExtraArgs: true }).thenResolve("not found");
  await t.throwsAsync(adb.getDeviceName(), {
    message: "unknown getprop error"
  });
});
test("getprop() should handle error in cat", async t => {
  const [[adb]] = fake()(["", "", 0]);
  td.replace(adb, "shell");
  td.when(adb.shell("getprop"), {
    ignoreExtraArgs: true,
    times: 1
  }).thenResolve("");
  td.when(adb.shell("cat"), { ignoreExtraArgs: true }).thenReject(
    new Error("this is wrong")
  );
  await t.throwsAsync(adb.getDeviceName(), {
    message: "this is wrong"
  });
});

test("getDeviceName()", async t => {
  const [[adb]] = fake()(["thisisadevicecodename", "", 0]);
  t.is(await adb.getDeviceName(), "thisisadevicecodename");
});

test("getSystemImageCapability() should resolve true", async t => {
  const [[adb]] = fake()(["hell yeah", "", 0]);
  t.true(await adb.getSystemImageCapability());
});
test("getSystemImageCapability() should resolve false", async t => {
  const [[adb]] = fake()(["not found", "", 0]);
  t.false(await adb.getSystemImageCapability());
});
test("getSystemImageCapability() should reject", async t => {
  const [[adb]] = fake()(["", "", 1]);
  await t.throwsAsync(adb.getSystemImageCapability(), {
    instanceOf: AdbError,
    message: `Command failed: adb shell getprop ro.ubuntu.recovery`
  });
});

test("getOs() should resolve ubuntutouch", async t => {
  const [[adb]] = fake()(["systemimage", "", 0]);
  t.is(await adb.getOs(), "ubuntutouch");
});
test("getOs() should resolve android", async t => {
  const [[adb]] = fake()(["", "", 0]);
  t.is(await adb.getOs(), "android");
});

test("hasAccess() should resolve true", async t => {
  const [[adb]] = fake()([".", "", 0]);
  t.true(await adb.hasAccess());
});
test("hasAccess() should resolve false", async t => {
  const [[adb]] = fake()(["", "no device", 1]);
  t.false(await adb.hasAccess());
});
test("hasAccess() should reject error", async t => {
  const [[adb]] = fake()(["*explosions in the distance*", "", 0]);
  await t.throwsAsync(adb.hasAccess(), {
    message: "unexpected response: *explosions in the distance*"
  });
});

test("wait()", async t => {
  const [[adb]] = fake()(["recovery", "", 0]);
  t.is(await adb.wait(), "recovery");
});

testrecoveryfstabs.forEach(device => {
  device.partitions.forEach(partition => {
    test(`format() should resolve ${partition.mountpoint} for ${device.device}`, async t => {
      const [[adb]] = fake()(["", "", 0]);
      td.replace(adb, "shell");
      td.when(adb.shell("cat", "/etc/recovery.fstab")).thenResolve(
        device.fstab
      );
      td.when(adb.shell(`umount`, `/${partition.mountpoint}`)).thenResolve("");
      td.when(adb.shell(`make_ext4fs`, partition.partition)).thenResolve("");
      td.when(adb.shell(`mount`, `/${partition.mountpoint}`)).thenResolve("");
      t.falsy(await adb.format(partition.mountpoint));
    });
    test(`format() should reject on error with ${partition.mountpoint} for ${device.device}`, async t => {
      const [[adb]] = fake()(["/dev/block/data /data", "", 0]);
      await t.throwsAsync(adb.format("data"), {
        message: "failed to mount: /dev/block/data /data"
      });
    });
  });
});

test("wipeCache()", async t => {
  const [[adb]] = fake()(["", "", 0]);
  t.falsy(await adb.wipeCache());
});

test("verifyPartitionType()", async t => {
  const [[adb]] = fake()(["/dev/userdata on /data type ext4 (rw)", "", 0]);
  t.true(await adb.verifyPartitionType("data", "ext4"));
  t.false(await adb.verifyPartitionType("data", "ntfs"));
  await t.throwsAsync(adb.verifyPartitionType("cache", "ext4"), {
    message: "partition not found"
  });
});

test("getFileSize() should resolve size", async t => {
  const [[adb]] = fake()(["1337", "", 0]);
  t.is(await adb.getFileSize("/cache/test.txt"), 1337);
});
test("getFileSize() should reject on error", async t => {
  const [[adb]] = fake()(["invalid", "", 0]);
  await t.throwsAsync(adb.getFileSize("/cache/test.txt"), {
    message: "Cannot parse size from invalid"
  });
});

test("getAvailablePartitionSize() should resolve size", async t => {
  const [[adb]] = fake()(["a\n/wtf 1337 a b", "", 0]);
  t.is(await adb.getAvailablePartitionSize("/wtf"), 1337);
});
test("getAvailablePartitionSize() should reject on error", async t => {
  const [[adb]] = fake()(["invalid", "", 0]);
  await t.throwsAsync(adb.getAvailablePartitionSize("/wtf"), {
    message: "Cannot parse size from NaN"
  });
});

test("getTotalPartitionSize() should resolve size", async t => {
  const [[adb]] = fake()(["a\n/wtf 1337 a b c d", "", 0]);
  t.is(await adb.getTotalPartitionSize("/wtf"), 1337);
});
test("getTotalPartitionSize() should reject on error", async t => {
  const [[adb]] = fake()(["invalid", "", 0]);
  await t.throwsAsync(adb.getTotalPartitionSize("/wtf"), {
    message: "Cannot parse size from NaN"
  });
});
