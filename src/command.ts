import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { mkdir, readFile, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { get } from "axios";
import open from "open";
import Json from "comment-json";
import Yaml from "yaml";
import { createInterface } from "node:readline/promises";
import { group, text, password, cancel, spinner } from "@clack/prompts";

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

export const setPkgName = async (name: string, npm: NPM, cwd?: string) => {
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
  name: string,
  script: string | undefined,
  npm: NPM,
  cwd?: string,
) => {
  if (!script) {
    await exec(format(command.rmPkgScript, npm, name), { cwd });
    return;
  }
  await exec(format(command.setPkgScript, npm, name, script), { cwd });
};

export const getPkgScript = async (name: string, npm: NPM, cwd?: string) => {
  const script = (
    await exec(format(command.getPkgScript, npm, name), { cwd })
  ).stdout.trim();
  return script === "{}" ? undefined : script;
};

type Script = { name: string; script?: string };
export const defKey = "def" as const;
export type Scripts<T extends string> = Partial<
  Record<T | typeof defKey, readonly Script[]>
>;

export const setPkgScripts = async <K extends string, T extends Scripts<K>>(
  scripts: T & {
    [K0 in keyof T]: K0 extends K | typeof defKey ? T[K0] : never;
  },
  key: K | undefined,
  npm: NPM,
  cwd?: string,
) => {
  const scripts0 = scripts[key ?? defKey] ?? scripts.def;
  if (!scripts0) {
    return;
  }
  for (const { name, script } of scripts0) {
    await setPkgScript(name, script, npm, cwd);
  }
};

export const setPkgDep = async (
  name: string,
  version: string,
  npm: NPM,
  cwd?: string,
) => {
  await exec(format(command.setPkgDeps, npm, name, version), { cwd });
};

export const setPkgDevDep = async (
  name: string,
  version: string,
  npm: NPM,
  cwd?: string,
) => {
  await exec(format(command.setPkgDevDeps, npm, name, version), { cwd });
};

type PkgDep = { name: string; version: string; dev?: boolean };
export type PkgDeps<T extends string> = Partial<
  Record<T | typeof defKey, readonly PkgDep[]>
>;

export const setPkgDeps = async <K extends string, T extends PkgDeps<K>>(
  deps: T & { [K0 in keyof T]: K0 extends K | typeof defKey ? T[K0] : never },
  key: K | undefined,
  npm: NPM,
  cwd?: string,
) => {
  const deps0 = deps[key ?? defKey] ?? deps.def;
  if (!deps0) {
    return;
  }
  for (const { name, version } of deps0.filter((e) => !e.dev)) {
    await setPkgDep(name, version, npm, cwd);
  }
  for (const { name, version } of deps0.filter((e) => e.dev)) {
    await setPkgDevDep(name, version, npm, cwd);
  }
};

export const setPkgBin = async (
  name: string,
  script: string | undefined,
  npm: NPM,
  cwd?: string,
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
  const doc = Yaml.parse(
    await readFile(workspace, "utf8").catch(() => "{}"),
  ) as unknown;
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error(format(message.invFormat, workspace));
  }
  const doc0 = doc as Record<string, unknown>;
  void (doc0.packages || (doc0.packages = []));
  if (!Array.isArray(doc0.packages)) {
    throw new Error(format(message.invFormat, workspace));
  }
  doc0.packages.push(pkg);
  await writeFile(workspace, Yaml.stringify(doc));
};

export const addOnlyBuiltDeps = async (deps: readonly string[]) => {
  const doc = Yaml.parse(
    await readFile(workspace, "utf8").catch(() => "{}"),
  ) as unknown;
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error(format(message.invFormat, workspace));
  }
  const doc0 = doc as Record<string, unknown>;
  void (doc0.onlyBuiltDependencies || (doc0.onlyBuiltDependencies = []));
  if (!Array.isArray(doc0.onlyBuiltDependencies)) {
    throw new Error(format(message.invFormat, workspace));
  }
  doc0.onlyBuiltDependencies.push(...deps);
  await writeFile(workspace, Yaml.stringify(doc));
};

export const rmPnpmNodeLinker = async () => {
  await exec(command.rmNodeLinker);
};

export type BuiltDeps<T extends string> = Partial<
  Record<T | typeof defKey, readonly string[]>
>;

export const setWkspaceBuiltDeps = async <
  K extends string,
  T extends BuiltDeps<K>,
>(
  deps: T & { [K0 in keyof T]: K0 extends K | typeof defKey ? T[K0] : never },
  key?: K,
) => {
  const deps0 = deps[key ?? defKey] ?? deps.def;
  if (!deps0) {
    return;
  }
  await addOnlyBuiltDeps(deps0);
};

const tsconfig = "tsconfig.json" as const;

export const setTsOptions = async (options: object, cwd?: string) => {
  const file = join(cwd ?? "", tsconfig);
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}"));
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error(format(message.invFormat, file));
  }
  void (
    doc.compilerOptions || (doc.compilerOptions = {} as Json.CommentObject)
  );
  if (
    typeof doc.compilerOptions !== "object" ||
    doc.compilerOptions === null ||
    Array.isArray(doc.compilerOptions)
  ) {
    throw new Error(format(message.invFormat, file));
  }
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
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}"));
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error(format(message.invFormat, file));
  }
  void (
    doc.compilerOptions || (doc.compilerOptions = {} as Json.CommentObject)
  );
  if (
    typeof doc.compilerOptions !== "object" ||
    doc.compilerOptions === null ||
    Array.isArray(doc.compilerOptions)
  ) {
    throw new Error(format(message.invFormat, file));
  }
  doc.compilerOptions.baseUrl = base;
  doc.compilerOptions.paths = pathAlias as Json.CommentObject;
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
  const doc = Json.parse(await readFile(file, "utf8").catch(() => "{}"));
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    throw new Error(format(message.invFormat, file));
  }
  void (
    doc.compilerOptions || (doc.compilerOptions = {} as Json.CommentObject)
  );
  if (
    typeof doc.compilerOptions !== "object" ||
    doc.compilerOptions === null ||
    Array.isArray(doc.compilerOptions)
  ) {
    throw new Error(format(message.invFormat, file));
  }
  void (
    doc.compilerOptions.paths ||
    (doc.compilerOptions.paths = {} as Json.CommentObject)
  );
  if (
    typeof doc.compilerOptions.paths !== "object" ||
    doc.compilerOptions.paths === null ||
    Array.isArray(doc.compilerOptions.paths)
  ) {
    throw new Error(format(message.invFormat, file));
  }
  doc.compilerOptions.paths[name] = paths as Json.CommentArray<string>;
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

const cfgDir = ".bradhezh-create-prj" as const;
const config = "config.json" as const;

export const getCfg = async (path?: string) => {
  const doc = Json.parse(
    await readFile(join(homedir(), cfgDir, config), "utf-8").catch(() => "{}"),
  );
  if (!path) {
    return doc;
  }
  let value = doc;
  for (const key of path.split(".")) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return;
    }
    value = value[key];
  }
  return value;
};

export const setCfg = async (value: Json.CommentJSONValue, path?: string) => {
  await mkdir(join(homedir(), cfgDir), { recursive: true });
  const file = join(homedir(), cfgDir, config);
  let doc = Json.parse(await readFile(file, "utf8").catch(() => "{}"));
  if (!path) {
    doc = value;
  } else {
    if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
      doc = {} as Json.CommentObject;
    }
    let obj = doc;
    const keys = path.split(".");
    const last = keys.pop()!;
    for (const key of keys) {
      if (
        typeof obj[key] !== "object" ||
        obj[key] === null ||
        Array.isArray(obj[key])
      ) {
        obj[key] = {} as Json.CommentObject;
      }
      obj = obj[key];
    }
    obj[last] = value;
  }
  const text =
    Json.stringify(doc, null, 2).replace(/\[\s+"([^"]+)"\s+\]/g, '["$1"]') +
    "\n";
  await writeFile(file, text);
};

type Tmplt = { name: string; path?: string };
export type Template<T extends string> = Partial<
  Record<T | typeof defKey, Tmplt>
>;

export const installTmplt = async <K extends string, T extends Template<K>>(
  base: string,
  template: T & {
    [K0 in keyof T]: K0 extends K | typeof defKey ? T[K0] : never;
  },
  key?: K,
  cwd?: string,
  tar?: boolean,
) => {
  const tmplt = template[key ?? defKey] ?? template.def;
  if (!tmplt) {
    return;
  }
  const file = join(cwd ?? "", tmplt.name);
  const res = await get<unknown>(`${base}${tmplt.path ?? ""}`, {
    responseType: tar ? "arraybuffer" : "text",
  });
  const data = !(res.data instanceof ArrayBuffer)
    ? res.data
    : new Uint8Array(res.data);
  if (typeof data !== "string" && !(data instanceof Uint8Array)) {
    throw new Error();
  }
  await writeFile(file, data);
  if (!tar) {
    return;
  }
  await exec(format(command.tar, tmplt.name), { cwd });
  await rm(file, { force: true });
};

export enum AuthKey {
  user = "user",
  readToken = "readToken",
  token = "token",
}
type Auth = Partial<Record<AuthKey, string>>;
type AuthCfgPath = Auth;
type Spinner = ReturnType<typeof spinner>;

export const auth = async (
  path: AuthCfgPath,
  ini: Auth,
  hint: string,
  tokenUrl: string,
  s?: Spinner,
) => {
  const value = await authGot(path, ini);
  if (
    (!path.user || value.user) &&
    (!path.readToken || value.readToken) &&
    (!path.token || value.token)
  ) {
    return value;
  }
  s?.stop();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question(hint);
  rl.close();
  if ((path.readToken && !value.readToken) || (path.token && !value.token)) {
    await open(tokenUrl);
  }
  const answer = await authPrompt(
    !!(path.user && !value.user),
    !!(path.readToken && !value.readToken),
    !!(path.token && !value.token),
  );
  s?.start();
  await setAuth(value, path, answer);
  return value;
};

const authGot = async (path: AuthCfgPath, ini: Auth) => {
  if (!path.user && !path.readToken && !path.token) {
    return {};
  }
  const user = path.user && (ini.user || (await getCfg(path.user)));
  const readToken =
    path.readToken && (ini.readToken || (await getCfg(path.readToken)));
  const token = path.token && (ini.token || (await getCfg(path.token)));
  if (
    (typeof user !== "string" && typeof user !== "undefined") ||
    (typeof readToken !== "string" && typeof readToken !== "undefined") ||
    (typeof token !== "string" && typeof token !== "undefined")
  ) {
    throw new Error();
  }
  return { user, readToken, token };
};

const authPrompt = (
  forUser: boolean,
  forReadToken: boolean,
  forToken: boolean,
) => {
  return group(
    {
      ...(forUser && {
        user: () =>
          text({
            message: message.userGot,
            validate: (value?: string) =>
              value ? undefined : message.userRequired,
          }),
      }),
      ...(forReadToken && {
        readToken: () =>
          password({
            message: message.readTokenGot,
            mask: "*",
            validate: (value?: string) =>
              value ? undefined : message.readTokenRequired,
          }),
      }),
      ...(forToken && {
        token: () =>
          password({
            message: message.tokenGot,
            mask: "*",
            validate: (value?: string) =>
              value ? undefined : message.tokenRequired,
          }),
      }),
    },
    { onCancel },
  );
};

const setAuth = async (auth: Auth, path: AuthCfgPath, answer: Auth) => {
  if (path.user && !auth.user) {
    if (!answer.user) {
      throw new Error();
    }
    auth.user = answer.user;
    await setCfg(auth.user, path.user);
  }
  if (path.readToken && !auth.readToken) {
    if (!answer.readToken) {
      throw new Error();
    }
    auth.readToken = answer.readToken;
    await setCfg(auth.readToken, path.readToken);
  }
  if (path.token && !auth.token) {
    if (!answer.token) {
      throw new Error();
    }
    auth.token = answer.token;
    await setCfg(auth.token, path.token);
  }
};

export const onCancel = () => {
  cancel(message.opCanceled);
  process.exit(0);
};
