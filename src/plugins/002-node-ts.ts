import { rm } from "node:fs/promises";
import { join } from "node:path";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import { value, TsValue } from "./const";
import { regOption, meta, NPM, Conf, Plugin } from "@/registry";
import { setTsOptions, installTmplt, setPkgName, setPkgVers } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, this.label));

  const npm = conf.npm;
  const name = conf.node!.name ?? meta.plugin.type.node;
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : name;
  const ts = conf.node!.typescript as Ts;

  await reinstall(npm, name, ts, cwd);

  log.info(format(message.pluginFinish, this.label));
  s.stop();
}

const reinstall = async (npm: NPM, name: string, ts: Ts, cwd: string) => {
  if (ts === value.typescript.metadata) {
    await setTsOptions(
      { experimentalDecorators: true, emitDecoratorMetadata: true },
      cwd,
    );
  } else if (ts === meta.plugin.value.none) {
    log.info(message.reinstall);
    for (const replace of replaces) {
      await rm(join(cwd, replace), { recursive: true, force: true });
    }
    await installTmplt(base, { node: template }, "node", cwd, true);
    await setPkgName(npm, name, cwd);
    await setPkgVers(npm, cwd);
  }
};

const label = "Typescript for Node.js app" as const;

regOption(
  {
    name: meta.plugin.option.type.typescript,
    label,
    plugin: {
      name: `${meta.plugin.type.node}_${meta.plugin.option.type.typescript}`,
      label,
      run,
    },
    values: [
      {
        name: value.typescript.nodec,
        label: "No decorator",
        skips: [],
        keeps: [],
        requires: [],
      },
      {
        name: value.typescript.metadata,
        label: "Decorator with emitDecoratorMetadata",
        skips: [],
        keeps: [],
        requires: [],
      },
      {
        name: meta.plugin.value.none,
        label: "None",
        skips: [],
        keeps: [],
        requires: [],
      },
    ],
  },
  meta.system.option.category.type,
  meta.plugin.type.node,
);

type Ts = NonNullable<TsValue>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master/type/node/js/node.tar" as const;
const template = { name: "node.tar" } as const;

const replaces = ["package.json", "tsconfig.json", "src"] as const;

const message = {
  ...msg,
  reinstall: "Replacing Typescript files with Javascript ones",
} as const;
