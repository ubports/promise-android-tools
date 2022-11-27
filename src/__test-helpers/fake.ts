import { Adb, AdbOptions } from "../adb.js";
import { Fastboot, FastbootOptions } from "../fastboot.js";
import { Heimdall, HeimdallOptions } from "../heimdall.js";
import { Tool as _Tool, ToolConfig, ToolError, ToolOptions } from "../tool.js";
import { resolve } from "node:path";
import { DeviceTools, DeviceToolsOptions } from "../module.js";

class Tool extends _Tool {
  config!: ToolConfig;
}

export const EXECUTABLE = resolve(
  `./src/__test-helpers/fake_executable.${
    process.platform == "win32" ? "bat" : "js"
  }`
);
type Fakeable = Adb | Fastboot | Heimdall | Tool | DeviceTools;
type Fake<T extends Fakeable> = [T, Partial<ToolError>];

type FakeArgs = [
  stdout?: string,
  stderr?: string,
  code?: number,
  delay?: number
];

const fake = (tool: Fakeable) => {
  if (tool["executable"]) {
    tool["executable"] = EXECUTABLE;
  } else {
    tool["adb"].executable = EXECUTABLE;
    tool["fastboot"].executable = EXECUTABLE;
    tool["heimdall"].executable = EXECUTABLE;
  }
  return (...fakes: FakeArgs[]): Fake<typeof tool>[] =>
    fakes.map(([stdout, stderr, code, delay]) => [
      tool._withEnv({
        MOCK_EXIT: JSON.stringify({ stdout, stderr, code, delay })
      }),
      {
        message: `Command failed: ${tool["tool"] || "adb"}\n${stderr || ""}`,
        stdout,
        stderr
      }
    ]);
};

export const adb = (options: AdbOptions = {}) =>
  fake(new Adb(options)) as (...fakes: FakeArgs[]) => Fake<Adb>[];
export const fastboot = (options: FastbootOptions = {}) =>
  fake(new Fastboot(options)) as (...fakes: FakeArgs[]) => Fake<Fastboot>[];
export const heimdall = (options: HeimdallOptions = {}) =>
  fake(new Heimdall(options)) as (...fakes: FakeArgs[]) => Fake<Heimdall>[];
export const tool = (options: ToolOptions | {} = {}) =>
  fake(new Tool({ tool: EXECUTABLE, Error: ToolError, ...options })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Tool>[];
export const deviceTools = (options: DeviceToolsOptions = {}) =>
  fake(new DeviceTools(options)) as (
    ...fakes: FakeArgs[]
  ) => Fake<DeviceTools>[];
