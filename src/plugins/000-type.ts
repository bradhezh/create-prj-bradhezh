import { execSync } from "node:child_process";
import { rm, rename } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";
import wrapAnsi from "wrap-ansi";

import { value } from "./const";
import { regType, meta, NPM, Conf, Plugin, PrimeType } from "@/registry";
import {
  installTmplt,
  setPkgName,
  setPkgVers,
  getPkgScript,
  setPkgScript,
  setPkgScripts,
  setWkspaceBuiltDeps,
  rmPnpmNodeLinker,
  setPathAliasWithShared,
  defKey,
  Template,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const conf0 = parseConf(conf, this.name as PrimeType);

  await install(conf0, s);
  log.info(message.setPkg);
  await setPkg(conf0);
  log.info(message.setWkspace);
  await setWkspace(conf0);

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf, type: PrimeType) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const name = conf[type]?.name;
  if (!name) {
    throw new Error();
  }
  const type0 = parseType(conf, type, name);
  return { npm, name, ...type0 };
};

const parseType = (conf: Conf, type: PrimeType, name: string) => {
  const typeFrmwk = (conf[type]?.framework ?? type) as TypeFrmwk;
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : name;
  const shared = (conf.monorepo?.types.length ?? 0) > 1;
  return { type, typeFrmwk, cwd, shared };
};

type InstallData = { typeFrmwk: TypeFrmwk; npm: NPM; cwd: string };

const install = async ({ typeFrmwk, npm, cwd }: InstallData, s: Spinner) => {
  await installTmplt(base, template, typeFrmwk, cwd, true);
  if (command[typeFrmwk]) {
    const cmd = format(command[typeFrmwk], npm, cwd);
    log.info(wrapAnsi(cmd, message.noteWidth));
    s.stop();
    execSync(cmd, { stdio: "inherit" });
    s.start();
    await rm(join(cwd, git), { recursive: true, force: true });
  }
  const tmplt = template as Template<TypeFrmwk>;
  if (!tmplt[typeFrmwk] && !tmplt.def && !command[typeFrmwk]) {
    log.warn(format(message.noTmpltCmd, typeFrmwk));
  }
};

type PkgData = { name: string; typeFrmwk: TypeFrmwk; npm: NPM; cwd: string };

const setPkg = async ({ name, typeFrmwk, npm, cwd }: PkgData) => {
  await setPkgName(name, npm, cwd);
  await setPkgVers(npm, cwd);
  await setPkgScripts(scripts, typeFrmwk, npm, cwd);
  if (command[typeFrmwk]) {
    for (const { name, script } of nonTmpltScripts) {
      if (!(await getPkgScript(name, npm, cwd)))
        await setPkgScript(name, script, npm, cwd);
    }
  }
  if (
    typeFrmwk === value.framework.next &&
    (await getPkgScript(nextScripts[0].name, npm, "."))
  ) {
    await setPkgScripts({ nextScripts }, "nextScripts", npm, ".");
  }
};

type WkspaceData = { typeFrmwk: TypeFrmwk; shared: boolean; cwd: string };

const setWkspace = async ({ typeFrmwk, shared, cwd }: WkspaceData) => {
  await setWkspaceBuiltDeps(builtDeps, typeFrmwk);
  if (cwd !== ".") {
    if (typeFrmwk === value.framework.next) {
      const wkspace = join(cwd, workspace);
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
    } else if (typeFrmwk === value.framework.expo) {
      await rmPnpmNodeLinker();
    }
  }
  if (shared) {
    log.info(message.setShared);
    await setPathAliasWithShared(cwd);
    await installTmplt(base, patchTmplt, typeFrmwk, cwd, true);
  }
};

for (const { name, label, keeps, frameworks } of [
  {
    name: meta.plugin.type.backend,
    label: "Backend",
    keeps: [],
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
    keeps: [],
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
    keeps: [],
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
  {
    name: meta.plugin.type.node,
    label: "Node.js app",
    keeps: [
      { option: meta.plugin.option.builder },
      { option: meta.plugin.option.test },
      { option: meta.plugin.option.lint },
    ],
  },
  {
    name: meta.plugin.type.lib,
    label: "Library",
    keeps: [
      { option: meta.plugin.option.builder },
      { option: meta.plugin.option.test },
      { option: meta.plugin.option.lint },
    ],
  },
  {
    name: meta.plugin.type.cli,
    label: "CLI tool",
    keeps: [
      { option: meta.plugin.option.builder },
      { option: meta.plugin.option.test },
      { option: meta.plugin.option.lint },
    ],
  },
]) {
  regType({
    name,
    label,
    skips: [],
    keeps,
    requires: [],
    plugin: { name, label, run },
    options: [
      {
        name: meta.plugin.option.type.name,
        label: `${label} name`,
        values: [],
      },
      ...(!frameworks
        ? []
        : [
            {
              name: meta.plugin.option.type.framework,
              label: `${label} framework`,
              values: frameworks,
            },
          ]),
    ],
  });
}

type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/type" as const;
const name = "type.tar" as const;

type TypeFrmwk = PrimeType | keyof typeof value.framework;
const template = {
  nest: { name, path: "/nest/type.tar" },
  express: { name, path: "/expr/ts/type.tar" },
  node: { name, path: "/node/ts/type.tar" },
  lib: { name, path: "/lib/ts/type.tar" },
  cli: { name, path: "/cli/ts/type.tar" },
} as const;

const patchTmplt = {
  nest: { name: "ptch.tar", path: "/shrd/ptch/nest/ptch.tar" },
  express: { name: "ptch.tar", path: "/shrd/ptch/expr/ts/ptch.tar" },
} as const;

type TypeFrmwkKey = TypeFrmwk | typeof defKey;
const command: Partial<Record<TypeFrmwkKey, string>> = {
  react: "%s create vite %s --template react-ts",
  next: "%s create next-app %s --ts --no-react-compiler --no-src-dir -app --api --eslint --tailwind --skip-install --disable-git",
  expo: "%s create expo-app %s --no-install",
} as const;

const scripts = {
  react: [{ name: "start", script: "vite preview" }],
  expo: [{ name: "dev", script: "expo start" }],
} as const;

const nonTmpltScripts = [
  { name: "test", script: "exit 0" },
  { name: "lint", script: "exit 0" },
] as const;

const nextScripts = [
  { name: "copy-dist", script: undefined },
  {
    name: "build",
    script: "pnpm --filter backend build && pnpm --filter frontend build",
  },
  { name: "start:fe", script: "pnpm --filter frontend start" },
] as const;

const builtDeps = { nest: ["@nestjs/core"], react: ["esbuild"] } as const;

const git = ".git" as const;
const workspace = "pnpm-workspace.yaml" as const;
const bak = ".bak" as const;

const message = {
  ...msg,
  noTmpltCmd: 'No template or command provided for "%s"',
  nextWkspaceRenamed:
    "%s/pnpm-workspace.yaml has been renamed %s/pnpm-workspace.yaml.bak, please check the content and merge necessary ones into the root workspace.",
} as const;
