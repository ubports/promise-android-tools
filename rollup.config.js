export default {
  input: 'src/module.js',
  output: {
    file: 'lib/module.cjs',
    format: 'cjs'
  },
  external: [
    "events", "cancelable-promise", "fs-extra", "path", "child_process", "android-tools-bin"
  ]
};
