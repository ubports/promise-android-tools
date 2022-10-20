#!/usr/bin/env node
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
} else if (args.length === 1 && args[0] === "pass") {
  console.log("ok");
  process.exit(0);
} else if (args.length) {
  Promise.all(
    args.map(arg =>
      new Promise(resolve => setTimeout(resolve, 1)).then(() =>
        console.log(arg)
      )
    )
  ).then(() => process.exit(0));
} else {
  console.log("not ok");
  console.error("should have args");
  process.exit(-1);
}
