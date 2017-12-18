# System image nodejs module

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
