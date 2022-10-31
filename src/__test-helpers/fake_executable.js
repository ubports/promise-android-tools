#!/usr/bin/env node
0</* :{
  @echo off
  node %~f0 %*
  exit /b %errorlevel%
:} */0;
const [_node, _script, ...args] = process.argv;
if (process.env.MOCK_EXIT) {
  const { stdout, stderr, code, delay } = JSON.parse(process.env.MOCK_EXIT);
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  if (isNaN(code + 0)) {
    new Promise(resolve => setTimeout(resolve, 10000));
  } else {
    setTimeout(() => process.exit(code), delay || 0);
  }
} else {
  console.log("set MOCK_EXIT env var");
  console.error("env not set");
  process.exit(-1);
}
