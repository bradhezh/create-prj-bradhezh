import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { log, spinner } from "@clack/prompts";

import { option, value, CLIDeployValue } from "./const";
import { regValue, meta, PosMode, NPM, Conf, Plugin } from "@/registry";
import { auth } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, `${this.label} for the frontend`));

  const conf0 = parseConf(conf);
  if (!conf0) {
    return;
  }
  const { npm, cwd, forToken } = conf0;

  await createVercel(npm, cwd, s);
  const { token } = await authVercel(forToken, s);
  (conf.frontend![value.deployment.vercel] as CLIDeployValue) = { token };

  log.info(format(message.pluginFinish, `${this.label} for the frontend`));
  s.stop();
}

const parseConf = (conf: Conf) => {
  if (!conf.git) {
    throw new Error();
  }
  if (!conf[conf.git]) {
    log.warn(message.noGit);
    return;
  }
  const npm = conf.npm;
  const cwd =
    conf.type !== meta.plugin.type.monorepo ? "." : conf.frontend?.name;
  if (!cwd) {
    throw new Error();
  }
  const forToken = !!conf.cicd;
  return { npm, cwd, forToken };
};

const createVercel = async (npm: NPM, cwd: string, s: Spinner) => {
  log.info(
    "todo: install vercel CLI, using it to create the project on Vercel and link to it.",
  );
  await Promise.resolve({ execSync, exec, command, npm, cwd, s });
};

const authVercel = async (forToken: boolean, s: Spinner) => {
  const { token } = await auth(
    { ...(!forToken ? {} : { token: tokenKey }) },
    {},
    message.token,
    tokenUrl,
    s,
  );
  if (forToken && !token) {
    throw new Error();
  }
  return { token };
};

const label = "Vercel" as const;

regValue(
  {
    name: value.deployment.vercel,
    label,
    skips: [{ type: meta.plugin.type.frontend, option: option.deploySrc }],
    keeps: [],
    requires: [{ option: meta.plugin.option.git }],
    plugin: {
      name: `${meta.plugin.type.frontend}_${meta.plugin.option.type.deployment}_${value.deployment.vercel}`,
      label,
      pos: {
        mode: PosMode.after,
        refs: [meta.plugin.option.git],
      },
      run,
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.frontend,
);

const exec = promisify(execAsync);

type Spinner = ReturnType<typeof spinner>;

const command = {
  install: "%s add -D vercel",
  login: "%s vercel login",
  link: "%s vercel link",
} as const;

const tokenKey = "vercelToken" as const;
const tokenUrl = "" as const;

const message = {
  ...msg,
  noGit:
    "Cannot work as expected because the plugin for the Git option has not run successfully.",
  token:
    "Token needed for automated integration.\nPress [ENTER] to open your browser and create a read-write token for CI/CD...\n",
} as const;
