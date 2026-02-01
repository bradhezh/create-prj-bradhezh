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
import { installTmplt, setPkgScripts, setPkgDeps, Template } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const npm = conf.npm;
  const types = (conf.monorepo?.types ?? [conf.type]) as PrimeType[];
  const skips = typeFrmwksSkip(meta.plugin.option.builder);

  for (const type of types) {
    const typeFrmwk = (conf[type]?.framework ?? type) as TypeFrmwk;
    if (skips.includes(typeFrmwk)) {
      continue;
    }

    const name = conf[type]?.name ?? type;
    const cwd = conf.type !== meta.plugin.type.monorepo ? "." : name;
    const ts = conf[type]?.typescript as TsValue;

    log.info(format(message.forType, name));
    await install(typeFrmwk, ts, cwd);

    log.info(message.setPkg);
    await setPkgScripts(npm, scripts, typeFrmwk, cwd);
    await rsSetPkgDeps(npm, ts, cwd);
  }

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const install = async (typeFrmwk: TypeFrmwk, ts: TsValue, cwd: string) => {
  if (typeFrmwk === value.framework.nest) {
    await installTmplt(base, { nest: nestTmplt }, "nest", cwd);
  } else {
    const tmplt = template[ts ?? "default"] ?? template.default!;
    await installTmplt(base, tmplt, typeFrmwk, cwd);
  }
};

const rsSetPkgDeps = async (npm: NPM, ts: TsValue, cwd: string) => {
  await setPkgDeps(npm, { default: pkgDeps }, "default", cwd);
  if (ts !== meta.plugin.value.none) {
    await setPkgDeps(npm, { default: tsPkgDeps }, "default", cwd);
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
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/rspack" as const;

const nestTmplt = {
  name: "rspack.config.ts",
  path: "/rspack-be-dec.config.ts",
} as const;

const template: Partial<
  Record<NonNullable<TsValue> | "default", Template<Exclude<TypeFrmwk, "nest">>>
> = {
  none: {
    cli: { name: "rspack.config.js", path: "/rspack-cli.config.js" },
    lib: { name: "rspack.config.js", path: "/rspack-lib.config.js" },
    express: { name: "rspack.config.js", path: "/rspack-be.config.js" },
    default: { name: "rspack.config.js", path: "/rspack.config.js" },
  },
  metadata: {
    cli: { name: "rspack.config.ts", path: "/rspack-cli-dec.config.ts" },
    lib: { name: "rspack.config.ts", path: "/rspack-lib-dec.config.ts" },
    express: { name: "rspack.config.ts", path: "/rspack-be-dec.config.ts" },
    default: { name: "rspack.config.ts", path: "/rspack-dec.config.ts" },
  },
  default: {
    cli: { name: "rspack.config.ts", path: "/rspack-cli.config.ts" },
    lib: { name: "rspack.config.ts", path: "/rspack-lib.config.ts" },
    express: { name: "rspack.config.ts", path: "/rspack-be.config.ts" },
    default: { name: "rspack.config.ts", path: "/rspack.config.ts" },
  },
} as const;

const scripts = {
  cli: [
    { name: "build", script: "rspack build" },
    { name: "dev", script: "rspack dev" },
  ],
  lib: [
    {
      name: "build",
      script:
        'rspack build && pnpm dlx del-cli "dist/*.d.ts" "!dist/index.d.ts"',
    },
    { name: "dev", script: "rspack dev" },
    { name: "dev:cli", script: "CLI=true rspack dev" },
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
