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
  const types = parseType(conf);

  for (const type of types) {
    log.info(format(message.forType, type.name));
    await install({ ...conf0, ...type });
    log.info(message.setPkg);
    await setPkg({ ...conf0, ...type });
  }
  conf[value.builder.rspack] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  return { npm };
};

const parseType = (conf: Conf) => {
  const types = ((conf.monorepo?.types ?? [conf.type]) as PrimeType[])
    .map((e) => {
      const name = conf[e]?.name;
      if (!name) {
        throw new Error();
      }
      return {
        typeFrmwk: (conf[e]?.framework ?? e) as TypeFrmwk,
        name,
        cwd: conf.type !== meta.plugin.type.monorepo ? "." : name,
        ts: conf[e]?.typescript as Ts,
      };
    })
    .filter(
      (e) =>
        !typeFrmwksSkip(
          undefined,
          meta.plugin.option.builder,
          undefined,
        ).includes(e.typeFrmwk),
    );
  return types;
};

type InstallData = { typeFrmwk: TypeFrmwk; ts: Ts; cwd: string };

const install = async ({ typeFrmwk, ts, cwd }: InstallData) => {
  const tmplt = template[typeFrmwk] ?? template.def;
  if (!tmplt) {
    throw new Error();
  }
  await installTmplt(base, tmplt, ts, cwd);
};

type PkgData = { typeFrmwk: TypeFrmwk; ts: Ts; npm: NPM; cwd: string };

const setPkg = async ({ typeFrmwk, ts, npm, cwd }: PkgData) => {
  await setPkgScripts(scripts, typeFrmwk, npm, cwd);
  await setPkgDeps({ pkgDeps }, "pkgDeps", npm, cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps({ tsPkgDeps }, "tsPkgDeps", npm, cwd);
  }
};

const label = "Rspack" as const;

regValue(
  {
    name: value.builder.rspack,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.option.builder}_${value.builder.rspack}`,
      label,
      run,
    },
  },
  meta.plugin.option.builder,
);

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/rspk" as const;
const name = "rspack.config.ts" as const;
const nameJs = "rspack.config.js" as const;

type TypeFrmwk = PrimeType | keyof typeof value.framework;
type TypeFrmwkKey = TypeFrmwk | typeof defKey;
type Ts =
  | keyof typeof value.typescript
  | typeof meta.plugin.value.none
  | undefined;
type TsKey = NonNullable<Ts> | typeof defKey;
const template: Partial<Record<TypeFrmwkKey, Template<TsKey>>> = {
  nest: { def: { name, path: "/be/meta/rspack.config.ts" } },
  express: {
    none: { name: nameJs, path: "/be/no/rspack.config.js" },
    metadata: { name, path: "/be/meta/rspack.config.ts" },
    def: { name, path: "/be/ndec/rspack.config.ts" },
  },
  lib: {
    none: { name: nameJs, path: "/lib/no/rspack.config.js" },
    metadata: { name, path: "/lib/meta/rspack.config.ts" },
    def: { name, path: "/lib/ndec/rspack.config.ts" },
  },
  cli: {
    none: { name: nameJs, path: "/cli/no/rspack.config.js" },
    metadata: { name, path: "/cli/meta/rspack.config.ts" },
    def: { name, path: "/cli/ndec/rspack.config.ts" },
  },
  def: {
    none: { name: nameJs, path: "/def/no/rspack.config.js" },
    metadata: { name, path: "/def/meta/rspack.config.ts" },
    def: { name, path: "/def/ndec/rspack.config.ts" },
  },
} as const;

const scripts = {
  lib: [
    {
      name: "build",
      script:
        "rspack build && pnpm dlx del-cli 'dist/*.d.ts' '!dist/index.d.ts'",
    },
    { name: "dev", script: "rspack dev" },
    { name: "dev:cli", script: "CLI=true rspack dev" },
  ],
  cli: [
    { name: "build", script: "rspack build" },
    { name: "dev", script: "rspack dev" },
  ],
  def: [
    { name: "build", script: "rspack build" },
    { name: "dev", script: "rspack dev" },
    { name: "start", script: "node build/main.js" },
  ],
} as const;

const pkgDeps = [
  { name: "@rspack/cli", version: "^1", dev: true },
  { name: "@rspack/core", version: "^1", dev: true },
  { name: "run-script-webpack-plugin", version: "^0", dev: true },
  { name: "webpack-node-externals", version: "^3", dev: true },
] as const;

const tsPkgDeps = [
  { name: "@types/webpack-node-externals", version: "^3", dev: true },
  { name: "ts-checker-rspack-plugin", version: "^1", dev: true },
] as const;

const message = {
  ...msg,
  forType: 'for "%s"',
} as const;
