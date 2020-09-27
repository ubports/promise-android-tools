# promise-android-tools

[![Build Status](https://travis-ci.org/ubports/promise-android-tools.svg?branch=master)](https://travis-ci.org/ubports/promise-android-tools) [![Coverage Status](https://coveralls.io/repos/github/ubports/promise-android-tools/badge.svg?branch=master)](https://coveralls.io/github/ubports/promise-android-tools?branch=master) [![Build status](https://ci.appveyor.com/api/projects/status/wmjs1hijnnpknp9w?svg=true)](https://ci.appveyor.com/project/NeoTheThird/promise-android-tools)

## Client
A wrapper for adb and fastboot that returns convenient promises.

**NOTE**: This is still a work in progress. Not all functions have been added and API stability is not guaranteed.

Example:

```javascript
const { Adb, Fastboot, Heimdall } = require("./src/module.js");
const adb = new Adb();
const fastboot = new Fastboot();
const heimdall = new Heimdall();
```
