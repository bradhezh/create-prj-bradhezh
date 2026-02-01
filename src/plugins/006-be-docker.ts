import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import open from "open";
import { createInterface } from "node:readline/promises";
import { group, text, password, cancel, log, spinner } from "@clack/prompts";

import { option, value, rtConf, RtConf, GitValue, GitData } from "./const";
import { regValue, meta, PosMode, NPM, Conf, Plugin } from "@/registry";
import { installTmplt, getConfig, setConfig } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, `${this.label} for the backend`));

  const npm = conf.npm;
  const monorepo = conf.type === meta.plugin.type.monorepo;
  const git = conf.git as GitValue;
  const gitData =
    git === value.git.github
      ? (conf[rtConf.github] as RtConf["github"])
      : undefined;

  if (!git || git === meta.plugin.value.none) {
    log.warn(message.noGit);
  } else if (git === value.git.github && gitData !== value.done) {
    log.warn(message.noGh);
  }
  await install(npm, monorepo);
  const { username, token, readToken } = await checkAuth(s);
  await setRepo(username, token, git, gitData);
  (conf.backend![rtConf.dkrUsername] as RtConf["dkrUsername"]) = username;
  (conf.backend![rtConf.dkrToken] as RtConf["dkrToken"]) = token;
  (conf.backend![rtConf.dkrReadToken] as RtConf["dkrReadToken"]) = readToken;

  log.info(format(message.pluginFinish, `${this.label} for the backend`));
  s.stop();
}

const install = async (npm: NPM, monorepo: boolean) => {
  await installTmplt(base, { ignore: template.ignore }, "ignore");
  if (monorepo) {
    await installTmplt(base, { monorepo: template.monorepo }, "monorepo");
  } else if (npm === NPM.npm) {
    await installTmplt(base, { npm: template.npm }, "npm");
  } else {
    await installTmplt(base, { default: template.default }, "default");
  }
};

const checkAuth = async (s: Spinner) => {
  let username = (await getConfig(usernameKey)) as string | undefined;
  let token = (await getConfig(tokenKey)) as string | undefined;
  let readToken = (await getConfig(readTokenKey)) as string | undefined;
  if (username && token && readToken) {
    return { username, token, readToken };
  }
  s.stop();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await rl.question(message.docker);
  rl.close();
  await open(authUrl);
  const answer = await group(
    {
      ...(username
        ? {}
        : {
            username: () =>
              text({
                message: message.usernameGot,
                validate: (value?: string) =>
                  value ? undefined : message.usernameRequired,
              }),
          }),
      ...(token
        ? {}
        : {
            token: () =>
              password({
                message: message.tokenGot,
                mask: "*",
                validate: (value?: string) =>
                  value ? undefined : message.tokenRequired,
              }),
          }),
      ...(readToken
        ? {}
        : {
            readToken: () =>
              password({
                message: message.readTokenGot,
                mask: "*",
                validate: (value?: string) =>
                  value ? undefined : message.readTokenRequired,
              }),
          }),
    },
    { onCancel },
  );
  s.start();
  void (
    username ||
    ((username = answer.username!) && (await setConfig(usernameKey, username)))
  );
  void (
    token ||
    ((token = answer.token!) && (await setConfig(tokenKey, token)))
  );
  void (
    readToken ||
    ((readToken = answer.readToken!) &&
      (await setConfig(readTokenKey, readToken)))
  );
  return { username, token, readToken };
};

const setRepo = async (
  username: string,
  token: string,
  git: GitValue,
  gitData: GitData,
) => {
  if (git === value.git.github && gitData === value.done) {
    await exec(command.gitAdd);
    await exec(command.gitCi);
    await exec(command.gitPush);
    await exec(format(command.ghSetSec, usernameSec, username));
    await exec(format(command.ghSetSec, tokenSec, token));
  }
};

const onCancel = () => {
  cancel(message.opCanceled);
  process.exit(0);
};

const label = "Docker Hub" as const;

regValue(
  {
    name: value.deploySrc.docker,
    label,
    skips: [],
    keeps: [],
    requires: [],
    plugin: {
      name: `${meta.plugin.type.backend}_${option.deploySrc}_${value.deploySrc.docker}`,
      label,
      pos: {
        mode: PosMode.after,
        refs: [meta.plugin.option.git],
      },
      run,
    },
  },
  option.deploySrc,
  meta.plugin.type.backend,
);

const exec = promisify(execAsync);

type Spinner = ReturnType<typeof spinner>;

const base =
  "https://raw.githubusercontent.com/bradhezh/prj-template/master" as const;

const template = {
  ignore: { name: ".dockerignore", path: "/docker/dockerignore" },
  monorepo: { name: "Dockerfile", path: "/docker/Dockerfile-mono" },
  npm: { name: "Dockerfile", path: "/docker/Dockerfile-npm" },
  default: { name: "Dockerfile", path: "/docker/Dockerfile" },
} as const;

const command = {
  gitAdd: "git add .",
  gitCi: 'git commit -m "Dockerfile and .dockerignore added"',
  gitPush: "git push",
  ghSetSec: "gh secret set %s --body %s",
} as const;

const usernameKey = "dkrUsername" as const;
const tokenKey = "dkrToken" as const;
const readTokenKey = "dkrReadToken" as const;
const usernameSec = "DOCKER_USERNAME" as const;
const tokenSec = "DOCKER_TOKEN" as const;
const authUrl =
  "https://app.docker.com/settings/personal-access-tokens" as const;

const message = {
  ...msg,
  docker:
    "Username and tokens needed for publishing and deployment of images on Docker Hub.\nPress [ENTER] to open your Docker Hub settings and create a read-write token for publishing and a read-only token for deploying the image...\n",
  usernameGot: "Paste your username: ",
  usernameRequired: "Username required.",
  tokenGot: "Paste your read-write token: ",
  tokenRequired: "Read-write token required.",
  readTokenGot: "Paste your read-only token: ",
  readTokenRequired: "Read-only token required.",
  noGit: "Git option invalid, dependent features might not work as expected.",
  noGh: "GitHub plugin has not succeeded, dependent features might not work as expected.",
} as const;
