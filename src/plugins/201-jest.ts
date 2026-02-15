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
  defKey,
  Template,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const { monorepo, shared, types, npm } = await parseConf(conf);

  for (const { typeFrmwk, name, cwd, ts, backend } of types) {
    log.info(format(message.forType, name));
    await install(ts, typeFrmwk, shared, cwd);
    log.info(message.setPkg);
    await setPkgScripts({ def: scripts.default }, "def", npm, cwd);
    await jestSetPkgDeps(ts, backend, typeFrmwk, npm, cwd);
  }
  if (monorepo) {
    await setPkgScripts({ mono: scripts.monorepo }, "mono", npm);
  }
  log.info(message.setWkspace);
  await setWkspaceBuiltDeps({ builtDeps }, "builtDeps");
  conf[value.test.jest] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = async (conf: Conf) => {
  const types0 = (conf.monorepo?.types ?? [conf.type]) as PrimeType[];
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const shared = types0.length > 1;
  const types1 = types0
    .map((e) => ({
      typeFrmwk: (conf[e]?.framework ?? e) as TypeFrmwk,
      name: conf[e]?.name as string,
      cwd: (!monorepo ? "." : conf[e]?.name) as string,
      ts: conf[e]?.typescript as TsValue,
      backend: e === meta.plugin.type.backend,
    }))
    .filter(
      (e) =>
        !typeFrmwksSkip(undefined, meta.plugin.option.test, undefined).includes(
          e.typeFrmwk,
        ),
    );
  const types = !shared
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
          backend: false,
        },
      ];
  if (types.find((e) => !e.name)) {
    throw new Error();
  }
  const npm = conf.npm;
  return { monorepo, shared, types, npm };
};

const install = async (
  ts: TsValue,
  typeFrmwk: TypeFrmwk,
  shared: boolean,
  cwd: string,
) => {
  if (typeFrmwk === value.framework.nest) {
    await installTmplt(base, nestTmplt, shared ? "shared" : defKey, cwd);
  } else if (typeFrmwk === meta.system.type.shared) {
    await installTmplt(base, sharedTmplt, ts, cwd);
  } else {
    const tmplt = template[ts ?? defKey] ?? template.default;
    if (!tmplt) {
      throw new Error();
    }
    const tmplt0 =
      tmplt[
        typeFrmwk === meta.plugin.type.lib || typeFrmwk === meta.plugin.type.cli
          ? "pkg"
          : typeFrmwk
      ] ?? tmplt.default;
    if (!tmplt0) {
      throw new Error();
    }
    await installTmplt(base, tmplt0, shared ? "shared" : defKey, cwd);
  }
  const tmplt = srcTmplt[typeFrmwk] ?? srcTmplt.default;
  if (!tmplt) {
    throw new Error();
  }
  await installTmplt(base, tmplt, ts, cwd);
};

const jestSetPkgDeps = async (
  ts: TsValue,
  backend: boolean,
  typeFrmwk: TypeFrmwk,
  npm: NPM,
  cwd: string,
) => {
  await setPkgDeps({ pkgDeps }, "pkgDeps", npm, cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps({ tsPkgDeps }, "tsPkgDeps", npm, cwd);
  }
  if (backend) {
    await setPkgDeps({ bePkgDeps }, "bePkgDeps", npm, cwd);
    if (ts !== meta.plugin.value.none) {
      await setPkgDeps({ beTsPkgDeps }, "beTsPkgDeps", npm, cwd);
    }
  }
  if (typeFrmwk === value.framework.nest) {
    await setPkgDeps({ nestPkgDeps }, "nestPkgDeps", npm, cwd);
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

type TypeFrmwk =
  | PrimeType
  | typeof meta.system.type.shared
  | NonNullable<FrmwkValue>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/jest" as const;
const name = "jest.config.js" as const;

const nestTmplt = {
  shared: { name, path: "/cfg/meta/def/shrd/jest.config.js" },
  default: { name, path: "/cfg/meta/def/no/jest.config.js" },
} as const;

const sharedTmplt = {
  none: { name, path: "/cfg/no/jest.config.js" },
  default: { name, path: "/cfg/shrd/jest.config.js" },
} as const;

const template: Partial<
  Record<
    NonNullable<TsValue> | typeof defKey,
    Partial<
      Record<
        | Exclude<
            TypeFrmwk,
            typeof meta.plugin.type.lib | typeof meta.plugin.type.cli
          >
        | "pkg"
        | typeof defKey,
        Template<"shared" | typeof defKey>
      >
    >
  >
> = {
  none: { default: { default: { name, path: "/cfg/no/jest.config.js" } } },
  metadata: {
    pkg: {
      shared: { name, path: "/cfg/meta/pkg/shrd/jest.config.js" },
      default: { name, path: "/cfg/meta/pkg/no/jest.config.js" },
    },
    default: {
      shared: { name, path: "/cfg/meta/def/shrd/jest.config.js" },
      default: { name, path: "/cfg/meta/def/no/jest.config.js" },
    },
  },
  default: {
    pkg: {
      shared: { name, path: "/cfg/ndec/pkg/shrd/jest.config.js" },
      default: { name, path: "/cfg/ndec/pkg/no/jest.config.js" },
    },
    default: {
      shared: { name, path: "/cfg/ndec/def/shrd/jest.config.js" },
      default: { name, path: "/cfg/ndec/def/no/jest.config.js" },
    },
  },
} as const;

const srcTmplt: Partial<
  Record<TypeFrmwk | typeof defKey, Template<NonNullable<TsValue>>>
> = {
  nest: { default: { name: "jest.tar", path: "/src/nest/jest.tar" } },
  express: {
    none: { name: "jest.tar", path: "/src/expr/js/jest.tar" },
    default: { name: "jest.tar", path: "/src/expr/ts/jest.tar" },
  },
  default: {
    none: { name: "jest.tar", path: "/src/def/js/jest.tar" },
    default: { name: "jest.tar", path: "/src/def/ts/jest.tar" },
  },
} as const;

const scripts = {
  monorepo: [{ name: "test", script: "pnpm -r test" }],
  default: [{ name: "test", script: "jest --passWithNoTests" }],
} as const;

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
