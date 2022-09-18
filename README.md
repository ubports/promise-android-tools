# promise-android-tools ![Continuous Integration](https://github.com/ubports/promise-android-tools/workflows/Continuous%20Integration/badge.svg) [![npm](https://img.shields.io/npm/v/promise-android-tools)](https://www.npmjs.com/package/promise-android-tools) [![codecov](https://codecov.io/gh/ubports/promise-android-tools/branch/master/graph/badge.svg?token=cEneFUUbgt)](https://codecov.io/gh/ubports/promise-android-tools/)

A wrapper for Adb, Fastboot, and Heimall that returns convenient promises.

## IMPORTANT NOTE

This is still a work in progress. Not all functions have been added and API stability is not guaranteed. The package was originally developed for use in the [UBports Installer](https://devices.ubuntu-touch.io/installer/).

## Usage

Install the package by running `npm i promise-android-tools`.

### Quick-start example

The default settings should cover most usecases.

```javascript
const { DeviceTools } = require("promise-android-tools");
const dt = new DeviceTools();

dt.wait() // wait for any device
  .then(state =>
    dt
      .getDeviceName()
      .then(name => console.log(`detected ${name} in ${state} state`))
  );
```

### Log execution events

Events are available to log or introspect tool executions.

```javascript
const { DeviceTools } = require("promise-android-tools");
const dt = new DeviceTools();

dt.on("exec", r => console.log("exec", r));
dt.on("spawn:start", r => console.log("spawn:start", r));
dt.on("spawn:exit", r => console.log("spawn:exit", r));
dt.on("spawn:error", r => console.log("spawn:error", r));

dt.adb.shell("echo", "test");
// will log a compact object (i.e. no falsy values) consisting of the command array cmd, the error object, and the stderr and stdout buffers. The path to the executable will be replaced with the tool name for brevity:
// exec {
//   cmd: [ 'adb', '-P', 5037, 'shell', 'echo test' ],
//   error: {
//     message: 'Command failed: adb -P 5037 shell echo test\n' +
//       'adb: no devices/emulators found',
//     code: 1
//   },
//   stderr: 'adb: no devices/emulators found'
// }
```

### Complex example

The library provides most features of the eponymous command-line utilities wrapped in the available classes. This example only serves as a demonstration, confer to the documenation to discover the full power of this library.

```javascript
const { DeviceTools } = require("promise-android-tools");
const dt = new DeviceTools();

db.adb
  .wait() // wait for any device over adb
  .then(() => dt.adb.ensureState("recovery")) // reboot to recovery if we have to
  .then(() => dt.adb.push(["./config.json"], "/tmp", progress)) // push a config file to the device
  .then(() => dt.adb.getDeviceName()) // read device codename
  .then(name => {
    // samsung devices do not use fastbooot
    if (name.includes("samsung")) {
      return dt.adb
        .reboot("bootloader") // reboot to samsung's download mode
        .then(() => dt.heimdall.wait()) // wait for device to respond to heimdall
        .then(() => dt.heimdall.flash("boot", "boot.img")) // flash an image to a partition
        .then(() => dt.heimdall.reboot()); // reboot to system
    } else {
      return dt.adb
        .reboot("bootloader") // reboot to bootloader (aka. fastboot mode)
        .then(() => dt.fastboot.wait()) // wait for device to respond to fastboot commands
        .then(() => dt.fastboot.flash("boot", "boot.img")) // flash an image
        .then(() => dt.fastboot.continue()); // auto-boot to system
    }
  })
  .then(() => dt.adb.wait("device")) // ignore devices in recovery or a different mode
  .then(() => console.log("flashing complete, that was easy!")); // yay

function progress(p) {
  console.log("operation", p * 100, "% complete");
}
```

### Documentation

When using the library with modern editors like VScode/VScodium or Atom, you can make use of IntelliSense. Run `npm run docs` to build html from JSdoc documentation for all API functions.

## API Changes, Deprecation Notices, Upgrade Guide

### Upgrading to 5.x

Version 5.0.0 introduces...

argsModel and config
removes fs-extra dependency
deprecate execOptions

### Upgrading to 4.x

Version 4.0.0 includes a major re-factoring effort that touched almost every function. The APIs of most functions remained intact, but in most cases you will have to make changes to your code. This has been done to correct some early design decisions.

- A new convenience class `DeviceTools` has been implemented that provides instances of all tool classes as well as some generic convenience functions such as `deviceTools.wait()` (wait for any device to be visible with any adb, fastboot, or heimdall) and `deviceTools.getDeviceName()` (read the device name from fastboot or adb). In most cases you will no longer need to instantiate any of the tool classes directly.
- In order to properly follow the object-oriented paradigm, all tool wrapper classes now inherit from a new `Tool` class that implements the `child_process` wrappers along with some common interfaces. The implications of this are:
  - Our [android-tools-bin](https://www.npmjs.com/package/android-tools-bin) package is now included as a dependency. If you require custom executables, you can use [environment variables](https://www.npmjs.com/package/android-tools-bin#requesting-native-tools-using-environment-variables).
  - Specifying a custom `exec` function in the constructor arguments is no longer supported.
    - We no longer use `child_process.exec` to avoid spawining a shell. Confer with the [official documentation](https://nodejs.org/api/child_process.html) to learn what this entails in detail. Most short-lived commands now use `child_process.execFile`. Long-running commands use
  - Specifying a custom `log` function in the constructor arguments is no longer supported. You can instead listen to the events `exec`, `spawn:start`, `spawn:exit`, and `spawn:error` on the tool object to implement your own logging or introspection logic.
  - The `<tool>.<tool>Event` event emitter has been deprecated. Instead, the tool class now inherits from the event emitter class directly.
- `<tool>.waitForDevice()` and `<tool>.stopWaiting()` have been deprecated in favor of `<tool>.wait()`.
  - On `fastboot` and `heimdall`, `<tool>.wait()` will poll using `<tool>.hasAccess()` at a fixed interval. It does not take arguments.
  - `adb.wait()` uses the `adb wait-for-[-TRANSPORT]-STATE` command instead. You can optionally specify the state or transport as arguments, eg `adb.wait("recovery", "usb")`.
  - The `<tool>.wait()` function returns a [Promise](https://github.com/alkemics/Promise), which extends the native ES promise to support cancelling pending promises. Calling `const p = adb.wait(); setTimeout(() => p.cancel(), 5000);` will kill the waiting child-process and settle the pending promise.
- `adb.pushArray()` has been deprecated and incorporated into the `adb.push()` API.
  - Since the `adb push` command supports pushing multiple files to the same location and this is the most common usecase, the `adb.pushArray()` function has been deprecated. The `adb.push()` function now takes an array of source file paths, a target destination path on the device, and a progress callback.
  - The progress is now reported on-the-fly and no longer requires polling via `adb shell stat <file>`. This results in faster and more accurate reporting.
- Functions that are considered unstable or experimental have been makred as such in their documentation comments. If you're building a product around any of those, you're welcome to help us improve the library to ensure your needs will be accounted for in the future.

### Upgrading to 3.x

- Version 3.0.0 introduced a breaking API change in `fastboot.flash()` and `fastboot.flashRaw()`. Pervious the third and fourth arguments of `fastboot.flash()` were boolean arguments for indicating force and raw flashing. Similarly `fastboot.flashRaw()` is a convenience function that forwarded the third argument as a boolean flag for the force option. The new API of `fastboot.flash()` accepts a boolean value for raw flashing as the third argument, followed by any number of string arguments for additional flags. The `fastboot.flashRaw()` function similarly accepts any number of arguments for additional flags starting at the third argument. The `fastboot.flashArray()` function now takes an array like `[ {partition, file, raw, flags}, ... ]` as an argument. We believe that this change is more in line with the latest developments in the fastboot cli and provides better access to options like `--force`, `--disable-verity`, and `--disable-verification`.
- NodeJS version 8 and below have been deprecated and are no longer supported. Versions 10, 12, and 14 are actively tested and supported.
- New experimental backup and restore functions for use with Ubuntu Touch have been added to the ADB module. The API of these might change in the future.

### Upgrading to 2.x

- No breaking API changes were introduced in version 2.0.0.
- A new `Heimdall` module provides access to Samsung devices.

## License

Original development by [Johannah Sprinz](https://spri.nz) and [Marius Gripsgård](http://mariogrip.com/). Copyright (C) 2017-2022 [UBports Foundation](https://ubports.com).

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program. If not, see <http://www.gnu.org/licenses/>.
