#!/usr/bin/env node

const fs = require("fs");

const [,, ...args] = process.argv;
fs.statSync(args[0])
