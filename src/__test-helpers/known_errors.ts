import { RawError, ToolErrorMessage } from "../tool.js";

interface KnownError {
  expectedReturn: ToolErrorMessage|string;
  error: RawError;
  stdout?: string;
  stderr?: string;
}

export const genericErrors = (tool: string): KnownError[] => [
  {
    error: {},
    expectedReturn: `${tool.charAt(0).toUpperCase()}${tool.slice(1)}Error`
  },
  {
    expectedReturn: "aborted",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "adb died: Killed"
  },
  {
    expectedReturn: "aborted",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "adb server killed by remote request"
  },
  {
    expectedReturn: `{"error":{"code":1,"cmd":"${tool} some command"},"stderr":"${tool}: something went wrong"}`,
    error: { killed: false, code: 1, cmd: `${tool} some command` },
    stdout: "",
    stderr: `${tool}: something went wrong\n`
  }
];

export const adbErrors: KnownError[] = [
  ...genericErrors("adb"),
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "error: no devices/emulators found"
  },
  {
    expectedReturn: "more than one device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "error: more than one device/emulator"
  },
  {
    expectedReturn: "unauthorized",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: "",
    stderr:
      "error: device unauthorized.\nThis adb server's $ADB_VENDOR_KEYS is not set\nTry 'adb kill-server' if that seems wrong.\nOtherwise check for a confirmation dialog on your device."
  },
  {
    expectedReturn: "unauthorized",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: "",
    stderr: "error: device still authorizing"
  },
  {
    expectedReturn: "device offline",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "error: error: device offline"
  },
  {
    expectedReturn: "device offline",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: "",
    stderr: "error: error: device offline\n"
  },
  {
    expectedReturn: "device offline",
    error: {
      message:
        "Command failed: adb.exe -P 5037 shell getprop ro.product.device\nerror: protocol fault (couldn't read status): connection reset",
      code: 1
    },
    stderr: "error: protocol fault (couldn't read status): connection reset"
  }
];

export const fastbootErrors: KnownError[] = [
  ...genericErrors("fastboot"),
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Bootloader is locked.')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: not supported in locked device)"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: ‘not supported in locked device’)"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Flashing is not allowed in Lock State')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'not allowed in locked state')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Device not unlocked cannot flash or erase')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: '\tDevice not unlocked cannot flash or erase')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Partition flashing is not allowed')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: 'Command not allowed')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { code: 1 },
    stderr: "FAILED (remote: 'device is locked. Cannot flash images')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { code: 1 },
    stderr:
      "FAILED (remote: 'Fastboot command (set_active:) is not allowed when locked')"
  },
  {
    expectedReturn: "bootloader locked",
    error: { code: 1 },
    stderr: "FAILED (remote: 'download for partition 'boot' is not allowed')"
  },
  {
    expectedReturn: "enable unlocking",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr:
      "(bootloader) Check 'Allow OEM Unlock' in Developer Options.\nFAILED (remote: '')\nfastboot: error: Command failed"
  },
  {
    expectedReturn: "enable unlocking",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr:
      "(bootloader) Start unlock flow\n\nFAILED (remote: '\nUnlock operation is not allowed\n')\nfastboot: error: Command failed"
  },
  {
    expectedReturn: "enable unlocking",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr:
      "FAILED (remote: 'oem unlock is not allowed')fastboot: error: Command failed"
  },
  {
    expectedReturn: "low battery",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote: low power, need battery charging.)"
  },
  {
    expectedReturn: "failed to boot",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (remote failure)"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "this is an I/O error"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (command write failed (No such device))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (command write failed (Success))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (status read failed (No such device))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (data transfer failure (Broken pipe))"
  },
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "FAILED (data transfer failure (Protocol error))"
  }
];

export const heimdallErrors: KnownError[] = [
  ...genericErrors("heimdall"),
  {
    expectedReturn: "no device",
    error: { killed: false, code: 1, cmd: "command" },
    stdout: undefined,
    stderr: "ERROR: Failed to detect compatible download-mode device."
  }
];
