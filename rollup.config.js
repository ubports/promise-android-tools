export default {
  input: "src/module.js",
  output: {
    file: "lib/module.cjs",
    format: "cjs"
  },
  external: [
    "events",
    "fs/promises",
    "path",
    "child_process",
    "android-tools-bin"
  ]
};
