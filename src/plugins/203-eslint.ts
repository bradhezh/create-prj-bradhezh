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
import { installTmplt, setPkgScripts, setPkgDeps, Template } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const npm = conf.npm;
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const types0 = conf.monorepo?.types ?? [conf.type];
  const types = (
    types0.length <= 1 ? types0 : [...types0, meta.system.type.shared]
  ) as TargetType[];
  const skips = typeFrmwksSkip(meta.plugin.option.lint);

  for (const type of types) {
    const typeFrmwk = (conf[type as PrimeType]?.framework ?? type) as TypeFrmwk;
    if (skips.includes(typeFrmwk)) {
      continue;
    }

    const name = conf[type as PrimeType]?.name ?? type;
    const cwd = conf.type !== meta.plugin.type.monorepo ? "." : name;
    const ts =
      type !== meta.system.type.shared
        ? (conf[type]?.typescript as TsValue)
        : (await access(join(meta.system.type.shared, "tsconfig.json"))
              .then(() => true)
              .catch(() => false))
          ? value.typescript.nodec
          : meta.plugin.value.none;
    const test = conf.test as TestValue;

    log.info(format(message.forType, name));
    await install(typeFrmwk, ts, test, cwd);

    log.info(message.setPkg);
    await setPkgScripts(npm, { default: scripts.default }, "default", cwd);
    await elSetPkgDeps(npm, ts, cwd);
  }
  if (monorepo) {
    await setPkgScripts(npm, { monorepo: scripts.monorepo }, "monorepo");
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const install = async (
  typeFrmwk: TypeFrmwk,
  ts: TsValue,
  test: TestValue,
  cwd: string,
) => {
  const tmplt = template[ts ?? "default"] ?? template.default!;
  const tmplt0 = tmplt[test ?? "default"] ?? tmplt.default!;
  await installTmplt(base, tmplt0, typeFrmwk, cwd);
};

const elSetPkgDeps = async (npm: NPM, ts: TsValue, cwd: string) => {
  await setPkgDeps(npm, { default: pkgDeps }, "default", cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps(npm, { default: tsPkgDeps }, "default", cwd);
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

type TargetType = PrimeType | typeof meta.system.type.shared;
type TypeFrmwk = TargetType | NonNullable<FrmwkValue>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/eslint" as const;

const template: Partial<
  Record<
    NonNullable<TsValue> | "default",
    Partial<Record<NonNullable<TestValue> | "default", Template<TypeFrmwk>>>
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
