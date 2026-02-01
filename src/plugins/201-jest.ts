import { access } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value, FrmwkValue, TsValue } from "./const";
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
  setWkspaceBuiltDeps,
  Template,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const npm = conf.npm;
  const types0 = conf.monorepo?.types ?? [conf.type];
  const types = (
    types0.length <= 1 ? types0 : [...types0, meta.system.type.shared]
  ) as TargetType[];
  const withShared = types0.length <= 1 ? undefined : "withShared";
  const skips = typeFrmwksSkip(meta.plugin.option.test);

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

    log.info(format(message.forType, name));
    await install(typeFrmwk, ts, withShared, cwd);

    log.info(message.setPkg);
    await setPkgScripts(npm, { default: scripts }, "default", cwd);
    await jeSetPkgDeps(npm, type, typeFrmwk, ts, cwd);
  }
  log.info(message.setWkspace);
  await setWkspaceBuiltDeps({ default: builtDeps }, "default");

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const install = async (
  typeFrmwk: TypeFrmwk,
  ts: TsValue,
  withShared: WithShared,
  cwd: string,
) => {
  if (typeFrmwk === value.framework.nest) {
    await installTmplt(base, nestTmplt, withShared ?? "default", cwd);
    await installTmplt(base, { nest: nestSrcTmplt }, "nest", cwd, true);
  } else {
    const tmplt = template[ts ?? "default"] ?? template.default!;
    const tmplt0 = tmplt[withShared ?? "default"] ?? tmplt.default!;
    await installTmplt(base, tmplt0, typeFrmwk, cwd);
    const tmplt1 = srcTmplt[ts ?? "default"] ?? srcTmplt.default!;
    await installTmplt(base, tmplt1, typeFrmwk, cwd, true);
  }
};

const jeSetPkgDeps = async (
  npm: NPM,
  type: TargetType,
  typeFrmwk: TypeFrmwk,
  ts: TsValue,
  cwd: string,
) => {
  await setPkgDeps(npm, { default: pkgDeps }, "default", cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps(npm, { default: tsPkgDeps }, "default", cwd);
  }
  if (type === meta.plugin.type.backend) {
    await setPkgDeps(npm, { default: bePkgDeps }, "default", cwd);
    if (ts !== meta.plugin.value.none) {
      await setPkgDeps(npm, { default: beTsPkgDeps }, "default", cwd);
    }
  }
  if (typeFrmwk === value.framework.nest) {
    await setPkgDeps(npm, { default: nestPkgDeps }, "default", cwd);
  }
};

const label = "Jest" as const;

regValue(
  {
    name: value.test.jest,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.test}_${value.test.jest}`,
      label,
      run,
    },
  },
  meta.plugin.option.test,
);

type TargetType = PrimeType | typeof meta.system.type.shared;
type TypeFrmwk = TargetType | NonNullable<FrmwkValue>;
type WithShared = "withShared" | undefined;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/jest" as const;

const nestTmplt = {
  withShared: {
    name: "jest.config.js",
    path: "/jest-with-shared-dec.config.js",
  },
  default: { name: "jest.config.js", path: "/jest-dec.config.js" },
} as const;

const template: Partial<
  Record<
    NonNullable<TsValue> | "default",
    Partial<
      Record<
        NonNullable<WithShared> | "default",
        Template<Exclude<TypeFrmwk, "nest">>
      >
    >
  >
> = {
  none: {
    default: {
      default: { name: "jest.config.js", path: "/jest-js.config.js" },
    },
  },
  metadata: {
    withShared: {
      cli: {
        name: "jest.config.js",
        path: "/jest-pkg-with-shared-dec.config.js",
      },
      lib: {
        name: "jest.config.js",
        path: "/jest-pkg-with-shared-dec.config.js",
      },
      default: {
        name: "jest.config.js",
        path: "/jest-with-shared-dec.config.js",
      },
    },
    default: {
      cli: { name: "jest.config.js", path: "/jest-pkg-dec.config.js" },
      lib: { name: "jest.config.js", path: "/jest-pkg-dec.config.js" },
      default: { name: "jest.config.js", path: "/jest-dec.config.js" },
    },
  },
  default: {
    withShared: {
      cli: { name: "jest.config.js", path: "/jest-pkg-with-shared.config.js" },
      lib: { name: "jest.config.js", path: "/jest-pkg-with-shared.config.js" },
      shared: { name: "jest.config.js", path: "/jest-shared.config.js" },
      default: { name: "jest.config.js", path: "/jest-with-shared.config.js" },
    },
    default: {
      cli: { name: "jest.config.js", path: "/jest-pkg.config.js" },
      lib: { name: "jest.config.js", path: "/jest-pkg.config.js" },
      default: { name: "jest.config.js", path: "/jest.config.js" },
    },
  },
} as const;

const nestSrcTmplt = { name: "jest.tar", path: "/nest/jest.tar" } as const;

const srcTmplt: Partial<
  Record<NonNullable<TsValue> | "default", Template<Exclude<TypeFrmwk, "nest">>>
> = {
  none: {
    express: { name: "jest.tar", path: "/backend/js/jest.tar" },
    default: { name: "jest.tar", path: "/js/jest.tar" },
  },
  default: {
    express: { name: "jest.tar", path: "/backend/jest.tar" },
    default: { name: "jest.tar", path: "/jest.tar" },
  },
} as const;

const scripts = [{ name: "test", script: "jest --passWithNoTests" }] as const;

const pkgDeps = [
  { name: "@swc/core", version: "^1", dev: true },
  { name: "@swc/jest", version: "^0", dev: true },
  { name: "jest", version: "^30", dev: true },
] as const;

const tsPkgDeps = [{ name: "@types/jest", version: "^30", dev: true }] as const;
const bePkgDeps = [{ name: "supertest", version: "^7", dev: true }] as const;

const beTsPkgDeps = [
  { name: "@types/supertest", version: "^6", dev: true },
] as const;

const nestPkgDeps = [
  { name: "@nestjs/testing", version: "^11", dev: true },
] as const;

const builtDeps = ["@swc/core", "unrs-resolver"] as const;

const message = {
  ...msg,
  forType: 'for "%s"',
} as const;
