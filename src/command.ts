import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { get } from "axios";
import Json from "comment-json";
import Yaml from "yaml";

import { meta, NPM } from "@/registry";
import { message } from "@/message";

const exec = promisify(execAsync);

const command = {
  volta: "volta -v",
  node: "node -v",
  npm: `%s -v`,
  pnpm: "pnpm -v",
  setPkgName: '%s pkg set name="%s"',
  setPkgVoltaNode: '%s pkg set "volta.node"="%s"',
  setPkgVoltaNpm: '%s pkg set "volta.%s"="%s"',
  setPkgPkgMgr: '%s pkg set packageManager="%s@%s"',
  setPkgScript: '%s pkg set "scripts.%s"="%s"',
  getPkgScript: '%s pkg get "scripts.%s"',
  rmPkgScript: '%s pkg delete "scripts.%s"',
  setPkgDeps: '%s pkg set "dependencies.%s"="%s"',
  setPkgDevDeps: '%s pkg set "devDependencies.%s"="%s"',
  setPkgBin: '%s pkg set "bin.%s"="%s"',
  rmNodeLinker: "pnpm config --location project delete node-linker",
  tar: "tar -xvf %s",
} as const;

export const setPkgName = async (npm: NPM, name: string, cwd?: string) => {
  await exec(format(command.setPkgName, npm, name), { cwd });
};

let volta: boolean | undefined;

export const setPkgVers = async (npm: NPM, cwd?: string) => {
  void (
    volta !== undefined ||
    (volta = await exec(command.volta)
      .then(() => true)
      .catch(() => false))
  );
  if (volta) {
    const node = (await exec(command.node)).stdout.trim();
    await exec(
      format(
        command.setPkgVoltaNode,
        npm,
        !node.startsWith("v") ? node : node.slice(1),
      ),
      { cwd },
    );
    const npmV = (await exec(format(command.npm, npm))).stdout.trim();
    await exec(
      format(
        command.setPkgVoltaNpm,
        npm,
        npm,
        !npmV.startsWith("v") ? npmV : npmV.slice(1),
      ),
      { cwd },
    );
  }

  if (npm !== NPM.pnpm) {
    return;
  }
  const pnpm = (await exec(command.pnpm)).stdout.trim();
  await exec(
    format(
      command.setPkgPkgMgr,
      NPM.pnpm,
      NPM.pnpm,
      !pnpm.startsWith("v") ? pnpm : pnpm.slice(1),
    ),
    { cwd },
  );
};

export const setPkgScript = async (
  npm: NPM,
  name: string,
  script?: string,
  cwd?: string,
) => {
  if (!script) {
    await exec(format(command.rmPkgScript, npm, name), { cwd });
    return;
  }
  await exec(format(command.setPkgScript, npm, name, script), { cwd });
};

export const getPkgScript = async (npm: NPM, name: string, cwd?: string) => {
  const script = (
    await exec(format(command.getPkgScript, npm, name), { cwd })
  ).stdout.trim();
  return script === "{}" ? undefined : script;
};

type Script = { name: string; script?: string };
export type Scripts<T extends string> = Partial<
  Record<T | "default", readonly Script[]>
>;

export const setPkgScripts = async <K extends string, T extends Scripts<K>>(
  npm: NPM,
  scripts: T & { [K0 in keyof T]: K0 extends K | "default" ? T[K0] : never },
  key: K,
  cwd?: string,
) => {
  const scripts0 = scripts[key] ?? scripts.default;
  if (!scripts0) {
    return;
  }
  for (const { name, script } of scripts0) {
    await setPkgScript(npm, name, script, cwd);
  }
};

export const setPkgDep = async (
  npm: NPM,
  name: string,
  version: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgDeps, npm, name, version), { cwd });
};

export const setPkgDevDep = async (
  npm: NPM,
  name: string,
  version: string,
  cwd?: string,
) => {
  await exec(format(command.setPkgDevDeps, npm, name, version), { cwd });
};

type PkgDep = { name: string; version: string; dev?: boolean };
export type PkgDeps<T extends string> = Partial<
  Record<T | "default", readonly PkgDep[]>
>;

export const setPkgDeps = async <K extends string, T extends PkgDeps<K>>(
  npm: NPM,
  deps: T & { [K0 in keyof T]: K0 extends K | "default" ? T[K0] : never },
  key: K,
  cwd?: string,
) => {
  const deps0 = deps[key] ?? deps.default;
  if (!deps0) {
    return;
  }
  for (const { name, version } of deps0.filter((e) => !e.dev)) {
    await setPkgDep(npm, name, version, cwd);
  }
  for (const { name, version } of deps0.filter((e) => e.dev)) {
    await setPkgDevDep(npm, name, version, cwd);
  }
};

export const setPkgBin = async (
  npm: NPM,
  name: string,
  cwd?: string,
  script?: string,
) => {
  await exec(
    format(
      command.setPkgBin,
      npm,
      !name.includes("/") ? name : name.split("/").pop(),
      script ?? "dist/index.js",
    ),
    { cwd },
  );
};

const workspace = "pnpm-workspace.yaml" as const;

export const createWkspace = async (pkgs: readonly string[]) => {
  const packages = pkgs.length <= 1 ? pkgs : [...pkgs, meta.system.type.shared];
  for (const pkg of packages) {
    await mkdir(pkg);
  }
  await writeFile(workspace, Yaml.stringify({ packages }));
};

export const addPkgInWkspace = async (pkg: string) => {
  const doc = Yaml.parse(await readFile(workspace, "utf8").catch(() => "{}"));
  if (typeof doc !== "object") {
    throw new Error(format(message.invFormat, workspace));
  }
  void (doc.packages || (doc.packages = []));
  doc.packages.push(pkg);
  await writeFile(workspace, Yaml.stringify(doc));
};

export const addOnlyBuiltDeps = async (deps: readonly string[]) => {
  const doc = Yaml.parse(await readFile(workspace, "utf8").catch(() => "{}"));
  if (typeof doc !== "object") {
    throw new Error(format(message.invFormat, workspace));
  }
  void (doc.onlyBuiltDependencies || (doc.onlyBuiltDependencies = []));
  doc.onlyBuiltDependencies.push(...deps);
  await writeFile(workspace, Yaml.stringify(doc));
};

export const rmPnpmNodeLinker = async () => {
  await exec(command.rmNodeLinker);
};

export type BuiltDeps<T extends string> = Partial<
  Record<T | "default", readonly string[]>
>;

export const setWkspaceBuiltDeps = async <
  K extends string,
  T extends BuiltDeps<K>,
>(
  deps: T & { [K0 in keyof T]: K0 extends K | "default" ? T[K0] : never },
  key: K,
) => {
  const deps0 = deps[key] ?? deps.default;
  if (!deps0) {
    return;
  }
  await addOnlyBuiltDeps(deps0);
};

const tsconfig = "tsconfig.json" as const;

export const setTsOptions = async (options: object, cwd?: string) => {
  const file = join(cwd ?? "", tsconfig);
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}")) as any;
  if (typeof doc !== "object") {
    throw new Error(format(message.invFormat, file));
  }
  void (doc.compilerOptions || (doc.compilerOptions = {}));
  doc.compilerOptions = { ...doc.compilerOptions, ...options };
  const text =
    Json.stringify(doc, null, 2).replace(/\[\s+"([^"]+)"\s+\]/g, '["$1"]') +
    "\n";
  await writeFile(file, text);
};

type PathAlias = Record<string, readonly string[]>;

export const setPathAlias = async (
  base: string,
  pathAlias: PathAlias,
  cwd?: string,
) => {
  const file = join(cwd ?? "", tsconfig);
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}")) as any;
  if (typeof doc !== "object") {
    throw new Error(format(message.invFormat, file));
  }
  void (doc.compilerOptions || (doc.compilerOptions = {}));
  doc.compilerOptions.baseUrl = base;
  doc.compilerOptions.paths = pathAlias;
  const text =
    Json.stringify(doc, null, 2).replace(/\[\s+"([^"]+)"\s+\]/g, '["$1"]') +
    "\n";
  await writeFile(file, text);
};

export const addPathAlias = async (
  name: string,
  paths: readonly string[],
  cwd?: string,
) => {
  const file = join(cwd ?? "", tsconfig);
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}")) as any;
  if (typeof doc !== "object") {
    throw new Error(format(message.invFormat, file));
  }
  void (doc.compilerOptions || (doc.compilerOptions = {}));
  void (doc.compilerOptions.paths || (doc.compilerOptions.paths = {}));
  doc.compilerOptions.paths[name] = paths;
  const text =
    Json.stringify(doc, null, 2).replace(/\[\s+"([^"]+)"\s+\]/g, '["$1"]') +
    "\n";
  await writeFile(file, text);
};

const src = "src" as const;
const pathAliasWithShared = { "@/*": [""], "@shared/*": ["shared/src/*"] };

export const setPathAliasWithShared = async (cwd: string) => {
  await access(join(cwd, src))
    .then(() => (pathAliasWithShared["@/*"][0] = format(`%s/${src}/*`, cwd)))
    .catch(() => (pathAliasWithShared["@/*"][0] = format("%s/*", cwd)));
  await setPathAlias("..", pathAliasWithShared, cwd);
};

const configDir = ".bradhezh-create-prj" as const;
const config = "config.json" as const;

export const getConfig = async (key: string) => {
  const doc = Json.parse(
    await readFile(join(homedir(), configDir, config), "utf-8").catch(
      () => "{}",
    ),
  ) as any;
  return typeof doc !== "object" ? undefined : doc[key];
};

export const setConfig = async (key: string, value: unknown) => {
  await mkdir(join(homedir(), configDir), { recursive: true });
  const file = join(homedir(), configDir, config);
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}")) as any;
  if (typeof doc !== "object") {
    throw new Error(format(message.invFormat, file));
  }
  doc[key] = value;
  const text =
    Json.stringify(doc, null, 2).replace(/\[\s+"([^"]+)"\s+\]/g, '["$1"]') +
    "\n";
  await writeFile(file, text);
};

type Tmplt = { name: string; path?: string };
export type Template<T extends string> = Partial<Record<T | "default", Tmplt>>;

export const installTmplt = async <K extends string, T extends Template<K>>(
  base: string,
  template: T & { [K0 in keyof T]: K0 extends K | "default" ? T[K0] : never },
  key?: K,
  cwd?: string,
  tar?: boolean,
) => {
  const tmplt = template[key ?? "default"] ?? template.default;
  if (!tmplt) {
    return;
  }
  const file = join(cwd ?? "", tmplt.name);
  await writeFile(
    file,
    (
      await get(`${base}${tmplt.path ?? ""}`, {
        responseType: !tar ? "text" : "arraybuffer",
      })
    ).data,
  );
  if (!tar) {
    return;
  }
  await exec(format(command.tar, tmplt.name), { cwd });
  await rm(file, { force: true });
};
