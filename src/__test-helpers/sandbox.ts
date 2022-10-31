import { mkdtemp, rm, mkdir, open } from "node:fs/promises";
import { join, sep } from "node:path";
import { tmpdir } from "os";

const DEFAULT_PREFIX = "promise-android-tools";

const base = (prefix = DEFAULT_PREFIX): string => join(tmpdir(), prefix, sep);

export const createFile = async (
  name = "file",
  prefix = DEFAULT_PREFIX,
  base: string | Promise<string> = create(prefix)
): Promise<string> => {
  const file = join(await base, name);
  await (await open(file, "w", 0o666)).close();
  return file;
};

/** create temporary sandbox dir */
export const create = async (prefix = DEFAULT_PREFIX): Promise<string> => {
  const baseDir = base(prefix);
  await mkdir(baseDir, { recursive: true });
  return mkdtemp(baseDir);
};

/** rm all temporary sandbox dirs */
export const remove = async (prefix = DEFAULT_PREFIX): Promise<void> =>
  rm(base(prefix), { recursive: true });

export default { create, createFile, remove };
