import { execSync, exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { log, spinner } from "@clack/prompts";

import { value, CLIDeployValue } from "./const";
import { regValue, meta, NPM, Conf, Plugin } from "@/registry";
import { auth } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, `${this.label} for the mobile`));

  const { npm, cwd, forToken } = parseConf(conf);

  await createExpo(npm, cwd, s);
  const { token } = await authExpo(forToken, s);
  (conf.mobile![value.deployment.expo] as CLIDeployValue) = { token };

  log.info(format(message.pluginFinish, `${this.label} for the mobile`));
  s.stop();
}

const parseConf = (conf: Conf) => {
  const npm = conf.npm;
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : conf.mobile?.name;
  if (!cwd) {
    throw new Error();
  }
  const forToken = !!conf.cicd;
  return { npm, cwd, forToken };
};

const createExpo = async (npm: NPM, cwd: string, s: Spinner) => {
  log.info(
    "todo: install eas CLI, using it to create the project on Expo and link to it.",
  );
  await Promise.resolve({ execSync, exec, command, npm, cwd, s });
};

const authExpo = async (forToken: boolean, s: Spinner) => {
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

const label = "Expo" as const;

regValue(
  {
    name: value.deployment.expo,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.type.mobile}_${meta.plugin.option.type.deployment}_${value.deployment.expo}`,
      label,
      run,
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.mobile,
);

const exec = promisify(execAsync);

type Spinner = ReturnType<typeof spinner>;

const command = {
  install: "%s add -D eas-cli",
  login: "%s eas login",
  link: "%s eas build:configure",
} as const;

const tokenKey = "expoToken" as const;
const tokenUrl = "" as const;

const message = {
  ...msg,
  token:
    "Token needed for automated integration.\nPress [ENTER] to open your browser and create a read-write token for CI/CD...\n",
} as const;
