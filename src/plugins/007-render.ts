import { create, AxiosInstance } from "axios";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import {
  option,
  value,
  RenderValue,
  DeploySrcValue,
  DkrValue,
  DeploySrcConf,
  GitSvcValue,
  GitConf,
} from "./const";
import { regValue, meta, PosMode, Conf, Plugin, PrimeType } from "@/registry";
import { auth, getConfig, setConfig } from "@/command";
import { message as msg } from "@/message";

const run = (type: PrimeType) => {
  return async function (this: Plugin, conf: Conf) {
    const s = spinner();
    s.start();
    log.info(format(message.pluginStart, `${this.label} for the ${type}`));

    const conf0 = parseConf(conf, type);
    if (!conf0) {
      return;
    }
    const { name, src, srcData } = conf0;

    const { token } = await authRender(s);
    log.info(message.createRender);
    const { owner, service, cred } = await createRender(
      name,
      token,
      src,
      srcData,
    );
    (conf[type]![value.deployment.render] as RenderValue) = {
      owner,
      service,
      token,
      cred,
    };

    log.info(format(message.pluginFinish, `${this.label} for the ${type}`));
    s.stop();
  };
};

const parseConf = (conf: Conf, type: PrimeType) => {
  if (
    conf.backend?.deployment === value.deployment.render &&
    conf.frontend?.deployment === value.deployment.render
  ) {
    throw new Error();
  }
  const name = conf[conf.type as PrimeType]?.name;
  if (!name) {
    throw new Error();
  }
  const src = conf[type]![option.deploySrc] as DeploySrcValue;
  let srcData;
  if (src === value.deploySrc.dkrhub) {
    srcData = conf[type]![value.deploySrc.dkrhub] as DkrValue;
    if (!srcData) {
      log.warn(message.noDkrhub);
      return;
    }
  } else if (src === value.deploySrc.ghcr) {
    srcData = conf[type]![value.deploySrc.ghcr] as DkrValue;
    if (!srcData) {
      log.warn(message.noGhcr);
      return;
    }
    if (!srcData.image) {
      throw new Error();
    }
  } else if (src === value.deploySrc.repo) {
    if (!conf.git) {
      throw new Error();
    }
    srcData = conf[conf.git] as GitSvcValue;
    if (!srcData) {
      log.warn(message.noGit);
      return;
    }
    if (!srcData.repo) {
      throw new Error();
    }
  } else {
    throw new Error();
  }
  return { name, src, srcData };
};

const authRender = async (s: Spinner) => {
  const { token } = await auth(
    { token: tokenKey },
    {},
    message.token,
    tokenUrl,
    s,
  );
  if (!token) {
    throw new Error();
  }
  return { token };
};

const createRender = async (
  name: string,
  token: string,
  src: DeploySrc,
  srcData: SrcData,
) => {
  const api = create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  const ownerId = await getOwner(api);
  let cred, src0, runtime;
  if (src === value.deploySrc.dkrhub || src === value.deploySrc.ghcr) {
    cred = await getDkrCred(api, ownerId, src, srcData as Docker);
    src0 = {
      image: {
        ownerId,
        imagePath:
          src === value.deploySrc.dkrhub
            ? dhImg
            : (srcData as DkrWithImg).image,
        registryCredentialId: cred,
      },
    };
    runtime = imgRuntime;
  } else if (src === value.deploySrc.repo) {
    // authed via render github app
    src0 = { repo: (srcData as GitSvc).repo };
    runtime = nodeRuntime;
  } else {
    throw new Error();
  }
  const {
    data: {
      service: { id: service },
    },
  } = await api.post(svcsEp, {
    ownerId,
    name,
    type: svcType,
    ...src0,
    serviceDetails: { runtime, plan, region, healthCheckPath },
    autoDeploy: "no",
  });
  if (typeof service !== "string") {
    throw new Error();
  }
  return { owner: ownerId, service, cred };
};

const getOwner = async (api: AxiosInstance) => {
  const owner = (await getConfig(ownerKey)) as string | undefined;
  if (owner) {
    return owner;
  }
  const {
    data: [
      {
        owner: { id },
      },
    ],
  } = await api.get(ownersEp);
  if (typeof id !== "string") {
    throw new Error();
  }
  await setConfig(ownerKey, id);
  return id;
};

const getDkrCred = async (
  api: AxiosInstance,
  ownerId: string,
  src: DeploySrc,
  docker: Docker,
) => {
  let key, name, registry;
  if (src === value.deploySrc.dkrhub) {
    key = dhCredKey;
    name = dhCredName;
    registry = dhReg;
  } else if (src === value.deploySrc.ghcr) {
    key = ghcrCredKey;
    name = ghcrCredName;
    registry = ghcrReg;
  } else {
    throw new Error();
  }
  const cred = (await getConfig(key)) as string | undefined;
  if (cred) {
    return cred;
  }
  const { data } = await api.get(credsEp, { params: { name } });
  const id =
    (data?.length && data[0].id) ||
    (
      await api.post(credsEp, {
        ownerId,
        name,
        registry,
        username: docker.user,
        authToken: docker.readToken,
      })
    ).data.id;
  if (typeof id !== "string") {
    throw new Error();
  }
  await setConfig(key, id);
  return id;
};

const label = "Render.com" as const;

regValue(
  {
    name: value.deployment.render,
    label,
    skips: [
      {
        type: meta.plugin.type.frontend,
        option: meta.plugin.option.type.deployment,
      },
      { type: meta.plugin.type.frontend, option: option.deploySrc },
    ],
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
      run: run(meta.plugin.type.backend),
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.backend,
);
regValue(
  {
    name: value.deployment.render,
    label,
    skips: [],
    keeps: [],
    requires: [
      { option: meta.plugin.option.git },
      { option: meta.plugin.option.cicd },
    ],
    plugin: {
      name: `${meta.plugin.type.frontend}_${meta.plugin.option.type.deployment}_${value.deployment.render}`,
      label,
      pos: {
        mode: PosMode.after,
        refs: [
          `${meta.plugin.type.frontend}_${option.deploySrc}`,
          meta.plugin.option.git,
        ],
      },
      run: run(meta.plugin.type.frontend),
    },
  },
  meta.plugin.option.type.deployment,
  meta.plugin.type.frontend,
);

type DeploySrc = NonNullable<DeploySrcValue>;
type Docker = NonNullable<DkrValue>;
type DkrWithImg = Docker & { image: string };
type DeploySrcData = NonNullable<DeploySrcConf>;
type GitSvc = NonNullable<GitSvcValue> & { repo: string };
type GitData = NonNullable<GitConf>;
type SrcData = DeploySrcData | GitData;
type Spinner = ReturnType<typeof spinner>;

const ownerKey = "renderOwner" as const;
const dhCredKey = "renderDhCred" as const;
const ghcrCredKey = "renderGhcrCred" as const;
const tokenKey = "renderToken" as const;
const tokenUrl = "https://dashboard.render.com/u/settings#api-keys" as const;
const baseURL = "https://api.render.com/v1" as const;
const ownersEp = "/owners" as const;
const credsEp = "/registrycredentials" as const;
const svcsEp = "/services" as const;
const dhCredName = "bradhezh-create-prj-dh-img" as const;
const ghcrCredName = "bradhezh-create-prj-ghcr-img" as const;
const dhReg = "DOCKER" as const;
const ghcrReg = "GITHUB" as const;
const dhImg = "docker.io/library/alpine:latest" as const;
const svcType = "web_service" as const;
const imgRuntime = "image" as const;
const nodeRuntime = "node" as const;
const plan = "free" as const;
const region = "oregon" as const;
const healthCheckPath = "/api" as const;

const message = {
  ...msg,
  noDkrhub:
    "Cannot work as expected because the Docker hub plugin has not run successfully.",
  noGhcr:
    "Cannot work as expected because the Github container registry plugin has not run successfully.",
  noGit:
    "Cannot work as expected because the plugin for the Git option has not run successfully.",
  token:
    "API key needed to create a Render service, as well as for CI/CD.\nPress [ENTER] to open your browser and create an API key...\n",
  createRender: "Creating the service on Render.com",
} as const;
