import { Adb, AdbOptions } from "../adb.js";
import { Fastboot, FastbootOptions } from "../fastboot.js";
import { Heimdall, HeimdallOptions } from "../heimdall.js";
import { Tool as _Tool, ToolConfig, ToolOptions } from "../tool.js";
import { ExecException } from "node:child_process";
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
type FakeError = {
  error?: ExecException | { [propName: string]: any };
  stdout?: string;
  stderr?: string;
};
type Fakeable = Adb | Fastboot | Heimdall | Tool | DeviceTools;
type Fake<T extends Fakeable> = [T, FakeError];

type FakeArgs = [
  stdout?: string,
  stderr?: string,
  code?: number,
  delay?: number
];

const fake =
  (tool: Fakeable) =>
  (...fakes: FakeArgs[]): Fake<typeof tool>[] =>
    fakes.map(([stdout, stderr, code, delay]) => [
      tool._withEnv({
        MOCK_EXIT: JSON.stringify({ stdout, stderr, code, delay })
      }),
      {
        error: {
          message: `Command failed: ${EXECUTABLE}\n${stderr || ""}`,
          code
        },
        stdout,
        stderr
      }
    ]);

export const adb = (options: AdbOptions = {}) =>
  fake(new Adb({ tool: EXECUTABLE, ...options })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Adb>[];
export const fastboot = (options: FastbootOptions = {}) =>
  fake(new Fastboot({ tool: EXECUTABLE, ...options })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Fastboot>[];
export const heimdall = (options: HeimdallOptions = {}) =>
  fake(new Heimdall({ tool: EXECUTABLE, ...options })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Heimdall>[];
export const tool = (options: ToolOptions | {} = {}) =>
  fake(new Tool({ tool: EXECUTABLE, ...options })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Tool>[];
export const deviceTools = (options: DeviceToolsOptions = {}) =>
  fake(
    new DeviceTools({
      adbOptions: { tool: EXECUTABLE, ...options.adbOptions },
      fastbootOptions: { tool: EXECUTABLE, ...options.fastbootOptions },
      heimdallOptions: { tool: EXECUTABLE, ...options.heimdallOptions }
    })
  ) as (...fakes: FakeArgs[]) => Fake<DeviceTools>[];
