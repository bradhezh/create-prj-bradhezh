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
  setWkspaceBuiltDeps,
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
  log.info(message.setWkspace);
  await setWkspace();
  conf[value.test.jest] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

type Conf0 = { npm: NPM; monorepo: boolean; shared: boolean };

const parseConf = (conf: Conf) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const shared = (conf.monorepo?.types.length ?? 0) > 1;
  return { npm, monorepo, shared };
};

const parseType = async (conf: Conf, { monorepo, shared }: Conf0) => {
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
        backend: e === meta.plugin.type.backend,
      };
    })
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
  return types;
};

type InstallData = {
  typeFrmwk: TypeFrmwk;
  ts: Ts;
  shared: boolean;
  cwd: string;
};

const install = async ({ typeFrmwk, ts, shared, cwd }: InstallData) => {
  if (typeFrmwk === value.framework.nest) {
    await installTmplt(base, nestTmplt, shared ? "shared" : defKey, cwd);
  } else if (typeFrmwk === meta.system.type.shared) {
    await installTmplt(base, sharedTmplt, ts, cwd);
  } else {
    const tmplt = template[ts ?? defKey] ?? template.def;
    if (!tmplt) {
      throw new Error();
    }
    const tmplt0 =
      tmplt[
        typeFrmwk === meta.plugin.type.lib || typeFrmwk === meta.plugin.type.cli
          ? "pkg"
          : typeFrmwk
      ] ?? tmplt.def;
    if (!tmplt0) {
      throw new Error();
    }
    await installTmplt(base, tmplt0, shared ? "shared" : defKey, cwd);
  }
  const tmplt = srcTmplt[typeFrmwk] ?? srcTmplt.def;
  if (!tmplt) {
    throw new Error();
  }
  await installTmplt(base, tmplt, ts, cwd, true);
};

type PkgData = {
  ts: Ts;
  backend: boolean;
  typeFrmwk: TypeFrmwk;
  npm: NPM;
  cwd: string;
};

const setPkg = async ({ ts, backend, typeFrmwk, npm, cwd }: PkgData) => {
  await setPkgScripts({ scripts }, "scripts", npm, cwd);
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

type MonoData = { monorepo: boolean; npm: NPM };

const setMono = async ({ monorepo, npm }: MonoData) => {
  if (monorepo) {
    await setPkgScripts({ monoScripts }, "monoScripts", npm);
  }
};

const setWkspace = async () => {
  await setWkspaceBuiltDeps({ builtDeps }, "builtDeps");
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

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/jest" as const;
const name = "jest.config.js" as const;

type Ts =
  | keyof typeof value.typescript
  | typeof meta.plugin.value.none
  | undefined;
type TsKey = NonNullable<Ts> | typeof defKey;
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
  Record<TsKey, Partial<Record<TypeFrmwkKey, Template<"shared">>>>
> = {
  none: { def: { def: { name, path: "/cfg/no/jest.config.js" } } },
  metadata: {
    pkg: {
      shared: { name, path: "/cfg/meta/pkg/shrd/jest.config.js" },
      def: { name, path: "/cfg/meta/pkg/no/jest.config.js" },
    },
    def: {
      shared: { name, path: "/cfg/meta/def/shrd/jest.config.js" },
      def: { name, path: "/cfg/meta/def/no/jest.config.js" },
    },
  },
  def: {
    pkg: {
      shared: { name, path: "/cfg/ndec/pkg/shrd/jest.config.js" },
      def: { name, path: "/cfg/ndec/pkg/no/jest.config.js" },
    },
    def: {
      shared: { name, path: "/cfg/ndec/def/shrd/jest.config.js" },
      def: { name, path: "/cfg/ndec/def/no/jest.config.js" },
    },
  },
} as const;

const sharedTmplt = {
  none: { name, path: "/cfg/no/jest.config.js" },
  def: { name, path: "/cfg/shrd/jest.config.js" },
} as const;

const nestTmplt = {
  shared: { name, path: "/cfg/meta/def/shrd/jest.config.js" },
  def: { name, path: "/cfg/meta/def/no/jest.config.js" },
} as const;

const srcTmplt: Partial<Record<TypeFrmwk | typeof defKey, Template<TsKey>>> = {
  nest: { def: { name: "jest.tar", path: "/src/nest/jest.tar" } },
  express: {
    none: { name: "jest.tar", path: "/src/expr/js/jest.tar" },
    def: { name: "jest.tar", path: "/src/expr/ts/jest.tar" },
  },
  def: {
    none: { name: "jest.tar", path: "/src/def/js/jest.tar" },
    def: { name: "jest.tar", path: "/src/def/ts/jest.tar" },
  },
} as const;

const scripts = [{ name: "test", script: "jest --passWithNoTests" }] as const;
const monoScripts = [{ name: "test", script: "pnpm -r test" }] as const;

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
