import { exec as execAsync } from "node:child_process";
import { promisify, format } from "node:util";
import { create, AxiosInstance } from "axios";
import open from "open";
import { createInterface } from "node:readline/promises";
import { group, password, cancel, log, spinner } from "@clack/prompts";

import {
  option,
  value,
  rtConf,
  RtConf,
  DeploySrcValue,
  DeploySrcData,
  DkrData,
  GitValue,
  GitData,
} from "./const";
import { regValue, meta, PosMode, Conf, Plugin, PluginType } from "@/registry";
import { getConfig, setConfig } from "@/command";
import { message as msg } from "@/message";

async function run(this: Plugin, conf: Conf) {
  const s = spinner();
  s.start();
  log.info(format(message.pluginStart, `${this.label} for the backend`));

  const name = conf[conf.type as PluginType]?.name ?? conf.type;
  const src = conf.backend![option.deploySrc] as DeploySrcValue;
  const srcData =
    src === value.deploySrc.docker
      ? {
          username: conf.backend![rtConf.dkrUsername] as RtConf["dkrUsername"],
          token: conf.backend![rtConf.dkrReadToken] as RtConf["dkrReadToken"],
        }
      : src === value.deploySrc.example
        ? (conf.backend![rtConf.example] as RtConf["example"])
        : undefined;
  const git = conf.git as GitValue;
  const gitData =
    git === value.git.github
      ? (conf[rtConf.github] as RtConf["github"])
      : undefined;

  if (!src || (src as string) === meta.plugin.value.none) {
    log.warn(message.noSrc);
  } else if (src === value.deploySrc.docker) {
    const data = srcData as DkrData;
    if (!data.username || !data.token) {
      log.warn(message.noDkr);
    }
  }
  if (!git || git === meta.plugin.value.none) {
    log.warn(message.noGit);
  } else if (git === value.git.github && gitData !== value.done) {
    log.warn(message.noGh);
  }
  const token = await checkAuth(s);
  const { owner, svc, cred } = await createRender(name, token, src, srcData);
  await setRepo(token, owner, svc, cred, git, gitData, src);

  log.info(format(message.pluginFinish, `${this.label} for the backend`));
  s.stop();
}

const checkAuth = async (s: Spinner) => {
  let token = (await getConfig(tokenKey)) as string | undefined;
  if (token) {
    return token;
  }
  s.stop();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await rl.question(message.token);
  rl.close();
  await open(tokenUrl);
  token = (
    await group(
      {
        token: () =>
          password({
            message: message.tokenGot,
            mask: "*",
            validate: (value?: string) =>
              value ? undefined : message.tokenRequired,
          }),
      },
      { onCancel },
    )
  ).token;
  s.start();
  await setConfig(tokenKey, token);
  return token;
};

const createRender = async (
  name: string,
  token: string,
  src: DeploySrcValue,
  srcData: DeploySrcData,
) => {
  const api = create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const owner = await getOwner(api);
  if (!owner) {
    return {};
  }
  let cred;
  if (src === value.deploySrc.docker) {
    const data = srcData as DkrData;
    if (data.username && data.token) {
      cred = await getDkrCred(api, owner, data.username, data.token);
    }
  }
  return { owner, svc: await createSvc(api, owner, name, src, cred), cred };
};

const setRepo = async (
  token: string,
  owner?: string,
  svc?: string,
  cred?: string,
  git?: GitValue,
  gitData?: GitData,
  src?: DeploySrcValue,
) => {
  if (git === value.git.github && gitData === value.done) {
    await exec(format(command.ghSetSec, tokenSec, token));
    void (owner && (await exec(format(command.ghSetSec, ownerSec, owner))));
    void (svc && (await exec(format(command.ghSetSec, svcSec, svc))));
    if (src === value.deploySrc.docker && cred) {
      await exec(format(command.ghSetSec, credSec, cred));
    }
  }
};

const getOwner = async (api: AxiosInstance) => {
  const owner = (await getConfig(ownerKey)) as string | undefined;
  if (owner) {
    return owner;
  }
  const { data } = await api.get(ownersEp);
  if (!data.length) {
    log.warn(message.noOwner);
    return;
  }
  await setConfig(ownerKey, data[0].owner.id);
  return data[0].owner.id as string;
};

const getDkrCred = async (
  api: AxiosInstance,
  owner: string,
  dkrUsername: string,
  dkrToken: string,
) => {
  let cred = (await getConfig(dkrCredKey)) as string | undefined;
  if (cred) {
    return cred;
  }
  const { data } = await api.get(credsEp, { params: { name: dkrCredName } });
  if (data.length) {
    cred = data[0].id as string;
  } else {
    cred = (
      await api.post(credsEp, {
        ownerId: owner,
        name: dkrCredName,
        registry: dkrRegistry,
        username: dkrUsername,
        authToken: dkrToken,
      })
    ).data.id as string;
  }
  await setConfig(dkrCredKey, cred);
  return cred;
};

const createSvc = async (
  api: AxiosInstance,
  owner: string,
  name: string,
  src: DeploySrcValue,
  cred?: string,
) => {
  const { data } = await api.post(svcsEp, {
    ownerId: owner,
    name,
    type: svcType,
    ...(src === value.deploySrc.docker
      ? {
          image: {
            ownerId: owner,
            imagePath: dkrImg,
            registryCredentialId: cred,
          },
        }
      : {}),
    serviceDetails: {
      runtime: src === value.deploySrc.docker ? runtimeImg : runtimeNode,
      plan,
      region,
      healthCheckPath,
    },
    autoDeploy: "no",
  });
  return data.service.id as string;
};

const onCancel = () => {
  cancel(message.opCanceled);
  process.exit(0);
};

const label = "Render.com" as const;

regValue(
  {
    name: value.deployment.render,
    label,
    skips: [{ option: option.reactDeploy, type: meta.plugin.type.frontend }],
    keeps: [],
    requires: [
      { option: meta.plugin.option.git },
      { option: meta.plugin.option.cicd },
    ],
    plugin: {
      name: `${meta.plugin.type.backend}_${meta.plugin.option.type.deployment}_${value.deployment.render}`,
      label,
      pos: {
        mode: PosMode.after,
        refs: [
          `${meta.plugin.type.backend}_${option.deploySrc}`,
          meta.plugin.option.git,
        ],
      },
      run,
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.backend,
);

const exec = promisify(execAsync);

type Spinner = ReturnType<typeof spinner>;

const command = { ghSetSec: "gh secret set %s --body %s" } as const;

const ownerKey = "renderOwner" as const;
const dkrCredKey = "renderDkrCred" as const;
const tokenKey = "renderToken" as const;
const tokenSec = "RENDER_API_KEY" as const;
const svcSec = "RENDER_SERVICE_ID" as const;
const ownerSec = "RENDER_OWNER_ID" as const;
const credSec = "RENDER_CRED_ID" as const;
const tokenUrl = "https://dashboard.render.com/u/settings#api-keys" as const;
const baseURL = "https://api.render.com/v1" as const;
const ownersEp = "/owners" as const;
const credsEp = "/registrycredentials" as const;
const svcsEp = "/services" as const;
const dkrCredName = "bradhezh-cli-docker-deploy" as const;
const dkrRegistry = "DOCKER" as const;
const dkrImg = "docker.io/library/alpine:latest" as const;
const svcType = "web_service" as const;
const runtimeImg = "image" as const;
const runtimeNode = "node" as const;
const plan = "free" as const;
const region = "oregon" as const;
const healthCheckPath = "/api" as const;

const message = {
  ...msg,
  token:
    "API key needed for deployment on Render.com.\nPress [ENTER] to open your Render settings and create an API key...\n",
  tokenGot: "Paste your API key: ",
  tokenRequired: "Token required.",
  noGit: "Git option invalid, dependent features might not work as expected.",
  noGh: "GitHub plugin has not succeeded, dependent features might not work as expected.",
  noSrc:
    "Backend deployment source option invalid, dependent features might not work as expected.",
  noDkr:
    "Docker Hub plugin has not succeeded, dependent features might not work as expected.",
  noOwner: "No workspaces found. Please check your account on Render.com.",
} as const;
