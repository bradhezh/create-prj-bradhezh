import { access } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value, FrmwkValue, TsValue, TestValue } from "./const";
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

  const { monorepo, types, test, npm } = await parseConf(conf);

  for (const { typeFrmwk, name, cwd, ts } of types) {
    log.info(format(message.forType, name));
    await install(ts, test, typeFrmwk, cwd);
    log.info(message.setPkg);
    await setPkgScripts({ def: scripts.default }, "def", npm, cwd);
    await esltSetPkgDeps(ts, npm, cwd);
  }
  if (monorepo) {
    await setPkgScripts({ mono: scripts.monorepo }, "mono", npm);
  }
  conf[value.lint.eslint] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = async (conf: Conf) => {
  const types0 = (conf.monorepo?.types ?? [conf.type]) as PrimeType[];
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const types1 = types0
    .map((e) => ({
      typeFrmwk: (conf[e]?.framework ?? e) as TypeFrmwk,
      name: conf[e]?.name as string,
      cwd: (!monorepo ? "." : conf[e]?.name) as string,
      ts: conf[e]?.typescript as TsValue,
    }))
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
  if (types.find((e) => !e.name)) {
    throw new Error();
  }
  const test = conf.test as TestValue;
  const npm = conf.npm;
  return { monorepo, types, test, npm };
};

const install = async (
  ts: TsValue,
  test: TestValue,
  typeFrmwk: TypeFrmwk,
  cwd: string,
) => {
  const tmplt = template[ts ?? defKey] ?? template.default!;
  if (!tmplt) {
    throw new Error();
  }
  const tmplt0 = tmplt[test ?? defKey] ?? tmplt.default;
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

const esltSetPkgDeps = async (ts: TsValue, npm: NPM, cwd: string) => {
  await setPkgDeps({ pkgDeps }, "pkgDeps", npm, cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps({ tsPkgDeps }, "tsPkgDeps", npm, cwd);
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

type TypeFrmwk =
  | PrimeType
  | typeof meta.system.type.shared
  | NonNullable<FrmwkValue>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/eslt" as const;
const name = "eslint.config.mjs" as const;

const template: Partial<
  Record<
    NonNullable<TsValue> | typeof defKey,
    Partial<
      Record<
        NonNullable<TestValue> | typeof defKey,
        Template<
          | Exclude<
              TypeFrmwk,
              typeof meta.plugin.type.lib | typeof meta.plugin.type.cli
            >
          | "pkg"
        >
      >
    >
  >
> = {
  none: {
    jest: { default: { name, path: "/ts-n/jest/eslint.config.mjs" } },
    default: { default: { name, path: "/ts-n/no/eslint.config.mjs" } },
  },
  default: {
    jest: {
      pkg: { name, path: "/def/jest/pkg/eslint.config.mjs" },
      shared: { name, path: "/def/jest/pkg/eslint.config.mjs" },
      default: { name, path: "/def/jest/def/eslint.config.mjs" },
    },
    default: {
      pkg: { name, path: "/def/no/pkg/eslint.config.mjs" },
      shared: { name, path: "/def/no/pkg/eslint.config.mjs" },
      default: { name, path: "/def/no/def/eslint.config.mjs" },
    },
  },
} as const;

const scripts = {
  monorepo: [{ name: "lint", script: "pnpm -r lint" }],
  default: [{ name: "lint", script: "eslint ." }],
} as const;

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
