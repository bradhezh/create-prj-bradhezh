import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value, FrmwkValue, TsValue, TestValue } from "./const";
import {
  regValue,
  getDisableTypesAndFrmwks,
  meta,
  NPM,
  Conf,
  PluginType,
} from "@/registry";
import { installTmplt, setPkgScripts, setPkgDeps, Template } from "@/command";
import { message as msg } from "@/message";

const run = async (conf: Conf) => {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, label));

  const npm = conf.npm;
  const types0 = conf.monorepo?.types ?? [conf.type];
  const types = (
    types0.length <= 1 ? types0 : [...types0, meta.system.type.shared]
  ) as PluginType[];

  for (const type of types) {
    const name = conf[type]?.name ?? type;
    const cwd = conf.type !== meta.system.type.monorepo ? "." : name;
    const typeFrmwk = (conf[type]?.framework ?? type) as TypeFrmwk;
    const ts = conf[type]?.typescript as Ts;
    const test = conf.test as Test;

    log.info(format(message.forType, name));
    await install(typeFrmwk, ts, test, cwd);

    log.info(message.setPkg);
    await elSetPkgScripts(npm, typeFrmwk, cwd);
    await elSetPkgDeps(npm, typeFrmwk, ts, cwd);
  }

  log.info(format(message.pluginFinish, label));
  s.stop();
};

const install = async (
  typeFrmwk: TypeFrmwk,
  ts: Ts,
  test: Test,
  cwd: string,
) => {
  if (getDisableTypesAndFrmwks(meta.plugin.option.lint).includes(typeFrmwk)) {
    return;
  }
  const tmplt = ts && ts in template ? template[ts]! : template.default!;
  const tmplt0 = test && test in tmplt ? tmplt[test]! : tmplt.default!;
  if (await installTmplt(base, tmplt0, typeFrmwk, cwd)) {
    return;
  }
  await installTmplt(base, { default: tmplt0.default }, "default", cwd);
};

const elSetPkgScripts = async (npm: NPM, typeFrmwk: TypeFrmwk, cwd: string) => {
  if (getDisableTypesAndFrmwks(meta.plugin.option.lint).includes(typeFrmwk)) {
    return;
  }
  await setPkgScripts(npm, { default: [script] }, "default", cwd);
};

const elSetPkgDeps = async (
  npm: NPM,
  typeFrmwk: TypeFrmwk,
  ts: Ts,
  cwd: string,
) => {
  if (getDisableTypesAndFrmwks(meta.plugin.option.lint).includes(typeFrmwk)) {
    return;
  }
  await setPkgDeps(npm, { default: pkgDeps }, "default", cwd);
  if (ts === meta.plugin.value.none) {
    return;
  }
  await setPkgDeps(npm, { default: tsPkgDeps }, "default", cwd);
};

const label = "ESLint" as const;

regValue(
  {
    name: value.lint.eslint,
    label,
    plugin: { run },
    disables: [],
    enables: [],
  },
  meta.plugin.option.lint,
  undefined,
  0,
);

type TypeFrmwk =
  | PluginType
  | NonNullable<FrmwkValue>
  | typeof meta.system.type.shared
  | "default";
type Ts = TsValue | "default";
type Test = TestValue | "default";

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/eslint" as const;

const template: Partial<
  Record<
    NonNullable<Ts>,
    Partial<Record<NonNullable<Test>, Template<TypeFrmwk>>>
  >
> = {
  none: {
    jest: {
      default: {
        name: "eslint.config.mjs",
        path: "/eslint-jest-js.config.mjs",
      },
    },
    default: {
      default: { name: "eslint.config.mjs", path: "/eslint-js.config.mjs" },
    },
  },
  default: {
    jest: {
      cli: { name: "eslint.config.mjs", path: "/eslint-pkg-jest.config.mjs" },
      lib: { name: "eslint.config.mjs", path: "/eslint-pkg-jest.config.mjs" },
      shared: {
        name: "eslint.config.mjs",
        path: "/eslint-pkg-jest.config.mjs",
      },
      default: { name: "eslint.config.mjs", path: "/eslint-jest.config.mjs" },
    },
    default: {
      cli: { name: "eslint.config.mjs", path: "/eslint-pkg.config.mjs" },
      lib: { name: "eslint.config.mjs", path: "/eslint-pkg.config.mjs" },
      shared: { name: "eslint.config.mjs", path: "/eslint-pkg.config.mjs" },
      default: { name: "eslint.config.mjs", path: "/eslint.config.mjs" },
    },
  },
} as const;

const script = { name: "lint", script: "eslint ." } as const;

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
