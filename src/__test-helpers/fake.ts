import { Adb } from "../adb.js";
import { Fastboot } from "../fastboot.js";
import { Heimdall } from "../heimdall.js";
import { Tool as _Tool, ToolConfig } from "../tool.js";
import { ExecException } from "node:child_process";
import { DeviceTools } from "../module.js";
class Tool extends _Tool {
  config!: ToolConfig;
}

const FAKE_EXECUTABLE = "./src/__test-helpers/fake_executable.js";
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
          message: `Command failed: ${FAKE_EXECUTABLE}\n${stderr || ""}`,
          code
        },
        stdout,
        stderr
      }
    ]);

export const adb = () =>
  fake(new Adb({ tool: FAKE_EXECUTABLE })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Adb>[];
export const fastboot = () =>
  fake(new Fastboot({ tool: FAKE_EXECUTABLE })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Fastboot>[];
export const heimdall = () =>
  fake(new Heimdall({ tool: FAKE_EXECUTABLE })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Heimdall>[];
export const tool = () =>
  fake(new Tool({ tool: FAKE_EXECUTABLE })) as (
    ...fakes: FakeArgs[]
  ) => Fake<Tool>[];
export const deviceTools = () =>
  fake(
    new DeviceTools({
      adbOptions: { tool: FAKE_EXECUTABLE },
      fastbootOptions: { tool: FAKE_EXECUTABLE },
      heimdallOptions: { tool: FAKE_EXECUTABLE }
    })
  ) as (...fakes: FakeArgs[]) => Fake<DeviceTools>[];
