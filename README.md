# System image nodejs module

[![Build Status](https://travis-ci.org/ubports/system-image-node-module.svg?branch=master)](https://travis-ci.org/ubports/system-image-node-module) [![Coverage Status](https://coveralls.io/repos/github/ubports/system-image-node-module/badge.svg?branch=master)](https://coveralls.io/github/ubports/system-image-node-module?branch=master)

## Client
Access a system-image server http endpoint


examples:

```
const systemImageClient = require("ubports-system-image").Client;

const sic = new systemImageClient();

sic.getDeviceChannels("bacon").then((channels) => console.log(channels));
```


## Server
Access and maintain a system-image server backend
