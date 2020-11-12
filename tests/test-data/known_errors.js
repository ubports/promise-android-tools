export const genericErrors = tool => [
  {
    expectedReturn: "killed",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "adb died: Killed"
  },
  {
    expectedReturn: "killed",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "adb server killed by remote request"
  },
  {
    expectedReturn: `{"error":{"code":1,"cmd":"${tool} some command"},"stderr":"${tool}: something went wrong"}`,
    error: {
      killed: false,
      code: 1,
      signal: null,
      cmd: `/path/to/${tool} some command`
    },
    stdout: "",
    stderr: `${tool}: something went wrong\n`
  }
];

export const adbErrors = [
  ...genericErrors("adb"),
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "error: no devices/emulators found"
  },
  {
    expectedReturn: "unauthorized",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: "",
    stderr:
      "error: device unauthorized.\nThis adb server's $ADB_VENDOR_KEYS is not set\nTry 'adb kill-server' if that seems wrong.\nOtherwise check for a confirmation dialog on your device."
  },
  {
    expectedReturn: "unauthorized",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: "",
    stderr: "error: device still authorizing"
  },
  {
    expectedReturn: "device offline",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "error: error: device offline"
  },
  {
    expectedReturn: "device offline",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: "",
    stderr: "error: error: device offline\n"
  }
];

export const fastbootErrors = [
  ...genericErrors("fastboot"),
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Bootloader is locked.')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: not supported in locked device)"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: ‘not supported in locked device’)"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'not allowed in locked state')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Device not unlocked cannot flash or erase')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: '\tDevice not unlocked cannot flash or erase')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Partition flashing is not allowed')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Command not allowed')"
  },
  {
    expectedReturn: "enable unlocking",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr:
      "(bootloader) Check 'Allow OEM Unlock' in Developer Options.\nFAILED (remote: '')\nfastboot: error: Command failed"
  },
  {
    expectedReturn: "enable unlocking",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr:
      "(bootloader) Start unlock flow\n\nFAILED (remote: '\nUnlock operation is not allowed\n')\nfastboot: error: Command failed"
  },
  {
    expectedReturn: "enable unlocking",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr:
      "FAILED (remote: 'oem unlock is not allowed')fastboot: error: Command failed"
  },
  {
    expectedReturn: "low battery",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: low power, need battery charging.)"
  },
  {
    expectedReturn: "failed to boot",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote failure)"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "this is an I/O error"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (command write failed (No such device))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (command write failed (Success))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (status read failed (No such device))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (data transfer failure (Broken pipe))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (data transfer failure (Protocol error))"
  }
];

export const heimdallErrors = [
  ...genericErrors("heimdall"),
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, signal: null, cmd: "command" },
    stdout: undefined,
    stderr: "ERROR: Failed to detect compatible download-mode device."
  }
];
