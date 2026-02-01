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
  setPkgScript,
  getPkgScript,
  setPkgScripts,
  setWkspaceBuiltDeps,
  rmPnpmNodeLinker,
  setPathAliasWithShared,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();

  const type = this.name as PrimeType;
  const npm = conf.npm;
  const name = conf[type]?.name ?? type;
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : name;
  const typeFrmwk = (conf[type]?.framework ?? type) as TypeFrmwk;
  const shared = (conf.monorepo?.types.length ?? 0) > 1;

  log.info(format(message.pluginStart, this.label));
  await install(npm, typeFrmwk, cwd, s);

  log.info(message.setPkg);
  await setPkgName(npm, name, cwd);
  await setPkgVers(npm, cwd);
  await typeSetPkgScripts(npm, typeFrmwk, cwd);

  log.info(message.setWkspace);
  await setWkspace(typeFrmwk, cwd);

  if (shared) {
    log.info(message.setShared);
    await setShared(typeFrmwk, cwd);
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const install = async (
  npm: NPM,
  typeFrmwk: TypeFrmwk,
  cwd: string,
  s: Spinner,
) => {
  await installTmplt(base, template, typeFrmwk, cwd, true);
  if (command[typeFrmwk]) {
    await create(npm, command[typeFrmwk], cwd, s);
  }
  if (!(typeFrmwk in template) && !command[typeFrmwk]) {
    log.warn(format(message.noTmpltCmd, typeFrmwk));
  }
};

const create = async (npm: NPM, command: string, cwd: string, s: Spinner) => {
  const cmd = format(command, npm, cwd);
  log.info(wrapAnsi(cmd, message.noteWidth));
  s.stop();
  execSync(cmd, { stdio: "inherit" });
  s.start();
  await rm(join(cwd, git), { recursive: true, force: true });
};

const typeSetPkgScripts = async (
  npm: NPM,
  typeFrmwk: TypeFrmwk,
  cwd: string,
) => {
  await setPkgScripts(npm, scripts, typeFrmwk, cwd);
  if (
    typeFrmwk === value.framework.next &&
    (await getPkgScript(npm, nextScript.copyDist.name, "."))
  ) {
    for (const { name, script } of Object.values(nextScript)) {
      await setPkgScript(npm, name, script, ".");
    }
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
          { option: meta.plugin.option.builder },
          { option: meta.plugin.option.test },
          { option: meta.plugin.option.lint },
        ],
        keeps: [],
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
  { name: meta.plugin.type.cli, label: "CLI tool" },
  { name: meta.plugin.type.lib, label: "Library" },
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

const template = {
  node: { name: "node.tar", path: "/node/node.tar" },
  cli: { name: "cli.tar", path: "/cli/cli.tar" },
  lib: { name: "lib.tar", path: "/lib/lib.tar" },
  express: { name: "express.tar", path: "/express/express.tar" },
  nest: { name: "nest.tar", path: "/nest/nest.tar" },
} as const;

const patchTmplt = {
  express: { name: "patch.tar", path: "/express/patch/patch.tar" },
  nest: { name: "patch.tar", path: "/nest/patch/patch.tar" },
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

const nextScript = {
  copyDist: { name: "copy-dist", script: undefined },
  build: {
    name: "build",
    script: "pnpm --filter backend build && pnpm --filter frontend build",
  },
  start: { name: "start:fe", script: "pnpm --filter frontend start" },
} as const;

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
