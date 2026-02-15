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
  defKey,
  Template,
} from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const { types, npm } = parseConf(conf);

  for (const { typeFrmwk, name, cwd, ts } of types) {
    log.info(format(message.forType, name));
    await install(typeFrmwk, ts, cwd);
    log.info(message.setPkg);
    await setPkgScripts(scripts, typeFrmwk, npm, cwd);
    await rsSetPkgDeps(ts, npm, cwd);
  }
  conf[value.builder.rspack] = {};

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const parseConf = (conf: Conf) => {
  const types = ((conf.monorepo?.types ?? [conf.type]) as PrimeType[])
    .map((e) => ({
      typeFrmwk: (conf[e]?.framework ?? e) as TypeFrmwk,
      name: conf[e]?.name as string,
      cwd: (conf.type !== meta.plugin.type.monorepo
        ? "."
        : conf[e]?.name) as string,
      ts: conf[e]?.typescript as TsValue,
    }))
    .filter(
      (e) =>
        !typeFrmwksSkip(
          undefined,
          meta.plugin.option.builder,
          undefined,
        ).includes(e.typeFrmwk),
    );
  if (types.find((e) => !e.name)) {
    throw new Error();
  }
  const npm = conf.npm;
  return { types, npm };
};

const install = async (typeFrmwk: TypeFrmwk, ts: TsValue, cwd: string) => {
  const tmplt = template[typeFrmwk] ?? template.default;
  if (!tmplt) {
    throw new Error();
  }
  await installTmplt(base, tmplt, ts, cwd);
};

const rsSetPkgDeps = async (ts: TsValue, npm: NPM, cwd: string) => {
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

type TypeFrmwk = PrimeType | NonNullable<FrmwkValue>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/rspk" as const;
const name = "rspack.config.ts" as const;
const nameJs = "rspack.config.js" as const;

const template: Partial<
  Record<TypeFrmwk | typeof defKey, Template<NonNullable<TsValue>>>
> = {
  nest: { default: { name, path: "/be/meta/rspack.config.ts" } },
  lib: {
    none: { name: nameJs, path: "/lib/no/rspack.config.js" },
    metadata: { name, path: "/lib/meta/rspack.config.ts" },
    default: { name, path: "/lib/ndec/rspack.config.ts" },
  },
  cli: {
    none: { name: nameJs, path: "/cli/no/rspack.config.js" },
    metadata: { name, path: "/cli/meta/rspack.config.ts" },
    default: { name, path: "/cli/ndec/rspack.config.ts" },
  },
  express: {
    none: { name: nameJs, path: "/be/no/rspack.config.js" },
    metadata: { name, path: "/be/meta/rspack.config.ts" },
    default: { name, path: "/be/ndec/rspack.config.ts" },
  },
  default: {
    none: { name: nameJs, path: "/def/no/rspack.config.js" },
    metadata: { name, path: "/def/meta/rspack.config.ts" },
    default: { name, path: "/def/ndec/rspack.config.ts" },
  },
} as const;

const scripts = {
  lib: [
    {
      name: "build",
      script:
        'rspack build && pnpm dlx del-cli "dist/*.d.ts" "!dist/index.d.ts"',
    },
    { name: "dev", script: "rspack dev" },
    { name: "dev:cli", script: "CLI=true rspack dev" },
  ],
  cli: [
    { name: "build", script: "rspack build" },
    { name: "dev", script: "rspack dev" },
  ],
  default: [
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
