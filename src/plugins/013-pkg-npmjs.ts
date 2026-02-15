import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { log, spinner } from "@clack/prompts";

import { value } from "./const";
import { regValue, meta, NPM, Conf, Plugin, PrimeType } from "@/registry";
import { message } from "@/message";

const run = (type: PrimeType) => {
  return async function (this: Plugin, conf: Conf) {
    const s = spinner();
    s.start();
    log.info(format(message.pluginStart, `${this.label} for the ${type}`));

    const { npm, cwd } = parseConf(conf, type);

    await createNpmjs(npm, cwd, s);
    conf[type]![value.deployment.npmjs] = {};

    log.info(format(message.pluginFinish, `${this.label} for the ${type}`));
    s.stop();
  };
};

const parseConf = (conf: Conf, type: PrimeType) => {
  if (
    type === meta.plugin.type.cli &&
    conf.lib?.deployment === value.deployment.npmjs
  ) {
    throw new Error();
  }
  const npm = conf.npm;
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : conf[type]?.name;
  if (!cwd) {
    throw new Error();
  }
  return { npm, cwd };
};

const createNpmjs = async (npm: NPM, cwd: string, s: Spinner) => {
  log.info(
    "todo: build and publish the package initially, and then set the cicd as the trusted publisher on npmjs.",
  );
  await Promise.resolve({ execSync, exec, command, npm, cwd, s });
};

const label = "npmjs" as const;

regValue(
  {
    name: value.deployment.npmjs,
    label,
    skips: [
      {
        type: meta.plugin.type.cli,
        option: meta.plugin.option.type.deployment,
      },
    ],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.type.lib}_${meta.plugin.option.type.deployment}_${value.deployment.npmjs}`,
      label,
      run: run(meta.plugin.type.lib),
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.lib,
);
regValue(
  {
    name: value.deployment.npmjs,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.type.cli}_${meta.plugin.option.type.deployment}_${value.deployment.npmjs}`,
      label,
      run: run(meta.plugin.type.cli),
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.cli,
);

const exec = promisify(execAsync);

type Spinner = ReturnType<typeof spinner>;

const command = {
  install: "%s i",
  build: "%s build",
  login: "%s login",
  publish: "%s publish --access public",
} as const;
