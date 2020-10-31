# promise-android-tools ![Continuous Integration](https://github.com/ubports/promise-android-tools/workflows/Continuous%20Integration/badge.svg) [![npm](https://img.shields.io/npm/v/promise-android-tools)](https://www.npmjs.com/package/promise-android-tools) [![Coverage Status](https://coveralls.io/repos/github/ubports/promise-android-tools/badge.svg?branch=master)](https://coveralls.io/github/ubports/promise-android-tools?branch=master)

A wrapper for adb and fastboot that returns convenient promises.

## IMPORTANT NOTES

- This package does not include any binaries. Check out [android-tools-bin](https://www.npmjs.com/package/android-tools-bin) for cross-platform pre-compiled binaries of adb, fastboot, and heimdall.
- This is still a work in progress. Not all functions have been added and API stability is not guaranteed. The package was originally developed for use in the [UBports Installer](https://devices.ubuntu-touch.io/installer/).

## Usage

Install the package by running `npm i promise-android-tools`.

```javascript
const { Adb, Fastboot, Heimdall } = require("promise-android-tools");
const adb = new Adb();
const fastboot = new Fastboot();
const heimdall = new Heimdall();
```

## API Changes, Deprecation Notices, Upgrade Guide

### Upgrading to 3.x

- Version 3.0.0 introduced a breaking API change in `fastboot.flash()` and `fastboot.flashRaw()`. Pervious the third and fourth arguments of `fastboot.flash()` were boolean arguments for indicating force and raw flashing. Similarly `fastboot.flashRaw()` is a convenience function that forwarded the third argument as a boolean flag for the force option. The new API of `fastboot.flash()` accepts a boolean value for raw flashing as the third argument, followed by any number of string arguments for additional flags. The `fastboot.flashRaw()` function similarly accepts any number of arguments for additional flags starting at the third argument. The `fastboot.flashArray()` function now takes an array like `[ {partition, file, raw, flags}, ... ]` as an argument. We believe that this change is more in line with the latest developments in the fastboot cli and provides better access to options like `--force`, `--disable-verity`, and `--disable-verification`.
- NodeJS version 8 and below have been deprecated and are no longer supported. Versions 10, 12, and 14 are actively tested and supported.
- New experimental backup and restore functions for use with Ubuntu Touch have been added to the ADB module. The API of these might change in the future.

### Upgrading to 2.x

- No breaking API changes were introduced in version 2.0.0.
- A new `Heimdall` module provides access to Samsung devices.

## License

Original development by [Jan Sprinz](https://spri.nz) and [Marius Gripsgård](http://mariogrip.com/). Copyright (C) 2017-2020 [UBports Foundation](https://ubports.com).

This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.  If not, see <http://www.gnu.org/licenses/>.
