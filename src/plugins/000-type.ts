import { execSync } from "node:child_process";
import { rm, rename } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";
import wrapAnsi from "wrap-ansi";

import { value, FrmwkValue } from "./const";
import { regType, meta, NPM, Conf, Plugin, PrimeType } from "@/registry";
import {
  installTmplt,
  setPkgName,
  setPkgVers,
  getPkgScript,
  setPkgScripts,
  setWkspaceBuiltDeps,
  rmPnpmNodeLinker,
  setPathAliasWithShared,
  Template,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const { name, typeFrmwk, npm, cwd, shared } = parseConf(
    conf,
    this.name as PrimeType,
  );

  await install(typeFrmwk, npm, cwd, s);
  log.info(message.setPkg);
  await setPkgName(name, npm, cwd);
  await setPkgVers(npm, cwd);
  await typeSetPkgScripts(typeFrmwk, npm, cwd);
  log.info(message.setWkspace);
  await setWkspace(typeFrmwk, cwd);
  if (shared) {
    log.info(message.setShared);
    await setShared(typeFrmwk, cwd);
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf, type: PrimeType) => {
  const name = conf[type]?.name;
  if (!name) {
    throw new Error();
  }
  const typeFrmwk = (conf[type]?.framework ?? type) as TypeFrmwk;
  const npm = conf.npm;
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : name;
  const shared = (conf.monorepo?.types.length ?? 0) > 1;
  return { name, typeFrmwk, npm, cwd, shared };
};

const install = async (
  typeFrmwk: TypeFrmwk,
  npm: NPM,
  cwd: string,
  s: Spinner,
) => {
  await installTmplt(base, template, typeFrmwk, cwd, true);
  if (command[typeFrmwk]) {
    await create(command[typeFrmwk], npm, cwd, s);
  }
  const tmplt = template as Template<TypeFrmwk>;
  if (!tmplt[typeFrmwk] && !tmplt.default && !command[typeFrmwk]) {
    log.warn(format(message.noTmpltCmd, typeFrmwk));
  }
};

const create = async (command: string, npm: NPM, cwd: string, s: Spinner) => {
  const cmd = format(command, npm, cwd);
  log.info(wrapAnsi(cmd, message.noteWidth));
  s.stop();
  execSync(cmd, { stdio: "inherit" });
  s.start();
  await rm(join(cwd, git), { recursive: true, force: true });
};

const typeSetPkgScripts = async (
  typeFrmwk: TypeFrmwk,
  npm: NPM,
  cwd: string,
) => {
  await setPkgScripts(scripts, typeFrmwk, npm, cwd);
  if (
    typeFrmwk === value.framework.next &&
    (await getPkgScript(nextScripts[0].name, npm, "."))
  ) {
    await setPkgScripts({ nextScripts }, "nextScripts", npm, ".");
  }
};

const setWkspace = async (typeFrmwk: TypeFrmwk, cwd: string) => {
  await setWkspaceBuiltDeps(builtDeps, typeFrmwk);
  const wkspace = join(cwd, workspace);
  if (typeFrmwk === value.framework.next && cwd !== ".") {
    if (
      await rename(wkspace, `${wkspace}${bak}`)
        .then(() => true)
        .catch(() => false)
    ) {
      log.warn(
        wrapAnsi(
          format(message.nextWkspaceRenamed, cwd, cwd),
          message.noteWidth,
        ),
      );
    }
  }
  if (typeFrmwk === value.framework.expo && cwd !== ".") {
    await rmPnpmNodeLinker();
  }
};

const setShared = async (typeFrmwk: TypeFrmwk, cwd: string) => {
  await setPathAliasWithShared(cwd);
  await installTmplt(base, patchTmplt, typeFrmwk, cwd, true);
};

for (const { name, label, frameworks } of [
  {
    name: meta.plugin.type.backend,
    label: "Backend",
    frameworks: [
      {
        name: value.framework.express,
        label: "Express",
        skips: [],
        keeps: [
          { option: meta.plugin.option.builder },
          { option: meta.plugin.option.test },
          { option: meta.plugin.option.lint },
        ],
        requires: [],
      },
      {
        name: value.framework.nest,
        label: "NestJS",
        skips: [],
        keeps: [
          { option: meta.plugin.option.builder },
          { option: meta.plugin.option.test },
          { option: meta.plugin.option.lint },
        ],
        requires: [],
      },
    ],
  },
  {
    name: meta.plugin.type.frontend,
    label: "Frontend",
    frameworks: [
      {
        name: value.framework.react,
        label: "React (Vite)",
        skips: [
          { option: meta.plugin.option.builder },
          { option: meta.plugin.option.test },
          { option: meta.plugin.option.lint },
        ],
        keeps: [],
        requires: [],
      },
      {
        name: value.framework.next,
        label: "Next.js",
        skips: [
          {
            type: meta.plugin.type.frontend,
            option: meta.plugin.option.type.deployment,
            value: value.deployment.render,
          },
          { option: meta.plugin.option.builder },
          { option: meta.plugin.option.test },
          { option: meta.plugin.option.lint },
        ],
        keeps: [
          {
            type: meta.plugin.type.frontend,
            option: meta.plugin.option.type.deployment,
          },
        ],
        requires: [],
      },
    ],
  },
  {
    name: meta.plugin.type.mobile,
    label: "Mobile",
    frameworks: [
      {
        name: value.framework.expo,
        label: "Expo",
        skips: [
          { option: meta.plugin.option.builder },
          { option: meta.plugin.option.test },
          { option: meta.plugin.option.lint },
        ],
        keeps: [],
        requires: [],
      },
    ],
  },
]) {
  regType({
    name,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: { name, label, run },
    options: [
      {
        name: meta.plugin.option.type.name,
        label: `${label} name`,
        values: [],
      },
      {
        name: meta.plugin.option.type.framework,
        label: `${label} framework`,
        values: frameworks,
      },
    ],
  });
}
for (const { name, label } of [
  { name: meta.plugin.type.node, label: "Node.js app" },
  { name: meta.plugin.type.lib, label: "Library" },
  { name: meta.plugin.type.cli, label: "CLI tool" },
]) {
  regType({
    name,
    label,
    skips: [],
    keeps: [
      { option: meta.plugin.option.builder },
      { option: meta.plugin.option.test },
      { option: meta.plugin.option.lint },
    ],
    requires: [],
    plugin: { name, label, run },
    options: [
      {
        name: meta.plugin.option.type.name,
        label: `${label} name`,
        values: [],
      },
    ],
  });
}

type TypeFrmwk = PrimeType | NonNullable<FrmwkValue>;
type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/type" as const;
const name = "type.tar" as const;

const template = {
  node: { name, path: "/node/ts/type.tar" },
  lib: { name, path: "/lib/ts/type.tar" },
  cli: { name, path: "/cli/ts/type.tar" },
  express: { name, path: "/expr/ts/type.tar" },
  nest: { name, path: "/nest/type.tar" },
} as const;

const patchTmplt = {
  express: { name: "ptch.tar", path: "/shrd/ptch/expr/ts/ptch.tar" },
  nest: { name: "ptch.tar", path: "/shrd/ptch/nest/ptch.tar" },
} as const;

const command: Partial<Record<TypeFrmwk, string>> = {
  react: "%s create vite %s --template react-ts",
  next: "%s create next-app %s --ts --no-react-compiler --no-src-dir -app --api --eslint --tailwind --skip-install --disable-git",
  expo: "%s create expo-app %s --no-install",
} as const;

const scripts = {
  react: [{ name: "start", script: "vite preview" }],
  expo: [{ name: "dev", script: "expo start" }],
} as const;

const nextScripts = [
  { name: "copy-dist", script: undefined },
  {
    name: "build",
    script: "pnpm --filter backend build && pnpm --filter frontend build",
  },
  { name: "start:fe", script: "pnpm --filter frontend start" },
] as const;

const builtDeps = { nest: ["@nestjs/core"] } as const;

const git = ".git" as const;
const workspace = "pnpm-workspace.yaml" as const;
const bak = ".bak" as const;

const message = {
  ...msg,
  noTmpltCmd: 'No template or command provided for "%s"',
  nextWkspaceRenamed:
    "%s/pnpm-workspace.yaml has been renamed %s/pnpm-workspace.yaml.bak, please check the content and merge necessary ones into the root workspace.",
} as const;
