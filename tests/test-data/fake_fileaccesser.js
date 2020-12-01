#!/usr/bin/env node

import fs from "fs";

const [, ...args] = process.argv;
console.log(fs.statSync(args[1]));
