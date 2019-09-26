# System image node module

[![Build Status](https://travis-ci.org/ubports/system-image-node-module.svg?branch=master)](https://travis-ci.org/ubports/system-image-node-module) [![Coverage Status](https://coveralls.io/repos/github/ubports/system-image-node-module/badge.svg?branch=master)](https://coveralls.io/github/ubports/system-image-node-module?branch=master)

## Client
Access a system-image server http endpoint

Example:

```javascript

const systemImageClient = require("./src/module.js").Client;
const systemImage = new systemImageClient();

systemImage.getDeviceChannels("bacon").then((channels) => console.log(channels));

var progress = (progress, speed) => {
  console.log("progress:", progress*100, "%");
  console.log("speed:", speed, "MB/s");
}

var next = (downloadedFiles, totalFiles) => {
  console.log("file", downloadedFiles, "/", totalFiles);
}

systemImage.downloadLatestVersion({device: "bacon", channel: "ubports-touch/16.04/stable"}, progress, next).then(() => { console.log("done"); });
```

The constructor takes an object with optional properties as an argument. The default properties are listed below.

```javascript
{
  host: "https://system-image.ubports.com/", // URL of the system-image server
  path: "./test",                            // download path
  allow_insecure: false                      // allow unencrypted URL
  cache_time: 180                            // time to keep cached files
}
```

## Server
Maintain a system-image server backend (not implemented yet)
