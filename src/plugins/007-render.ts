import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { create, AxiosInstance } from "axios";
import { log, spinner } from "@clack/prompts";
import { format } from "node:util";

import {
  valid,
  option,
  value,
  RenderValue,
  DkrValue,
  GitSvcValue,
} from "./const";
import {
  regValue,
  meta,
  PosMode,
  NPM,
  Conf,
  Plugin,
  PrimeType,
} from "@/registry";
import { auth, getCfg, setCfg } from "@/command";
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

    const auth0 = await authRender(s);
    log.info(message.createRender);
    const render = await createRender({ ...conf0, ...auth0 });
    setValue(conf, { ...conf0, ...auth0, ...render });

    log.info(format(message.pluginFinish, `${this.label} for the ${type}`));
    s.stop();
  };
};

const parseConf = (conf: Conf, type: PrimeType) => {
  const npm = conf.npm;
  if (npm !== NPM.npm && npm !== NPM.pnpm) {
    throw new Error();
  }
  const name = conf[conf.type as PrimeType]?.name;
  if (!name) {
    throw new Error();
  }
  const deploy = parseDeploy(conf, type);
  if (!deploy) {
    return;
  }
  return { type, npm, name, ...deploy };
};

const parseDeploy = (conf: Conf, type: PrimeType) => {
  if (
    (type !== meta.plugin.type.backend && type !== meta.plugin.type.frontend) ||
    (conf.backend?.deployment === value.deployment.render &&
      conf.frontend?.deployment === value.deployment.render)
  ) {
    throw new Error();
  }
  const src = conf[type]![option.deploySrc];
  let srcData;
  if (src === value.deploySrc.dkrhub || src === value.deploySrc.ghcr) {
    srcData = conf[type]![src] as DkrValue;
    if (!srcData) {
      log.warn(message.noDkr);
      return;
    }
    if (src === value.deploySrc.ghcr && !srcData.image) {
      throw new Error();
    }
  } else if (src === value.deploySrc.repo) {
    if (!valid(conf.git)) {
      throw new Error();
    }
    srcData = conf[conf.git!] as GitSvcValue;
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
  const cwd = conf.type !== meta.plugin.type.monorepo ? "." : conf[type]?.name;
  if (!cwd) {
    throw new Error();
  }
  return { src, srcData, cwd };
};

const authRender = async (s: Spinner) => {
  const { token } = await auth(
    { token: tokenPath },
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

type RenderData = {
  name: string;
  src: string;
  srcData: SrcData;
  type: PrimeType;
  token: string;
  npm: NPM;
  cwd: string;
};

const createRender = async (data: RenderData) => {
  const { token } = data;
  const api = create({
    baseURL,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const owner = await getOwner(api);
  const cred = await getCred(api, owner, data);
  const service = await createSvc(api, owner, data, cred);
  await setEnvVars(api, service, data);
  return { owner, service, cred };
};

const getOwner = async (api: AxiosInstance) => {
  const owner = await getCfg(ownerPath);
  if (typeof owner !== "string" && typeof owner !== "undefined") {
    throw new Error();
  }
  if (owner) {
    return owner;
  }
  const {
    data: [
      {
        owner: { id },
      },
    ],
  } = await api.get<{ owner: { id: string } }[]>(ownersEp);
  if (typeof id !== "string") {
    throw new Error();
  }
  await setCfg(id, ownerPath);
  return id;
};

const getCred = async (
  api: AxiosInstance,
  ownerId: string,
  { src, srcData }: RenderData,
) => {
  let path, name, registry;
  if (src === value.deploySrc.dkrhub) {
    path = dhCredPath;
    name = dhCredName;
    registry = dhReg;
  } else if (src === value.deploySrc.ghcr) {
    path = ghcrCredPath;
    name = ghcrCredName;
    registry = ghcrReg;
  } else {
    return;
  }
  const cred = await getCfg(path);
  if (typeof cred !== "string" && typeof cred !== "undefined") {
    throw new Error();
  }
  if (cred) {
    return cred;
  }
  const { data } = await api.get<{ id: string }[]>(credsEp, {
    params: { name },
  });
  const docker = srcData as Docker;
  const id =
    (data?.length && data[0].id) ||
    (
      await api.post<{ id: string }>(credsEp, {
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
  await setCfg(id, path);
  return id;
};

const createSvc = async (
  api: AxiosInstance,
  ownerId: string,
  { name, src, srcData, type, npm, cwd }: RenderData,
  registryCredentialId: string | undefined,
) => {
  let src0, type0, detail;
  if (src === value.deploySrc.dkrhub || src === value.deploySrc.ghcr) {
    src0 = {
      image: {
        ownerId,
        imagePath:
          src === value.deploySrc.dkrhub ? dhImg : (srcData as Docker).image!,
        registryCredentialId,
      },
    };
    type0 = { type: webSvc };
    detail = {
      serviceDetails: {
        runtime: imgRuntime,
        plan: free,
        region: oregon,
        healthCheckPath,
      },
    };
  } else if (src === value.deploySrc.repo) {
    src0 = { repo: (srcData as GitSvc).repo! };
    if (type === meta.plugin.type.backend) {
      type0 = { type: webSvc };
      detail = {
        serviceDetails: {
          runtime: nodeRuntime,
          buildCommand: format(buildCommand, npm, npm),
          startCommand: format(startCommand, npm),
          plan: free,
          region: oregon,
          healthCheckPath,
        },
      };
    } else if (type === meta.plugin.type.frontend) {
      type0 = { type: staticSite };
      detail = {
        serviceDetails: {
          buildCommand: format(buildCommand, npm, npm),
          publishPath: format(publishPath, cwd),
        },
      };
    } else {
      throw new Error();
    }
  } else {
    throw new Error();
  }
  const {
    data: {
      service: { id: service },
    },
  } = await api.post<{ service: { id: string } }>(svcsEp, {
    ownerId,
    name,
    ...src0,
    ...type0,
    ...detail,
    autoDeploy: "no",
  });
  if (typeof service !== "string") {
    throw new Error();
  }
  return service;
};

const setEnvVars = async (
  api: AxiosInstance,
  service: string,
  { type, cwd }: RenderData,
) => {
  if (type === meta.plugin.type.backend) {
    const lines = (
      await readFile(join(cwd, env), "utf-8").catch(() => "")
    ).split(/\r?\n/);
    for (const line of lines) {
      if (!line || line.startsWith("#") || line.startsWith("PORT")) {
        continue;
      }
      const [name, ...parts] = line.split("=");
      const key = name.trim();
      const value = parts.join("=").trim();
      if (!key || !value) {
        continue;
      }
      await api.put(format(envVarEp, service, key), { value });
    }
  }
};

type Value = { type: PrimeType } & NonNullable<RenderValue>;

const setValue = (conf: Conf, { type, owner, service, token, cred }: Value) => {
  (conf[type]![value.deployment.render] as RenderValue) = {
    owner,
    service,
    token,
    cred,
  };
};

const label = "Render.com" as const;

for (const { type, skips } of [
  {
    type: meta.plugin.type.backend,
    skips: [
      {
        type: meta.plugin.type.frontend,
        option: meta.plugin.option.type.deployment,
      },
      { type: meta.plugin.type.frontend, option: option.deploySrc },
      {
        type: meta.plugin.type.lib,
        option: meta.plugin.option.type.deployment,
      },
      {
        type: meta.plugin.type.cli,
        option: meta.plugin.option.type.deployment,
      },
    ],
  },
  {
    type: meta.plugin.type.frontend,
    skips: [
      {
        type: meta.plugin.type.lib,
        option: meta.plugin.option.type.deployment,
      },
      {
        type: meta.plugin.type.cli,
        option: meta.plugin.option.type.deployment,
      },
    ],
  },
]) {
  regValue(
    {
      name: value.deployment.render,
      label,
      skips,
      keeps: [],
      requires: [
        { option: meta.plugin.option.git },
        { option: meta.plugin.option.cicd },
      ],
      plugin: {
        name: `${type}_${meta.plugin.option.type.deployment}_${value.deployment.render}`,
        label,
        pos: {
          mode: PosMode.after,
          refs: [`${type}_${option.deploySrc}`, meta.plugin.option.git],
        },
        run: run(type),
      },
    },
    meta.plugin.option.type.deployment,
    type,
  );
}

type Docker = NonNullable<DkrValue>;
type GitSvc = NonNullable<GitSvcValue>;
type SrcData = Docker | GitSvc;
type Spinner = ReturnType<typeof spinner>;

const ownerPath = "render.owner" as const;
const dhCredPath = "render.credential.docker-hub" as const;
const ghcrCredPath = "render.credential.github-cr" as const;
const tokenPath = "render.token" as const;
const tokenUrl = "https://dashboard.render.com/u/settings#api-keys" as const;
const baseURL = "https://api.render.com/v1" as const;
const ownersEp = "/owners" as const;
const credsEp = "/registrycredentials" as const;
const svcsEp = "/services" as const;
const envVarEp = "/services/%s/env-vars/%s" as const;
const dhCredName = "bradhezh-create-prj-dkrhub-img" as const;
const ghcrCredName = "bradhezh-create-prj-ghcr-img" as const;
const dhReg = "DOCKER" as const;
const ghcrReg = "GITHUB" as const;
const dhImg = "docker.io/library/alpine:latest" as const;
const webSvc = "web_service" as const;
const staticSite = "static_site" as const;
const imgRuntime = "image" as const;
const nodeRuntime = "node" as const;
const buildCommand = "%s i && %s build" as const;
const startCommand = "%s start" as const;
const publishPath = "%s/dist" as const;
const free = "free" as const;
const oregon = "oregon" as const;
const healthCheckPath = "/health-check" as const;
const env = ".env" as const;

const message = {
  ...msg,
  noDkr:
    "Cannot work as expected because the docker plugin has not run successfully.",
  noGit:
    "Cannot work as expected because the plugin for the Git option has not run successfully.",
  token:
    "API key needed to create a Render service, as well as for CI/CD.\nPress [ENTER] to open your browser and create an API key...\n",
  createRender: "Creating the service on Render.com",
} as const;
