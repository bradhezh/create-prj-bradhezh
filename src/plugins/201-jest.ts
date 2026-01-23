import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value, FrmwkValue, TsValue } from "./const";
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
  const shared = types0.length > 1 ? "withShared" : undefined;

  for (const type of types) {
    const name = conf[type]?.name ?? type;
    const cwd = conf.type !== meta.system.type.monorepo ? "." : name;
    const typeFrmwk = (conf[type]?.framework ?? type) as TypeFrmwk;
    const ts = conf[type]?.typescript as Ts;

    log.info(format(message.forType, name));
    await install(typeFrmwk, ts, shared, cwd);

    log.info(message.setPkg);
    await jeSetPkgScripts(npm, typeFrmwk, cwd);
    await jeSetPkgDeps(npm, type, typeFrmwk, ts, cwd);
  }

  log.info(format(message.pluginFinish, label));
  s.stop();
};

const install = async (
  typeFrmwk: TypeFrmwk,
  ts: Ts,
  shared: Shared,
  cwd: string,
) => {
  if (getDisableTypesAndFrmwks(meta.plugin.option.test).includes(typeFrmwk)) {
    return;
  }
  if (typeFrmwk === value.framework.nest) {
    await installTmplt(base, nestTmplt, shared ?? "default", cwd);
    await installTmplt(base, { nest: nestSrcTmplt }, "nest", cwd, true);
    return;
  }
  const tmplt = ts && ts in template ? template[ts]! : template.default!;
  const tmplt0 = shared && shared in tmplt ? tmplt[shared]! : tmplt.default!;
  if (!(await installTmplt(base, tmplt0, typeFrmwk, cwd))) {
    await installTmplt(base, { default: tmplt0.default }, "default", cwd);
  }
  await installTmplt(base, srcTmplt, ts ?? "default", cwd, true);
};

const jeSetPkgScripts = async (npm: NPM, typeFrmwk: TypeFrmwk, cwd: string) => {
  if (getDisableTypesAndFrmwks(meta.plugin.option.test).includes(typeFrmwk)) {
    return;
  }
  await setPkgScripts(npm, { default: [script] }, "default", cwd);
};

const jeSetPkgDeps = async (
  npm: NPM,
  type: PluginType,
  typeFrmwk: TypeFrmwk,
  ts: Ts,
  cwd: string,
) => {
  if (getDisableTypesAndFrmwks(meta.plugin.option.test).includes(typeFrmwk)) {
    return;
  }
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
    plugin: { run },
    disables: [],
    enables: [],
  },
  meta.plugin.option.test,
  undefined,
  0,
);

type TypeFrmwk =
  | PluginType
  | NonNullable<FrmwkValue>
  | typeof meta.system.type.shared
  | "default";
type Ts = TsValue | "default";
type Shared = "withShared" | undefined | "default";

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
    NonNullable<Ts>,
    Partial<Record<NonNullable<Shared>, Template<Exclude<TypeFrmwk, "nest">>>>
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
      shared: { name: "jest.config.js", path: "/jest-shared-dec.config.js" },
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

const srcTmplt = {
  none: { name: "jest.tar", path: "/js/jest.tar" },
  default: { name: "jest.tar", path: "/jest.tar" },
} as const;

const script = { name: "test", script: "jest --passWithNoTests" } as const;

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

const message = {
  ...msg,
  forType: 'for "%s"',
} as const;
