import { access } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value } from "./const";
import {
  regValue,
  typeFrmwksSkip,
  meta,
  NPM,
  Conf,
  Plugin,
  PrimeType,
} from "@/registry";
import {
  installTmplt,
  setPkgScripts,
  setPkgDeps,
  defKey,
  Template,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const conf0 = parseConf(conf);
  const types = await parseType(conf, conf0);

  for (const type of types) {
    log.info(format(message.forType, type.name));
    await install({ ...conf0, ...type });
    log.info(message.setPkg);
    await setPkg({ ...conf0, ...type });
  }
  await setMono(conf0);
  conf[value.lint.eslint] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

type Conf0 = { npm: NPM; monorepo: boolean; test: Test };

const parseConf = (conf: Conf) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const test = conf.test as Test;
  return { npm, monorepo, test };
};

const parseType = async (conf: Conf, { monorepo }: Conf0) => {
  const types0 = (conf.monorepo?.types ?? [conf.type]) as PrimeType[];
  const types1 = types0
    .map((e) => {
      const name = conf[e]?.name;
      if (!name) {
        throw new Error();
      }
      return {
        typeFrmwk: (conf[e]?.framework ?? e) as TypeFrmwk,
        name,
        cwd: !monorepo ? "." : name,
        ts: conf[e]?.typescript as Ts,
      };
    })
    .filter(
      (e) =>
        !typeFrmwksSkip(undefined, meta.plugin.option.test, undefined).includes(
          e.typeFrmwk,
        ),
    );
  const types =
    types0.length <= 1
      ? types1
      : [
          ...types1,
          {
            typeFrmwk: meta.system.type.shared,
            name: meta.system.type.shared,
            cwd: meta.system.type.shared,
            ts: (await access(join(meta.system.type.shared, "tsconfig.json"))
              .then(() => true)
              .catch(() => false))
              ? value.typescript.nodec
              : meta.plugin.value.none,
          },
        ];
  return types;
};

type InstallData = { ts: Ts; test: Test; typeFrmwk: TypeFrmwk; cwd: string };

const install = async ({ ts, test, typeFrmwk, cwd }: InstallData) => {
  const tmplt = template[ts ?? defKey] ?? template.def;
  if (!tmplt) {
    throw new Error();
  }
  const tmplt0 = tmplt[test ?? defKey] ?? tmplt.def;
  if (!tmplt0) {
    throw new Error();
  }
  await installTmplt(
    base,
    tmplt0,
    typeFrmwk === meta.plugin.type.lib || typeFrmwk === meta.plugin.type.cli
      ? "pkg"
      : typeFrmwk,
    cwd,
  );
};

type PkgData = { ts: Ts; npm: NPM; cwd: string };

const setPkg = async ({ npm, cwd, ts }: PkgData) => {
  await setPkgScripts({ scripts }, "scripts", npm, cwd);
  await setPkgDeps({ pkgDeps }, "pkgDeps", npm, cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps({ tsPkgDeps }, "tsPkgDeps", npm, cwd);
  }
};

type MonoData = { monorepo: boolean; npm: NPM };

const setMono = async ({ monorepo, npm }: MonoData) => {
  if (monorepo) {
    await setPkgScripts({ monoScripts }, "monoScripts", npm);
  }
};

const label = "ESLint" as const;

regValue(
  {
    name: value.lint.eslint,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.lint}_${value.lint.eslint}`,
      label,
      run,
    },
  },
  meta.plugin.option.lint,
);

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/eslt" as const;
const name = "eslint.config.mjs" as const;

type Ts =
  | keyof typeof value.typescript
  | typeof meta.plugin.value.none
  | undefined;
type TsKey = NonNullable<Ts> | typeof defKey;
type Test = keyof typeof value.test | undefined;
type TestKey = NonNullable<Test> | typeof defKey;
type TypeFrmwk =
  | PrimeType
  | typeof meta.system.type.shared
  | keyof typeof value.framework;
type TypeFrmwkKey =
  | Exclude<
      TypeFrmwk,
      typeof meta.plugin.type.lib | typeof meta.plugin.type.cli
    >
  | "pkg"
  | typeof defKey;
const template: Partial<
  Record<TsKey, Partial<Record<TestKey, Template<TypeFrmwkKey>>>>
> = {
  none: {
    jest: { def: { name, path: "/ts-n/jest/eslint.config.mjs" } },
    def: { def: { name, path: "/ts-n/no/eslint.config.mjs" } },
  },
  def: {
    jest: {
      pkg: { name, path: "/def/jest/pkg/eslint.config.mjs" },
      shared: { name, path: "/def/jest/pkg/eslint.config.mjs" },
      def: { name, path: "/def/jest/def/eslint.config.mjs" },
    },
    def: {
      pkg: { name, path: "/def/no/pkg/eslint.config.mjs" },
      shared: { name, path: "/def/no/pkg/eslint.config.mjs" },
      def: { name, path: "/def/no/def/eslint.config.mjs" },
    },
  },
} as const;

const scripts = [{ name: "lint", script: "eslint ." }] as const;
const monoScripts = [{ name: "lint", script: "pnpm -r lint" }] as const;

const pkgDeps = [
  { name: "@eslint/js", version: "^9", dev: true },
  { name: "eslint", version: "^9", dev: true },
  { name: "globals", version: "^16", dev: true },
] as const;

const tsPkgDeps = [
  { name: "typescript-eslint", version: "^8", dev: true },
] as const;

const message = {
  ...msg,
  forType: 'for "%s"',
} as const;
